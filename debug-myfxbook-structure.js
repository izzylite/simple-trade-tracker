const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

/**
 * Debug MyFXBook HTML structure to understand how to parse events
 */
async function debugMyFXBookStructure() {
  try {
    console.log('🔍 Debugging MyFXBook HTML structure for Friday, Jun 27, 2025\n');
    
    const dateString = '2025-06-27';
    const url = `https://www.myfxbook.com/forex-economic-calendar?day=${dateString}`;
    
    console.log(`📡 Fetching: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    });
    
    console.log(`✅ Response received (${response.status})`);
    
    const $ = cheerio.load(response.data);
    
    // Save the HTML for inspection
    fs.writeFileSync('myfxbook-debug.html', response.data);
    console.log('💾 Saved HTML to myfxbook-debug.html for inspection');
    
    // Analyze the page structure
    console.log('\n📊 Page Analysis:');
    console.log(`  Title: ${$('title').text()}`);
    console.log(`  Body length: ${$('body').text().length} characters`);
    
    // Look for tables
    const tables = $('table');
    console.log(`  Tables found: ${tables.length}`);
    
    tables.each((i, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      console.log(`    Table ${i + 1}: ${rows.length} rows`);
      
      if (rows.length > 0) {
        const firstRow = $(rows[0]);
        const cells = firstRow.find('td, th');
        console.log(`      First row: ${cells.length} cells`);
        if (cells.length > 0) {
          console.log(`      First row text: "${firstRow.text().trim().substring(0, 100)}..."`);
        }
      }
    });
    
    // Look for specific text patterns from the image
    const bodyText = $('body').text();
    const expectedEvents = [
      'Fed Kashkari Speech',
      'Inflation Rate MoM',
      'Retail Sales YoY',
      'Fed Williams Speech',
      'Core PCE Price Index',
      'Personal Spending',
      'Michigan Consumer Sentiment'
    ];
    
    console.log('\n🔍 Searching for expected events in page text:');
    expectedEvents.forEach(event => {
      if (bodyText.includes(event)) {
        console.log(`  ✅ Found: "${event}"`);
      } else {
        // Try partial matches
        const words = event.split(' ');
        const partialMatches = words.filter(word => bodyText.includes(word));
        if (partialMatches.length > 0) {
          console.log(`  🔶 Partial match for "${event}": ${partialMatches.join(', ')}`);
        } else {
          console.log(`  ❌ Not found: "${event}"`);
        }
      }
    });
    
    // Look for currency patterns
    console.log('\n💱 Currency analysis:');
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
    currencies.forEach(currency => {
      const matches = (bodyText.match(new RegExp(currency, 'g')) || []).length;
      console.log(`  ${currency}: ${matches} occurrences`);
    });
    
    // Look for time patterns
    console.log('\n⏰ Time pattern analysis:');
    const timePatterns = [
      /\d{1,2}:\d{2}/g,
      /\d+h\s*\d*min/g,
      /\d+\s*min/g,
      /\d+\s*days?/g
    ];
    
    timePatterns.forEach((pattern, i) => {
      const matches = bodyText.match(pattern) || [];
      console.log(`  Pattern ${i + 1} (${pattern}): ${matches.length} matches`);
      if (matches.length > 0 && matches.length < 20) {
        console.log(`    Examples: ${matches.slice(0, 5).join(', ')}`);
      }
    });
    
    // Look for specific selectors that might contain events
    console.log('\n🎯 Testing specific selectors:');
    const selectors = [
      '.calendar-table tr',
      '.event-row',
      '[data-event]',
      '.economic-event',
      'tr[class*="event"]',
      'tr[class*="calendar"]',
      '.calendar tbody tr',
      'table tr',
      'div[class*="event"]',
      'div[class*="calendar"]'
    ];
    
    selectors.forEach(selector => {
      try {
        const elements = $(selector);
        console.log(`  ${selector}: ${elements.length} elements`);
        
        if (elements.length > 0 && elements.length < 50) {
          elements.slice(0, 3).each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 0) {
              console.log(`    Example ${i + 1}: "${text.substring(0, 80)}..."`);
            }
          });
        }
      } catch (error) {
        console.log(`  ${selector}: Error - ${error.message}`);
      }
    });
    
    // Look for JavaScript-rendered content indicators
    console.log('\n🔧 JavaScript content indicators:');
    const jsIndicators = [
      'data-react',
      'data-vue',
      'ng-',
      'v-',
      'class="loading"',
      'id="app"',
      'id="root"'
    ];
    
    jsIndicators.forEach(indicator => {
      if (response.data.includes(indicator)) {
        console.log(`  ✅ Found: ${indicator}`);
      }
    });
    
    // Check if content is dynamically loaded
    const scripts = $('script');
    console.log(`\n📜 Scripts found: ${scripts.length}`);
    
    let hasAjax = false;
    scripts.each((i, script) => {
      const scriptContent = $(script).html() || '';
      if (scriptContent.includes('ajax') || scriptContent.includes('fetch') || scriptContent.includes('XMLHttpRequest')) {
        hasAjax = true;
      }
    });
    
    if (hasAjax) {
      console.log('  ⚠️ Page appears to use AJAX/dynamic loading');
    } else {
      console.log('  ✅ No obvious AJAX indicators found');
    }
    
    console.log('\n💡 Recommendations:');
    console.log('1. Check myfxbook-debug.html file for actual HTML structure');
    console.log('2. Look for the specific table/div structure containing events');
    console.log('3. Events might be loaded dynamically via JavaScript');
    console.log('4. Consider using a different URL format or parameters');
    
  } catch (error) {
    console.error('❌ Error in debug analysis:', error);
  }
}

// Run the debug analysis
debugMyFXBookStructure();
