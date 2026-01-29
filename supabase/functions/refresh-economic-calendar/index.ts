/**
 * Refresh Economic Calendar Edge Function (Standalone with CORS fix)
 * Replaces Firebase refreshEconomicCalendar callable function
 *
 * Manually refreshes economic calendar data for specific dates/currencies
 * by fetching from multiple sources (MQL5, MyFXBook) with fallback
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


// Currency to Country/Flag mapping
const currencyMapping: Record<string, { country: string; flag_code: string }> = {
  USD: { country: "United States", flag_code: "us" },
  EUR: { country: "Euro Area", flag_code: "eu" },
  GBP: { country: "United Kingdom", flag_code: "gb" },
  JPY: { country: "Japan", flag_code: "jp" },
  AUD: { country: "Australia", flag_code: "au" },
  NZD: { country: "New Zealand", flag_code: "nz" },
  CAD: { country: "Canada", flag_code: "ca" },
  CHF: { country: "Switzerland", flag_code: "ch" },
  CNY: { country: "China", flag_code: "cn" },
  HKD: { country: "Hong Kong", flag_code: "hk" },
  SGD: { country: "Singapore", flag_code: "sg" },
  INR: { country: "India", flag_code: "in" },
  KRW: { country: "South Korea", flag_code: "kr" },
  MXN: { country: "Mexico", flag_code: "mx" },
  BRL: { country: "Brazil", flag_code: "br" },
  ZAR: { country: "South Africa", flag_code: "za" },
  SEK: { country: "Sweden", flag_code: "se" },
  NOK: { country: "Norway", flag_code: "no" },
  DKK: { country: "Denmark", flag_code: "dk" },
  PLN: { country: "Poland", flag_code: "pl" },
  TRY: { country: "Turkey", flag_code: "tr" },
  RUB: { country: "Russia", flag_code: "ru" },
};

/**
 * Clean HTML entities and normalize value strings
 */
function cleanHtmlEntities(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/&#xA0;/g, ' ')      // non-breaking space
    .replace(/&#x27;/g, "'")       // apostrophe
    .replace(/&amp;/g, '&')        // ampersand
    .replace(/&lt;/g, '<')         // less than
    .replace(/&gt;/g, '>')         // greater than
    .replace(/&quot;/g, '"')       // quote
    .replace(/\u00A0/g, ' ')       // unicode non-breaking space
    .replace(/\s+/g, ' ')          // multiple spaces to single
    .trim();
}

// Cache for event data (event URL path -> { impact, actual_result_type })
interface EventMetadata {
  impact: string;
  actual_result_type: 'good' | 'bad' | '';
}
const eventMetadataCache: Map<string, EventMetadata> = new Map();

/**
 * Fetch impact level AND actual_result_type from individual MQL5 event page
 * Returns { impact: 'High'|'Medium'|'Low', actual_result_type: 'good'|'bad'|'' }
 */
async function fetchEventMetadata(eventPath: string): Promise<EventMetadata> {
  // Check cache first
  if (eventMetadataCache.has(eventPath)) {
    return eventMetadataCache.get(eventPath)!;
  }

  const defaultResult: EventMetadata = { impact: 'Low', actual_result_type: '' };

  try {
    const url = `https://www.mql5.com${eventPath}`;

    // Add timeout for individual fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      eventMetadataCache.set(eventPath, defaultResult);
      return defaultResult;
    }

    const html = await response.text();

    // Extract IMPACT
    // MQL5 event pages have: <td class="event-table__importance high">High</td>
    let impact = 'Medium'; // Default
    const impactMatch = html.match(/event-table__importance\s+(high|medium|low)/i);
    if (impactMatch) {
      const level = impactMatch[1].toLowerCase();
      impact = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';
    } else {
      // Fallback patterns
      const ecTableMatch = html.match(/ec-table__importance_(\w+)/);
      if (ecTableMatch) {
        const level = ecTableMatch[1].toLowerCase();
        if (level === 'high' || level === 'medium' || level === 'low') {
          impact = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';
        }
      }
    }

    // Extract actual_result_type (green = good/better than expected, red = bad/worse than expected)
    // MQL5 event pages have: <td class="event-table__actual green">value</td>
    let actual_result_type: 'good' | 'bad' | '' = '';
    const resultMatch = html.match(/event-table__actual\s+(green|red)/i);
    if (resultMatch) {
      const color = resultMatch[1].toLowerCase();
      actual_result_type = color === 'green' ? 'good' : 'bad';
    }

    const result: EventMetadata = { impact, actual_result_type };
    eventMetadataCache.set(eventPath, result);
    return result;
  } catch (error) {
    log(`Failed to fetch event metadata for ${eventPath}`, 'warn', error);
    eventMetadataCache.set(eventPath, defaultResult);
    return defaultResult;
  }
}

/**
 * Batch fetch impact and actual_result_type for multiple event URLs
 * Limits concurrent requests and caches results
 */
async function batchFetchEventMetadata(eventPaths: string[]): Promise<Map<string, EventMetadata>> {
  const uniquePaths = [...new Set(eventPaths)].filter(p => !eventMetadataCache.has(p));
  log(`Fetching metadata for ${uniquePaths.length} unique event pages (${eventMetadataCache.size} already cached)...`);

  // Limit to 5 concurrent requests to avoid rate limiting
  const batchSize = 5;
  const results = new Map<string, EventMetadata>();
  let successCount = 0;

  for (let i = 0; i < uniquePaths.length; i += batchSize) {
    const batch = uniquePaths.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (path) => {
        const metadata = await fetchEventMetadata(path);
        return { path, metadata };
      })
    );

    for (const { path, metadata } of batchResults) {
      results.set(path, metadata);
      successCount++;
    }

    // Log progress every 50 paths
    if ((i + batchSize) % 50 === 0 || i + batchSize >= uniquePaths.length) {
      log(`Progress: ${Math.min(i + batchSize, uniquePaths.length)}/${uniquePaths.length} (${successCount} fetched)`);
    }

    // Longer delay between batches to avoid rate limiting
    if (i + batchSize < uniquePaths.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Merge cached results (for paths that were already cached before this call)
  eventMetadataCache.forEach((metadata, path) => {
    if (!results.has(path)) {
      results.set(path, metadata);
    }
  });

  log(`Batch fetch complete: ${results.size} total paths with metadata (${successCount} new)`);
  return results;
}

/**
 * Extract impact level from ec-table__importance class
 * MQL5 uses: ec-table__importance_high, ec-table__importance_medium, ec-table__importance_low
 */
function extractMQL5Impact(rowHtml: string): string {
  // Look for importance class: ec-table__importance_high, _medium, _low
  const importanceMatch = rowHtml.match(/ec-table__importance_(\w+)/);
  if (importanceMatch) {
    const level = importanceMatch[1].toLowerCase();
    if (level === 'high') return 'High';
    if (level === 'medium' || level === 'moderate') return 'Medium';
    if (level === 'low') return 'Low';
    if (level === 'none' || level === 'holiday') return 'Holiday';
  }

  // Fallback to Low if no importance class found
  return 'Low';
}

/**
 * Parse MQL5 event from table format HTML
 * Structure: ec-table__item with columns for time, currency, event, actual, forecast, previous
 * Impact: ec-table__importance_high/medium/low
 * Sentiment: green/red class on ec-table__col_actual
 */
function parseMQL5TableEvent(itemHtml: string, eventDate: string): Record<string, unknown> | null {
  try {
    // Extract impact from ec-table__importance class
    const impactMatch = itemHtml.match(/ec-table__importance_(\w+)/);
    const impact = impactMatch ?
      (impactMatch[1] === 'high' ? 'High' :
       impactMatch[1] === 'medium' ? 'Medium' :
       impactMatch[1] === 'low' ? 'Low' : 'Low') : 'Medium';

    // Extract time from ec-table__col_time
    const timeMatch = itemHtml.match(/ec-table__col_time[^>]*>.*?<div>(\d{2}:\d{2})<\/div>/s);
    const timePart = timeMatch ? timeMatch[1] : null;
    if (!timePart) return null;

    // Extract currency from ec-table__col_currency
    const currencyMatch = itemHtml.match(/ec-table__curency-name[^>]*>(\w{3})<\/div>/);
    const currency = currencyMatch ? currencyMatch[1] : null;
    if (!currency) return null;

    // Extract event name from ec-table__col_event link
    const eventMatch = itemHtml.match(/ec-table__col_event[^>]*>.*?<a[^>]*>([^<]+)<\/a>/s);
    const eventName = eventMatch ? eventMatch[1].trim() : null;
    if (!eventName) return null;

    // Extract actual value and sentiment (green/red class)
    // HTML format: <div class="ec-table__col ec-table__col_actual  green"><span>value</span></div>
    // Note: there can be double spaces before green/red
    const actualColMatch = itemHtml.match(/ec-table__col_actual\s*(green|red)?[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s);
    const actualSentiment = actualColMatch?.[1] || null;  // 'green', 'red', or null
    const actualValue = actualColMatch ? cleanHtmlEntities(actualColMatch[2]) : null;

    // Extract forecast value
    const forecastMatch = itemHtml.match(/ec-table__col_forecast[^>]*>([^<]+)</);
    const forecastValue = forecastMatch ? cleanHtmlEntities(forecastMatch[1]) : null;

    // Extract previous value
    const previousMatch = itemHtml.match(/ec-table__col_previous[^>]*>.*?(?:<div[^>]*>)?([^<]+)(?:<\/div>)?/s);
    const previousValue = previousMatch ? cleanHtmlEntities(previousMatch[1]) : null;

    // Parse date/time
    const [year, month, day] = eventDate.split('-');
    const [hour, minute] = timePart.split(':');
    const timeUtc = new Date(Date.UTC(
      parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour), parseInt(minute)
    )).toISOString();

    // Generate external_id
    const externalId = `mql5_${eventDate.replace(/-/g, '')}_${timePart.replace(':', '')}_${currency}_${eventName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`;

    // Get country and flag from currency mapping
    const mapping = currencyMapping[currency] || { country: null, flag_code: null };
    const flagUrl = mapping.flag_code ? `https://flagcdn.com/w160/${mapping.flag_code}.png` : null;

    return {
      external_id: externalId,
      event_name: eventName,
      currency: currency,
      time_utc: timeUtc,
      event_date: eventDate,
      actual_value: actualValue,
      forecast_value: forecastValue,
      previous_value: previousValue,
      impact: impact,
      sentiment: actualSentiment,  // 'green', 'red', or null
      country: mapping.country,
      flag_code: mapping.flag_code,
      flag_url: flagUrl,
      source: 'mql5',
    };
  } catch (error) {
    log("Error parsing MQL5 table event", "warn", { itemHtml: itemHtml.substring(0, 200), error });
    return null;
  }
}

/**
 * Parse MQL5 event from inline format (fallback)
 * Format: "2026.01.26 13:30, USD, Event Name, Actual: X, Forecast: Y, Previous: Z"
 * Returns event data including event_path for fetching impact
 */
function parseMQL5InlineEvent(rowHtml: string): Record<string, unknown> | null {
  try {
    // Find the inline item div within the row
    const inlineMatch = rowHtml.match(/<div class="ec-table__item ec-table__item_inline"[^>]*>(.*?)<\/div>/s);
    if (!inlineMatch) return null;

    const line = inlineMatch[0];
    const fullContent = line.replace(/<[^>]+>/g, ' ').trim();

    // Extract the event name and path from the <a> tag
    // Format: <a href="/en/economic-calendar/country/event-name">Event Name</a>
    const linkMatch = line.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    const eventPath = linkMatch ? linkMatch[1] : null;
    const eventName = linkMatch ? linkMatch[2].trim() : null;

    // Debug logging
    if (!linkMatch) {
      log(`No link found in inline event: ${line.substring(0, 200)}`, 'warn');
    }

    // If no link (e.g., holidays), try to extract event name from text
    if (!eventName) {
      // Try to extract text after the currency code
      const textMatch = fullContent.match(/\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2},\s*\w{3},\s*([^,]+)/);
      if (textMatch) {
        // This might be a holiday or event without link
        return null;  // Skip events without links for now
      }
      return null;
    }

    // Parse the inline format: "2026.01.26 13:30, USD, ..."
    const dateTimeMatch = fullContent.match(/(\d{4}\.\d{2}\.\d{2})\s+(\d{2}:\d{2}),\s*(\w{3}),/);
    if (!dateTimeMatch) return null;

    const datePart = dateTimeMatch[1];
    const timePart = dateTimeMatch[2];
    const currency = dateTimeMatch[3];

    const [year, month, day] = datePart.split('.');
    const [hour, minute] = timePart.split(':');
    const timeUtc = new Date(Date.UTC(
      parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour), parseInt(minute)
    )).toISOString();

    const actualMatch = fullContent.match(/Actual:\s*([^,]+?)(?:,|$)/);
    const forecastMatch = fullContent.match(/Forecast:\s*([^,]+?)(?:,|$)/);
    const previousMatch = fullContent.match(/Previous:\s*([^,\s]+)/);

    const cleanValue = (val: string | undefined): string | null => {
      if (!val) return null;
      return cleanHtmlEntities(val.trim());
    };

    const externalId = `mql5_${datePart.replace(/\./g, '')}_${timePart.replace(':', '')}_${currency}_${eventName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`;
    const mapping = currencyMapping[currency] || { country: null, flag_code: null };
    const flagUrl = mapping.flag_code ? `https://flagcdn.com/w160/${mapping.flag_code}.png` : null;

    return {
      external_id: externalId,
      event_name: cleanHtmlEntities(eventName) || eventName,
      currency: currency,
      time_utc: timeUtc,
      event_date: `${year}-${month}-${day}`,
      actual_value: cleanValue(actualMatch?.[1]),
      forecast_value: cleanValue(forecastMatch?.[1]),
      previous_value: cleanValue(previousMatch?.[1]),
      impact: 'Low',  // Default, will be updated by batch fetch
      event_path: eventPath,  // Store path for impact lookup
      country: mapping.country,
      flag_code: mapping.flag_code,
      flag_url: flagUrl,
      source: 'mql5',
    };
  } catch (error) {
    log("Error parsing MQL5 inline event", "warn", { rowHtml: rowHtml.substring(0, 200), error });
    return null;
  }
}

/**
 * Parse flexible date formats
 */
function parseFlexibleDate(dateText: string): string | null {
  // Try "January 29, 2026" format
  const longMatch = dateText.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (longMatch) {
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12'
    };
    const month = months[longMatch[1].toLowerCase()];
    if (month) {
      const day = longMatch[2].padStart(2, '0');
      return `${longMatch[3]}-${month}-${day}`;
    }
  }
  // Try "29.01.2026" format
  const shortMatch = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (shortMatch) {
    return `${shortMatch[3]}-${shortMatch[2]}-${shortMatch[1]}`;
  }
  // Try "2026-01-29" format
  const isoMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0];
  }
  return null;
}

/**
 * Fetch weekly economic calendar data from MQL5
 */
async function fetchFromMQL5Weekly(): Promise<Record<string, unknown>[]> {
  try {
    log("🔄 Fetching weekly economic calendar from MQL5...");
    const url = "https://www.mql5.com/en/economic-calendar";
    log(`📡 Fetching URL: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
      });
    } catch (fetchError) {
      if ((fetchError as Error).name === 'AbortError') {
        throw new Error(`MQL5 request timed out after 25 seconds`);
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`MQL5 HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    log(`✅ MQL5 response received: ${response.status}, content length: ${html.length}`);

    // Debug: Log if we have the table format with importance classes
    const hasImportanceClass = html.includes('ec-table__importance_');
    const hasTableFormat = html.includes('ec-table__col_time') && !html.includes('ec-table__item_inline');
    const hasInlineFormat = html.includes('ec-table__item_inline');
    log(`HTML format: importance=${hasImportanceClass}, table=${hasTableFormat}, inline=${hasInlineFormat}`);

    const events: Record<string, unknown>[] = [];
    let tableEventCount = 0;
    let inlineEventCount = 0;

    // Get current date as fallback
    const today = new Date().toISOString().split('T')[0];

    // Strategy 1: If server returned INLINE format (most common for server requests),
    // use inline parser which extracts event paths for impact lookup
    if (hasInlineFormat) {
      log(`Using INLINE format parser (server-side HTML detected)...`);

      const inlineMatches = html.matchAll(/<div class="ec-table__item ec-table__item_inline"[^>]*>[\s\S]*?<\/div>/g);
      for (const match of inlineMatches) {
        const parsed = parseMQL5InlineEvent(match[0]);
        if (parsed && parsed.currency && parsed.event_name) {
          events.push(parsed);
          inlineEventCount++;
        }
      }

      // Batch fetch impact levels from individual event pages
      // Only fetch for events with event_path (events with links)
      const eventPaths = events
        .map(e => e.event_path as string)
        .filter((path): path is string => !!path);

      log(`Events with paths: ${eventPaths.length}/${events.length}`);
      // NOTE: Impact fetching is deferred to after filtering to avoid fetching 281+ pages
      log(`Impact fetching deferred until after filtering (will fetch only for target events)`);
    }

    // Strategy 2: Parse TABLE format (browser HTML with importance classes)
    // Only try this if inline parsing found nothing (rare - only if browser HTML is returned)
    if (events.length === 0 && hasTableFormat) {
      log(`Trying TABLE format parser (browser HTML detected)...`);

      // Find date sections
      const dateMatches = html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"/g);
      const dates = [...dateMatches].map(m => m[1]);
      const dateHeaderMatches = html.matchAll(/ec-table__date[^>]*>([^<]+)</g);
      for (const match of dateHeaderMatches) {
        const parsedDate = parseFlexibleDate(match[1].trim());
        if (parsedDate && !dates.includes(parsedDate)) {
          dates.push(parsedDate);
        }
      }
      if (dates.length === 0) {
        dates.push(today);
      }

      // Split by non-inline table items
      const itemSegments = html.split(/<div class="ec-table__item(?=[^_]|$)/);
      let currentDate = today;

      for (let i = 1; i < itemSegments.length; i++) {
        const segment = itemSegments[i];
        if (segment.startsWith('_inline')) continue;

        const prevSegment = itemSegments[i - 1];
        const dateHeaderMatch = prevSegment.match(/ec-table__date[^>]*>([^<]+)</);
        if (dateHeaderMatch) {
          const parsedDate = parseFlexibleDate(dateHeaderMatch[1].trim());
          if (parsedDate) currentDate = parsedDate;
        }

        const itemHtml = '<div class="ec-table__item' + segment;
        let eventDate = currentDate;
        const datAttrMatch = itemHtml.match(/data-date="(\d{4}-\d{2}-\d{2})"/);
        if (datAttrMatch) eventDate = datAttrMatch[1];

        const parsed = parseMQL5TableEvent(itemHtml, eventDate);
        if (parsed && parsed.currency && parsed.event_name) {
          events.push(parsed);
          tableEventCount++;
        }
      }
    }

    log(`🎯 Extracted ${events.length} events from MQL5 (table: ${tableEventCount}, inline: ${inlineEventCount})`);

    return events;
  } catch (error) {
    log("❌ Error fetching from MQL5:", "error", error);
    throw error;
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

    // Add timeout to prevent indefinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
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
    } catch (fetchError) {
      if ((fetchError as Error).name === 'AbortError') {
        throw new Error(`MyFXBook request timed out after 25 seconds`);
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read response body');
      log(`MyFXBook returned HTTP ${response.status}: ${response.statusText}`, "error", {
        status: response.status,
        statusText: response.statusText,
        bodyPreview: errorBody.substring(0, 500)
      });
      throw new Error(`MyFXBook HTTP ${response.status}: ${response.statusText}`);
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
        actual_result_type: e.actual_result_type ?? null,
        source_url: e.source === "mql5"
          ? "https://www.mql5.com/en/economic-calendar"
          : "https://www.myfxbook.com/forex-economic-calendar",
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
    let dataSource = "unknown";

    while (!updated && count < maxRetries) {
      // Try MQL5 first, then fallback to MyFXBook
      let freshEvents: Record<string, unknown>[] = [];
      try {
        log("📡 Attempting to fetch from MQL5...");
        freshEvents = await fetchFromMQL5Weekly();
        dataSource = "mql5";
        log(`✅ MQL5 returned ${freshEvents.length} events`);
      } catch (mql5Error) {
        log("⚠️ MQL5 failed, trying MyFXBook...", "warn", mql5Error);
        try {
          freshEvents = await fetchFromMyFXBookWeekly();
          dataSource = "myfxbook";
          log(`✅ MyFXBook returned ${freshEvents.length} events`);
        } catch (myfxbookError) {
          log("❌ Both MQL5 and MyFXBook failed", "error", { mql5Error, myfxbookError });
          throw new Error(`All data sources failed. MQL5: ${(mql5Error as Error).message}, MyFXBook: ${(myfxbookError as Error).message}`);
        }
      }
      allEventsForDate = freshEvents.filter((event) => {
        const eventDate =
          new Date(event.time_utc as string).toISOString().split("T")[0];
        return eventDate === targetDate &&
          currencies.includes(event.currency as string);
      });

      // NOW fetch impact AND sentiment for ONLY the filtered events (much faster than fetching for all 281+)
      if (dataSource === 'mql5' && allEventsForDate.length > 0) {
        const eventPaths = allEventsForDate
          .map(e => e.event_path as string)
          .filter((path): path is string => !!path);

        if (eventPaths.length > 0) {
          log(`🔍 Fetching metadata for ${eventPaths.length} filtered events...`);
          const metadataMap = await batchFetchEventMetadata(eventPaths);
          log(`✅ Got metadata for ${metadataMap.size} events`);

          // Debug: Show impact distribution
          const highCount = [...metadataMap.values()].filter(m => m.impact === 'High').length;
          const goodCount = [...metadataMap.values()].filter(m => m.actual_result_type === 'good').length;
          const badCount = [...metadataMap.values()].filter(m => m.actual_result_type === 'bad').length;
          log(`Impact: ${highCount} high | Result: ${goodCount} good, ${badCount} bad`);

          // Update filtered events with impact and actual_result_type
          let updatedCount = 0;
          for (const event of allEventsForDate) {
            const path = event.event_path as string;
            if (path && metadataMap.has(path)) {
              const metadata = metadataMap.get(path)!;
              event.impact = metadata.impact;
              // Only update actual_result_type if we got one from the page (don't overwrite existing)
              if (metadata.actual_result_type) {
                event.actual_result_type = metadata.actual_result_type;
              }
              updatedCount++;
            }
            // Clean up event_path (not needed in database)
            delete event.event_path;
          }
          log(`Updated metadata for ${updatedCount}/${allEventsForDate.length} events`);
        }
      }

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
    // Clean up debug fields from events before storing
    for (const event of allEventsForDate) {
      delete (event as Record<string, unknown>)._parseInfo;
      delete (event as Record<string, unknown>)._hasPath;
      delete (event as Record<string, unknown>)._eventPath;
      delete (event as Record<string, unknown>)._fetchedImpact;
      delete (event as Record<string, unknown>)._impactMapMiss;
    }

    // Count events with different impact levels (after filter)
    const impactCounts = {
      high: allEventsForDate.filter(e => e.impact === 'High').length,
      medium: allEventsForDate.filter(e => e.impact === 'Medium').length,
      low: allEventsForDate.filter(e => e.impact === 'Low').length,
    };

    const updatedCount = await updateEventsInDatabase(allEventsForDate);
    log(`✅ Successfully updated ${updatedCount} economic events`);
    const response: Record<string, unknown> = {
      success: true,
      updatedCount,
      dataSource,
      impactCounts,
      targetEvents: allEventsForDate,
      foundEvents,
      targetDate,
      currencies,
      requestedEvents: requestedEvents || [],
      hasSpecificEvents,
      message: hasSpecificEvents
        ? `Updated ${updatedCount} events for ${targetDate} from ${dataSource}. Found ${foundEvents.length}/${requestedEvents.length} requested events.`
        : `Updated ${updatedCount} events for ${targetDate} from ${dataSource}.`,
    };
    return successResponse(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log("Error refreshing economic calendar", "error", { message: errorMessage, error });
    return errorResponse(`Refresh failed: ${errorMessage}`, 500);
  }
});
