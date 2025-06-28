const axios = require('axios');
const cheerio = require('cheerio');

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
  try {
    const url = `https://www.myfxbook.com/forex-economic-calendar?day=${dateString}`;
    console.log(`📡 Fetching: ${url}`);
    
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
    
    console.log(`📄 Response: ${response.status}, Length: ${response.data.length}`);
    
    const $ = cheerio.load(response.data);
    const events = [];
    
    // Look for table rows and process them systematically
    const rows = $('tr');
    console.log(`🔍 Found ${rows.length} table rows`);
    
    rows.each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 4) {
        const rowText = $row.text();
        
        // Look for date patterns to identify event rows
        const datePatterns = [
          new RegExp(dateString.replace(/-/g, '\\s*')), // Match the specific date
          /Apr\s+\d{1,2}/i, /\d{1,2}\s+Apr/i,
          /May\s+\d{1,2}/i, /\d{1,2}\s+May/i,
          /Jun\s+\d{1,2}/i, /\d{1,2}\s+Jun/i,
          /Jul\s+\d{1,2}/i, /\d{1,2}\s+Jul/i,
          /Mar\s+\d{1,2}/i, /\d{1,2}\s+Mar/i,
          /Feb\s+\d{1,2}/i, /\d{1,2}\s+Feb/i,
          /Dec\s+\d{1,2}/i, /\d{1,2}\s+Dec/i
        ];
        
        const hasDateMatch = datePatterns.some(pattern => pattern.test(rowText));
        
        if (hasDateMatch) {
          let time = '';
          let currency = '';
          let eventName = '';
          let impact = '';
          
          cells.each((cellIndex, cell) => {
            const cellText = $(cell).text().trim();
            
            // Cell 0: Usually contains date and time
            if (cellIndex === 0 && hasDateMatch) {
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
            
            // Look for event name (Cell 4 typically contains the main event description)
            if (cellIndex === 4 && cellText.length > 3 && 
                !/^(USD|EUR|GBP|JPY|AUD|CAD|CHF)$/i.test(cellText) &&
                !/^(High|Medium|Low)$/i.test(cellText) &&
                !/^\d{1,2}:\d{2}$/.test(cellText)) {
              eventName = cellText;
            }
          });
          
          // Validate and create event only if we have essential data
          if (time && currency && eventName) {
            const event = {
              date: dateString,
              time_utc: time,
              currency: currency,
              event: cleanEventName(eventName),
              impact: impact || 'Medium',
              previous: '',
              consensus: '',
              actual: ''
            };
            
            events.push(event);
          }
        }
      }
    });
    
    console.log(`✅ Extracted ${events.length} events for ${dateString}`);
    return events;
    
  } catch (error) {
    console.error(`❌ Error scraping ${dateString}:`, error.message);
    return [];
  }
}

/**
 * Test historical dates
 */
async function testHistoricalDates() {
  console.log('🧪 TESTING HISTORICAL DATES\n');
  
  const testDates = [
    '2025-04-01', // April 1st
    '2025-04-15', // Mid April
    '2025-04-30', // End of April
    '2025-05-01', // May 1st
    '2025-05-15', // Mid May
    '2025-05-31', // End of May
    '2025-03-15', // March (further back)
    '2025-02-14', // February (even further back)
    '2024-12-25', // December 2024 (last year)
    '2024-06-15', // June 2024 (way back)
  ];
  
  console.log(`📅 Testing ${testDates.length} historical dates...\n`);
  
  const results = [];
  
  for (const dateString of testDates) {
    console.log(`\n🔍 Testing date: ${dateString}`);
    console.log('=' .repeat(40));
    
    try {
      const events = await scrapeMyFXBookDirect(dateString);
      
      const result = {
        date: dateString,
        eventCount: events.length,
        success: events.length > 0,
        currencies: [...new Set(events.map(e => e.currency))],
        sampleEvents: events.slice(0, 3).map(e => `${e.currency} - ${e.event}`)
      };
      
      results.push(result);
      
      if (events.length > 0) {
        console.log(`✅ SUCCESS: Found ${events.length} events`);
        console.log(`💱 Currencies: ${result.currencies.join(', ')}`);
        console.log(`📋 Sample events:`);
        result.sampleEvents.forEach((event, i) => {
          console.log(`   ${i + 1}. ${event}`);
        });
      } else {
        console.log(`❌ FAILED: No events found`);
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results.push({
        date: dateString,
        eventCount: 0,
        success: false,
        error: error.message
      });
    }
  }
  
  // Summary
  console.log('\n\n📊 HISTORICAL DATA SUMMARY');
  console.log('=' .repeat(50));
  
  const successfulDates = results.filter(r => r.success);
  const failedDates = results.filter(r => !r.success);
  
  console.log(`✅ Successful dates: ${successfulDates.length}/${results.length}`);
  console.log(`❌ Failed dates: ${failedDates.length}/${results.length}`);
  
  if (successfulDates.length > 0) {
    console.log('\n✅ SUCCESSFUL DATES:');
    successfulDates.forEach(result => {
      console.log(`   📅 ${result.date}: ${result.eventCount} events (${result.currencies.join(', ')})`);
    });
    
    console.log('\n🎯 CONCLUSION: Historical data IS available!');
    console.log('   We can scrape past dates using the date range approach.');
  } else {
    console.log('\n❌ CONCLUSION: Historical data NOT available');
    console.log('   MyFXBook may only provide current/future data.');
  }
  
  if (failedDates.length > 0) {
    console.log('\n❌ FAILED DATES:');
    failedDates.forEach(result => {
      console.log(`   📅 ${result.date}: ${result.error || 'No events found'}`);
    });
  }
  
  return results;
}

// Run the test
if (require.main === module) {
  testHistoricalDates().catch(console.error);
}

module.exports = {
  testHistoricalDates,
  scrapeMyFXBookDirect,
  cleanEventName
};
