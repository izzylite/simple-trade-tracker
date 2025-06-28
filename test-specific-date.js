const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const axios = require('axios');
const cheerio = require('cheerio');

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
 * Clean event name by removing currency prefixes and time indicators
 */
function cleanEventName(eventName) {
  if (!eventName) return '';
  
  let cleaned = eventName.trim();
  
  // Remove currency prefixes (EUR, USD, etc.)
  cleaned = cleaned.replace(/^(EUR|USD|GBP|JPY|AUD|CAD|CHF|NZD)\s+/i, '');
  
  // Remove time indicators like "2 days", "1 hour", etc.
  cleaned = cleaned.replace(/\b\d+\s+(day|hour|minute|week|month)s?\b/gi, '');
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Direct MyFXBook scraping implementation for a specific date
 */
async function scrapeMyFXBookDirect(dateString) {
  console.log(`🔍 Scraping MyFXBook directly for date: ${dateString}`);
  
  try {
    const url = `https://www.myfxbook.com/forex-economic-calendar?day=${dateString}`;
    console.log(`📡 Fetching URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    console.log(`✅ Response received (${response.status})`);
    
    const $ = cheerio.load(response.data);
    const events = [];
    
    console.log('🔍 Analyzing page structure...');
    console.log(`📄 Page title: ${$('title').text()}`);
    
    // Look for table rows that contain economic events
    const rows = $('tr');
    console.log(`📊 Found ${rows.length} table rows to analyze`);
    
    rows.each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length >= 4) {
        const rowText = $row.text();

        // Check if this row contains date information for our target date
        const dateMatch = rowText.match(/Jun\s+30|30\s+Jun|June\s+30|30\s+June/i);

        if (dateMatch) {
          console.log(`📅 Found potential event row ${index}:`);
          console.log(`   Full text: "${rowText}"`);
          console.log(`   Cell count: ${cells.length}`);

          // Debug: show each cell content
          cells.each((cellIndex, cell) => {
            const cellText = $(cell).text().trim();
            if (cellText) {
              console.log(`   Cell ${cellIndex}: "${cellText}"`);
            }
          });

          // Try to extract event details from individual cells
          let time = '';
          let currency = '';
          let eventName = '';
          let impact = '';

          cells.each((cellIndex, cell) => {
            const cellText = $(cell).text().trim();

            // Look for time pattern in date/time cell (Cell 0)
            if (cellIndex === 0 && cellText.includes('Jun 30')) {
              const timeMatch = cellText.match(/(\d{1,2}):(\d{2})/);
              if (timeMatch) {
                time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
              }
            }

            // Look for currency (Cell 3)
            if (/^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)$/.test(cellText)) {
              currency = cellText;
            }

            // Look for impact (Cell 5)
            if (/^(High|Medium|Low)$/i.test(cellText)) {
              impact = cellText;
            }

            // Look for event name (Cell 4 - the main event description)
            if (cellIndex === 4 && cellText.length > 3) {
              eventName = cellText;
            }
          });

          console.log(`   Extracted - Time: "${time}", Currency: "${currency}", Event: "${eventName}", Impact: "${impact}"`);

          if (time && currency && eventName) {
            const event = {
              date: dateString,
              time_utc: time,
              currency: currency,
              event: cleanEventName(eventName),
              impact: impact || 'Unknown',
              previous: '',
              consensus: '',
              actual: ''
            };

            events.push(event);
            console.log(`✅ Successfully extracted event: ${event.currency} - ${event.event} (${event.impact}) at ${event.time_utc}`);
          } else {
            console.log(`❌ Failed to extract complete event data`);
          }

          console.log(''); // Empty line for readability
        }
      }
    });
    
    console.log(`📊 Successfully extracted ${events.length} events for ${dateString}`);
    return events;
    
  } catch (error) {
    console.error('❌ Error scraping MyFXBook:', error.message);
    return [];
  }
}

/**
 * Test specific date with filtering
 */
async function testSpecificDate() {
  console.log('🎯 Testing Specific Date: Monday June 30, 2025\n');
  console.log('🔍 Filtering: USD and EUR currencies with High and Medium impact\n');
  
  try {
    const targetDate = '2025-06-30';
    console.log(`📅 Target date: ${targetDate} (Monday)`);
    
    // Scrape events for the specific date
    const allEvents = await scrapeMyFXBookDirect(targetDate);
    
    console.log(`\n📊 Total events found: ${allEvents.length}`);
    
    if (allEvents.length === 0) {
      console.log('⚠️ No events found for this date. This could indicate:');
      console.log('   1. The date is too far in the future');
      console.log('   2. MyFXBook structure has changed');
      console.log('   3. There are no events scheduled for this date');
      console.log('   4. Date parsing issue in the scraper');
      return;
    }
    
    // Apply currency filtering (USD and EUR)
    const currencyFiltered = allEvents.filter(event => 
      ['USD', 'EUR'].includes(event.currency)
    );
    
    console.log(`\n💱 After currency filtering (USD, EUR): ${currencyFiltered.length} events`);
    
    // Apply impact filtering (High and Medium)
    const impactFiltered = currencyFiltered.filter(event => 
      ['High', 'Medium'].includes(event.impact)
    );
    
    console.log(`\n📊 After impact filtering (High, Medium): ${impactFiltered.length} events`);
    
    if (impactFiltered.length > 0) {
      console.log('\n🎯 FILTERED RESULTS FOR MONDAY JUNE 30, 2025:');
      console.log('=' .repeat(60));
      
      impactFiltered.forEach((event, index) => {
        console.log(`${index + 1}. ${event.currency} - "${event.event}"`);
        console.log(`   📊 Impact: ${event.impact}`);
        console.log(`   ⏰ Time: ${event.time_utc} UTC`);
        console.log(`   📅 Date: ${event.date}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️ No events found matching the criteria (USD/EUR + High/Medium impact)');
    }
    
    // Show all events for debugging
    if (allEvents.length > 0) {
      console.log('\n🔍 ALL EVENTS FOUND (for debugging):');
      console.log('=' .repeat(60));
      
      allEvents.forEach((event, index) => {
        console.log(`${index + 1}. ${event.currency} - "${event.event}" (${event.impact}) at ${event.time_utc}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testSpecificDate().catch(console.error);
}

module.exports = {
  scrapeMyFXBookDirect,
  testSpecificDate,
  cleanEventName
};
