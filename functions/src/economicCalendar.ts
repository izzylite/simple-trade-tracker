/**
 * Economic Calendar Firebase Functions
 * Fetches economic calendar data from MyFXBook
 */

import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

// Types
interface EconomicEvent {
  currency: string;
  event: string;
  impact: string;
  time_utc: string;
  actual: string;
  forecast: string;
  previous: string;
}

 
 
/**
 * Auto-refresh economic calendar data (runs weekly on Mondays at 6 AM UTC)
 * Stores individual events in economicEvents collection for efficient querying
 * MyFXBook provides a full week view, so weekly scraping is optimal
 */
export const autoRefreshEconomicCalendarV2 = onSchedule(
  {
    schedule: '0 6 * * 1', // Every Monday at 6 AM UTC
    region: 'us-central1',
    memory: '1GiB', // Increased memory for enhanced scraping
    timeoutSeconds: 540 // 9 minutes timeout for comprehensive scraping
  },
  async () => {
    try {
      logger.info('🚀 Auto-refreshing economic calendar data (Weekly Enhanced Scraping)');

      // Define major currency pairs to fetch
      const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];

      logger.info(`📊 Fetching weekly economic calendar for currencies: ${majorCurrencies.join(', ')}`);

      // Fetch all events using enhanced weekly scraping (MyFXBook shows full week)
      const allEvents = await fetchFromMyFXBookWeekly();

      // Filter for major currencies and clean event names
      const majorCurrencyEvents = allEvents
        .filter(event => majorCurrencies.includes(event.currency))
        .map(event => ({
          ...event,
          event: cleanEventName(event.event) // Apply event name cleaning
        }));

      logger.info(`✅ Filtered ${allEvents.length} total events to ${majorCurrencyEvents.length} major currency events`);

      // Store events in database for frontend querying
      await storeEventsInDatabase(majorCurrencyEvents);

      logger.info(`🎉 Auto-refresh completed: ${majorCurrencyEvents.length} events stored in database`);

    } catch (error) {
      logger.error('❌ Error in auto-refresh:', error);
      throw error; // Re-throw to ensure Cloud Functions logs the failure
    }
  }
);

/**
 * Enhanced weekly fetch from MyFXBook (single request gets full week)
 * MyFXBook shows a week view regardless of date parameters
 */
async function fetchFromMyFXBookWeekly(): Promise<EconomicEvent[]> {
  logger.info('🔄 Fetching weekly economic calendar from MyFXBook...');

  try {
    // Use main URL without date parameters since MyFXBook shows week view
    const url = 'https://www.myfxbook.com/forex-economic-calendar';
    logger.info(`📡 Fetching URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    logger.info(`✅ Response received: ${response.status}, content length: ${html.length}`);

    // Parse the HTML using enhanced logic
    const events = await parseMyFXBookWeeklyEnhanced(html);

    logger.info(`🎯 Successfully extracted ${events.length} events from MyFXBook`);
    return events;

  } catch (error) {
    logger.error('❌ Error fetching from MyFXBook:', error);
    throw error;
  }
}

 
/**
 * Store events in database for efficient frontend querying with deduplication
 */
async function storeEventsInDatabase(events: EconomicEvent[]): Promise<void> {
  const db = getFirestore();

  logger.info(`Processing ${events.length} events for database storage with deduplication`);

  // Create deterministic event IDs based on content, not array index
  const processedEvents = events.map(event => {
    // Create a stable hash-like ID based on event content
    const eventTime = new Date(event.time_utc);
    const eventDate = event.time_utc.split('T')[0]; // YYYY-MM-DD

    // Normalize time to remove milliseconds and create consistent format
    const normalizedTime = new Date(eventTime);
    normalizedTime.setSeconds(0, 0); // Remove seconds and milliseconds
    const timeString = normalizedTime.toISOString().replace(/[:.T-]/g, '').substring(0, 12); // YYYYMMDDHHMM

    // Normalize event name for consistent ID generation
    const normalizedEventName = event.event
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
      .substring(0, 15); // Limit length

    // Create unique ID based on currency, date, time (without seconds), and normalized event name
    const eventId = `${event.currency}_${eventDate}_${timeString}_${normalizedEventName}`;

    return {
      id: eventId,
      currency: event.currency,
      event: cleanEventName(event.event), // ✅ Apply event name cleaning here!
      impact: event.impact,
      time: normalizedTime, // Use normalized time for consistency
      timeUtc: event.time_utc,
      date: eventDate, // String date for exact date queries
      actual: event.actual || '',
      forecast: event.forecast || '',
      previous: event.previous || '',
      lastUpdated: Date.now(),
      source: 'myfxbook'
    };
  });

  // Remove duplicates based on ID
  const uniqueEvents = processedEvents.reduce((acc, event) => {
    acc[event.id] = event; // This will overwrite duplicates
    return acc;
  }, {} as Record<string, any>);

  const uniqueEventsArray = Object.values(uniqueEvents);
  logger.info(`Deduplicated ${events.length} events to ${uniqueEventsArray.length} unique events`);

  // Store events in batches (Firestore has 500 operation limit per batch)
  const batchSize = 450; // Leave some margin
  const batches = [];

  for (let i = 0; i < uniqueEventsArray.length; i += batchSize) {
    const batch = db.batch();
    const batchEvents = uniqueEventsArray.slice(i, i + batchSize);

    batchEvents.forEach(event => {
      const eventRef = db.collection('economicEvents').doc(event.id);
      batch.set(eventRef, event, { merge: true }); // Use merge to update existing
    });

    batches.push(batch);
  }

  // Execute all batches
  await Promise.all(batches.map(batch => batch.commit()));

  logger.info(`Successfully stored ${uniqueEventsArray.length} unique events in database`);
}

  
 

/**
 * Manually trigger database population (for testing)
 */
export const populateDatabaseManually = onCall(
  {
    region: 'us-central1',
    memory: '512MiB'
  },
  async () => {
    try {
      logger.info('Manually populating database with economic events');

      // Define major currency pairs to fetch
      const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];

      // Fetch data for today and next 7 days
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      logger.info(`Fetching events from ${today} to ${nextWeek} for currencies: ${majorCurrencies.join(', ')}`);

      // Fetch all events using weekly scraping
      const allEvents = await fetchFromMyFXBookWeekly();

      // Filter for major currencies
      const majorCurrencyEvents = allEvents.filter((event: EconomicEvent) =>
        majorCurrencies.includes(event.currency)
      );

      logger.info(`Filtered ${allEvents.length} total events to ${majorCurrencyEvents.length} major currency events`);

      // Store events in database with deduplication
      await storeEventsInDatabase(majorCurrencyEvents);
 

      logger.info(`Manual population completed: ${majorCurrencyEvents.length} events stored`);

      return {
        success: true,
        totalEvents: allEvents.length,
        storedEvents: majorCurrencyEvents.length,
        currencies: majorCurrencies,
        dateRange: { start: today, end: nextWeek }
      };

    } catch (error) {
      logger.error('Error in manual population:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        totalEvents: 0,
        storedEvents: 0
      };
    }
  }
);
 

/**
 * Enhanced MyFXBook weekly parsing using our tested logic
 */
async function parseMyFXBookWeeklyEnhanced(html: string): Promise<EconomicEvent[]> {
  logger.info('🔧 Parsing MyFXBook HTML with enhanced weekly logic...');

  try {
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);
    const events: EconomicEvent[] = [];

    // Valid currencies and impacts for filtering
    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
    const validImpacts = ['High', 'Medium', 'Low'];

    logger.info('🔍 Looking for table rows with economic data...');

    // Find all table rows with proper structure (at least 4 cells)
    const tableRows = $('tr').filter((_i, el) => {
      const $row = $(el);
      const cells = $row.find('td');
      const text = $row.text();

      // Only process rows with sufficient cells and date patterns
      const hasEnoughCells = cells.length >= 4;
      const hasDatePattern = /Jun\s+\d{1,2}|Jul\s+\d{1,2}|\d{1,2}\s+Jun|\d{1,2}\s+Jul/i.test(text);
      const hasCurrency = /\b(USD|EUR|GBP|JPY|AUD|CAD|CHF)\b/.test(text);

      return hasEnoughCells && hasDatePattern && hasCurrency;
    });

    logger.info(`📊 Found ${tableRows.length} potential event rows`);

    // Process each row
    tableRows.each((i, row) => {
      try {
        const $row = $(row);
        const cellTexts = $row.find('td, th').map((_j, cell) => $(cell).text().trim()).get();

        if (cellTexts.length < 4) return; // Skip rows with insufficient data

        // Extract data using enhanced logic
        let currency = '';
        let eventName = '';
        let impact = '';
        let time = '';
        let date = '';

        // Find currency (look for 3-letter currency codes)
        for (const cell of cellTexts) {
          const currencyMatch = cell.match(/\b(USD|EUR|GBP|JPY|AUD|CAD|CHF)\b/);
          if (currencyMatch && validCurrencies.includes(currencyMatch[1])) {
            currency = currencyMatch[1];
            break;
          }
        }

        // Find impact level
        for (const cell of cellTexts) {
          if (validImpacts.includes(cell)) {
            impact = cell;
            break;
          }
        }

        // Extract date from first cell
        const dateCell = cellTexts[0] || '';
        const dateMatch = dateCell.match(/(Jun \d{1,2}|Jul \d{1,2}|\d{1,2} Jun|\d{1,2} Jul)/);
        if (dateMatch) {
          date = dateMatch[1];
        }

        // Extract time
        const timeMatch = cellTexts.join(' ').match(/(\d{1,2}:\d{2})/);
        if (timeMatch) {
          time = timeMatch[1];
        }

        // Extract event name from specific cell position (Cell 4 typically contains event description)
        // Only use structured table data, not pattern matching
        if (cellTexts.length >= 5) {
          const potentialEventName = cellTexts[4]; // Cell 4 is typically the event description
          if (potentialEventName &&
              potentialEventName.length > 3 &&
              !validCurrencies.includes(potentialEventName) &&
              !validImpacts.includes(potentialEventName) &&
              !potentialEventName.match(/^\d{1,2}:\d{2}$/) &&
              !potentialEventName.match(/^(Jun|Jul) \d{1,2}$/)) {
            eventName = potentialEventName;
          }
        }

        // Validate and create event
        if (currency && eventName && eventName.length > 3) {
          // Create ISO date string
          let isoDate = '';
          if (date && time) {
            // Convert to proper date format (assuming current year)
            const year = new Date().getFullYear();
            const monthMap: { [key: string]: string } = {
              'Jun': '06', 'Jul': '07'
            };

            const dateMatch = date.match(/(Jun|Jul) (\d{1,2})/);
            if (dateMatch) {
              const month = monthMap[dateMatch[1]];
              const day = dateMatch[2].padStart(2, '0');
              isoDate = `${year}-${month}-${day}T${time}:00+00:00`;
            }
          }

          if (!isoDate) {
            // Fallback to current date if parsing fails
            isoDate = new Date().toISOString();
          }

          const event: EconomicEvent = {
            currency,
            event: cleanEventName(eventName), // Apply proper event name cleaning
            impact: impact || 'Medium',
            time_utc: isoDate,
            actual: '',
            forecast: '',
            previous: ''
          };

          events.push(event);

          if (events.length <= 10) { // Log first 10 events for debugging
            logger.info(`✅ Extracted: ${date || 'Unknown'} | ${time || '00:00'} | ${currency} ${eventName} | ${impact || 'Medium'}`);
          }
        }

      } catch (rowError) {
        // Skip individual row errors
        logger.warn(`⚠️ Error processing row ${i}:`, rowError);
      }
    });

    logger.info(`🎉 Successfully extracted ${events.length} events`);
    return events;

  } catch (error) {
    logger.error('❌ Error in parseMyFXBookWeeklyEnhanced:', error);
    throw error;
  }
}

/**
 * Clean event names by removing currency prefixes, time indicators, and impact levels
 */
function cleanEventName(eventName: string): string {
  if (!eventName) return eventName;

  let cleaned = eventName.trim();

  // Valid currencies for removal
  const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

  // Remove currency codes from event name (more aggressive cleaning)
  validCurrencies.forEach(curr => {
    // Remove currency at the beginning of the string
    cleaned = cleaned.replace(new RegExp(`^${curr}\\s+`, 'g'), '').trim();
    // Remove currency anywhere in the string
    cleaned = cleaned.replace(new RegExp(`\\b${curr}\\b`, 'g'), '').trim();
  });

  // Remove time indicators like "4h 5min", "35 min", "28 min", etc.
  cleaned = cleaned.replace(/\d+h\s*\d*min?/gi, '').trim();
  cleaned = cleaned.replace(/\d+\s*min/gi, '').trim();
  cleaned = cleaned.replace(/\d+h/gi, '').trim();

  // Remove "days" prefix that sometimes appears
  cleaned = cleaned.replace(/^days\s+/i, '').trim();

  // Remove common prefixes that include currency
  cleaned = cleaned.replace(/^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)\s*/gi, '').trim();

  // Remove impact level indicators that get mixed into event names
  cleaned = cleaned.replace(/\s+(High|Medium|Low)\s*$/gi, '').trim();
  cleaned = cleaned.replace(/^(High|Medium|Low)\s+/gi, '').trim();

  // Remove leading "min" that appears in some events
  cleaned = cleaned.replace(/^min\s+/gi, '').trim();

  // Remove trailing incomplete parentheses like "(May" or "(Jun"
  cleaned = cleaned.replace(/\s*\([A-Za-z]{3}$/, '').trim();

  // Remove leading/trailing special characters and extra spaces
  cleaned = cleaned.replace(/^[^\w]+|[^\w]+$/g, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remove any remaining currency codes that might be embedded
  validCurrencies.forEach(curr => {
    cleaned = cleaned.replace(new RegExp(`\\s+${curr}\\s+`, 'g'), ' ').trim();
  });

  // Final cleanup
  cleaned = cleaned.replace(/^\s+|\s+$/g, '').trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Test MyFXBook scraper (callable function for testing)
 */
export const testMyFXBookScraper = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 60,
    region: 'us-central1'
  },
  async (_request) => {
    logger.info('Testing MyFXBook scraper');

    try {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];

      logger.info(`Testing MyFXBook scraper for date: ${dateString}`);

      // Test weekly MyFXBook scraping
      const events = await fetchFromMyFXBookWeekly();

      logger.info(`MyFXBook test completed. Found ${events.length} events`);

      return {
        success: true,
        date: dateString,
        eventCount: events.length,
        events: events.slice(0, 5), // Return first 5 events as sample
        message: `Successfully scraped ${events.length} events from MyFXBook`
      };
    } catch (error) {
      logger.error('MyFXBook test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'MyFXBook scraping test failed'
      };
    }
  }
);
