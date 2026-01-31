/**
 * Refresh Economic Calendar Edge Function
 * Bulk fetches economic calendar data from multiple sources (MQL5, MyFXBook)
 *
 * PURPOSE: Cron-scheduled bulk refresh only
 * For on-demand individual event fetches, use fetch-mql5-event function instead
 *
 * Called by cron job: Sunday and Wednesday at 3 AM UTC
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchFromMQL5Weekly } from './mql5-extractor.ts'

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

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
    JSON.stringify({ success: false, error: message }),
    { status, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
}

function successResponse(data: unknown, message?: string): Response {
  return new Response(
    JSON.stringify({ success: true, data, ...(message && { message }) }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
}

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

function log(message: string, level: string = "info", context?: unknown): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  if (context) {
    if (level === "error") console.error(logMessage, context);
    else if (level === "warn") console.warn(logMessage, context);
    else console.log(logMessage, context);
  } else {
    if (level === "error") console.error(logMessage);
    else if (level === "warn") console.warn(logMessage);
    else console.log(logMessage);
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
 * Uses ScraperAPI proxy to bypass anti-bot protection
 */
async function fetchFromMyFXBookWeekly(): Promise<Record<string, unknown>[]> {
  try {
    log("Fetching weekly calendar from MyFXBook...");
    const targetUrl = "https://www.myfxbook.com/forex-economic-calendar";
    const scraperApiKey = Deno.env.get("SCRAPER_API_KEY");

    // Use ScraperAPI if key is available, otherwise try direct fetch
    let fetchUrl: string;
    if (scraperApiKey) {
      fetchUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}`;
      log("Using ScraperAPI proxy for MyFXBook");
    } else {
      fetchUrl = targetUrl;
      log("No SCRAPER_API_KEY found, attempting direct fetch");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // Longer timeout for proxy

    let response: Response;
    try {
      response = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: scraperApiKey ? {} : {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Cache-Control": "no-cache",
        },
      });
    } catch (fetchError) {
      if ((fetchError as Error).name === 'AbortError') {
        throw new Error("MyFXBook request timed out after 45 seconds");
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`MyFXBook HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    log(`MyFXBook response: ${response.status}, length: ${html.length}`);

    // Call the process-economic-events function to parse the HTML
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const processResponse = await fetch(
      `${supabaseUrl}/functions/v1/process-economic-events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ htmlContent: html }),
      },
    );

    if (!processResponse.ok) {
      throw new Error(`Process function failed: ${await processResponse.text()}`);
    }

    const processResult = await processResponse.json() as Record<string, unknown>;
    const stats = (processResult.data as Record<string, unknown>) || processResult;
    const extracted = (stats.parsed_total as number) ??
      ((stats.events as Record<string, unknown>[])?.length || 0);

    log(`Extracted ${extracted} events from MyFXBook`);
    return (stats.events as Record<string, unknown>[]) || [];
  } catch (error) {
    log("Error fetching from MyFXBook", "error", error);
    throw error;
  }
}

/**
 * Update events in database
 */
async function updateEventsInDatabase(events: Record<string, unknown>[]): Promise<number> {
  if (events.length === 0) return 0;

  log(`Updating ${events.length} events in database`);
  const supabase = createServiceClient();
  let updatedCount = 0;

  const normalizeImpact = (impact: unknown): string => {
    const i = (impact as string || "").toLowerCase();
    if (i === "high") return "High";
    if (i === "medium") return "Medium";
    if (i === "low") return "Low";
    return "Low";
  };

  for (const e of events) {
    if (!e.event_name || !e.currency) {
      log(`Skipping event ${e.external_id} - missing required fields`, "warn");
      continue;
    }

    const row: Record<string, unknown> = {
      external_id: e.external_id,
      currency: e.currency,
      event_name: e.event_name,
      impact: normalizeImpact(e.impact),
      event_date: e.event_date || e.date,
      event_time: e.time_utc ? new Date(e.time_utc as string).toISOString() : null,
      time_utc: e.time_utc ?? null,
      unix_timestamp: e.unix_timestamp ?? null,
      country: e.country ?? null,
      flag_code: e.flag_code ?? null,
      flag_url: e.flag_url ?? null,
      actual_result_type: e.actual_result_type ?? null,
      source_url: e.source === "mql5"
        ? "https://www.mql5.com/en/economic-calendar"
        : "https://www.myfxbook.com/forex-economic-calendar",
      data_source: e.source ?? "myfxbook",
      last_updated: new Date().toISOString(),
    };

    // Only include value fields if present
    if (e.actual) row.actual_value = e.actual;
    if (e.forecast) row.forecast_value = e.forecast;
    if (e.previous) row.previous_value = e.previous;
    if (e.actual_value) row.actual_value = e.actual_value;
    if (e.forecast_value) row.forecast_value = e.forecast_value;
    if (e.previous_value) row.previous_value = e.previous_value;

    const { data, error } = await supabase
      .from("economic_events")
      .upsert(row, { onConflict: "external_id" })
      .select("external_id");

    if (error) {
      log(`Error updating event ${e.external_id}`, "error", error);
    } else {
      updatedCount += (data as Record<string, unknown>[])?.length || 0;
    }
  }

  log(`Updated ${updatedCount} events in database`);
  return updatedCount;
}

// No required payload - fetches and saves all events
interface RefreshPayload {
  // Optional parameters for future use
}

/**
 * Main Edge Function handler
 * Simplified for cron-only bulk refresh (no on-demand event handling)
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    log("Bulk refresh economic calendar request received");

    // Parse payload (optional, no required parameters)
    await parseJsonBody(req);

    log(`Bulk refreshing economic calendar - fetching all events`);

    let freshEvents: Record<string, unknown>[] = [];
    let dataSource = "unknown";

    // Try MyFXBook first (via ScraperAPI), fallback to MQL5
    try {
      log("Attempting to fetch from MyFXBook...");
      freshEvents = await fetchFromMyFXBookWeekly();
      dataSource = "myfxbook";
      log(`MyFXBook returned ${freshEvents.length} events`);
    } catch (myfxbookError) {
      log("MyFXBook failed, trying MQL5...", "warn", myfxbookError);
      try {
        freshEvents = await fetchFromMQL5Weekly();
        dataSource = "mql5";
        log(`MQL5 returned ${freshEvents.length} events`);
      } catch (mql5Error) {
        log("Both sources failed", "error", { myfxbookError, mql5Error });
        throw new Error(`All data sources failed`);
      }
    }

    const impactCounts = {
      high: freshEvents.filter(e => e.impact === 'High').length,
      medium: freshEvents.filter(e => e.impact === 'Medium').length,
      low: freshEvents.filter(e => e.impact === 'Low').length,
    };

    const updatedCount = await updateEventsInDatabase(freshEvents);
    log(`Successfully updated ${updatedCount} economic events`);

    return successResponse({
      updatedCount,
      dataSource,
      impactCounts,
      totalEvents: freshEvents.length,
      message: `Bulk updated ${updatedCount} events from ${dataSource}.`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log("Error refreshing economic calendar", "error", { message: errorMessage });
    return errorResponse(`Refresh failed: ${errorMessage}`, 500);
  }
});
