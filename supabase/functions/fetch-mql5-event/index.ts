import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Fetch MQL5 Event Details Edge Function
 * Fetches real-time event data (actual, forecast, previous) from MQL5 individual event pages
 *
 * CACHING STRATEGY:
 * 1. First checks Supabase economic_events table for existing data
 * 2. If data exists and is fresh (< 5 minutes old), returns cached data
 * 3. If data is stale or missing, fetches from MQL5, updates DB, and returns
 *
 * Usage - Single Event:
 * POST /functions/v1/fetch-mql5-event
 * Body: { "event_name": "Nonfarm Payrolls", "country": "United States" }
 * Returns: { success: true, data: { actual, forecast, previous, ... } }
 *
 * Usage - Batch Events:
 * POST /functions/v1/fetch-mql5-event
 * Body: { "events": [
 *   { "event_name": "Nonfarm Payrolls", "country": "United States" },
 *   { "event_name": "Unemployment Rate", "country": "United States" }
 * ]}
 * Returns: { success: true, batch: true, total: 2, succeeded: 2, failed: 0, results: [...] }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// Cache freshness threshold (5 minutes)
const CACHE_FRESHNESS_MS = 5 * 60 * 1000;

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
}

function successResponse(data: unknown): Response {
  return new Response(
    JSON.stringify({ success: true, data }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
}

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

function log(message: string, level = "info", context?: unknown): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [fetch-mql5-event] ${message}`;
  if (context) {
    if (level === "error") console.error(logMessage, context);
    else console.log(logMessage, context);
  } else {
    if (level === "error") console.error(logMessage);
    else console.log(logMessage);
  }
}

/**
 * Initialize Supabase client
 */
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    log("Missing Supabase environment variables", "error");
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

type LockAcquireResult = "acquired" | "lost" | "error";

/**
 * Try to acquire a per-event advisory lock via RPC.
 * Returns 'acquired' if we took the lock, 'lost' if another caller holds it,
 * 'error' if the RPC itself failed (caller should proceed without the lock).
 */
async function tryAcquireLock(
  eventName: string,
  country: string,
  leaseSeconds = 30,
): Promise<LockAcquireResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    log("Cannot acquire lock: no Supabase client", "error");
    return "error";
  }

  const { data, error } = await supabase.rpc("try_acquire_mql5_sync_lock", {
    p_event_name: eventName,
    p_country: country,
    p_lease_seconds: leaseSeconds,
  });

  if (error) {
    log(`Lock acquire RPC failed for ${eventName}/${country}`, "error", error);
    return "error";
  }

  return data === true ? "acquired" : "lost";
}

/**
 * Release the per-event advisory lock. Idempotent — safe to call on error paths.
 */
async function releaseLock(eventName: string, country: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.rpc("release_mql5_sync_lock", {
    p_event_name: eventName,
    p_country: country,
  });

  if (error) {
    log(`Lock release RPC failed for ${eventName}/${country}`, "error", error);
    // Not fatal — lease will expire.
  }
}

interface CachedEventData {
  id: string;
  external_id: string;
  event_name: string;
  country: string;
  currency: string | null;
  actual_value: string | null;
  forecast_value: string | null;
  previous_value: string | null;
  impact: string | null;
  event_date: string | null;
  time_utc: string | null;
  last_updated: string;
  data_source: string | null;
}

/**
 * Check if cached event data exists and is fresh
 */
async function getCachedEventData(
  eventName: string,
  country: string
): Promise<{ data: CachedEventData | null; isFresh: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { data: null, isFresh: false };
  }

  try {
    // Try exact match first, fall back to partial match
    // Exact match prevents "Retail Sales" from matching "Retail Sales Ex Autos"
    let { data, error } = await supabase
      .from("economic_events")
      .select("*")
      .ilike("event_name", eventName)
      .ilike("country", country)
      .order("event_date", { ascending: false })
      .limit(1)
      .single();

    // Fall back to partial match if exact match fails
    if (error || !data) {
      log(`No exact match for "${eventName}", trying partial match...`);
      ({ data, error } = await supabase
        .from("economic_events")
        .select("*")
        .ilike("event_name", `%${eventName}%`)
        .ilike("country", country)
        .order("event_date", { ascending: false })
        .limit(1)
        .single());
    }

    if (error || !data) {
      log(`No cached data found for ${eventName} (${country})`);
      return { data: null, isFresh: false };
    }

    // Check freshness based on last_updated
    const lastUpdated = new Date(data.last_updated).getTime();
    const now = Date.now();
    const isFresh = (now - lastUpdated) < CACHE_FRESHNESS_MS;

    log(`Cached data found for ${eventName}: last_updated=${data.last_updated}, isFresh=${isFresh}`);
    return { data, isFresh };

  } catch (error) {
    log("Error checking cached event data", "error", error);
    return { data: null, isFresh: false };
  }
}

/**
 * Compare two dates to see if they represent the same calendar day
 * Handles ISO strings, date strings (YYYY-MM-DD), and Date objects
 */
function isSameDay(date1: string | Date | null, date2: string | Date | null): boolean {
  if (!date1 || !date2) return false;

  try {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

    // Compare year, month, and day (ignoring time)
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
  } catch {
    return false;
  }
}

interface UpdateResult {
  updated: boolean;
  skipped: boolean;
  reason?: string;
}

/**
 * Update event data in Supabase after fetching from MQL5
 * Validates that MQL5 data date matches the cached event date before updating
 */
async function updateEventInDatabase(
  cachedEvent: CachedEventData | null,
  mql5Data: MQL5EventData
): Promise<UpdateResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    log("Could not initialize Supabase client for update", "error");
    return { updated: false, skipped: true, reason: "No Supabase client" };
  }

  // No cached event to update
  if (!cachedEvent) {
    log(`No existing record to update for ${mql5Data.event_name} (${mql5Data.country}). Skipping insert.`);
    return { updated: false, skipped: true, reason: "No cached event found" };
  }

  // DATE VALIDATION: Compare MQL5's last_release_date with cached event's event_date
  // This prevents updating December's event with November's data from MQL5
  if (mql5Data.last_release_date && cachedEvent.event_date) {
    if (!isSameDay(mql5Data.last_release_date, cachedEvent.event_date)) {
      const mql5DateStr = new Date(mql5Data.last_release_date).toISOString().split('T')[0];
      const eventDateStr = cachedEvent.event_date.split('T')[0];
      log(`Date mismatch: MQL5 has data for ${mql5DateStr}, but event date is ${eventDateStr}. Skipping update to prevent stale data.`, "error");
      return {
        updated: false,
        skipped: true,
        reason: `Date mismatch: MQL5 data is for ${mql5DateStr}, event is for ${eventDateStr}`
      };
    }
    log(`Date validation passed: MQL5 date matches event date ${cachedEvent.event_date}`);
  } else {
    log(`Warning: Could not validate dates (mql5_date=${mql5Data.last_release_date}, event_date=${cachedEvent.event_date})`);
  }

  try {
    // Preserve impact from primary source — MQL5 uses different ratings
    // Only use MQL5 impact if the event has no impact set yet
    const updateData: Record<string, unknown> = {
      actual_value: mql5Data.actual_value,
      forecast_value: mql5Data.forecast_value,
      previous_value: mql5Data.previous_value,
      actual_result_type: mql5Data.actual_result_type,
      last_updated: new Date().toISOString(),
      data_source: "mql5",
    };
    if (!cachedEvent.impact && mql5Data.impact) {
      updateData.impact = mql5Data.impact;
    }

    // Update existing record
    const { error } = await supabase
      .from("economic_events")
      .update(updateData)
      .eq("id", cachedEvent.id);

    if (error) {
      log(`Failed to update event ${cachedEvent.id}`, "error", error);
      return { updated: false, skipped: false, reason: error.message };
    }

    log(`Updated event ${cachedEvent.id} with MQL5 data`);
    return { updated: true, skipped: false };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log("Error updating event in database", "error", error);
    return { updated: false, skipped: false, reason: errMsg };
  }
}

// Country name to MQL5 URL slug mapping
const COUNTRY_SLUG_MAP: Record<string, string> = {
  "united states": "united-states",
  "united kingdom": "united-kingdom",
  "euro area": "european-union",
  "european union": "european-union",
  "eurozone": "european-union",
  "canada": "canada",
  "australia": "australia",
  "japan": "japan",
  "germany": "germany",
  "france": "france",
  "switzerland": "switzerland",
  "new zealand": "new-zealand",
  "china": "china",
  "spain": "spain",
  "italy": "italy",
  "greece": "greece",
  "netherlands": "netherlands",
  "belgium": "belgium",
  "austria": "austria",
  "portugal": "portugal",
  "ireland": "ireland",
  "finland": "finland",
  "norway": "norway",
  "sweden": "sweden",
  "denmark": "denmark",
  "poland": "poland",
  "russia": "russia",
  "brazil": "brazil",
  "mexico": "mexico",
  "india": "india",
  "south korea": "south-korea",
  "singapore": "singapore",
  "hong kong": "hong-kong",
  "taiwan": "taiwan",
  "south africa": "south-africa",
  "turkey": "turkey",
  "israel": "israel",
};

// Common abbreviation expansions for MQL5 URL slugs
// Note: MQL5 uses some abbreviations (ppi, gdp) but expands others (cpi)
const SLUG_EXPANSIONS: Record<string, string> = {
  'cpi': 'consumer-price-index',  // MQL5 uses full name for CPI
  // 'ppi' stays as 'ppi' - MQL5 uses abbreviation
  // 'gdp' stays as 'gdp' - MQL5 uses abbreviation
  // 'pmi' stays as 'pmi' - MQL5 uses abbreviation
};

// Direct event name to MQL5 slug mappings for better accuracy
// These are known event patterns that need specific transformations
const EVENT_NAME_MAPPINGS: Record<string, string> = {
  // Building/Construction
  'Building Permits': 'building-approvals',
  'Building Permits MoM': 'building-approvals-mm',
  'Building Permits YoY': 'building-approvals-yy',
  'Building Consents': 'building-consents',

  // Inflation
  'Harmonised Inflation Rate': 'hicp',
  'Harmonised Inflation Rate MoM': 'hicp-mm',
  'Harmonised Inflation Rate YoY': 'hicp-yy',
  'Inflation Rate': 'cpi',
  'Inflation Rate MoM': 'cpi-mm',
  'Inflation Rate YoY': 'cpi-yy',
  'Core Inflation Rate': 'core-cpi',
  'Core Inflation Rate MoM': 'consumer-price-index-ex-food-energy-mm',
  'Core Inflation Rate YoY': 'consumer-price-index-ex-food-energy-yy',
  'CPI': 'consumer-price-index',
  'Core CPI': 'core-consumer-price-index',

  // Employment
  'JOLTs Job Openings': 'jolts-job-openings',
  'JOLTs Job Quits': 'jolts-job-quits',
  'Unemployment Change': 'unemployment-change',
  'Unemployment Rate': 'unemployment-rate',
  'Employment Change': 'employment-change',
  'ADP Employment Change': 'adp-nonfarm-employment-change',
  'ADP Nonfarm Employment Change': 'adp-nonfarm-employment-change',
  'Nonfarm Payrolls': 'nonfarm-payrolls',
  'Initial Jobless Claims': 'initial-jobless-claims',
  'Continuing Jobless Claims': 'continuing-jobless-claims',

  // Central Bank
  'RBA Interest Rate Decision': 'rba-interest-rate-decision',
  'RBA Press Conference': 'rba-monetary-policy-statement',
  'RBA Rate Statement': 'rba-rate-statement',
  'RBA Monetary Policy Statement': 'rba-monetary-policy-statement',
  'ECB Interest Rate Decision': 'ecb-interest-rate-decision',
  'ECB Press Conference': 'ecb-monetary-policy-press-conference',
  'ECB Monetary Policy Press Conference': 'ecb-monetary-policy-press-conference',
  'BoE Interest Rate Decision': 'boe-interest-rate-decision',
  'BoE MPC Meeting Minutes': 'boe-mpc-meeting-minutes',
  'BoJ Monetary Base': 'monetary-base',
  'BoJ Interest Rate Decision': 'boj-interest-rate-decision',
  'Fed Interest Rate Decision': 'fomc-interest-rate-decision',

  // PMI
  'Manufacturing PMI': 'manufacturing-pmi',
  'Services PMI': 'services-pmi',
  'Composite PMI': 'composite-pmi',
  'ISM Manufacturing PMI': 'ism-manufacturing-pmi',
  'ISM Non-Manufacturing PMI': 'ism-non-manufacturing-pmi',
  'ISM Services PMI': 'ism-non-manufacturing-pmi',

  // GDP
  'GDP Growth Rate': 'gdp-growth-rate',
  'GDP Growth Rate QoQ': 'gdp-growth-rate-qq',
  'GDP Growth Rate YoY': 'gdp-growth-rate-yy',

  // Trade
  'Trade Balance': 'trade-balance',
  'Exports': 'exports',
  'Imports': 'imports',

  // Retail
  'Retail Sales': 'retail-sales',
  'Retail Sales MoM': 'retail-sales-mm',
  'Retail Sales YoY': 'retail-sales-yy',

  // Industrial
  'Industrial Production': 'industrial-production',
  'Industrial Production MoM': 'industrial-production-mm',
  'Industrial Production YoY': 'industrial-production-yy',

  // Consumer
  'Consumer Confidence': 'consumer-confidence',
  'Michigan Consumer Sentiment': 'michigan-consumer-sentiment',

  // Housing
  'HPI': 'hpi',
  'House Price Index': 'house-price-index',
  'Nationwide HPI': 'nationwide-hpi',
  'Halifax HPI': 'halifax-house-price-index',

  // Auctions
  '10-Year JGB Auction': '10-year-jgb-auction',
  '30-Year JGB Auction': '30-year-jgb-auction',
  '10-Year Bond Auction': '10-year-bond-auction',
  '10-Year Treasury Gilt Auction': '10-year-treasury-gilt-auction',

  // Budget
  'Budget Balance': 'government-budget-balance',
  'Government Budget Balance': 'government-budget-balance',

  // PPI
  'PPI': 'producer-price-index',
  'PPI MoM': 'producer-price-index-mm',
  'PPI YoY': 'producer-price-index-yy',

  // Tourist
  'Tourist Arrivals': 'tourist-arrivals',
  'Tourist Arrivals YoY': 'tourist-arrivals-yy',

  // Redbook
  'Redbook': 'redbook',
  'Redbook YoY': 'redbook-yy',

  // LMI
  'LMI Logistics Managers Index': 'lmi-logistics-managers-index',
};

/**
 * Convert event name to MQL5 URL slug
 * e.g., "Nonfarm Payrolls (Jan)" -> "nonfarm-payrolls"
 * e.g., "S&P Global Services PMI" -> "sp-global-services-pmi"
 * e.g., "PPI YoY" -> "ppi-yy"
 * e.g., "ZEW Economic Sentiment Index" -> "zew-economic-sentiment-indicator"
 * e.g., "CPI" -> "consumer-price-index"
 */
function eventNameToSlug(name: string): string {
  // Remove date/period info in parentheses like (Dec), (Jan), (Q4), etc.
  const cleanName = name.replace(/\s*\([^)]*\)\s*/g, '').trim();

  // Check for direct mapping first (case-insensitive)
  for (const [key, value] of Object.entries(EVENT_NAME_MAPPINGS)) {
    if (cleanName.toLowerCase() === key.toLowerCase()) {
      return value;
    }
    // Also check if the clean name starts with the key (for partial matches)
    if (cleanName.toLowerCase().startsWith(key.toLowerCase())) {
      const suffix = cleanName.slice(key.length).trim();
      if (!suffix) return value;
    }
  }

  // Apply transformation rules if no direct mapping found
  let slug = cleanName
    .toLowerCase()
    .replace(/&/g, '')              // Remove ampersands
    .replace(/[.']/g, '')           // Remove periods and apostrophes
    // MQL5 uses abbreviations: yy/mm/qq instead of yoy/mom/qoq
    .replace(/\byoy\b/gi, 'yy')
    .replace(/\bmom\b/gi, 'mm')
    .replace(/\bqoq\b/gi, 'qq')
    .replace(/\s+/g, '-')           // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, '')     // Remove other special chars
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')          // Trim leading/trailing hyphens
    .trim();

  // MQL5-specific slug corrections
  // ZEW uses "indicator" instead of "index"
  if (slug.includes('zew') && slug.includes('index')) {
    slug = slug.replace('index', 'indicator');
  }

  // Expand common abbreviations (only if they appear as standalone words in slug)
  // e.g., "cpi-yy" -> "consumer-price-index-yy"
  for (const [abbrev, expansion] of Object.entries(SLUG_EXPANSIONS)) {
    // Match abbreviation at start, end, or between hyphens
    const pattern = new RegExp(`(^|-)${abbrev}(-|$)`, 'g');
    if (pattern.test(slug) && abbrev !== expansion) {
      slug = slug.replace(pattern, `$1${expansion}$2`);
    }
  }

  return slug;
}

/**
 * Get country slug from country name
 */
function getCountrySlug(country: string): string | null {
  const normalized = country.toLowerCase().trim();
  return COUNTRY_SLUG_MAP[normalized] || null;
}

/**
 * Build MQL5 event URL
 */
function buildMql5Url(eventName: string, country: string): string | null {
  const countrySlug = getCountrySlug(country);
  if (!countrySlug) {
    log(`Unknown country: ${country}`, "error");
    return null;
  }

  const eventSlug = eventNameToSlug(eventName);
  if (!eventSlug) {
    log(`Could not create slug for event: ${eventName}`, "error");
    return null;
  }

  return `https://www.mql5.com/en/economic-calendar/${countrySlug}/${eventSlug}`;
}

interface MQL5EventData {
  event_name: string;
  country: string;
  mql5_url: string;

  // Last release data
  last_release_date: string | null;
  actual_value: string | null;
  forecast_value: string | null;
  previous_value: string | null;
  impact: string | null;
  actual_result_type: 'good' | 'bad' | '' | null; // green=good, red=bad, neutral=''

  // Next release data
  next_release_date: string | null;
  next_forecast: string | null;
  days_until_next: number | null;

  // Meta
  source: string | null;
  sector: string | null;
  fetched_at: string;
}

/**
 * Helper to decode HTML entities and normalize whitespace
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&#xA0;/gi, ' ')  // Hex entity for non-breaking space
    .replace(/&#160;/g, ' ')   // Decimal entity for non-breaking space
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract text content from HTML, stripping all tags
 */
function extractTextContent(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ''));
}

/**
 * Parse MQL5 event page HTML to extract data
 *
 * MQL5 HTML structure uses specific CSS classes:
 * - event-table__date: contains the release date
 * - event-table__importance: contains High/Medium/Low
 * - event-table__actual: contains the actual value
 * - event-table__forecast: contains the forecast value
 * - event-table__previous: contains the previous value
 */
function parseMql5Html(html: string, eventName: string, country: string, url: string): MQL5EventData {
  const result: MQL5EventData = {
    event_name: eventName,
    country: country,
    mql5_url: url,
    last_release_date: null,
    actual_value: null,
    forecast_value: null,
    previous_value: null,
    impact: null,
    actual_result_type: null,
    next_release_date: null,
    next_forecast: null,
    days_until_next: null,
    source: null,
    sector: null,
    fetched_at: new Date().toISOString(),
  };

  try {
    // Extract dates from data-date attributes (Unix timestamps)
    // MQL5 stores dates as data-date="1767965400000" and renders them via JS
    const lastDateAttrMatch = html.match(/id="actualValueDate"[^>]*data-date="(\d+)"/i);
    if (lastDateAttrMatch) {
      const timestamp = parseInt(lastDateAttrMatch[1], 10);
      const date = new Date(timestamp);
      result.last_release_date = date.toISOString();
    }

    const nextDateAttrMatch = html.match(/id="nextValueDate"[^>]*data-date="(\d+)"/i);
    if (nextDateAttrMatch) {
      const timestamp = parseInt(nextDateAttrMatch[1], 10);
      const date = new Date(timestamp);
      result.next_release_date = date.toISOString();
    }

    // Fallback: try extracting dates from visible text (if JS-rendered)
    if (!result.last_release_date) {
      const gmtDatePattern = /(\d{1,2}\s+\w{3}\s+\d{4}\s+\d{1,2}:\d{2}\s+GMT)/g;
      const allDates = html.match(gmtDatePattern);
      if (allDates && allDates.length > 0) {
        result.last_release_date = allDates[0];
        if (allDates.length > 1 && !result.next_release_date) {
          result.next_release_date = allDates[1];
        }
      }
    }

    // Extract impact from event-table__importance class
    const impactMatch = html.match(/class="event-table__importance[^"]*"[^>]*>([^<]+)</i);
    if (impactMatch) {
      result.impact = decodeHtmlEntities(impactMatch[1]);
    }

    // Extract actual_result_type (color) from event-table__actual class
    // MQL5 uses: class="event-table__actual red" or "event-table__actual green"
    const colorMatch = html.match(/class="event-table__actual\s+(red|green)"/i);
    if (colorMatch) {
      const color = colorMatch[1].toLowerCase();
      result.actual_result_type = color === 'green' ? 'good' : color === 'red' ? 'bad' : '';
    } else {
      // Check if there's an actual value but no color (neutral = empty string)
      const hasActual = html.match(/class="event-table__actual"[^>]*>[\s\S]*?<span[^>]*class="[^"]*actual__value/i);
      if (hasActual) {
        result.actual_result_type = '';
      }
    }

    // Extract actual value from event-table__actual class
    // Structure: <td class="event-table__actual..."><span class="event-table__actual__value...">50&nbsp;K</span></td>
    const actualMatch = html.match(/class="event-table__actual[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*actual__value[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (actualMatch) {
      result.actual_value = extractTextContent(actualMatch[1]);
    } else {
      // Fallback: simpler actual extraction
      const simpleActualMatch = html.match(/class="event-table__actual[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
      if (simpleActualMatch) {
        const text = extractTextContent(simpleActualMatch[1]);
        if (text && text !== 'Actual') {
          result.actual_value = text;
        }
      }
    }

    // Extract first forecast value from event-table__forecast (in the last release row)
    const forecastMatches = html.match(/<td[^>]*class="event-table__forecast"[^>]*>([\s\S]*?)<\/td>/gi);
    if (forecastMatches && forecastMatches.length > 0) {
      // First match is the forecast for the last release
      const forecastText = extractTextContent(forecastMatches[0]);
      if (forecastText && forecastText !== 'Forecast') {
        result.forecast_value = forecastText;
      }
      // Second match (if exists) is the forecast for the next release
      if (forecastMatches.length > 1) {
        const nextForecastText = extractTextContent(forecastMatches[1]);
        if (nextForecastText && nextForecastText !== 'Forecast') {
          result.next_forecast = nextForecastText;
        }
      }
    }

    // Extract previous value from first event-table__previous (has nested div/span)
    const previousMatches = html.match(/<td[^>]*class="event-table__previous"[^>]*>([\s\S]*?)<\/td>/gi);
    if (previousMatches && previousMatches.length > 0) {
      // First match should contain the previous value for last release
      const prevText = extractTextContent(previousMatches[0]);
      if (prevText && prevText !== 'Previous') {
        result.previous_value = prevText;
      }
    }

    // Extract days until next from #eventTimeoutValue or calculate from dates
    const daysMatch = html.match(/<td[^>]*id="eventTimeoutValue"[^>]*>(\d+)<\/td>/i);
    if (daysMatch) {
      result.days_until_next = parseInt(daysMatch[1], 10);
    } else if (result.next_release_date) {
      // Calculate days from the next release date
      const nextDate = new Date(result.next_release_date);
      const now = new Date();
      const diffTime = nextDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        result.days_until_next = diffDays;
      }
    }

    // Extract source - pattern: "Source:" followed by a link
    const sourceMatch = html.match(/Source:[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    if (sourceMatch) {
      result.source = decodeHtmlEntities(sourceMatch[1]);
    }

    // Extract sector - look for "Sector:" label followed by value
    const sectorMatch = html.match(/Sector:[\s\S]*?<\/span>\s*<span[^>]*>([^<]+)/i);
    if (sectorMatch) {
      result.sector = decodeHtmlEntities(sectorMatch[1]);
    } else {
      // Alternative: look in meta-like structure
      const altSectorMatch = html.match(/"Sector:"[\s\S]*?>([^<]+)</i);
      if (altSectorMatch) {
        result.sector = decodeHtmlEntities(altSectorMatch[1]);
      }
    }

    // Clean up empty string values
    if (result.actual_value === '') result.actual_value = null;
    if (result.forecast_value === '') result.forecast_value = null;
    if (result.previous_value === '') result.previous_value = null;
    if (result.next_forecast === '') result.next_forecast = null;

    log(`Parsed MQL5 data: actual=${result.actual_value}, forecast=${result.forecast_value}, previous=${result.previous_value}, impact=${result.impact}`);

  } catch (error) {
    log("Error parsing MQL5 HTML", "error", error);
  }

  return result;
}

/**
 * Fetch event data from MQL5
 */
// Values MQL5 shows when data hasn't been released yet
const PLACEHOLDER_VALUES = ['N/D', 'n/d', 'N/A', 'n/a'];

function isPlaceholderValue(value: string | null): boolean {
  return !!value && PLACEHOLDER_VALUES.includes(value.trim());
}

// Retry config: 3 attempts with increasing delays (10s, 15s, 20s)
const RETRY_DELAYS_MS = [10000, 15000, 20000];

async function fetchMql5Event(eventName: string, country: string): Promise<MQL5EventData | null> {
  const url = buildMql5Url(eventName, country);
  if (!url) {
    return null;
  }

  let lastResult: MQL5EventData | null = null;
  const maxAttempts = 1 + RETRY_DELAYS_MS.length; // 1 initial + 3 retries

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      log(`Actual value is placeholder "${lastResult?.actual_value}" - retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    log(`Fetching MQL5 event: ${url} (attempt ${attempt + 1}/${maxAttempts})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        log(`MQL5 HTTP ${response.status} for ${url}`, "error");
        return lastResult;
      }

      const html = await response.text();
      log(`MQL5 response: ${response.status}, length: ${html.length}`);

      lastResult = parseMql5Html(html, eventName, country, url);

      // If actual value is a real value (not placeholder), return immediately
      if (lastResult && !isPlaceholderValue(lastResult.actual_value)) {
        if (attempt > 0) {
          log(`Got actual value "${lastResult.actual_value}" on attempt ${attempt + 1}`);
        }
        return lastResult;
      }

    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        log(`MQL5 request timed out for ${url} (attempt ${attempt + 1})`, "error");
      } else {
        log(`MQL5 fetch error for ${url} (attempt ${attempt + 1})`, "error", error);
      }
      // Continue retrying on error
    }
  }

  // All retries exhausted - null out placeholder actual_value
  if (lastResult && isPlaceholderValue(lastResult.actual_value)) {
    log(`All ${maxAttempts} attempts returned placeholder "${lastResult.actual_value}" - nulling out actual_value`);
    lastResult.actual_value = null;
    lastResult.actual_result_type = null;
  }

  return lastResult;
}

interface EventRequest {
  event_name: string;
  country: string;
}

interface RequestPayload {
  // Single event (legacy support)
  event_name?: string;
  country?: string;
  // Batch events
  events?: EventRequest[];
}

interface EventResult {
  event_name: string;
  country: string;
  success: boolean;
  data?: MQL5EventData & { cached?: boolean; stale?: boolean; cache_age_seconds?: number };
  error?: string;
  // Date mismatch fields - when MQL5 returns data for a different date than the event
  date_mismatch?: boolean;
  mql5_date?: string | null;
  event_date?: string | null;
}

/**
 * Process a single event - check cache, fetch from MQL5 if needed, update DB
 */
async function processEvent(eventName: string, country: string): Promise<EventResult> {
  try {
    // Step 1: Check for cached data in Supabase
    const { data: cachedData, isFresh } = await getCachedEventData(eventName, country);

    if (cachedData && isFresh) {
      log(`Returning fresh cached data for ${eventName}`);
      const cachedResponse: MQL5EventData = {
        event_name: cachedData.event_name,
        country: cachedData.country,
        mql5_url: buildMql5Url(eventName, country) || "",
        last_release_date: cachedData.event_date,
        actual_value: cachedData.actual_value,
        forecast_value: cachedData.forecast_value,
        previous_value: cachedData.previous_value,
        impact: cachedData.impact,
        actual_result_type: null, // Not available from cache
        next_release_date: null,
        next_forecast: null,
        days_until_next: null,
        source: cachedData.data_source,
        sector: null,
        fetched_at: cachedData.last_updated,
      };
      return {
        event_name: eventName,
        country,
        success: true,
        data: {
          ...cachedResponse,
          cached: true,
          cache_age_seconds: Math.round((Date.now() - new Date(cachedData.last_updated).getTime()) / 1000),
        },
      };
    }

    // Step 2: Fetch from MQL5 (data is stale or missing)
    log(`Cache miss or stale for ${eventName}, fetching from MQL5...`);
    const eventData = await fetchMql5Event(eventName, country);

    if (!eventData) {
      // If MQL5 fetch fails but we have stale cached data, return it
      if (cachedData) {
        log(`MQL5 fetch failed, returning stale cached data for ${eventName}`);
        const staleCachedResponse: MQL5EventData = {
          event_name: cachedData.event_name,
          country: cachedData.country,
          mql5_url: buildMql5Url(eventName, country) || "",
          last_release_date: cachedData.event_date,
          actual_value: cachedData.actual_value,
          forecast_value: cachedData.forecast_value,
          previous_value: cachedData.previous_value,
          impact: cachedData.impact,
          actual_result_type: null, // Not available from cache
          next_release_date: null,
          next_forecast: null,
          days_until_next: null,
          source: cachedData.data_source,
          sector: null,
          fetched_at: cachedData.last_updated,
        };
        return {
          event_name: eventName,
          country,
          success: true,
          data: {
            ...staleCachedResponse,
            cached: true,
            stale: true,
            cache_age_seconds: Math.round((Date.now() - new Date(cachedData.last_updated).getTime()) / 1000),
          },
        };
      }
      return {
        event_name: eventName,
        country,
        success: false,
        error: `Could not fetch event data for "${eventName}" in "${country}"`,
      };
    }

    // Step 3: Update Supabase with fresh MQL5 data (with date validation)
    const updateResult = await updateEventInDatabase(cachedData, eventData);

    // If date mismatch occurred, return error with explanation
    if (updateResult.skipped && updateResult.reason?.includes('Date mismatch')) {
      log(`Date mismatch prevented update for ${eventName}`, "error");
      return {
        event_name: eventName,
        country,
        success: false,
        error: updateResult.reason,
        date_mismatch: true,
        mql5_date: eventData.last_release_date,
        event_date: cachedData?.event_date,
      };
    }

    log(`Successfully fetched event data from MQL5 for ${eventName} (updated: ${updateResult.updated})`);
    return {
      event_name: eventName,
      country,
      success: true,
      data: {
        ...eventData,
        cached: false,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error processing event ${eventName}`, "error", { message: errorMessage });
    return {
      event_name: eventName,
      country,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Main Edge Function handler
 *
 * Supports two modes:
 * 1. Single event: { event_name: string, country: string }
 * 2. Batch events: { events: [{ event_name: string, country: string }, ...] }
 *
 * Flow for each event:
 * 1. Check Supabase for cached event data
 * 2. If data exists and is fresh (< 5 min), return cached data
 * 3. If stale or missing, fetch from MQL5
 * 4. Update Supabase with fresh MQL5 data
 * 5. Return the data
 */
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    log("Fetch MQL5 event request received");

    let payload: RequestPayload;
    try {
      payload = await req.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    // Check if this is a batch request
    if (payload.events && Array.isArray(payload.events)) {
      // Batch mode
      log(`Processing batch request with ${payload.events.length} events`);

      if (payload.events.length === 0) {
        return errorResponse("Events array cannot be empty", 400);
      }

      // Validate all events have required fields
      for (const event of payload.events) {
        if (!event.event_name || !event.country) {
          return errorResponse("Each event must have event_name and country", 400);
        }
      }

      // Process all events in parallel
      const results = await Promise.all(
        payload.events.map((event) => processEvent(event.event_name, event.country))
      );

      // Return batch results
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;
      log(`Batch complete: ${successCount} succeeded, ${failCount} failed`);

      return new Response(
        JSON.stringify({
          success: true,
          batch: true,
          total: results.length,
          succeeded: successCount,
          failed: failCount,
          results,
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Single event mode (legacy support)
    const { event_name, country } = payload;

    if (!event_name || !country) {
      return errorResponse("Missing required parameters: event_name and country (or use events array for batch)", 400);
    }

    log(`Fetching single event: ${event_name} (${country})`);

    // Use processEvent for single event too (for consistency)
    const result = await processEvent(event_name, country);

    if (!result.success) {
      return errorResponse(result.error || "Unknown error", 404);
    }

    return successResponse(result.data);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log("Error fetching MQL5 event", "error", { message: errorMessage });
    return errorResponse(`Fetch failed: ${errorMessage}`, 500);
  }
});
