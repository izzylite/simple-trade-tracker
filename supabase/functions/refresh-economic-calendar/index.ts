/**
 * Refresh Economic Calendar Edge Function (Standalone with CORS fix)
 * Replaces Firebase refreshEconomicCalendar callable function
 *
 * Manually refreshes economic calendar data for specific dates/currencies
 * by fetching from MyFXBook API and updating the database
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

// Utility functions
function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    },
  );
}

function successResponse(data: unknown, message?: string): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      ...(message && {
        message,
      }),
    }),
    {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    },
  );
}

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  return null;
}

function log(message: string, level: string = "info", context?: unknown): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  if (context) {
    if (level === "error") {
      console.error(logMessage, context);
    } else if (level === "warn") {
      console.warn(logMessage, context);
    } else {
      console.log(logMessage, context);
    }
  } else {
    if (level === "error") {
      console.error(logMessage);
    } else if (level === "warn") {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
  }
}

async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch (error) {
    log("Failed to parse JSON body", "error", error);
    return null;
  }
}
/**
 * Fetch weekly economic calendar data from MyFXBook
 */ async function fetchFromMyFXBookWeekly(): Promise<
  Record<string, unknown>[]
> {
  try {
    log("🔄 Fetching weekly economic calendar from MyFXBook...");
    const url = "https://www.myfxbook.com/forex-economic-calendar";
    log(`📡 Fetching URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const html = await response.text();
    log(
      `✅ Response received: ${response.status}, content length: ${html.length}`,
    );
    // Call the process-economic-events function to parse the HTML
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    // For internal edge function calls, use both apikey and Authorization headers
    const processResponse = await fetch(
      `${supabaseUrl}/functions/v1/process-economic-events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          htmlContent: html,
        }),
      },
    );
    if (!processResponse.ok) {
      throw new Error(
        `Process function failed: ${await processResponse.text()}`,
      );
    }
    const processResult = await processResponse.json() as Record<
      string,
      unknown
    >;
    const stats = (processResult.data as Record<string, unknown>) ||
      processResult;
    const extracted = (stats.parsed_total as number) ??
      ((stats.events as Record<string, unknown>[])?.length || 0);
    log(
      `🎯 Successfully extracted ${extracted} events from MyFXBook (upserted=${
        stats.upserted_count ?? 0
      }, existing=${stats.existing_count ?? 0})`,
    );
    return (stats.events as Record<string, unknown>[]) || [];
  } catch (error) {
    log("❌ Error fetching from MyFXBook:", "error", error);
    throw error;
  }
}
/**
 * Update events in database
 */ async function updateEventsInDatabase(
  events: Record<string, unknown>[],
): Promise<number> {
  try {
    if (events.length === 0) {
      return 0;
    }
    log(`Updating ${events.length} events in database`);
    const supabase = createServiceClient();
    let updatedCount = 0;
    for (const e of events) {
      const normalizeImpact = (impact: unknown): string => {
        const i = (impact as string || "").toLowerCase();
        if (i === "high") return "High";
        if (i === "medium") return "Medium";
        if (i === "low") return "Low";
        return "Low";
      };
      // Skip events with missing required fields
      if (!e.event_name || !e.currency) {
        log(
          `Skipping event ${e.external_id} - missing event_name or currency`,
          "warn",
        );
        continue;
      }
      // Build row with only non-null value fields to avoid overwriting existing data
      const row: Record<string, unknown> = {
        external_id: e.external_id,
        currency: e.currency,
        event_name: e.event_name,
        impact: normalizeImpact(e.impact),
        event_date: e.event_date || e.date,
        event_time: e.time_utc
          ? new Date(e.time_utc as string).toISOString()
          : null,
        time_utc: e.time_utc ?? null,
        unix_timestamp: e.unix_timestamp ?? null,
        country: e.country ?? null,
        flag_code: e.flag_code ?? null,
        flag_url: e.flag_url ?? null,
        source_url: "https://www.myfxbook.com/forex-economic-calendar",
        data_source: e.source ?? "myfxbook",
        last_updated: new Date().toISOString(),
      };
      // Only include value fields if they have data - prevents overwriting existing values with null
      if (e.actual) row.actual_value = e.actual;
      if (e.forecast) row.forecast_value = e.forecast;
      if (e.previous) row.previous_value = e.previous;
      // Also check for _value suffixed properties (from process-economic-events)
      if (e.actual_value) row.actual_value = e.actual_value;
      if (e.forecast_value) row.forecast_value = e.forecast_value;
      if (e.previous_value) row.previous_value = e.previous_value;
      const { data, error } = await supabase.from("economic_events").upsert(
        row,
        {
          onConflict: "external_id",
        },
      ).select("external_id");
      if (error) {
        log(`Error updating event ${e.external_id}`, "error", error);
      } else {
        updatedCount += (data as Record<string, unknown>[])?.length || 0;
      }
    }
    log(`Updated ${updatedCount} events in database`);
    return updatedCount;
  } catch (error) {
    log("Error updating events in database", "error", error);
    throw error;
  }
}
interface RefreshPayload {
  targetDate: string;
  currencies: string[];
  events?: Record<string, unknown>[];
}

/**
 * Main Edge Function handler
 */ Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    log("Refresh economic calendar request received");
    // Parse request body
    const payload = await parseJsonBody(req) as RefreshPayload;
    if (!payload) {
      return errorResponse("Invalid JSON payload", 400);
    }
    const { targetDate, currencies, events: requestedEvents } = payload;
    // Validate required parameters
    if (!targetDate || !currencies || !Array.isArray(currencies)) {
      return errorResponse(
        "Missing required parameters: targetDate and currencies array",
        400,
      );
    }
    const hasSpecificEvents = requestedEvents && requestedEvents.length > 0;
    log(
      `🔄 Refreshing economic calendar for date: ${targetDate}, currencies: ${
        currencies.join(", ")
      }`,
    );
    if (hasSpecificEvents) {
      log(
        `🎯 Looking for ${requestedEvents.length} specific event(s): ${
          requestedEvents.map((e) => (e as Record<string, unknown>).event).join(
            ", ",
          )
        }`,
      );
    }
    let updated = false;
    let count = 0;
    const maxRetries = 5;
    let allEventsForDate: Record<string, unknown>[] = [];
    let foundEvents: Record<string, unknown>[] = [];
    while (!updated && count < maxRetries) {
      const freshEvents = await fetchFromMyFXBookWeekly();
      allEventsForDate = freshEvents.filter((event) => {
        const eventDate =
          new Date(event.time_utc as string).toISOString().split("T")[0];
        return eventDate === targetDate &&
          currencies.includes(event.currency as string);
      });
      if (hasSpecificEvents) {
        const requestedEventIds = requestedEvents.map((e) =>
          (e as Record<string, unknown>).external_id
        );
        // Events from MyFXBook have 'id' field, not 'external_id'
        foundEvents = allEventsForDate.filter((event) =>
          requestedEventIds.includes(event.id || event.external_id)
        );
        log(
          `📊 Found ${foundEvents.length}/${requestedEvents.length} requested events in ${allEventsForDate.length} total events`,
        );
        let hasUpdates = false;
        for (const foundEvent of foundEvents) {
          const eventId = foundEvent.id || foundEvent.external_id;
          const originalEvent = requestedEvents.find((e) =>
            (e as Record<string, unknown>).external_id === eventId
          );
          if (
            originalEvent &&
            foundEvent.actual !==
              (originalEvent as Record<string, unknown>).actual
          ) {
            hasUpdates = true;
            log(`✅ Event updated: ${foundEvent.event}`);
          }
        }
        if (hasUpdates) {
          updated = true;
          break;
        }
        if (foundEvents.length === 0 || count >= maxRetries) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, (count + 1) * 1000));
        count++;
      } else {
        updated = true;
        break;
      }
    }
    const updatedCount = await updateEventsInDatabase(allEventsForDate);
    log(`✅ Successfully updated ${updatedCount} economic events`);
    const response: Record<string, unknown> = {
      success: true,
      updatedCount,
      targetEvents: allEventsForDate,
      foundEvents,
      targetDate,
      currencies,
      requestedEvents: requestedEvents || [],
      hasSpecificEvents,
      message: hasSpecificEvents
        ? `Updated ${updatedCount} events for ${targetDate}. Found ${foundEvents.length}/${requestedEvents.length} requested events.`
        : `Updated ${updatedCount} events for ${targetDate}.`,
    };
    return successResponse(response);
  } catch (error) {
    log("Error refreshing economic calendar", "error", error);
    return errorResponse("Internal server error", 500);
  }
});
