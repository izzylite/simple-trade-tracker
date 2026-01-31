/**
 * MQL5 Economic Calendar Extractor
 * Handles fetching and parsing economic events from MQL5.com
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
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

export interface EventMetadata {
  impact: string;
  actual_result_type: 'good' | 'bad' | '';
}

export interface CachedMetadata {
  impact: string;
  higher_is_better: boolean | null;
}

// Cache for event metadata (event URL path -> metadata)
const eventMetadataCache: Map<string, EventMetadata> = new Map();

function log(message: string, level: string = "info", context?: unknown): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[MQL5] [${timestamp}] ${message}`;
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

function cleanHtmlEntities(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/&#xA0;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch impact and actual_result_type from individual MQL5 event page
 */
async function fetchEventMetadata(eventPath: string): Promise<EventMetadata> {
  if (eventMetadataCache.has(eventPath)) {
    return eventMetadataCache.get(eventPath)!;
  }

  const defaultResult: EventMetadata = { impact: 'Low', actual_result_type: '' };

  try {
    const url = `https://www.mql5.com${eventPath}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

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

    // Extract impact from event page
    let impact = 'Medium';
    const impactMatch = html.match(/event-table__importance\s+(high|medium|low)/i);
    if (impactMatch) {
      const level = impactMatch[1].toLowerCase();
      impact = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';
    } else {
      const ecTableMatch = html.match(/ec-table__importance_(\w+)/);
      if (ecTableMatch) {
        const level = ecTableMatch[1].toLowerCase();
        if (level === 'high' || level === 'medium' || level === 'low') {
          impact = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';
        }
      }
    }

    // Extract actual_result_type (green = good, red = bad)
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
    log(`Failed to fetch metadata for ${eventPath}`, 'warn', error);
    eventMetadataCache.set(eventPath, defaultResult);
    return defaultResult;
  }
}

/**
 * Batch fetch metadata for multiple event URLs with rate limiting
 */
export async function batchFetchEventMetadata(
  eventPaths: string[]
): Promise<Map<string, EventMetadata>> {
  const uniquePaths = [...new Set(eventPaths)].filter(p => !eventMetadataCache.has(p));
  log(`Fetching metadata for ${uniquePaths.length} unique events (${eventMetadataCache.size} cached)`);

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

    if (i + batchSize < uniquePaths.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  eventMetadataCache.forEach((metadata, path) => {
    if (!results.has(path)) {
      results.set(path, metadata);
    }
  });

  log(`Batch fetch complete: ${results.size} total (${successCount} new)`);
  return results;
}

/**
 * Parse MQL5 event from table format HTML (browser-rendered)
 */
function parseMQL5TableEvent(
  itemHtml: string,
  eventDate: string
): Record<string, unknown> | null {
  try {
    const impactMatch = itemHtml.match(/ec-table__importance_(\w+)/);
    const impact = impactMatch
      ? (impactMatch[1] === 'high' ? 'High' :
         impactMatch[1] === 'medium' ? 'Medium' :
         impactMatch[1] === 'low' ? 'Low' : 'Low')
      : 'Medium';

    const timeMatch = itemHtml.match(/ec-table__col_time[^>]*>.*?<div>(\d{2}:\d{2})<\/div>/s);
    const timePart = timeMatch ? timeMatch[1] : null;
    if (!timePart) return null;

    const currencyMatch = itemHtml.match(/ec-table__curency-name[^>]*>(\w{3})<\/div>/);
    const currency = currencyMatch ? currencyMatch[1] : null;
    if (!currency) return null;

    const eventMatch = itemHtml.match(/ec-table__col_event[^>]*>.*?<a[^>]*>([^<]+)<\/a>/s);
    const eventName = eventMatch ? eventMatch[1].trim() : null;
    if (!eventName) return null;

    const actualColMatch = itemHtml.match(
      /ec-table__col_actual\s*(green|red)?[^>]*>.*?<span[^>]*>([^<]+)<\/span>/s
    );
    const actualSentiment = actualColMatch?.[1] || null;
    const actualValue = actualColMatch ? cleanHtmlEntities(actualColMatch[2]) : null;

    const forecastMatch = itemHtml.match(/ec-table__col_forecast[^>]*>([^<]+)</);
    const forecastValue = forecastMatch ? cleanHtmlEntities(forecastMatch[1]) : null;

    const previousMatch = itemHtml.match(
      /ec-table__col_previous[^>]*>.*?(?:<div[^>]*>)?([^<]+)(?:<\/div>)?/s
    );
    const previousValue = previousMatch ? cleanHtmlEntities(previousMatch[1]) : null;

    const [year, month, day] = eventDate.split('-');
    const [hour, minute] = timePart.split(':');
    const timeUtc = new Date(Date.UTC(
      parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour), parseInt(minute)
    )).toISOString();

    const externalId = `mql5_${eventDate.replace(/-/g, '')}_${timePart.replace(':', '')}_${currency}_${eventName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`;
    const mapping = currencyMapping[currency] || { country: null, flag_code: null };
    const flagUrl = mapping.flag_code ? `https://flagcdn.com/w160/${mapping.flag_code}.png` : null;

    return {
      external_id: externalId,
      event_name: eventName,
      currency,
      time_utc: timeUtc,
      event_date: eventDate,
      actual_value: actualValue,
      forecast_value: forecastValue,
      previous_value: previousValue,
      impact,
      actual_result_type: actualSentiment === 'green' ? 'good' : actualSentiment === 'red' ? 'bad' : null,
      country: mapping.country,
      flag_code: mapping.flag_code,
      flag_url: flagUrl,
      source: 'mql5',
    };
  } catch (error) {
    log("Error parsing table event", "warn", error);
    return null;
  }
}

/**
 * Parse MQL5 event from inline format (server-side HTML)
 */
function parseMQL5InlineEvent(rowHtml: string): Record<string, unknown> | null {
  try {
    const inlineMatch = rowHtml.match(
      /<div class="ec-table__item ec-table__item_inline"[^>]*>(.*?)<\/div>/s
    );
    if (!inlineMatch) return null;

    const line = inlineMatch[0];
    const fullContent = line.replace(/<[^>]+>/g, ' ').trim();

    const linkMatch = line.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    const eventPath = linkMatch ? linkMatch[1] : null;
    const eventName = linkMatch ? linkMatch[2].trim() : null;

    if (!eventName) return null;

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
      currency,
      time_utc: timeUtc,
      event_date: `${year}-${month}-${day}`,
      actual_value: cleanValue(actualMatch?.[1]),
      forecast_value: cleanValue(forecastMatch?.[1]),
      previous_value: cleanValue(previousMatch?.[1]),
      impact: 'Low', // Will be updated by batch fetch
      event_path: eventPath, // For metadata lookup
      country: mapping.country,
      flag_code: mapping.flag_code,
      flag_url: flagUrl,
      source: 'mql5',
    };
  } catch (error) {
    log("Error parsing inline event", "warn", error);
    return null;
  }
}

/**
 * Parse flexible date formats from MQL5
 */
function parseFlexibleDate(dateText: string): string | null {
  // "January 29, 2026" format
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

  // "29.01.2026" format
  const shortMatch = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (shortMatch) {
    return `${shortMatch[3]}-${shortMatch[2]}-${shortMatch[1]}`;
  }

  // "2026-01-29" format
  const isoMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0];
  }

  return null;
}

/**
 * Fetch weekly economic calendar data from MQL5
 */
export async function fetchFromMQL5Weekly(): Promise<Record<string, unknown>[]> {
  try {
    log("Fetching weekly calendar from MQL5...");

    // Calculate date range: Monday of current week to Sunday
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days

    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + daysToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const fromDate = monday.toISOString().split('T')[0];
    const toDate = sunday.toISOString().split('T')[0];

    const url = `https://www.mql5.com/en/economic-calendar?date=${fromDate}`;
    log(`Fetching MQL5 calendar for week: ${fromDate} to ${toDate}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
      });
    } catch (fetchError) {
      if ((fetchError as Error).name === 'AbortError') {
        throw new Error("MQL5 request timed out after 25 seconds");
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`MQL5 HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    log(`Response received: ${response.status}, length: ${html.length}`);

    const hasInlineFormat = html.includes('ec-table__item_inline');
    const hasTableFormat = html.includes('ec-table__col_time') && !hasInlineFormat;
    log(`Format detected: inline=${hasInlineFormat}, table=${hasTableFormat}`);

    const events: Record<string, unknown>[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Strategy 1: Parse inline format (most common for server requests)
    if (hasInlineFormat) {
      log("Using inline format parser...");
      const inlineMatches = html.matchAll(
        /<div class="ec-table__item ec-table__item_inline"[^>]*>[\s\S]*?<\/div>/g
      );
      for (const match of inlineMatches) {
        const parsed = parseMQL5InlineEvent(match[0]);
        if (parsed && parsed.currency && parsed.event_name) {
          events.push(parsed);
        }
      }
      log(`Parsed ${events.length} inline events`);
    }

    // Strategy 2: Parse table format (browser HTML - rare)
    if (events.length === 0 && hasTableFormat) {
      log("Using table format parser...");
      const dateMatches = html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"/g);
      const dates = [...dateMatches].map(m => m[1]);
      if (dates.length === 0) dates.push(today);

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
        }
      }
      log(`Parsed ${events.length} table events`);
    }

    log(`Extracted ${events.length} total events from MQL5`);

    // Enrich events with metadata (impact + actual_result_type) before returning
    if (events.length > 0) {
      await enrichEventsWithMQL5Metadata(events);
    }

    return events;
  } catch (error) {
    log("Error fetching from MQL5", "error", error);
    throw error;
  }
}

/**
 * Look up existing event metadata from Supabase
 * Returns a map of "eventName|currency" -> { impact, higher_is_better }
 *
 * The higher_is_better direction is inferred from historical data:
 * - If actual > forecast and result was 'good', higher_is_better = true
 * - If actual < forecast and result was 'bad', higher_is_better = true
 * - If actual < forecast and result was 'good', higher_is_better = false
 * - If actual > forecast and result was 'bad', higher_is_better = false
 */
async function getExistingMetadataFromSupabase(
  eventNames: string[],
  currencies: string[]
): Promise<Map<string, CachedMetadata>> {
  const supabase = createServiceClient();
  const metadataMap = new Map<string, CachedMetadata>();

  if (eventNames.length === 0) return metadataMap;

  log(`Checking Supabase for existing metadata for ${eventNames.length} events...`);

  // Query events by name and currency that have impact data
  // Include actual_value, forecast_value, actual_result_type to infer direction
  const { data, error } = await supabase
    .from("economic_events")
    .select("event_name, currency, impact, actual_value, forecast_value, actual_result_type")
    .in("event_name", eventNames)
    .in("currency", currencies)
    .not("impact", "is", null);

  if (error) {
    log("Error querying existing metadata from Supabase", "warn", error);
    return metadataMap;
  }

  // Build a lookup map: "eventName|currency" -> { impact, higher_is_better }
  // Infer higher_is_better from historical actual vs forecast comparisons
  const dbLookup = new Map<string, CachedMetadata>();

  for (const row of data || []) {
    const key = `${row.event_name}|${row.currency}`;

    if (!row.impact || row.impact === 'Low') continue;

    // Try to infer direction if we have the data
    let higher_is_better: boolean | null = null;

    if (row.actual_value && row.forecast_value && row.actual_result_type) {
      const actual = parseFloat(row.actual_value.replace(/[^-\d.]/g, ''));
      const forecast = parseFloat(row.forecast_value.replace(/[^-\d.]/g, ''));

      if (!isNaN(actual) && !isNaN(forecast) && actual !== forecast) {
        const actualHigher = actual > forecast;
        const resultGood = row.actual_result_type === 'good';

        // Infer direction: if actual > forecast and result is good, higher is better
        // If actual < forecast and result is bad, higher is better (inverse confirms)
        higher_is_better = (actualHigher && resultGood) || (!actualHigher && !resultGood);
      }
    }

    // Only update if we don't have this key yet, or if we now have direction info
    const existing = dbLookup.get(key);
    if (!existing || (higher_is_better !== null && existing.higher_is_better === null)) {
      dbLookup.set(key, {
        impact: row.impact,
        higher_is_better,
      });
    }
  }

  const withDirection = Array.from(dbLookup.values()).filter(v => v.higher_is_better !== null).length;
  log(`Found ${dbLookup.size} events with impact data (${withDirection} with inferred direction)`);
  return dbLookup;
}

/**
 * Calculate actual_result_type based on actual vs forecast and direction
 * Returns: 'good', 'bad', 'neutral', or null
 * - 'neutral' when actual equals forecast
 * - 'good'/'bad' based on direction when actual differs from forecast
 * - null when we can't calculate (missing data or unknown direction)
 */
export function calculateActualResultType(
  actual: string | null | undefined,
  forecast: string | null | undefined,
  higher_is_better: boolean | null
): string | null {
  if (!actual || !forecast) return null;

  const actualNum = parseFloat(String(actual).replace(/[^-\d.]/g, ''));
  const forecastNum = parseFloat(String(forecast).replace(/[^-\d.]/g, ''));

  if (isNaN(actualNum) || isNaN(forecastNum)) return null;

  // If actual equals forecast, it's neutral (regardless of direction)
  if (actualNum === forecastNum) return 'neutral';

  // If we don't know the direction, we can't determine good/bad
  if (higher_is_better === null) return null;

  const actualHigher = actualNum > forecastNum;

  if (higher_is_better) {
    return actualHigher ? 'good' : 'bad';
  } else {
    return actualHigher ? 'bad' : 'good';
  }
}

/**
 * Enrich MQL5 events with metadata (impact + actual_result_type)
 * Uses Supabase-first approach: check DB before fetching from MQL5 pages
 *
 * This is the main entry point - handles everything:
 * 1. Extracts event names and currencies
 * 2. Looks up existing metadata from Supabase
 * 3. Enriches events with cached data or fetches from MQL5
 *
 * @param events - Array of MQL5 events to enrich (modified in place)
 */
export async function enrichEventsWithMQL5Metadata(
  events: Record<string, unknown>[]
): Promise<void> {
  if (events.length === 0) return;

  log(`Enriching ${events.length} MQL5 events with metadata...`);

  // Extract event names and currencies for Supabase lookup
  const eventNames = events.map(e => e.event_name as string).filter(Boolean);
  const uniqueCurrencies = [...new Set(events.map(e => e.currency as string))];

  // Get existing metadata from Supabase first
  const existingMetadata = await getExistingMetadataFromSupabase(eventNames, uniqueCurrencies);

  // Determine which events need fetching from MQL5 (no existing metadata)
  const eventsNeedingFetch: string[] = [];

  for (const event of events) {
    const key = `${event.event_name}|${event.currency}`;
    const existingData = existingMetadata.get(key);

    if (existingData) {
      // Use cached impact from Supabase
      event.impact = existingData.impact;

      // Calculate actual_result_type if we have actual/forecast data
      if (event.actual && event.forecast) {
        const calculatedResult = calculateActualResultType(
          event.actual as string,
          event.forecast as string,
          existingData.higher_is_better
        );
        if (calculatedResult) {
          event.actual_result_type = calculatedResult;
          log(`Calculated actual_result_type for ${event.event_name}: ${calculatedResult}`);
        }
      }
      log(`Using cached impact for ${event.event_name}: ${existingData.impact}`);
    } else if (event.event_path) {
      // Need to fetch from MQL5 (no cached data)
      eventsNeedingFetch.push(event.event_path as string);
    }
  }

  // Fetch remaining metadata from MQL5 pages for events without cached data
  if (eventsNeedingFetch.length > 0) {
    log(`Fetching metadata from MQL5 for ${eventsNeedingFetch.length} events...`);
    const metadataMap = await batchFetchEventMetadata(eventsNeedingFetch);

    for (const event of events) {
      const path = event.event_path as string;
      if (path && metadataMap.has(path)) {
        const metadata = metadataMap.get(path)!;
        if (!event.impact || event.impact === 'Low') {
          event.impact = metadata.impact;
        }
        if (metadata.actual_result_type && !event.actual_result_type) {
          event.actual_result_type = metadata.actual_result_type;
        }
      }
    }
  } else {
    log(`All events found in Supabase cache, no MQL5 fetches needed`);
  }

  // Clean up event_path from all events
  for (const event of events) {
    delete event.event_path;
  }

  log(`Enrichment complete for ${events.length} events`);
}

/**
 * Clear the metadata cache (useful for testing)
 */
export function clearMetadataCache(): void {
  eventMetadataCache.clear();
}
