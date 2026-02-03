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
    // Query by event_name and country (case-insensitive match)
    const { data, error } = await supabase
      .from("economic_events")
      .select("*")
      .ilike("event_name", `%${eventName}%`)
      .ilike("country", country)
      .order("event_date", { ascending: false })
      .limit(1)
      .single();

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
 * Update event data in Supabase after fetching from MQL5
 */
async function updateEventInDatabase(
  cachedEvent: CachedEventData | null,
  mql5Data: MQL5EventData
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    log("Could not initialize Supabase client for update", "error");
    return;
  }

  try {
    const updateData = {
      actual_value: mql5Data.actual_value,
      forecast_value: mql5Data.forecast_value,
      previous_value: mql5Data.previous_value,
      impact: mql5Data.impact,
      actual_result_type: mql5Data.actual_result_type,
      last_updated: new Date().toISOString(),
      data_source: "mql5",
    };

    if (cachedEvent) {
      // Update existing record
      const { error } = await supabase
        .from("economic_events")
        .update(updateData)
        .eq("id", cachedEvent.id);

      if (error) {
        log(`Failed to update event ${cachedEvent.id}`, "error", error);
      } else {
        log(`Updated event ${cachedEvent.id} with MQL5 data`);
      }
    } else {
      // No existing record - log but don't insert (bulk refresh handles inserts)
      log(`No existing record to update for ${mql5Data.event_name} (${mql5Data.country}). Skipping insert.`);
    }

  } catch (error) {
    log("Error updating event in database", "error", error);
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
async function fetchMql5Event(eventName: string, country: string): Promise<MQL5EventData | null> {
  const url = buildMql5Url(eventName, country);
  if (!url) {
    return null;
  }

  log(`Fetching MQL5 event: ${url}`);

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
      return null;
    }

    const html = await response.text();
    log(`MQL5 response: ${response.status}, length: ${html.length}`);

    return parseMql5Html(html, eventName, country, url);

  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      log(`MQL5 request timed out for ${url}`, "error");
    } else {
      log(`MQL5 fetch error for ${url}`, "error", error);
    }
    return null;
  }
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

    // Step 3: Update Supabase with fresh MQL5 data
    await updateEventInDatabase(cachedData, eventData);

    log(`Successfully fetched event data from MQL5 for ${eventName}`);
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
