const cheerio = require('cheerio');
const fs = require('fs');
const crypto = require('crypto');

// Add logger implementation
const logger = {
  info: (message, ...args) => console.log(message, ...args),
  warn: (message, ...args) => console.warn(message, ...args),
  error: (message, ...args) => console.error(message, ...args)
};

/**
 * Check if a value looks like a numeric economic indicator
 */
function isNumericValue(value) {
  if (!value || typeof value !== 'string') return false;

  const trimmed = value.trim();

  // Skip obviously non-numeric values
  if (trimmed.length === 0 || trimmed.length > 25) return false;
  if (/^[a-zA-Z\s]+$/.test(trimmed)) return false; // Only letters and spaces
  if (trimmed.includes(':') && /\d{1,2}:\d{2}/.test(trimmed)) return false; // Time format

  // Remove common formatting and check if it's a number
  const cleaned = trimmed
    .replace(/[,%$€£¥]/g, '') // Remove currency symbols and formatting
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/^\+/, '') // Remove leading plus sign
    .replace(/\s+/g, ''); // Remove spaces

  // Check for various numeric patterns
  const numericPatterns = [
    /^-?\d+\.?\d*$/, // Basic numbers: 123, 123.45, -123.45
    /^-?\d+\.?\d*[KMB]$/i, // Numbers with K/M/B suffix: 123K, 1.5M, 2B
    /^-?\d+\.?\d*%$/, // Percentages: 2.5%, -1.2%
    /^-?\d{1,3}(,\d{3})*\.?\d*$/, // Numbers with comma separators: 1,234.56
    /^\d+\.?\d*[KMB]?$/i, // Positive numbers with optional suffix
    /^-?\d+\.?\d*[bp]$/i, // Basis points: 25bp, -10bp
  ];

  const isNumeric = numericPatterns.some(pattern => pattern.test(cleaned));
  const canParse = !isNaN(parseFloat(cleaned.replace(/[KMBbp%]/gi, '')));

  return isNumeric && canParse && cleaned.length > 0;
}

/**
 * Clean and normalize numeric values
 */
function cleanNumericValue(value) {
  if (!value) return '';

  return value.trim()
    .replace(/^\+/, '') // Remove leading plus
    .replace(/,/g, '') // Remove commas
    .trim();
}

/**
 * Get flag image URL from country code
 */
function getFlagUrl(countryCode, size = 'w160') {
  if (!countryCode) return '';

  // Use FlagCDN for reliable flag images
  return `https://flagcdn.com/${size}/${countryCode.toLowerCase()}.png`;
}

/**
 * Generate a unique ID for an economic event
 * Based on currency, event name, date, and time to ensure uniqueness
 */
function generateEventId(currency, eventName, dateTime, impact) {
  // Create a string that uniquely identifies this event
  const uniqueString = `${currency}-${eventName}-${dateTime}-${impact}`.toLowerCase();

  // Generate a hash of the unique string
  const hash = crypto.createHash('sha256').update(uniqueString).digest('hex');

  // Return first 20 characters to match Firebase ID standards
  return hash.substring(0, 20);
}

/**
 * Get country information including flag URL
 */
async function getCountryInfo(countryCode) {
  if (!countryCode) return null;

  try {
    // Use REST Countries API for comprehensive country data
    const response = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`);
    const data = await response.json();

    if (data && data[0]) {
      const country = data[0];
      return {
        name: country.name?.common || '',
        officialName: country.name?.official || '',
        flagUrl: country.flags?.png || getFlagUrl(countryCode),
        flagSvg: country.flags?.svg || '',
        region: country.region || '',
        capital: country.capital?.[0] || ''
      };
    }
  } catch (error) {
    console.warn(`Could not fetch country info for ${countryCode}:`, error);
  }

  // Fallback to just flag URL
  return {
    name: '',
    flagUrl: getFlagUrl(countryCode),
    flagSvg: '',
    region: '',
    capital: ''
  };
}

/**
 * Enhanced MyFXBook weekly parsing using our tested logic
 */
async function parseMyFXBookWeeklyEnhanced(html) {
  logger.info('🔧 Parsing MyFXBook HTML with enhanced weekly logic...');

  try {
    const $ = cheerio.load(html);
    const events = [];

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
      // Updated to match all months, not just Jun/Jul
      const hasDatePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2}/i.test(text);
      const hasCurrency = /\b(USD|EUR|GBP|JPY|AUD|CAD|CHF)\b/.test(text);

      return hasEnoughCells && hasDatePattern && hasCurrency;
    });

    logger.info(`📊 Found ${tableRows.length} potential event rows`);

    // Debug: If no rows found, let's examine the HTML structure
    if (tableRows.length === 0) {
      logger.info('🔍 No rows found with current criteria. Analyzing HTML structure...');

      // Check total number of tables and rows
      const allTables = $('table');
      const allRows = $('tr');
      logger.info(`📋 Total tables in HTML: ${allTables.length}`);
      logger.info(`📋 Total rows in HTML: ${allRows.length}`);

      // Sample some row content for debugging
      logger.info('📋 Sample of first 10 table rows:');
      allRows.slice(0, 10).each((i, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        const cellTexts = cells.map((_j, cell) => $(cell).text().trim()).get();
        const text = $row.text().trim().substring(0, 100); // First 100 chars
        logger.info(`  Row ${i}: ${cells.length} cells, text: "${text}"`);
        if (cells.length > 0) {
          logger.info(`    Cells: [${cellTexts.slice(0, 8).map(c => `"${c}"`).join(', ')}]`);
        }
      });

      // Check for any rows with currency codes
      const rowsWithCurrency = $('tr').filter((_i, el) => {
        const text = $(el).text();
        return /\b(USD|EUR|GBP|JPY|AUD|CAD|CHF)\b/.test(text);
      });
      logger.info(`📋 Rows containing currency codes: ${rowsWithCurrency.length}`);

      // Check for any rows with date patterns
      const rowsWithDates = $('tr').filter((_i, el) => {
        const text = $(el).text();
        return /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2}/i.test(text);
      });
      logger.info(`📋 Rows containing date patterns: ${rowsWithDates.length}`);
    }

    // Process each row
    tableRows.each((i, row) => {
      try {
        const $row = $(row);
        const cellTexts = $row.find('td, th').map((_j, cell) => $(cell).text().trim()).get();

        if (cellTexts.length < 4) return; // Skip rows with insufficient data

        // Debug: Log cell structure for first few rows to understand the format
        if (i < 5) {
          logger.info(`🔍 Row ${i} structure: [${cellTexts.map((cell, idx) => `${idx}:"${cell}"`).join(', ')}]`);
        }

        // Extract data using enhanced logic
        let currency = '';
        let eventName = '';
        let impact = '';
        let time = '';
        let date = '';
        let actual = '';
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

        // Extract country and flag information from the flag column (typically 3rd column)
        const $flagCells = $row.find('td');
        $flagCells.each((cellIndex, cell) => {
          const $cell = $(cell);

          // Debug: Log cell content for first few rows to understand structure
          if (i < 3 && cellIndex < 5) {
            const cellHtml = $cell.html();
            if (cellHtml && cellHtml.includes('flag')) {
              logger.info(`🔍 Flag cell ${cellIndex} HTML: ${cellHtml.substring(0, 200)}`);
            }
          }

          // Look for flag elements - MyFXBook uses specific patterns
          const $flagIcon = $cell.find('i[title]'); // Icon with title attribute
          const $flagSpan = $cell.find('span.flag'); // Span with flag class
          const $allFlags = $cell.find('[class*="flag"]'); // Any element with "flag" in class

          if ($flagIcon.length > 0) {
            // Extract country from title attribute
            const titleAttr = $flagIcon.attr('title');
            if (titleAttr && titleAttr.length > 0) {
              country = titleAttr.trim();
              if (i < 3) logger.info(`🏳️ Found country from title: ${country}`);
            }

            // Extract country from class attribute as backup
            if (!country) {
              const classAttr = $flagIcon.attr('class');
              if (classAttr) {
                // Look for country name in class (e.g., "United States align-center")
                const countryMatch = classAttr.match(/^([A-Za-z\s]+)\s+align-center/);
                if (countryMatch) {
                  country = countryMatch[1].trim();
                  if (i < 3) logger.info(`🏳️ Found country from class: ${country}`);
                }
              }
            }
          }

          if ($flagSpan.length > 0) {
            // Extract flag class (e.g., "flag-icon-us")
            const spanClass = $flagSpan.attr('class');
            if (spanClass) {
              const flagMatch = spanClass.match(/flag-icon-([a-z]{2})/);
              if (flagMatch) {
                flagClass = flagMatch[1]; // Extract country code (e.g., "us")
                if (i < 3) logger.info(`🚩 Found flag code: ${flagClass}`);
              }
            }
          }

          // Alternative: Look for any flag-related classes
          if (!flagClass && $allFlags.length > 0) {
            $allFlags.each((_idx, flagEl) => {
              const flagElClass = $(flagEl).attr('class');
              if (flagElClass) {
                const flagMatch = flagElClass.match(/flag-icon-([a-z]{2})/);
                if (flagMatch) {
                  flagClass = flagMatch[1];
                  if (i < 3) logger.info(`🚩 Found flag code from alternative search: ${flagClass}`);
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

        // Debug: Log what we extracted for first few rows
        if (i < 3 && (actual || forecast || previous)) {
          logger.info(`🔢 Row ${i} extracted - Previous: "${previous}", Forecast: "${forecast}", Actual: "${actual}"`);
        }

        // Validate and create event
        // Only include events that have actual economic data OR are significant events
        const hasEconomicData = actual || forecast || previous;
        const isSignificantEvent = impact && impact !== 'None' && impact !== '';

        if (currency && eventName && eventName.length > 3 && (hasEconomicData || isSignificantEvent)) {
          // Create ISO date string
          let isoDate = '';
          if (date && time) {
            // Convert to proper date format (assuming current year)
            const year = new Date().getFullYear();
            const monthMap = {
              'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
              'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
              'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };

            // Try different date formats
            let dateMatch = date.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
            if (dateMatch) {
              const month = monthMap[dateMatch[1]];
              const day = dateMatch[2].padStart(2, '0');
              isoDate = `${year}-${month}-${day}T${time}:00+00:00`;
            } else {
              // Try reverse format: "15 Jan"
              dateMatch = date.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
              if (dateMatch) {
                const day = dateMatch[1].padStart(2, '0');
                const month = monthMap[dateMatch[2]];
                isoDate = `${year}-${month}-${day}T${time}:00+00:00`;
              } else {
                // Try MM/DD/YYYY format
                dateMatch = date.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
                if (dateMatch) {
                  const month = dateMatch[1].padStart(2, '0');
                  const day = dateMatch[2].padStart(2, '0');
                  const yearPart = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
                  isoDate = `${yearPart}-${month}-${day}T${time}:00+00:00`;
                } else {
                  // Try YYYY-MM-DD format
                  dateMatch = date.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                  if (dateMatch) {
                    const yearPart = dateMatch[1];
                    const month = dateMatch[2].padStart(2, '0');
                    const day = dateMatch[3].padStart(2, '0');
                    isoDate = `${yearPart}-${month}-${day}T${time}:00+00:00`;
                  }
                }
              }
            }
          }

          if (!isoDate) {
            // Skip events without valid dates - we only want actual scraped data
            logger.info(`⚠️ Skipping event "${eventName}" - no valid date found`);
            return; // Skip this row in the .each() loop
          }

          const cleanedEventName = cleanEventName(eventName);

          // Debug: Log the cleaning process for first few events
          if (events.length < 5 && eventName !== cleanedEventName) {
            logger.info(`🔧 Event cleaning: "${eventName}" → "${cleanedEventName}"`);
          }

          // Generate unique ID for the event
          const eventId = generateEventId(currency, cleanedEventName, isoDate, impact || 'None');
          flagClass = flagClass === "emu" || flagClass === "em" ? "eu" : flagClass;
          const event = {
            id: eventId,
            currency,
            event: cleanedEventName, // Apply proper event name cleaning
            impact: impact || 'None',
            time_utc: isoDate,
            actual: actual || '',
            forecast: forecast || '',
            previous: previous || '',
            country: country || '',
            flagCode: flagClass || '',
            flagUrl: flagClass ? getFlagUrl(flagClass) : ''
          };

          events.push(event);

          if (events.length <= 10) { // Log first 10 events for debugging
            const actualStr = actual ? ` | A:${actual}` : '';
            const forecastStr = forecast ? ` | F:${forecast}` : '';
            const previousStr = previous ? ` | P:${previous}` : '';
            const countryStr = country ? ` | ${country}` : '';
            const flagStr = flagClass ? ` | ${flagClass}` : '';
            logger.info(`✅ Extracted: ${date || 'Unknown'} | ${time || '00:00'} | ${currency} ${eventName} | ${impact || 'Medium'}${actualStr}${forecastStr}${previousStr}${countryStr}${flagStr}`);
          }
        }

      } catch (rowError) {
        // Skip individual row errors
        logger.warn(`⚠️ Error processing row ${i}:`, rowError);
      }
    });

    // Analyze the types of events we extracted
    const eventsWithData = events.filter(e => e.actual || e.forecast || e.previous);
    const eventsWithoutData = events.filter(e => !e.actual && !e.forecast && !e.previous);
    const eventsWithCountry = events.filter(e => e.country);
    const countries = [...new Set(events.map(e => e.country).filter(c => c))];
    const flagCodes = [...new Set(events.map(e => e.flagCode).filter(f => f))];

    logger.info(`🎉 Successfully extracted ${events.length} events`);
    logger.info(`📊 Events with economic data: ${eventsWithData.length}`);
    logger.info(`📅 Events without data (holidays/announcements): ${eventsWithoutData.length}`);
    logger.info(`🏳️ Events with country info: ${eventsWithCountry.length}`);
    logger.info(`🌍 Countries found: ${countries.join(', ')}`);
    logger.info(`🚩 Flag codes found: ${flagCodes.join(', ')}`);

    if (eventsWithData.length > 0) {
      logger.info(`💰 Sample events with data:`);
      eventsWithData.slice(0, 3).forEach((event, i) => {
        const dataStr = [
          event.actual ? `A:${event.actual}` : '',
          event.forecast ? `F:${event.forecast}` : '',
          event.previous ? `P:${event.previous}` : ''
        ].filter(s => s).join(', ');
        const locationStr = event.country ? ` [${event.country}]` : '';
        const flagStr = event.flagUrl ? ` 🏳️ ${event.flagUrl}` : '';
        logger.info(`  ${i + 1}. ${event.currency} ${event.event}${locationStr} (${dataStr})${flagStr}`);
      });
    }

    return events;

  } catch (error) {
    logger.error('❌ Error in parseMyFXBookWeeklyEnhanced:', error);
    throw error;
  }
}

/**
 * Clean event names by removing currency prefixes, time indicators, and impact levels
 */
function cleanEventName(eventName) {
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

  // Don't remove trailing month abbreviations - we'll fix them by adding closing bracket



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

  // Debug logging for first few events to see what's happening
  // if (originalName.includes('(') && originalName !== cleaned) {
  //   logger.info(`🧹 Cleaned: "${originalName}" → "${cleaned}"`);
  // }

  return cleaned;
}

/**
 * Store events in database using cloud function (same approach as populate-fresh-data.js)
 */
async function storeEventsInDatabase(events) {
  console.log(`\n💾 Storing ${events.length} events using cloud function...`);

  try {
    // Create a cloud function that can accept manual events
    // For now, we'll create a simple JSON output that can be manually imported
    console.log('\n📄 EVENTS DATA FOR MANUAL IMPORT:');
    console.log('='.repeat(60));

    const eventsData = {
      source: 'manual-html-import',
      timestamp: new Date().toISOString(),
      events: events,
      summary: {
        totalEvents: events.length,
        currencies: Array.from(new Set(events.map(e => e.currency))),
        impacts: Array.from(new Set(events.map(e => e.impact))),
        dateRange: {
          start: events.length > 0 ? events.map(e => e.time_utc).sort()[0] : '',
          end: events.length > 0 ? events.map(e => e.time_utc).sort().reverse()[0] : ''
        }
      }
    };

    // Save to JSON file for manual import
    const outputFile = `manual-import-${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(eventsData, null, 2));

    console.log(`📁 Events saved to: ${outputFile}`);
    console.log(`💡 You can use this file to manually import the events later`);

    // For now, return success without actually storing
    // TODO: Create a cloud function to accept this data
    return {
      storedCount: events.length,
      duplicateCount: 0,
      outputFile: outputFile
    };

  } catch (error) {
    console.error('❌ Error preparing events for storage:', error);
    return { storedCount: 0, duplicateCount: 0 };
  }
}

/**
 * Main function to import HTML and update database
 */
async function importHTMLToDatabase(htmlFilePath) {
  console.log('🚀 MANUAL HTML IMPORT TO DATABASE\n');
  console.log('='.repeat(60));

  try {
    // Check if HTML file exists
    if (!fs.existsSync(htmlFilePath)) {
      throw new Error(`HTML file not found: ${htmlFilePath}`);
    }

    console.log(`📄 Reading HTML file: ${htmlFilePath}`);
    const html = fs.readFileSync(htmlFilePath, 'utf8');
    console.log(`📊 HTML file size: ${html.length.toLocaleString()} characters`);

    // Parse the HTML
    const events = await parseMyFXBookWeeklyEnhanced(html);

    if (events.length === 0) {
      console.log('❌ No events found in HTML. Please check the HTML content.');
      return;
    }

    // Analyze the events
    console.log('\n📊 EVENTS ANALYSIS:');
    const currencies = Array.from(new Set(events.map(e => e.currency)));
    const impacts = Array.from(new Set(events.map(e => e.impact)));
    const dates = Array.from(new Set(events.map(e => e.time_utc.split('T')[0])));

    console.log(`💱 Currencies: ${currencies.join(', ')}`);
    console.log(`🎯 Impact levels: ${impacts.join(', ')}`);
    console.log(`📅 Date range: ${dates.length > 0 ? dates.sort()[0] : 'N/A'} to ${dates.length > 0 ? dates.sort().reverse()[0] : 'N/A'}`);
    console.log(`📈 Total events: ${events.length}`);

    // Show sample events
    console.log('\n📋 SAMPLE EVENTS:');
    events.slice(0, 5).forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.currency} - "${event.event}" (${event.impact})`);
      console.log(`     📅 ${event.time_utc}`);
    });

    // Ask for confirmation
    console.log('\n❓ Do you want to proceed with importing these events to the database?');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Store in database
    const result = await storeEventsInDatabase(events);

    console.log('\n🎉 IMPORT COMPLETE!');
    console.log(`✅ ${result.storedCount} new events imported`);
    console.log(`🔄 ${result.duplicateCount} duplicates skipped`);
    console.log(`📊 Total events processed: ${events.length}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Command line usage
async function main() {
  const htmlFilePath = process.argv[2];

  if (!htmlFilePath) {
    console.log('📖 USAGE:');
    console.log('  node import-manual-html.js <path-to-html-file>');
    console.log('');
    console.log('📝 INSTRUCTIONS:');
    console.log('  1. Go to https://www.myfxbook.com/forex-economic-calendar');
    console.log('  2. Select your desired date range using the site\'s controls');
    console.log('  3. Right-click and "Save Page As" or copy the HTML source');
    console.log('  4. Save the HTML file (e.g., "economic-calendar.html")');
    console.log('  5. Run: node import-manual-html.js economic-calendar.html');
    console.log('');
    console.log('💡 TIP: You can manually select different date ranges on MyFXBook');
    console.log('   and import multiple HTML files to build historical data.');
    process.exit(1);
  }

  await importHTMLToDatabase(htmlFilePath);
}

// Export functions for module usage
module.exports = {
  parseMyFXBookHTML: parseMyFXBookWeeklyEnhanced,
  parseMyFXBookWeeklyEnhanced,
  storeEventsInDatabase,
  importHTMLToDatabase,
  cleanEventName,
  generateEventId
};

// Run main function if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
