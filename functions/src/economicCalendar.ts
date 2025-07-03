import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import * as crypto from 'crypto';

interface EconomicEvent {
  id: string;
  currency: string;
  event: string;
  impact: string;
  time_utc: string;
  time: Date;
  timeUtc: string;
  date: string;
  actualResultType: string;
  actual: string;
  forecast: string;
  previous: string;
  country: string;
  flagCode: string;
  flagUrl: string;
  lastUpdated: number;
  source: string;
  unixTimestamp?: number; // Unix timestamp in milliseconds from MyFXBook's time attribute
}

/**
 * Auto-refresh economic calendar data - runs every 30 minutes
 * Fetches from MyFXBook and stores events in economicEvents collection
 */
export const autoRefreshEconomicCalendarV2 = onSchedule(
  {
    schedule: '*/30 * * * *',
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540
  },
  async () => {
    try {
      logger.info('🚀 Auto-refreshing economic calendar data');

      const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
      logger.info(`📊 Fetching weekly economic calendar for currencies: ${majorCurrencies.join(', ')}`);

      const allEvents = await fetchFromMyFXBookWeekly();

      const majorCurrencyEvents = allEvents
        .filter(event => majorCurrencies.includes(event.currency))
        .map(event => ({
          ...event,
          event: cleanEventName(event.event)
        }));

      logger.info(`✅ Filtered ${allEvents.length} total events to ${majorCurrencyEvents.length} major currency events`);

      await storeEventsInDatabase(majorCurrencyEvents);

      logger.info(`🎉 Auto-refresh completed: ${majorCurrencyEvents.length} events stored in database`);

    } catch (error) {
      logger.error('❌ Error in auto-refresh:', error);
      throw error;
    }
  }
);

/**
 * Fetch economic calendar data from MyFXBook
 */
async function fetchFromMyFXBookWeekly(): Promise<EconomicEvent[]> {
  logger.info('🔄 Fetching weekly economic calendar from MyFXBook...');

  try {
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

    const events = await parseMyFXBookWeeklyEnhanced(html);

    logger.info(`🎯 Successfully extracted ${events.length} events from MyFXBook`);
    return events;

  } catch (error) {
    logger.error('❌ Error fetching from MyFXBook:', error);
    throw error;
  }
}

/**
 * Store events in database with deduplication
 */
async function storeEventsInDatabase(events: EconomicEvent[]): Promise<void> {
  const db = getFirestore();

  logger.info(`Storing ${events.length} events in database`);

  const uniqueEvents = events.reduce((acc, event) => {
    acc[event.id] = event;
    return acc;
  }, {} as Record<string, EconomicEvent>);

  const uniqueEventsArray = Object.values(uniqueEvents);
  logger.info(`Deduplicated ${events.length} events to ${uniqueEventsArray.length} unique events`);

  const batchSize = 450;
  const batches = [];

  for (let i = 0; i < uniqueEventsArray.length; i += batchSize) {
    const batch = db.batch();
    const batchEvents = uniqueEventsArray.slice(i, i + batchSize);

    batchEvents.forEach(event => {
      const eventRef = db.collection('economicEvents').doc(event.id);
      batch.set(eventRef, event, { merge: true });
    });

    batches.push(batch);
  }

  await Promise.all(batches.map(batch => batch.commit()));

  logger.info(`Successfully stored ${uniqueEventsArray.length} unique events in database`);
}


function isNumericValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > 25) return false;
  if (/^[a-zA-Z\s]+$/.test(trimmed)) return false;
  if (trimmed.includes(':') && /\d{1,2}:\d{2}/.test(trimmed)) return false;

  const cleaned = trimmed
    .replace(/[,%$€£¥]/g, '')
    .replace(/[()]/g, '')
    .replace(/^\+/, '')
    .replace(/\s+/g, '');

  const numericPatterns = [
    /^-?\d+\.?\d*$/,
    /^-?\d+\.?\d*[KMB]$/i,
    /^-?\d+\.?\d*%$/,
    /^-?\d{1,3}(,\d{3})*\.?\d*$/,
    /^\d+\.?\d*[KMB]?$/i,
    /^-?\d+\.?\d*[bp]$/i,
  ];

  const isNumeric = numericPatterns.some(pattern => pattern.test(cleaned));
  const canParse = !isNaN(parseFloat(cleaned.replace(/[KMBbp%]/gi, '')));

  return isNumeric && canParse && cleaned.length > 0;
}
/**
 * Determine if an actual result is good or bad based on MyFXBook indicators
 */
function determineResultType($cell: any, actual: any, forecast: any) {
  // Method 1: Check CSS classes for background color indicators
  const cellClass = $cell.attr('class') || '';
  if (cellClass.includes('background-transparent-red')) {
    return 'bad';
  }
  if (cellClass.includes('background-transparent-green')) {
    return 'good';
  }

  // Method 2: Check data-content attribute for explicit descriptions
  const dataContent = $cell.find('[data-content]').attr('data-content') || '';
  if (dataContent.toLowerCase().includes('worse than expected')) {
    return 'bad';
  }
  if (dataContent.toLowerCase().includes('better than expected')) {
    return 'good';
  }
  if (dataContent.toLowerCase().includes('as expected')) {
    return 'neutral';
  }

   

  return ''; // Unable to determine
}
function cleanNumericValue(value: string): string {
  if (!value) return '';

  return value.trim()
    .replace(/^\+/, '')
    .replace(/,/g, '')
    .trim();
}

function getFlagUrl(countryCode: string, size: string = 'w160'): string {
  if (!countryCode) return '';

  return `https://flagcdn.com/${size}/${countryCode.toLowerCase()}.png`;
}

/**
 * Generate unique ID for economic event based on currency, event name, date, and time
 */
function generateEventId(currency: string, eventName: string, country: string, impact: string): string {
  const uniqueString = `${currency}-${eventName}-${country}-${impact}`.toLowerCase();
  const hash = crypto.createHash('sha256').update(uniqueString).digest('hex');
  return hash.substring(0, 20);
}

/**
 * Parse MyFXBook HTML to extract economic events
 */
async function parseMyFXBookWeeklyEnhanced(html: string): Promise<EconomicEvent[]> {
  try {
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);
    const events: EconomicEvent[] = [];




    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
    const validImpacts = ['High', 'Medium', 'Low'];

    const tableRows = $('tr').filter((_i, el) => {
      const $row = $(el);
      const cells = $row.find('td');
      const text = $row.text();

      const hasEnoughCells = cells.length >= 4;
      const hasDatePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2}/i.test(text);
      const hasCurrency = /\b(USD|EUR|GBP|JPY|AUD|CAD|CHF)\b/.test(text);

      return hasEnoughCells && hasDatePattern && hasCurrency;
    });

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
        let actual = '';
        let actualResultType = '';
        let forecast = '';
        let previous = '';
        let country = '';
        let flagClass = '';

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

        const $flagCells = $row.find('td');
        $flagCells.each((cellIndex: number, cell: any) => {
          const $cell = $(cell);

          const $flagIcon = $cell.find('i[title]');
          const $flagSpan = $cell.find('span.flag');
          const $allFlags = $cell.find('[class*="flag"]');

          if ($flagIcon.length > 0) {
            const titleAttr = $flagIcon.attr('title');
            if (titleAttr && titleAttr.length > 0) {
              country = titleAttr.trim();
            }

            if (!country) {
              const classAttr = $flagIcon.attr('class');
              if (classAttr) {
                const countryMatch = classAttr.match(/^([A-Za-z\s]+)\s+align-center/);
                if (countryMatch) {
                  country = countryMatch[1].trim();
                }
              }
            }
          }

          if ($flagSpan.length > 0) {
            const spanClass = $flagSpan.attr('class');
            if (spanClass) {
              const flagMatch = spanClass.match(/flag-icon-([a-z]{2})/);
              if (flagMatch) {
                flagClass = flagMatch[1];
              }
            }
          }

          if (!flagClass && $allFlags.length > 0) {
            $allFlags.each((_idx: number, flagEl: any) => {
              const flagElClass = $(flagEl).attr('class');
              if (flagElClass) {
                const flagMatch = flagElClass.match(/flag-icon-([a-z]{2})/);
                if (flagMatch) {
                  flagClass = flagMatch[1];
                }
              }
            });
          }
        });

        // Extract date from first cell - updated to handle all months
        const dateCell = cellTexts[0] || '';
        const dateMatch = dateCell.match(/((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/i);
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
          let potentialEventName = cellTexts[4]; // Cell 4 is typically the event description

          // Check if event name is split across multiple cells (common with MyFXBook)
          // Look for incomplete parentheses and try to complete them from adjacent cells
          if (potentialEventName && potentialEventName.includes('(') && !potentialEventName.includes(')')) {
            // Try to find the closing part in the next few cells
            for (let nextCell = 5; nextCell < Math.min(cellTexts.length, 8); nextCell++) {
              const nextCellText = cellTexts[nextCell];
              if (nextCellText && nextCellText.includes(')')) {
                // Found potential closing part, combine them
                potentialEventName = potentialEventName + ' ' + nextCellText;
                break;
              } else if (nextCellText && nextCellText.length > 0 && nextCellText.length < 10) {
                // Short text that might be part of the event name
                potentialEventName = potentialEventName + ' ' + nextCellText;
                if (potentialEventName.includes(')')) break; // Stop if we found closing parenthesis
              }
            }
          }

          if (potentialEventName &&
            potentialEventName.length > 3 &&
            !validCurrencies.includes(potentialEventName) &&
            !validImpacts.includes(potentialEventName) &&
            !potentialEventName.match(/^\d{1,2}:\d{2}$/) &&
            !potentialEventName.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/i) &&
            !potentialEventName.match(/^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i)) {
            eventName = potentialEventName;
          }
        }

        // Extract forecast, previous, and actual values using MyFXBook's specific structure
        // MyFXBook uses data attributes and CSS classes to identify these values

        // Method 1: Use data attributes (most reliable)
        const $cells = $row.find('td');
        $cells.each((_cellIndex, cell) => {
          const $cell = $(cell);

          // Look for previous value
          if ($cell.attr('data-previous') || $cell.attr('previous-value')) {
            const prevValue = $cell.attr('previous-value') || $cell.text().trim();
            if (prevValue && isNumericValue(prevValue)) {
              previous = cleanNumericValue(prevValue);
            }
          }

          // Look for forecast/consensus value
          if ($cell.attr('data-concensus') || $cell.attr('concensus')) {
            const forecastValue = $cell.attr('concensus') || $cell.text().trim();
            if (forecastValue && isNumericValue(forecastValue)) {
              forecast = cleanNumericValue(forecastValue);
            }
          }

          // Look for actual value
          if ($cell.attr('data-actual')) {
            const actualValue = $cell.text().trim();
            if (actualValue && isNumericValue(actualValue)) {
              actual = cleanNumericValue(actualValue);
            }
            // Determine if the actual result is good or bad
            actualResultType = determineResultType($cell, actual, forecast);
          }
        });

        // Method 2: Use CSS classes as backup
        if (!previous) {
          const previousCell = $row.find('.previousCell');
          if (previousCell.length > 0) {
            const prevText = previousCell.text().trim();
            if (isNumericValue(prevText)) {
              previous = cleanNumericValue(prevText);
            }
          }
        }

        if (!actual) {
          const actualCell = $row.find('.actualCell');
          if (actualCell.length > 0) {
            const actualText = actualCell.text().trim();
            if (isNumericValue(actualText)) {
              actual = cleanNumericValue(actualText);
            }
          }
           // Determine if the actual result is good or bad
            actualResultType = determineResultType($row, actual, forecast);
        }

        // Method 3: Fallback to position-based extraction (MyFXBook standard layout)
        // Order: Date, Status, Flag, Currency, Event, Impact, Previous, Forecast, Actual
        if ((!previous || !forecast || !actual) && cellTexts.length >= 9) {
          if (!previous && cellTexts[6] && isNumericValue(cellTexts[6])) {
            previous = cleanNumericValue(cellTexts[6]);
          }
          if (!forecast && cellTexts[7] && isNumericValue(cellTexts[7])) {
            forecast = cleanNumericValue(cellTexts[7]);
          }
          if (!actual && cellTexts[8] && isNumericValue(cellTexts[8])) {
            actual = cleanNumericValue(cellTexts[8]);
          }
        }

        // Validate and create event
        // Only include events that have actual economic data OR are significant events
        const hasEconomicData = actual || forecast || previous;
        const isSignificantEvent = impact && impact !== 'None' && impact !== '';

        if (currency && eventName && eventName.length > 3 && (hasEconomicData || isSignificantEvent)) {
          // Create ISO date string and extract Unix timestamp
          let isoDate = '';
          let unixTimestamp: number | undefined;

          if (date && time) {
            // Try to extract precise date from data-calendardatetd attribute first
            const calendarDateTd = $(row).find('[data-calendardatetd]').attr('data-calendardatetd');
            if (calendarDateTd) {
              // Format: "2025-06-17 12:30:00.0" - this appears to already be in UTC!
              // Evidence: data-calendardatetd="12:30" while display shows "13:30" in GMT+1
              const utcDateTime = new Date(calendarDateTd.replace(' ', 'T') + 'Z');
              if (!isNaN(utcDateTime.getTime())) {
                isoDate = utcDateTime.toISOString();

              }
            }

            // Extract Unix timestamp from MyFXBook's time attribute
            const timeElement = $(row).find('[time]');
            if (timeElement.length > 0) {
              const timeAttr = timeElement.attr('time');
              if (timeAttr && /^\d+$/.test(timeAttr)) {
                unixTimestamp = parseInt(timeAttr, 10);
              }
            }

            if (!isoDate) {
              // Skip events without valid dates - we only want actual scraped data
              // logger.warn(`⚠️ Skipping event "${eventName}" - no valid date found`);
              return; // Skip this row in the .each() loop
            }

            const cleanedEventName = cleanEventName(eventName);

            // Generate unique ID for the event
            const eventId = generateEventId(currency, cleanedEventName, country || "global", impact || 'None');

            // Add extra fields for database storage
            const eventTime = new Date(isoDate);
            const eventDate = isoDate.split('T')[0]; // YYYY-MM-DD

            // Normalize time to remove milliseconds and create consistent format
            const normalizedTime = new Date(eventTime);
            normalizedTime.setSeconds(0, 0); // Remove seconds and milliseconds
            flagClass = flagClass === "emu" || flagClass === "em" ? "eu" : flagClass;
            const event: EconomicEvent = {
              id: eventId,
              currency,
              event: cleanedEventName, // Apply proper event name cleaning
              impact: impact || 'None',
              time_utc: isoDate,
              time: normalizedTime, // Use normalized time for consistency
              timeUtc: isoDate,
              date: eventDate, // String date for exact date queries
              actual: actual || '',
              actualResultType: actualResultType || '',
              forecast: forecast || '',
              previous: previous || '',
              country: country || '',
              flagCode: flagClass || '',
              flagUrl: flagClass ? getFlagUrl(flagClass) : '',
              lastUpdated: Date.now(),
              source: 'myfxbook',
              unixTimestamp: unixTimestamp // Unix timestamp from MyFXBook's time attribute
            };

            if(!event.event.toLowerCase().includes('myfxbook')) {
              events.push(event);
            }
          }
        }
      } catch (rowError) {
        // Skip individual row errors
        logger.warn(`⚠️ Error processing row: ${rowError}`);
      }
    });

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

  // Fix incomplete parentheses by adding missing closing bracket
  // Only fix if there are unmatched opening parentheses
  const openCount = (cleaned.match(/\(/g) || []).length;
  const closeCount = (cleaned.match(/\)/g) || []).length;

  if (openCount > closeCount) {
    // More opening than closing - add missing closing parentheses
    const missingClosing = openCount - closeCount;

    // Only add closing brackets if the opening parenthesis has meaningful content
    // Check if the last opening parenthesis has content after it
    const lastOpenIndex = cleaned.lastIndexOf('(');
    if (lastOpenIndex !== -1) {
      const afterParen = cleaned.substring(lastOpenIndex + 1).trim();

      // Only add closing bracket if there's meaningful content (not just whitespace)
      if (afterParen.length > 0) {
        // Add closing bracket at the end
        cleaned = cleaned + ')'.repeat(missingClosing);
      } else {
        // If opening parenthesis has no content, remove it
        cleaned = cleaned.substring(0, lastOpenIndex).trim();
      }
    }
  } else if (closeCount > openCount) {
    // More closing than opening - remove extra closing parentheses from the end
    const extraClosing = closeCount - openCount;
    for (let i = 0; i < extraClosing; i++) {
      const lastCloseIndex = cleaned.lastIndexOf(')');
      if (lastCloseIndex !== -1) {
        cleaned = cleaned.substring(0, lastCloseIndex) + cleaned.substring(lastCloseIndex + 1);
      }
    }
    cleaned = cleaned.trim();
  }

  // Remove leading/trailing special characters (but preserve parentheses) and extra spaces
  cleaned = cleaned.replace(/^[^\w(]+|[^\w)]+$/g, '').trim();
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
 * Process HTML content and store economic events in database
 */
export const processHtmlEconomicEvents = onCall(
  {
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 300
  },
  async (request) => {
    try {
      const { htmlContent } = request.data;

      if (!htmlContent || typeof htmlContent !== 'string') {
        throw new Error('HTML content is required and must be a string');
      }

      logger.info('🔄 Processing HTML content for economic events');
      logger.info(`📊 HTML content size: ${htmlContent.length} characters`);

      const events = await parseMyFXBookWeeklyEnhanced(htmlContent);

      logger.info(`🎉 Successfully processed ${events.length} events from HTML`);

      const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
      const majorCurrencyEvents = events.filter(event =>
        majorCurrencies.includes(event.currency)
      );

      logger.info(`✅ Filtered ${events.length} total events to ${majorCurrencyEvents.length} major currency events`);

      await storeEventsInDatabase(majorCurrencyEvents);

      logger.info(`💾 Successfully stored ${majorCurrencyEvents.length} events in database`);

      return {
        success: true,
        message: `Successfully processed and stored economic events`,
        totalEvents: events.length,
        majorCurrencyEvents: majorCurrencyEvents.length,
        currencies: [...new Set(events.map(e => e.currency))],
        dateRange: {
          start: events.length > 0 ? events.map(e => e.date).sort()[0] : null,
          end: events.length > 0 ? events.map(e => e.date).sort().reverse()[0] : null
        },
        sampleEvents: majorCurrencyEvents.slice(0, 5).map(event => ({
          id: event.id,
          currency: event.currency,
          event: event.event,
          impact: event.impact,
          time_utc: event.time_utc,
          country: event.country,
          flagCode: event.flagCode
        }))
      };

    } catch (error) {
      logger.error('❌ Error processing HTML economic events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
);

/**
 * On-demand refresh for specific economic events
 */
export const refreshEconomicCalendar = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60
  },
  async (request) => {
    try {
      const {
        targetDate,
        currencies,
        events // Optional list of specific events to watch for
      } = request.data;

      // Required fields
      if (!targetDate || !currencies || !Array.isArray(currencies)) {
        throw new Error('Missing required parameters: targetDate and currencies array');
      }

      // Optional: specific events to look for (if not provided, just refresh all events for the date/currencies)
      const requestedEvents = events || [];
      const hasSpecificEvents = requestedEvents.length > 0;

      logger.info(`🔄 Refreshing economic calendar for date: ${targetDate}, currencies: ${currencies.join(', ')}`);
      if (hasSpecificEvents) {
        logger.info(`🎯 Looking for ${requestedEvents.length} specific event(s): ${requestedEvents.map((e: EconomicEvent) => e.event).join(', ')}`);
      } else {
        logger.info(`📊 Refreshing all events for the specified date and currencies`);
      }

      let updated = false;
      let count = 0;
      let allEventsForDate: EconomicEvent[] = [];
      let foundEvents: EconomicEvent[] = [];

      while (!updated && count < 3) {
        const freshEvents = await fetchFromMyFXBookWeekly();

        allEventsForDate = freshEvents.filter(event => {
          const eventDate = new Date(event.time_utc).toISOString().split('T')[0];
          return eventDate === targetDate && currencies.includes(event.currency);
        });

        if (hasSpecificEvents) {
          // Find all requested events by matching IDs
          const requestedEventIds = requestedEvents.map((e: EconomicEvent) => e.id);
          foundEvents = allEventsForDate.filter(event => requestedEventIds.includes(event.id));

          logger.info(`📊 Found ${foundEvents.length}/${requestedEvents.length} requested events in ${allEventsForDate.length} total events`);

          // Check if any of the found events have updated actual values
          let hasUpdates = false;
          for (const foundEvent of foundEvents) {
            const originalEvent = requestedEvents.find((e: EconomicEvent) => e.id === foundEvent.id);
            if (originalEvent && foundEvent.actual !== originalEvent.actual) {
              hasUpdates = true;
              logger.info(`✅ Event updated: ${foundEvent.event} - Actual changed from "${originalEvent.actual}" to "${foundEvent.actual}"`);
            }
          }

          if (hasUpdates) {
            updated = true;
            break;
          }
          else {
            logger.info(`❌ No updates found for requested events. Retrying (${count + 1}/3) after ${count + 1} seconds...`);
          }

          if (foundEvents.length === 0 || count >= 2) {
            logger.info(`⚠️ Events not found or max retries reached (${count + 1}/3)`);
            break;
          }

          await new Promise(resolve => setTimeout(resolve, (count + 1) * 1000));
          count++;
        } else {
          // No specific events requested, just refresh all events for the date
          updated = true;
          break;
        }
      }

      logger.info(`📊 Found ${allEventsForDate.length} events to update for ${targetDate}`);


      await storeEventsInDatabase(allEventsForDate);
      const updatedCount = allEventsForDate.length;

      // Log details about found events
      if (hasSpecificEvents) {
        if (foundEvents.length > 0) {
          logger.info(`🎯 Found ${foundEvents.length} specific event(s):`);
          foundEvents.forEach(event => {
            logger.info(`- ${event.event}: Actual: ${event.actual}, Forecast: ${event.forecast}, Previous: ${event.previous}`);
          });
        } else {
          const requestedEventIds = requestedEvents.map((e: any) => e.id);
          logger.warn(`⚠️ None of the requested events found. Requested IDs: ${requestedEventIds.join(', ')}`);
        }
      }

      logger.info(`✅ Successfully updated ${updatedCount} economic events`);

      return {
        success: true,
        updatedCount,
        targetEvents: allEventsForDate, // All events for the date/currencies
        foundEvents, // The specific events that were requested (if any)
        targetDate,
        currencies,
        requestedEvents,
        hasSpecificEvents,
        message: hasSpecificEvents
          ? `Updated ${updatedCount} events for ${targetDate}. Found ${foundEvents.length}/${requestedEvents.length} requested events.`
          : `Updated ${updatedCount} events for ${targetDate}.`
      };

    } catch (error) {
      logger.error('❌ Error refreshing economic calendar:', error);
      throw new Error(`Failed to refresh economic calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

