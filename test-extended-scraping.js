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
 * Experiment 1: Try different URL patterns to get more data
 */
async function testDifferentURLPatterns() {
  console.log('🧪 EXPERIMENT 1: Testing different URL patterns\n');
  
  const patterns = [
    // Current working pattern
    'https://www.myfxbook.com/forex-economic-calendar',
    
    // Date-specific patterns
    'https://www.myfxbook.com/forex-economic-calendar?day=2025-06-30',
    'https://www.myfxbook.com/forex-economic-calendar?date=2025-06-30',
    
    // Week patterns
    'https://www.myfxbook.com/forex-economic-calendar?week=current',
    'https://www.myfxbook.com/forex-economic-calendar?view=week',
    
    // Month patterns
    'https://www.myfxbook.com/forex-economic-calendar?month=2025-06',
    'https://www.myfxbook.com/forex-economic-calendar?view=month',
    'https://www.myfxbook.com/forex-economic-calendar?period=month',
    
    // Range patterns
    'https://www.myfxbook.com/forex-economic-calendar?from=2025-06-28&to=2025-07-28',
    'https://www.myfxbook.com/forex-economic-calendar?start=2025-06-28&end=2025-07-28',
    
    // Filter patterns
    'https://www.myfxbook.com/forex-economic-calendar?currencies=USD,EUR',
    'https://www.myfxbook.com/forex-economic-calendar?impact=high,medium',
    
    // Combined patterns
    'https://www.myfxbook.com/forex-economic-calendar?view=month&currencies=USD,EUR&impact=high',
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const url = patterns[i];
    console.log(`\n📡 Testing pattern ${i + 1}/${patterns.length}: ${url}`);
    
    try {
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
      
      console.log(`✅ Status: ${response.status}, Content Length: ${response.data.length}`);
      
      // Quick analysis of content
      const $ = cheerio.load(response.data);
      const rows = $('tr');
      const dateMatches = response.data.match(/Jun|Jul|June|July/gi) || [];
      const eventCount = rows.length;
      
      console.log(`   📊 Table rows found: ${eventCount}`);
      console.log(`   📅 Date mentions: ${dateMatches.length}`);
      console.log(`   📄 Page title: ${$('title').text().substring(0, 50)}...`);
      
      // Check for specific date ranges
      const dateRangeIndicators = [
        'week', 'month', 'calendar', 'economic', 'events',
        '2025-06', '2025-07', 'Jun 2025', 'Jul 2025'
      ];
      
      let foundIndicators = [];
      dateRangeIndicators.forEach(indicator => {
        if (response.data.toLowerCase().includes(indicator.toLowerCase())) {
          foundIndicators.push(indicator);
        }
      });
      
      if (foundIndicators.length > 0) {
        console.log(`   🎯 Found indicators: ${foundIndicators.join(', ')}`);
      }
      
      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

/**
 * Experiment 2: Analyze the default page structure for navigation elements
 */
async function analyzePageStructure() {
  console.log('\n🧪 EXPERIMENT 2: Analyzing page structure for navigation\n');
  
  try {
    const url = 'https://www.myfxbook.com/forex-economic-calendar';
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
    
    const $ = cheerio.load(response.data);
    
    console.log('🔍 Looking for navigation elements...\n');
    
    // Look for date navigation
    const dateNavElements = [
      'input[type="date"]',
      '.date-picker',
      '.calendar-nav',
      '.date-nav',
      'select[name*="date"]',
      'select[name*="month"]',
      'select[name*="year"]',
      '.prev', '.next',
      '[data-date]',
      '[data-month]'
    ];
    
    dateNavElements.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`📅 Found ${elements.length} elements with selector: ${selector}`);
        elements.each((i, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          const value = $el.attr('value') || $el.attr('data-date') || $el.attr('data-month');
          if (text || value) {
            console.log(`   - Text: "${text}", Value: "${value}"`);
          }
        });
      }
    });
    
    // Look for filter elements
    console.log('\n🔍 Looking for filter elements...\n');
    
    const filterElements = [
      'select[name*="currency"]',
      'select[name*="impact"]',
      'input[name*="currency"]',
      'input[name*="impact"]',
      '.filter',
      '.currency-filter',
      '.impact-filter',
      '[data-currency]',
      '[data-impact]'
    ];
    
    filterElements.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`🔧 Found ${elements.length} filter elements with selector: ${selector}`);
        elements.each((i, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          const value = $el.attr('value') || $el.attr('data-currency') || $el.attr('data-impact');
          if (text || value) {
            console.log(`   - Text: "${text}", Value: "${value}"`);
          }
        });
      }
    });
    
    // Look for pagination or "load more" elements
    console.log('\n🔍 Looking for pagination elements...\n');
    
    const paginationElements = [
      '.pagination',
      '.load-more',
      '.show-more',
      '.next-page',
      '.prev-page',
      '[data-page]',
      'button[onclick*="load"]',
      'a[href*="page"]'
    ];
    
    paginationElements.forEach(selector => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`📄 Found ${elements.length} pagination elements with selector: ${selector}`);
        elements.each((i, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          const href = $el.attr('href');
          const onclick = $el.attr('onclick');
          console.log(`   - Text: "${text}", Href: "${href}", OnClick: "${onclick}"`);
        });
      }
    });
    
    // Look for JavaScript variables or AJAX endpoints
    console.log('\n🔍 Looking for JavaScript patterns...\n');
    
    const jsPatterns = [
      /ajax.*calendar/gi,
      /api.*economic/gi,
      /endpoint.*calendar/gi,
      /url.*calendar/gi,
      /fetch.*events/gi,
      /load.*more/gi,
      /calendar.*data/gi
    ];
    
    jsPatterns.forEach((pattern, index) => {
      const matches = response.data.match(pattern);
      if (matches) {
        console.log(`🔧 JS Pattern ${index + 1} matches: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error analyzing page structure:', error.message);
  }
}

/**
 * Experiment 3: Test date range scraping
 */
async function testDateRangeScraping() {
  console.log('\n🧪 EXPERIMENT 3: Testing extended date range scraping\n');
  
  // Test scraping multiple weeks
  const startDate = new Date('2025-06-28');
  const endDate = new Date('2025-07-28'); // 1 month range
  
  console.log(`📅 Testing date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  const allEvents = [];
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateString = currentDate.toISOString().split('T')[0];
    console.log(`\n📡 Scraping date: ${dateString}`);
    
    try {
      const events = await scrapeMyFXBookDirect(dateString);
      console.log(`   ✅ Found ${events.length} events`);
      allEvents.push(...events);
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`\n📊 TOTAL EVENTS COLLECTED: ${allEvents.length}`);
  
  // Analyze the data
  const currencies = [...new Set(allEvents.map(e => e.currency))];
  const dates = [...new Set(allEvents.map(e => e.date))];
  
  console.log(`💱 Currencies found: ${currencies.join(', ')}`);
  console.log(`📅 Date range covered: ${dates.length} days`);
  console.log(`📈 Average events per day: ${(allEvents.length / dates.length).toFixed(1)}`);
  
  return allEvents;
}

/**
 * Direct MyFXBook scraping implementation (copied from working script)
 */
async function scrapeMyFXBookDirect(dateString) {
  try {
    const url = `https://www.myfxbook.com/forex-economic-calendar?day=${dateString}`;
    
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
    
    const $ = cheerio.load(response.data);
    const events = [];
    
    // Look for table rows and process them systematically
    const rows = $('tr');
    
    rows.each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 4) {
        const rowText = $row.text();
        
        // Look for date patterns to identify event rows
        const datePatterns = [
          new RegExp(dateString.replace(/-/g, '\\s*')), // Match the specific date
          /Jun\s+\d{1,2}/i, /\d{1,2}\s+Jun/i,
          /Jul\s+\d{1,2}/i, /\d{1,2}\s+Jul/i
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
    
    return events;
    
  } catch (error) {
    console.error('❌ Error scraping MyFXBook:', error.message);
    return [];
  }
}

/**
 * Experiment 4: Test historical date scraping (April-May 2025)
 */
async function testHistoricalDateScraping() {
  console.log('\n🧪 EXPERIMENT 4: Testing historical date scraping (April-May 2025)\n');

  // Test scraping historical dates
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
  ];

  console.log(`📅 Testing ${testDates.length} historical dates...\n`);

  const results = [];

  for (const dateString of testDates) {
    console.log(`📡 Testing date: ${dateString}`);

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
        console.log(`   ✅ Found ${events.length} events`);
        console.log(`   💱 Currencies: ${result.currencies.join(', ')}`);
        console.log(`   📋 Sample: ${result.sampleEvents[0] || 'None'}`);
      } else {
        console.log(`   ❌ No events found`);
      }

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        date: dateString,
        eventCount: 0,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n📊 HISTORICAL DATA SUMMARY:');
  console.log('=' .repeat(50));

  const successfulDates = results.filter(r => r.success);
  const failedDates = results.filter(r => !r.success);

  console.log(`✅ Successful dates: ${successfulDates.length}/${results.length}`);
  console.log(`❌ Failed dates: ${failedDates.length}/${results.length}`);

  if (successfulDates.length > 0) {
    console.log('\n✅ SUCCESSFUL DATES:');
    successfulDates.forEach(result => {
      console.log(`   ${result.date}: ${result.eventCount} events (${result.currencies.join(', ')})`);
    });
  }

  if (failedDates.length > 0) {
    console.log('\n❌ FAILED DATES:');
    failedDates.forEach(result => {
      console.log(`   ${result.date}: ${result.error || 'No events found'}`);
    });
  }

  // Test a full month if we found historical data works
  if (successfulDates.length > 0) {
    console.log('\n🎯 Historical data available! Testing full April 2025...');
    await testFullMonthScraping('2025-04-01', '2025-04-30');
  }

  return results;
}

/**
 * Test scraping a full month
 */
async function testFullMonthScraping(startDateStr, endDateStr) {
  console.log(`\n📅 Testing full month: ${startDateStr} to ${endDateStr}`);

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const allEvents = [];
  let currentDate = new Date(startDate);
  let successCount = 0;
  let failCount = 0;

  while (currentDate <= endDate) {
    const dateString = currentDate.toISOString().split('T')[0];

    try {
      const events = await scrapeMyFXBookDirect(dateString);

      if (events.length > 0) {
        allEvents.push(...events);
        successCount++;
        console.log(`   ✅ ${dateString}: ${events.length} events`);
      } else {
        failCount++;
        console.log(`   ❌ ${dateString}: No events`);
      }

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      failCount++;
      console.log(`   ❌ ${dateString}: Error - ${error.message}`);
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`\n📊 FULL MONTH RESULTS:`);
  console.log(`   📅 Date range: ${startDateStr} to ${endDateStr}`);
  console.log(`   ✅ Successful days: ${successCount}`);
  console.log(`   ❌ Failed days: ${failCount}`);
  console.log(`   📈 Total events: ${allEvents.length}`);
  console.log(`   📊 Average per successful day: ${successCount > 0 ? (allEvents.length / successCount).toFixed(1) : 0}`);

  if (allEvents.length > 0) {
    const currencies = [...new Set(allEvents.map(e => e.currency))];
    const impacts = [...new Set(allEvents.map(e => e.impact))];
    console.log(`   💱 Currencies: ${currencies.join(', ')}`);
    console.log(`   🎯 Impact levels: ${impacts.join(', ')}`);
  }

  return allEvents;
}

/**
 * Main experiment runner
 */
async function runExperiments() {
  console.log('🚀 MYFXBOOK EXTENDED SCRAPING EXPERIMENTS\n');
  console.log('=' .repeat(60));

  try {
    // Test historical dates first
    await testHistoricalDateScraping();

    console.log('\n🎉 All experiments completed!');

  } catch (error) {
    console.error('❌ Experiment failed:', error);
  }
}

// Run experiments if this file is executed directly
if (require.main === module) {
  runExperiments().catch(console.error);
}

module.exports = {
  testDifferentURLPatterns,
  analyzePageStructure,
  testDateRangeScraping,
  testHistoricalDateScraping,
  testFullMonthScraping,
  scrapeMyFXBookDirect,
  cleanEventName
};
