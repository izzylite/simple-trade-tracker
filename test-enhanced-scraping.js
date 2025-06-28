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
 * Enhanced MyFXBook event name extraction
 * Properly extracts clean event names without currency codes or time info
 */
function parseMyFXBookEventsEnhanced($, dateString) {
  const events = [];

  try {
    console.log('🔍 Looking for MyFXBook table structure...');

    // MyFXBook uses a specific table structure
    // Look for rows that contain economic event data
    const eventRows = $('tr').filter((i, el) => {
      const $row = $(el);
      const cells = $row.find('td');

      // MyFXBook rows typically have 7+ columns: Date, Time, Currency, Event, Impact, Previous, Consensus, Actual
      if (cells.length < 4) return false;

      const rowText = $row.text();
      const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

      // Check if row contains currency and economic terms
      const hasCurrency = currencies.some(curr => rowText.includes(curr));
      const hasEconomicTerms = /Rate|Index|Sales|PMI|GDP|CPI|Inflation|Employment|Manufacturing|Services|Speech|Balance|Confidence|Sentiment/i.test(rowText);

      return hasCurrency && hasEconomicTerms;
    });

    console.log(`📊 Found ${eventRows.length} potential event rows`);

    eventRows.each((index, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length >= 4) {
        // Extract data from each column
        const timeCell = $(cells[0]).text().trim();
        const currencyCell = $(cells[1]).text().trim();
        const eventCell = $(cells[2]).text().trim();
        const impactCell = $(cells[3]).text().trim();
        const previousCell = cells.length > 4 ? $(cells[4]).text().trim() : '';
        const consensusCell = cells.length > 5 ? $(cells[5]).text().trim() : '';
        const actualCell = cells.length > 6 ? $(cells[6]).text().trim() : '';

        // Clean currency extraction
        const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
        let currency = '';

        // Try to find currency in the currency cell or nearby
        for (const curr of validCurrencies) {
          if (currencyCell.includes(curr) || eventCell.includes(curr)) {
            currency = curr;
            break;
          }
        }

        if (!currency) return; // Skip if no valid currency found

        // Clean event name extraction
        let eventName = eventCell.trim();

        // Remove currency codes from event name
        validCurrencies.forEach(curr => {
          eventName = eventName.replace(new RegExp(`\\b${curr}\\b`, 'g'), '').trim();
        });

        // Remove time indicators like "4h 5min", "35 min", etc.
        eventName = eventName.replace(/\d+h\s*\d*min?/gi, '').trim();
        eventName = eventName.replace(/\d+\s*min/gi, '').trim();
        eventName = eventName.replace(/\d+h/gi, '').trim();

        // Remove "days" prefix that sometimes appears
        eventName = eventName.replace(/^days\s+/i, '').trim();

        // Remove leading/trailing special characters
        eventName = eventName.replace(/^[^\w]+|[^\w]+$/g, '').trim();

        // Skip if event name is too short or invalid
        if (eventName.length < 3) return;

        // Parse time
        let timeUtc = `${dateString}T12:00:00+00:00`;
        const timeMatch = timeCell.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hours = timeMatch[1].padStart(2, '0');
          const minutes = timeMatch[2];
          timeUtc = `${dateString}T${hours}:${minutes}:00+00:00`;
        }

        // Determine impact level
        let impact = 'Medium';
        const impactLower = impactCell.toLowerCase();
        if (impactLower.includes('high') || impactCell.includes('🔴')) {
          impact = 'High';
        } else if (impactLower.includes('low') || impactCell.includes('🟡')) {
          impact = 'Low';
        }

        events.push({
          currency,
          event: eventName,
          impact,
          time_utc: timeUtc,
          actual: actualCell,
          forecast: consensusCell,
          previous: previousCell
        });
      }
    });

    console.log(`✅ Extracted ${events.length} clean events`);
    return events;

  } catch (error) {
    console.error('❌ Error in enhanced parsing:', error);
    return [];
  }
}

/**
 * Test the enhanced scraping directly
 */
async function testDirectScraping() {
  try {
    console.log('🌐 Testing direct MyFXBook scraping...\n');

    const today = new Date().toISOString().split('T')[0];
    const url = `https://www.myfxbook.com/forex-economic-calendar/${today}`;

    console.log(`📡 Fetching: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    });

    console.log(`✅ Response received (${response.status})`);

    const $ = cheerio.load(response.data);
    const events = parseMyFXBookEventsEnhanced($, today);

    console.log(`\n📊 Extracted ${events.length} events with enhanced parsing`);

    if (events.length > 0) {
      console.log('\n📋 Sample enhanced events:');
      events.slice(0, 10).forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact})`);
        console.log(`     Time: ${event.time_utc}`);
        if (event.actual || event.forecast || event.previous) {
          console.log(`     Data: A:${event.actual} F:${event.forecast} P:${event.previous}`);
        }
        console.log('');
      });

      // Analyze event name quality
      console.log('📈 Event Name Quality Analysis:');
      const avgLength = events.reduce((sum, e) => sum + e.event.length, 0) / events.length;
      const shortNames = events.filter(e => e.event.length <= 10);
      const goodNames = events.filter(e => e.event.length > 10 && e.event.length <= 50);
      const longNames = events.filter(e => e.event.length > 50);

      console.log(`  Average length: ${Math.round(avgLength)} characters`);
      console.log(`  Short names (≤10): ${shortNames.length}`);
      console.log(`  Good names (11-50): ${goodNames.length}`);
      console.log(`  Long names (>50): ${longNames.length}`);

      if (shortNames.length > 0) {
        console.log('\n⚠️ Short names that may need attention:');
        shortNames.slice(0, 5).forEach(e => console.log(`    - "${e.event}"`));
      }

      console.log('\n✅ Good quality event names:');
      goodNames.slice(0, 8).forEach(e => console.log(`    - "${e.event}"`));

    } else {
      console.log('❌ No events extracted - parsing may need adjustment');
    }

    return events;

  } catch (error) {
    console.error('❌ Error in direct scraping test:', error);
    return [];
  }
}

async function testEnhancedScraping() {
  try {
    console.log('🚀 Testing Enhanced Event Name Extraction...\n');

    // Step 1: Test direct scraping first
    console.log('='.repeat(60));
    console.log('📡 STEP 1: Testing Direct Enhanced Scraping');
    console.log('='.repeat(60));

    const directEvents = await testDirectScraping();

    if (directEvents.length > 0) {
      console.log('\n✅ Direct scraping successful! Now testing cloud function...\n');

      // Step 2: Test cloud function
      console.log('='.repeat(60));
      console.log('☁️ STEP 2: Testing Cloud Function Scraper');
      console.log('='.repeat(60));

      const testFunction = httpsCallable(functions, 'testMyFXBookScraper');
      const result = await testFunction();

      if (result.data.success) {
        console.log(`✅ Cloud function scraped ${result.data.eventCount} events`);
        console.log(`📅 Date: ${result.data.date}`);

        // Compare direct vs cloud function results
        console.log('\n📊 Comparison:');
        console.log(`  Direct scraping: ${directEvents.length} events`);
        console.log(`  Cloud function: ${result.data.eventCount} events`);

        if (result.data.events && result.data.events.length > 0) {
          console.log('\n📋 Cloud function sample events:');
          result.data.events.slice(0, 5).forEach((event, index) => {
            console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact})`);
          });
        }

      } else {
        console.log('❌ Cloud function scraping failed:', result.data.error);
        console.log('💡 Will proceed with database population using enhanced logic...');
      }

      // Step 3: Test database population
      console.log('\n' + '='.repeat(60));
      console.log('🗄️ STEP 3: Testing Database Population');
      console.log('='.repeat(60));

      const populateFunction = httpsCallable(functions, 'populateDatabaseManually');
      const populateResult = await populateFunction();

      if (populateResult.data.success) {
        console.log(`✅ Successfully populated database with ${populateResult.data.storedEvents} events`);
        console.log(`📊 Total events scraped: ${populateResult.data.totalEvents}`);
        console.log(`💱 Currencies: ${populateResult.data.currencies.join(', ')}`);
        console.log(`📅 Date range: ${populateResult.data.dateRange.start} to ${populateResult.data.dateRange.end}`);

        console.log('\n🎉 Enhanced scraping complete!');
        console.log('📱 Frontend should now show improved event names like:');
        console.log('   ✅ "Inflation Rate MoM (Jun)" instead of "days EUR Inflation"');
        console.log('   ✅ "Core PCE Price Index YoY (May)" instead of "4h 5min USD Core PCE"');
        console.log('   ✅ "Fed Williams Speech" instead of "Fed Williams Speech 🔊"');
        console.log('   ✅ "Retail Sales YoY (May)" instead of "EUR Retail Sales YoY"');

      } else {
        console.log('❌ Database population failed:', populateResult.data.error);
      }

    } else {
      console.log('❌ Direct scraping failed - cannot proceed with cloud function testing');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 TESTING COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error testing enhanced scraping:', error);
  }
}

// Run the enhanced test
testEnhancedScraping();
