const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Test if future dates beyond 1 week return different data
 */
async function testFutureDates() {
  console.log('🧪 TESTING FUTURE DATES BEYOND 1 WEEK\n');
  
  const today = new Date();
  const testDates = [];
  
  // Generate test dates: today + 1 week, 2 weeks, 3 weeks, 1 month, 2 months, 6 months
  const intervals = [
    { days: 7, label: '1 week' },
    { days: 14, label: '2 weeks' },
    { days: 21, label: '3 weeks' },
    { days: 30, label: '1 month' },
    { days: 60, label: '2 months' },
    { days: 90, label: '3 months' },
    { days: 180, label: '6 months' },
    { days: 365, label: '1 year' }
  ];
  
  intervals.forEach(interval => {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + interval.days);
    testDates.push({
      date: futureDate.toISOString().split('T')[0],
      label: interval.label,
      days: interval.days
    });
  });
  
  console.log(`📅 Testing ${testDates.length} future dates...\n`);
  
  const results = [];
  
  for (const testDate of testDates) {
    console.log(`\n🔍 Testing ${testDate.label} (${testDate.date})`);
    console.log('=' .repeat(50));
    
    try {
      const url = `https://www.myfxbook.com/forex-economic-calendar?day=${testDate.date}`;
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
      const rows = $('tr');
      
      // Extract some key indicators to check for differences
      const pageTitle = $('title').text();
      const bodyText = response.data;
      
      // Look for date mentions in the content
      const datePatterns = [
        /Jun\s+\d{1,2}/gi,
        /Jul\s+\d{1,2}/gi,
        /Aug\s+\d{1,2}/gi,
        /Sep\s+\d{1,2}/gi,
        /Oct\s+\d{1,2}/gi,
        /Nov\s+\d{1,2}/gi,
        /Dec\s+\d{1,2}/gi,
        /Jan\s+\d{1,2}/gi,
        /Feb\s+\d{1,2}/gi,
        /Mar\s+\d{1,2}/gi,
        /Apr\s+\d{1,2}/gi,
        /May\s+\d{1,2}/gi
      ];
      
      const allDateMentions = [];
      datePatterns.forEach(pattern => {
        const matches = bodyText.match(pattern) || [];
        allDateMentions.push(...matches);
      });
      
      // Get unique date mentions
      const uniqueDates = [...new Set(allDateMentions.map(d => d.toLowerCase()))];
      
      // Look for specific content that might indicate the requested date
      const hasRequestedDate = bodyText.includes(testDate.date) || 
                              bodyText.includes(testDate.date.replace(/-/g, '/')) ||
                              bodyText.includes(testDate.date.replace(/-/g, ' '));
      
      // Extract some sample events to compare
      const sampleEvents = [];
      rows.each((index, row) => {
        if (sampleEvents.length < 5) {
          const $row = $(row);
          const cells = $row.find('td');
          if (cells.length >= 4) {
            const eventText = $(cells[4]).text().trim();
            if (eventText && eventText.length > 3) {
              sampleEvents.push(eventText);
            }
          }
        }
      });
      
      const result = {
        date: testDate.date,
        label: testDate.label,
        days: testDate.days,
        responseLength: response.data.length,
        tableRows: rows.length,
        pageTitle: pageTitle,
        uniqueDates: uniqueDates.slice(0, 10), // First 10 unique dates
        hasRequestedDate: hasRequestedDate,
        sampleEvents: sampleEvents.slice(0, 3),
        success: true
      };
      
      results.push(result);
      
      console.log(`📊 Table rows: ${result.tableRows}`);
      console.log(`📅 Date mentions found: ${uniqueDates.length} (${uniqueDates.slice(0, 5).join(', ')}${uniqueDates.length > 5 ? '...' : ''})`);
      console.log(`🎯 Contains requested date: ${hasRequestedDate ? 'YES' : 'NO'}`);
      console.log(`📋 Sample events: ${result.sampleEvents.slice(0, 2).join(', ')}`);
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
      results.push({
        date: testDate.date,
        label: testDate.label,
        days: testDate.days,
        success: false,
        error: error.message
      });
    }
  }
  
  // Analysis
  console.log('\n\n📊 FUTURE DATES ANALYSIS');
  console.log('=' .repeat(60));
  
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    console.log('❌ No successful requests to analyze');
    return results;
  }
  
  // Check if all responses are identical
  const firstResult = successfulResults[0];
  const allIdentical = successfulResults.every(result => 
    result.responseLength === firstResult.responseLength &&
    result.tableRows === firstResult.tableRows &&
    JSON.stringify(result.sampleEvents) === JSON.stringify(firstResult.sampleEvents)
  );
  
  console.log(`🔍 Response length consistency: ${allIdentical ? 'IDENTICAL' : 'DIFFERENT'}`);
  
  if (allIdentical) {
    console.log('❌ ALL FUTURE DATES RETURN IDENTICAL DATA');
    console.log('   MyFXBook ignores date parameters completely');
    console.log('   Only current week data is available');
  } else {
    console.log('✅ FUTURE DATES RETURN DIFFERENT DATA');
    console.log('   Date range scraping may be viable');
  }
  
  // Detailed comparison
  console.log('\n📋 DETAILED COMPARISON:');
  successfulResults.forEach(result => {
    console.log(`\n📅 ${result.label} (${result.date}):`);
    console.log(`   📄 Response length: ${result.responseLength.toLocaleString()}`);
    console.log(`   📊 Table rows: ${result.tableRows}`);
    console.log(`   🎯 Has requested date: ${result.hasRequestedDate ? 'YES' : 'NO'}`);
    console.log(`   📅 Date range: ${result.uniqueDates.slice(0, 3).join(', ')}`);
    console.log(`   📋 Sample: ${result.sampleEvents[0] || 'None'}`);
  });
  
  // Check for any patterns in date mentions
  console.log('\n🔍 DATE MENTION ANALYSIS:');
  const allUniqueDates = [...new Set(successfulResults.flatMap(r => r.uniqueDates))];
  console.log(`📅 All unique dates found: ${allUniqueDates.slice(0, 10).join(', ')}`);
  
  // Final conclusion
  console.log('\n🎯 CONCLUSION:');
  if (allIdentical) {
    console.log('❌ Date range scraping will NOT work');
    console.log('   MyFXBook only provides current week data');
    console.log('   All date parameters are ignored');
    console.log('   Recommendation: Stick with current weekly approach');
  } else {
    console.log('✅ Date range scraping MAY work');
    console.log('   Different dates return different data');
    console.log('   Recommendation: Implement date range scraping');
  }
  
  return results;
}

// Run the test
if (require.main === module) {
  testFutureDates().catch(console.error);
}

module.exports = {
  testFutureDates
};
