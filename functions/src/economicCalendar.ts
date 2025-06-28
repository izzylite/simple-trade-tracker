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
 * Enhanced fetch data from MyFXBook for a date range with filtering (LEGACY)
 */
async function fetchFromMyFXBookEnhanced(
  startDate: string,
  endDate: string,
  currencies?: string[],
  impacts?: string[]
): Promise<EconomicEvent[]> {
  logger.info('Fetching economic data from MyFXBook (Enhanced)', {
    startDate,
    endDate,
    currencies: currencies || 'all',
    impacts: impacts || 'all'
  });

  const allEvents: EconomicEvent[] = [];

  // Convert dates and iterate through each day
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    try {
      const dateString = date.toISOString().split('T')[0];
      logger.info(`Scraping events for ${dateString}...`);

      const dayEvents = await scrapeMyFXBookDayEnhanced(dateString);

      // Apply filtering if specified
      let filteredEvents = dayEvents;

      // Currency filtering
      if (currencies && currencies.length > 0) {
        filteredEvents = filteredEvents.filter(event => currencies.includes(event.currency));
        logger.info(`Currency filtered ${dayEvents.length} -> ${filteredEvents.length} events for: ${currencies.join(', ')}`);
      }

      // Impact filtering
      if (impacts && impacts.length > 0) {
        const beforeImpactFilter = filteredEvents.length;
        filteredEvents = filteredEvents.filter(event => impacts.includes(event.impact));
        logger.info(`Impact filtered ${beforeImpactFilter} -> ${filteredEvents.length} events for: ${impacts.join(', ')}`);
      }

      allEvents.push(...filteredEvents);

      // Add delay between requests to be respectful
      if (date < end) {
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000)); // 2-3 seconds
      }
    } catch (error) {
      logger.warn(`Failed to fetch MyFXBook data for ${date.toISOString().split('T')[0]}:`, error);
      // Continue with next date
    }
  }

  logger.info(`Total events collected: ${allEvents.length}`);
  return allEvents;
}
 









/**
 * Enhanced MyFXBook scraping for a specific day
 */
async function scrapeMyFXBookDayEnhanced(dateString: string): Promise<EconomicEvent[]> {
  logger.info(`Scraping MyFXBook directly for date: ${dateString}`);

  try {
    const url = `https://www.myfxbook.com/forex-economic-calendar?day=${dateString}`;
    logger.info(`Fetching URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const html = await response.text();
    logger.info(`Response received, status: ${response.status}, content length: ${html.length}`);
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);
    const events: EconomicEvent[] = [];

    logger.info('Analyzing page structure...');

    // Log some basic page info
    const title = $('title').text();
    logger.info(`Page title: ${title}`);

    // First try MyFXBook specific parsing
    logger.info('Attempting MyFXBook specific parsing...');
    const myFxBookEvents = parseMyFXBookEvents($, dateString);
    let foundEvents = false;

    if (myFxBookEvents.length > 0) {
      logger.info(`Successfully parsed ${myFxBookEvents.length} events using MyFXBook specific parser`);
      events.push(...myFxBookEvents);
      foundEvents = true;
    } else {
      logger.info('MyFXBook specific parsing failed, trying general selectors...');

      // Try multiple selectors to find economic events
      const selectors = [
        'table.calendar-table tr',
        '.calendar-row',
        '.event-row',
        'tr[data-event]',
        '.economic-event',
        'table tr',
        '.calendar tbody tr'
      ];

      for (const selector of selectors) {
        logger.info(`Trying selector: ${selector}`);
        const elements = $(selector);
        logger.info(`Found ${elements.length} elements`);

        if (elements.length > 0) {
          // Try to parse events from this selector
          const parsedEvents = parseEventsFromElementsEnhanced($, elements, dateString);
          if (parsedEvents.length > 0) {
            events.push(...parsedEvents);
            foundEvents = true;
            logger.info(`Successfully parsed ${parsedEvents.length} events from selector: ${selector}`);
            break;
          }
        }
      }
    }

    if (!foundEvents) {
      logger.info('No events found with any selector, trying fallback parsing...');

      // Fallback: look for any text that might contain economic events
      const bodyText = $('body').text();
      logger.info(`Body text length: ${bodyText.length}`);

      // Look for currency patterns in the text
      const currencyMatches = bodyText.match(/\b(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD|CNY)\b/g);
      if (currencyMatches) {
        logger.info(`Found currencies in text: ${[...new Set(currencyMatches)].join(', ')}`);

        // Create a basic event for each currency found
        [...new Set(currencyMatches)].forEach(currency => {
          events.push({
            currency: currency,
            event: `Economic Event (${currency})`,
            impact: 'Medium',
            time_utc: `${dateString}T12:00:00+00:00`,
            actual: '',
            forecast: '',
            previous: ''
          });
        });
      }
    }

    logger.info(`Total events parsed: ${events.length}`);
    return events;

  } catch (error) {
    logger.error(`Error scraping MyFXBook for ${dateString}:`, error);
    throw error;
  }
}

/**
 * Parse MyFXBook specific event structure
 */
function parseMyFXBookEvents($: any, dateString: string): EconomicEvent[] {
  const events: EconomicEvent[] = [];

  try {
    // Look for MyFXBook's specific event structure
    // Events are typically in table rows with specific classes or data attributes
    const eventRows = $('tr').filter((_i: number, el: any) => {
      const $row = $(el);
      const rowText = $row.text();

      // Check if row contains economic event data
      return rowText.includes('EUR') || rowText.includes('USD') || rowText.includes('GBP') ||
             rowText.includes('JPY') || rowText.includes('AUD') || rowText.includes('CAD') ||
             rowText.includes('CHF') && (
               rowText.includes('Rate') || rowText.includes('Index') || rowText.includes('Sales') ||
               rowText.includes('PMI') || rowText.includes('GDP') || rowText.includes('CPI') ||
               rowText.includes('Inflation') || rowText.includes('Employment') ||
               rowText.includes('Manufacturing') || rowText.includes('Services')
             );
    });

    logger.info(`Found ${eventRows.length} potential MyFXBook event rows`);

    eventRows.each((_index: number, row: any) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length >= 4) {
        // MyFXBook typically has: Time, Currency, Event, Impact, Actual, Forecast, Previous
        const timeText = $(cells[0]).text().trim();
        const currencyText = $(cells[1]).text().trim();
        const eventText = $(cells[2]).text().trim();
        const impactText = cells.length > 3 ? $(cells[3]).text().trim() : '';
        const actualText = cells.length > 4 ? $(cells[4]).text().trim() : '';
        const forecastText = cells.length > 5 ? $(cells[5]).text().trim() : '';
        const previousText = cells.length > 6 ? $(cells[6]).text().trim() : '';

        // Validate currency
        const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
        if (!validCurrencies.includes(currencyText)) {
          return;
        }

        // Enhanced event name extraction and cleaning
        let cleanEventName = eventText.trim();

        // Remove currency codes from event name (more aggressive cleaning)
        validCurrencies.forEach(curr => {
          // Remove currency at the beginning of the string
          cleanEventName = cleanEventName.replace(new RegExp(`^${curr}\\s+`, 'g'), '').trim();
          // Remove currency anywhere in the string
          cleanEventName = cleanEventName.replace(new RegExp(`\\b${curr}\\b`, 'g'), '').trim();
        });

        // Remove time indicators like "4h 5min", "35 min", "28 min", etc.
        cleanEventName = cleanEventName.replace(/\d+h\s*\d*min?/gi, '').trim();
        cleanEventName = cleanEventName.replace(/\d+\s*min/gi, '').trim();
        cleanEventName = cleanEventName.replace(/\d+h/gi, '').trim();

        // Remove "days" prefix that sometimes appears
        cleanEventName = cleanEventName.replace(/^days\s+/i, '').trim();

        // Remove common prefixes that include currency
        cleanEventName = cleanEventName.replace(/^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)\s*/gi, '').trim();

        // Remove impact level indicators that get mixed into event names
        cleanEventName = cleanEventName.replace(/\s+(High|Medium|Low)\s*$/gi, '').trim();
        cleanEventName = cleanEventName.replace(/^(High|Medium|Low)\s+/gi, '').trim();

        // Remove leading "min" that appears in some events
        cleanEventName = cleanEventName.replace(/^min\s+/gi, '').trim();

        // Remove trailing incomplete parentheses like "(May" or "(Jun"
        cleanEventName = cleanEventName.replace(/\s*\([A-Za-z]{3}$/, '').trim();

        // Remove leading/trailing special characters and extra spaces
        cleanEventName = cleanEventName.replace(/^[^\w]+|[^\w]+$/g, '').trim();
        cleanEventName = cleanEventName.replace(/\s+/g, ' ').trim();

        // Remove any remaining currency codes that might be embedded
        validCurrencies.forEach(curr => {
          cleanEventName = cleanEventName.replace(new RegExp(`\\s+${curr}\\s+`, 'g'), ' ').trim();
        });

        // Final cleanup
        cleanEventName = cleanEventName.replace(/^\s+|\s+$/g, '').trim();

        // Skip if event name is too short or invalid
        if (cleanEventName.length < 3) {
          logger.debug(`Skipping row - event name too short: "${cleanEventName}"`);
          return;
        }

        // Parse time
        let timeUtc = `${dateString}T12:00:00+00:00`;
        const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hours = timeMatch[1].padStart(2, '0');
          const minutes = timeMatch[2];
          timeUtc = `${dateString}T${hours}:${minutes}:00+00:00`;
        }

        // Determine impact using proper emoji mapping and text analysis
        let impact = 'Medium'; // Default fallback

        // First, check for visual impact indicators (most reliable)
        if (impactText.includes('🔴') || impactText.toLowerCase().includes('high')) {
          impact = 'High';
        } else if (impactText.includes('🟢') || impactText.toLowerCase().includes('low')) {
          impact = 'Low';
        } else if (impactText.includes('🟡') || impactText.toLowerCase().includes('medium')) {
          impact = 'Medium';
        }

        // Additional validation: check for impact keywords in the cell text
        const impactKeywords = {
          high: ['high', 'important', 'major'],
          medium: ['medium', 'moderate'],
          low: ['low', 'minor']
        };

        const lowerImpactText = impactText.toLowerCase();
        if (impactKeywords.high.some(keyword => lowerImpactText.includes(keyword))) {
          impact = 'High';
        } else if (impactKeywords.low.some(keyword => lowerImpactText.includes(keyword))) {
          impact = 'Low';
        } else if (impactKeywords.medium.some(keyword => lowerImpactText.includes(keyword))) {
          impact = 'Medium';
        }

        events.push({
          currency: currencyText,
          event: cleanEventName,
          impact: impact,
          time_utc: timeUtc,
          actual: actualText,
          forecast: forecastText,
          previous: previousText
        });

        logger.info(`✅ Parsed clean event: ${currencyText} - "${cleanEventName}" (${impact})`);
      }
    });

  } catch (error) {
    logger.warn('Error parsing MyFXBook events:', error);
  }

  return events;
}

/**
 * Enhanced parsing function for economic events
 */
function parseEventsFromElementsEnhanced($: any, elements: any, dateString: string): EconomicEvent[] {
  const events: EconomicEvent[] = [];

  logger.info(`Parsing ${elements.length} elements for economic events...`);

  elements.each((index: number, element: any) => {
    try {
      const $row = $(element);
      const cells = $row.find('td');
      const rowText = $row.text().trim();

      // Skip header rows and empty rows
      if (rowText.length < 10 || rowText.toLowerCase().includes('date') ||
          rowText.toLowerCase().includes('time') || rowText.toLowerCase().includes('currency')) {
        return;
      }

      // Look for economic event patterns in the row text
      const economicEventPatterns = [
        /\b(GDP|CPI|NFP|PPI|PMI|Unemployment|Employment|Inflation|Interest Rate|Fed|ECB|BOE|BOJ)\b/i,
        /\b(Non.?Farm|Payroll|Consumer Price|Producer Price|Manufacturing|Services|Retail Sales)\b/i,
        /\b(Trade Balance|Current Account|Industrial Production|Housing|Construction)\b/i,
        /\b(Durable Goods|Personal Income|Personal Spending|Core|Preliminary|Final)\b/i
      ];

      const hasEconomicEvent = economicEventPatterns.some(pattern => pattern.test(rowText));

      if (hasEconomicEvent) {
        logger.info(`Found potential economic event in row ${index}: ${rowText.substring(0, 100)}...`);

        // Extract currency from the row
        const currencyMatch = rowText.match(/\b(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD|CNY)\b/);
        const currency = currencyMatch ? currencyMatch[1] : 'USD';

        // Extract full event name - look for complete economic event titles
        let eventName = '';

        // Try to extract full event name from structured data
        const eventNamePatterns = [
          // Full event names with periods/months
          /([A-Za-z\s]+(?:Rate|Index|Sales|Production|Confidence|Balance|Income|Spending|Orders|Claims|PMI|GDP|CPI|PPI|NFP)(?:\s+[A-Za-z]+)*(?:\s+\([A-Za-z]{3}\))?)/i,
          // Central bank events
          /(Fed\s+[A-Za-z\s]+|ECB\s+[A-Za-z\s]+|BOE\s+[A-Za-z\s]+|BOJ\s+[A-Za-z\s]+)/i,
          // Economic indicators with descriptors
          /([A-Za-z\s]*(?:Inflation|Employment|Unemployment|Manufacturing|Services|Housing|Construction|Trade|Current Account|Industrial|Durable Goods|Personal|Core|Preliminary|Final)[A-Za-z\s]*(?:Rate|Index|Data|Report|Change|YoY|MoM|QoQ)?(?:\s+\([A-Za-z]{3}\))?)/i
        ];

        for (const pattern of eventNamePatterns) {
          const match = rowText.match(pattern);
          if (match && match[1] && match[1].length > 3) {
            eventName = match[1].trim();

            // Apply enhanced cleaning logic
            const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

            // Remove currency codes from event name
            validCurrencies.forEach(curr => {
              eventName = eventName.replace(new RegExp(`^${curr}\\s+`, 'g'), '').trim();
              eventName = eventName.replace(new RegExp(`\\b${curr}\\b`, 'g'), '').trim();
            });

            // Remove time indicators like "4h 5min", "35 min", etc.
            eventName = eventName.replace(/\d+h\s*\d*min?/gi, '').trim();
            eventName = eventName.replace(/\d+\s*min/gi, '').trim();
            eventName = eventName.replace(/\d+h/gi, '').trim();

            // Remove "days" prefix that sometimes appears
            eventName = eventName.replace(/^days\s+/i, '').trim();

            // Clean up the event name
            eventName = eventName.replace(/\s+/g, ' '); // Remove extra spaces
            eventName = eventName.replace(/^\W+|\W+$/g, ''); // Remove leading/trailing non-word chars

            // Remove any remaining currency codes that might be embedded
            validCurrencies.forEach(curr => {
              eventName = eventName.replace(new RegExp(`\\s+${curr}\\s+`, 'g'), ' ').trim();
            });

            break;
          }
        }

        // Fallback to original pattern matching if no full name found
        if (!eventName) {
          for (const pattern of economicEventPatterns) {
            const match = rowText.match(pattern);
            if (match) {
              eventName = match[0];
              break;
            }
          }
        }

        // Extract time if available
        const timeMatch = rowText.match(/(\d{1,2}):(\d{2})/);
        let timeUtc = `${dateString}T12:00:00+00:00`;
        if (timeMatch) {
          const hours = timeMatch[1].padStart(2, '0');
          const minutes = timeMatch[2];
          timeUtc = `${dateString}T${hours}:${minutes}:00+00:00`;
        }

        // Determine impact based on visual indicators and text analysis (no keyword assumptions)
        let impact = 'Medium'; // Default fallback

        // Check for visual impact indicators first (most reliable)
        if (rowText.includes('🔴') || rowText.toLowerCase().includes('high impact')) {
          impact = 'High';
        } else if (rowText.includes('�') || rowText.toLowerCase().includes('low impact')) {
          impact = 'Low';
        } else if (rowText.includes('🟡') || rowText.toLowerCase().includes('medium impact')) {
          impact = 'Medium';
        }

        // Look for explicit impact level text in the row
        const impactMatch = rowText.match(/\b(High|Medium|Low)\b/i);
        if (impactMatch) {
          const matchedImpact = impactMatch[1];
          if (['High', 'Medium', 'Low'].includes(matchedImpact)) {
            impact = matchedImpact;
          }
        }

        // Extract numerical values (actual, forecast, previous)
        const numbers = rowText.match(/[\d.,]+%?/g) || [];
        const actual = numbers[0] || '';
        const forecast = numbers[1] || '';
        const previous = numbers[2] || '';

        events.push({
          currency: currency,
          event: eventName || 'Economic Event',
          impact: impact,
          time_utc: timeUtc,
          actual: actual,
          forecast: forecast,
          previous: previous
        });
      }

      // Also try traditional table parsing for structured data
      if (cells.length >= 3) {
        const timeCell = $(cells[0]).text().trim();
        const currencyCell = $(cells[1]).text().trim();
        const eventCell = $(cells[2]).text().trim();
        const impactCell = cells.length > 3 ? $(cells[3]).text().trim() : '';
        const actualCell = cells.length > 4 ? $(cells[4]).text().trim() : '';
        const forecastCell = cells.length > 5 ? $(cells[5]).text().trim() : '';
        const previousCell = cells.length > 6 ? $(cells[6]).text().trim() : '';

        // Validate currency (should be 3 letters)
        const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];
        const currency = validCurrencies.includes(currencyCell) ? currencyCell :
                        validCurrencies.find(c => currencyCell.includes(c)) || null;

        // Enhanced event name extraction and cleaning
        let cleanEventName = eventCell.trim();

        // Apply the same enhanced cleaning logic as parseMyFXBookEvents
        // Remove currency codes from event name (more aggressive cleaning)
        validCurrencies.forEach(curr => {
          // Remove currency at the beginning of the string
          cleanEventName = cleanEventName.replace(new RegExp(`^${curr}\\s+`, 'g'), '').trim();
          // Remove currency anywhere in the string
          cleanEventName = cleanEventName.replace(new RegExp(`\\b${curr}\\b`, 'g'), '').trim();
        });

        // Remove time indicators like "4h 5min", "35 min", "28 min", etc.
        cleanEventName = cleanEventName.replace(/\d+h\s*\d*min?/gi, '').trim();
        cleanEventName = cleanEventName.replace(/\d+\s*min/gi, '').trim();
        cleanEventName = cleanEventName.replace(/\d+h/gi, '').trim();

        // Remove "days" prefix that sometimes appears
        cleanEventName = cleanEventName.replace(/^days\s+/i, '').trim();

        // Remove impact level indicators that get mixed into event names
        cleanEventName = cleanEventName.replace(/\s+(High|Medium|Low)\s*$/gi, '').trim();
        cleanEventName = cleanEventName.replace(/^(High|Medium|Low)\s+/gi, '').trim();

        // Remove leading "min" that appears in some events
        cleanEventName = cleanEventName.replace(/^min\s+/gi, '').trim();

        // Remove trailing incomplete parentheses like "(May" or "(Jun"
        cleanEventName = cleanEventName.replace(/\s*\([A-Za-z]{3}$/, '').trim();

        // Remove common prefixes/suffixes that might be artifacts
        cleanEventName = cleanEventName.replace(/^[\d\s:]+/, ''); // Remove leading time/numbers
        cleanEventName = cleanEventName.replace(/\s*\([^)]*\)\s*$/, ''); // Remove trailing parentheses

        // Remove leading/trailing special characters and extra spaces
        cleanEventName = cleanEventName.replace(/^[^\w]+|[^\w]+$/g, '').trim();
        cleanEventName = cleanEventName.replace(/\s+/g, ' ').trim();

        // Remove any remaining currency codes that might be embedded
        validCurrencies.forEach(curr => {
          cleanEventName = cleanEventName.replace(new RegExp(`\\s+${curr}\\s+`, 'g'), ' ').trim();
        });

        // Final cleanup
        cleanEventName = cleanEventName.replace(/^\s+|\s+$/g, '').trim();

        // Validate event name (should not be column headers or currency pairs)
        const invalidEvents = ['EVENT', 'PREVIOUS', 'FORECAST', 'ACTUAL', 'IMPACT', 'TIME', 'CURRENCY', 'DATE'];
        const isCurrencyPair = /^[A-Z]{6}$/.test(cleanEventName); // EURUSD, GBPUSD, etc.
        const isValidEvent = cleanEventName && cleanEventName.length > 2 &&
                            !invalidEvents.includes(cleanEventName.toUpperCase()) &&
                            !isCurrencyPair && currency;

        if (isValidEvent) {

          // Determine impact using proper emoji mapping
          let impact = 'Medium'; // Default fallback

          // Check for visual impact indicators and text
          if (impactCell.toLowerCase().includes('high') || impactCell.includes('🔴')) {
            impact = 'High';
          } else if (impactCell.toLowerCase().includes('low') || impactCell.includes('�')) {
            impact = 'Low';
          } else if (impactCell.toLowerCase().includes('medium') || impactCell.includes('🟡')) {
            impact = 'Medium';
          }

          // Parse time
          let timeUtc = `${dateString}T12:00:00+00:00`;
          if (timeCell && timeCell.includes(':')) {
            const timeMatch = timeCell.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              const hours = timeMatch[1].padStart(2, '0');
              const minutes = timeMatch[2];
              timeUtc = `${dateString}T${hours}:${minutes}:00+00:00`;
            }
          }

          events.push({
            currency: currency,
            event: cleanEventName,
            impact: impact,
            time_utc: timeUtc,
            actual: actualCell || '',
            forecast: forecastCell || '',
            previous: previousCell || ''
          });
        }
      }
    } catch (parseError) {
      logger.warn('Error parsing element:', parseError);
    }
  });

  logger.info(`Extracted ${events.length} economic events from parsing`);
  return events;
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

      // Fetch all events
      const allEvents = await fetchFromMyFXBookEnhanced(today, nextWeek);

      // Filter for major currencies
      const majorCurrencyEvents = allEvents.filter(event =>
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
 * Fetch economic calendar data from MyFXBook
 */
export const fetchEconomicCalendarV2 = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60
  },
  async (request) => {
    try {
      const { start, end, currencies, impacts } = request.data;

      if (!start || !end) {
        throw new Error('Start and end dates are required');
      }

      logger.info(`Fetching economic calendar data from ${start} to ${end}`, {
        currencies: currencies || 'all',
        impacts: impacts || 'all'
      });

      // Fetch fresh data from MyFXBook with enhanced scraping and filtering
      const events = await fetchFromMyFXBookEnhanced(start, end, currencies, impacts);

      logger.info(`Successfully fetched ${events.length} economic events`);

      return {
        eco_elements: events
      };
    } catch (error) {
      logger.error('Error fetching economic calendar:', error);
      throw new Error('Failed to fetch economic calendar data');
    }
  }
);

/**
 * Get cached economic calendar data
 */
export const getCachedEconomicCalendarV2 = onCall(
  {
    region: 'us-central1',
    memory: '256MiB'
  },
  async (request) => {
    try {
      // For now, just return null since we're focusing on direct fetching
      // This can be enhanced later with proper caching
      logger.info('getCachedEconomicCalendar called:', request.data);
      return null;
    } catch (error) {
      logger.error('Error getting cached economic calendar:', error);
      throw new Error('Failed to get cached data');
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

    // Find all table rows that contain economic data
    const tableRows = $('tr').filter((_i, el) => {
      const $row = $(el);
      const text = $row.text();

      // Look for any economic data (no date filtering - get all events)
      const hasRelevantData = text.includes('USD') || text.includes('EUR') ||
                             text.includes('GBP') || text.includes('JPY') ||
                             text.includes('AUD') || text.includes('CAD') ||
                             text.includes('CHF') || text.includes('Fed') ||
                             text.includes('PMI') || text.includes('ECB') ||
                             text.includes('Inflation') || text.includes('PCE') ||
                             text.includes('Retail Sales') || text.includes('Consumer');

      return hasRelevantData;
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

        // Extract event name (look for meaningful event descriptions)
        for (const cell of cellTexts) {
          if (cell.length > 5 &&
              !validCurrencies.includes(cell) &&
              !validImpacts.includes(cell) &&
              !cell.match(/^\d{1,2}:\d{2}$/) &&
              !cell.match(/^(Jun|Jul) \d{1,2}$/) &&
              (cell.includes('PMI') || cell.includes('Inflation') ||
               cell.includes('Fed') || cell.includes('ECB') ||
               cell.includes('Sales') || cell.includes('Consumer') ||
               cell.includes('Employment') || cell.includes('GDP') ||
               cell.includes('Speech') || cell.includes('Rate'))) {
            eventName = cell;
            break;
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
            event: eventName,
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

      // Test enhanced MyFXBook scraping
      const events = await fetchFromMyFXBookEnhanced(dateString, dateString);

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
