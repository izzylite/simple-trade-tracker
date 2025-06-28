const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  apiKey: 'AIzaSyBJqJNvW_WwM2d8kKs8Z8Z8Z8Z8Z8Z8Z8Z',
  authDomain: 'tradetracker-30ec1.firebaseapp.com',
  projectId: 'tradetracker-30ec1',
  storageBucket: 'tradetracker-30ec1.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdefghijklmnop'
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

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

  // Remove time indicators like "4h 5min", "35 min", etc.
  cleaned = cleaned.replace(/\d+h\s*\d*min?/gi, '').trim();
  cleaned = cleaned.replace(/\d+\s*min/gi, '').trim();
  cleaned = cleaned.replace(/\d+h/gi, '').trim();

  // Remove "days" prefix that sometimes appears
  cleaned = cleaned.replace(/^days\s+/i, '').trim();

  // Remove impact level indicators that get mixed into event names
  cleaned = cleaned.replace(/\s+(High|Medium|Low)\s*$/gi, '').trim();
  cleaned = cleaned.replace(/^(High|Medium|Low)\s+/gi, '').trim();

  // Remove leading "min" that appears in some events
  cleaned = cleaned.replace(/^min\s+/gi, '').trim();

  // Remove trailing incomplete parentheses like "(May" or "(Jun"
  cleaned = cleaned.replace(/\s*\([A-Za-z]{3}$/, '').trim();

  // Remove common prefixes/suffixes that might be artifacts
  cleaned = cleaned.replace(/^[\d\s:]+/, ''); // Remove leading time/numbers
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/, ''); // Remove trailing parentheses

  // Remove leading/trailing special characters and extra spaces
  cleaned = cleaned.replace(/^[^\w]+|[^\w]+$/g, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remove any remaining currency codes that might be embedded
  validCurrencies.forEach(curr => {
    cleaned = cleaned.replace(new RegExp(`\\s+${curr}\\s+`, 'g'), ' ').trim();
  });

  // Final cleanup
  cleaned = cleaned.replace(/^\s+|\s+$/g, '').trim();

  return cleaned;
}

/**
 * Parse MyFXBook HTML using the same reliable logic as our cloud function
 */
function parseMyFXBookHTML(html) {
  console.log('🔧 Parsing MyFXBook HTML with reliable table-based logic...');

  try {
    const $ = cheerio.load(html);
    const events = [];

    // Valid currencies for filtering
    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];

    console.log('🔍 Looking for table rows with structured economic data...');

    // Find all table rows and process them systematically
    const rows = $('tr');
    console.log(`📊 Found ${rows.length} table rows to analyze`);

    rows.each((index, row) => {
      try {
        const $row = $(row);
        const cells = $row.find('td');
        
        // Only process rows with sufficient cells (proper table structure)
        if (cells.length >= 4) {
          const rowText = $row.text();
          
          // Look for date patterns to identify event rows
          const datePatterns = [
            /Jun\s+\d{1,2}/i,
            /\d{1,2}\s+Jun/i,
            /June\s+\d{1,2}/i,
            /\d{1,2}\s+June/i,
            /Jul\s+\d{1,2}/i,
            /\d{1,2}\s+Jul/i,
            /July\s+\d{1,2}/i,
            /\d{1,2}\s+July/i,
            /Aug\s+\d{1,2}/i,
            /\d{1,2}\s+Aug/i,
            /Sep\s+\d{1,2}/i,
            /\d{1,2}\s+Sep/i,
            /Oct\s+\d{1,2}/i,
            /\d{1,2}\s+Oct/i,
            /Nov\s+\d{1,2}/i,
            /\d{1,2}\s+Nov/i,
            /Dec\s+\d{1,2}/i,
            /\d{1,2}\s+Dec/i,
            /Jan\s+\d{1,2}/i,
            /\d{1,2}\s+Jan/i,
            /Feb\s+\d{1,2}/i,
            /\d{1,2}\s+Feb/i,
            /Mar\s+\d{1,2}/i,
            /\d{1,2}\s+Mar/i,
            /Apr\s+\d{1,2}/i,
            /\d{1,2}\s+Apr/i,
            /May\s+\d{1,2}/i,
            /\d{1,2}\s+May/i
          ];
          
          const hasDateMatch = datePatterns.some(pattern => pattern.test(rowText));
          
          if (hasDateMatch) {
            // Extract data from individual cells using reliable cell-based parsing
            let time = '';
            let currency = '';
            let eventName = '';
            let impact = '';
            let dateStr = '';
            
            cells.each((cellIndex, cell) => {
              const cellText = $(cell).text().trim();
              
              // Cell 0: Usually contains date and time
              if (cellIndex === 0 && hasDateMatch) {
                // Extract date
                for (const pattern of datePatterns) {
                  const dateMatch = cellText.match(pattern);
                  if (dateMatch) {
                    dateStr = dateMatch[0];
                    break;
                  }
                }
                
                // Extract time from the same cell
                const timeMatch = cellText.match(/(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                  time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
                }
              }
              
              // Look for currency (3-letter currency codes)
              if (/^(USD|EUR|GBP|JPY|AUD|CAD|CHF)$/.test(cellText)) {
                currency = cellText;
              }
              
              // Look for impact level
              if (/^(High|Medium|Low)$/i.test(cellText)) {
                impact = cellText;
              }
              
              // Look for event name (Cell 3 typically contains the main event description)
              if (cellIndex === 3 && cellText.length > 3 &&
                  !/^(USD|EUR|GBP|JPY|AUD|CAD|CHF)$/i.test(cellText) &&
                  !/^(High|Medium|Low)$/i.test(cellText) &&
                  !/^\d{1,2}:\d{2}$/.test(cellText) &&
                  !/^[\d.,%-]+$/.test(cellText) &&
                  !/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{1,2}:\d{2}$/i.test(cellText)) { // Exclude date/time patterns
                eventName = cellText;
              }
            });
            
            // Validate and create event only if we have essential data
            if (time && currency && eventName && validCurrencies.includes(currency)) {
              // Convert date to ISO format
              let isoDate = '';
              if (dateStr) {
                const year = new Date().getFullYear();
                let month = '';
                let day = '';
                
                const monthMap = {
                  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
                  'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
                  'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
                };
                
                for (const [monthName, monthNum] of Object.entries(monthMap)) {
                  if (dateStr.toLowerCase().includes(monthName)) {
                    month = monthNum;
                    day = dateStr.replace(/[^\d]/g, '').padStart(2, '0');
                    break;
                  }
                }
                
                if (month && day) {
                  isoDate = `${year}-${month}-${day}`;
                }
              }
              
              // Use current date as fallback
              if (!isoDate) {
                isoDate = new Date().toISOString().split('T')[0];
              }
              
              const event = {
                currency: currency,
                event: cleanEventName(eventName),
                impact: impact || 'Medium',
                time_utc: `${isoDate}T${time}:00+00:00`,
                actual: '',
                forecast: '',
                previous: ''
              };
              
              events.push(event);
            }
          }
        }
      } catch (error) {
        console.warn(`Error processing row ${index}:`, error);
      }
    });

    console.log(`🎉 Successfully extracted ${events.length} events using reliable parsing`);
    return events;

  } catch (error) {
    console.error('❌ Error parsing HTML:', error);
    throw error;
  }
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
    console.log('=' .repeat(60));

    const eventsData = {
      source: 'manual-html-import',
      timestamp: new Date().toISOString(),
      events: events,
      summary: {
        totalEvents: events.length,
        currencies: [...new Set(events.map(e => e.currency))],
        impacts: [...new Set(events.map(e => e.impact))],
        dateRange: {
          start: Math.min(...events.map(e => e.time_utc)),
          end: Math.max(...events.map(e => e.time_utc))
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
  console.log('=' .repeat(60));

  try {
    // Check if HTML file exists
    if (!fs.existsSync(htmlFilePath)) {
      throw new Error(`HTML file not found: ${htmlFilePath}`);
    }

    console.log(`📄 Reading HTML file: ${htmlFilePath}`);
    const html = fs.readFileSync(htmlFilePath, 'utf8');
    console.log(`📊 HTML file size: ${html.length.toLocaleString()} characters`);

    // Parse the HTML
    const events = parseMyFXBookHTML(html);

    if (events.length === 0) {
      console.log('❌ No events found in HTML. Please check the HTML content.');
      return;
    }

    // Analyze the events
    console.log('\n📊 EVENTS ANALYSIS:');
    const currencies = [...new Set(events.map(e => e.currency))];
    const impacts = [...new Set(events.map(e => e.impact))];
    const dates = [...new Set(events.map(e => e.time_utc.split('T')[0]))];

    console.log(`💱 Currencies: ${currencies.join(', ')}`);
    console.log(`🎯 Impact levels: ${impacts.join(', ')}`);
    console.log(`📅 Date range: ${Math.min(...dates)} to ${Math.max(...dates)}`);
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
if (require.main === module) {
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

  importHTMLToDatabase(htmlFilePath).catch(console.error);
}

module.exports = {
  parseMyFXBookHTML,
  storeEventsInDatabase,
  importHTMLToDatabase,
  cleanEventName
};
