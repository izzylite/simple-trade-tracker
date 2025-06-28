const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

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

async function testSimpleScraping() {
  try {
    console.log('🚀 Testing Enhanced Event Name Scraping...\n');
    
    // Test the enhanced scraping
    console.log('📡 Testing enhanced MyFXBook scraper...');
    const testFunction = httpsCallable(functions, 'testMyFXBookScraper');
    const result = await testFunction();
    
    if (result.data.success) {
      console.log(`✅ Successfully scraped ${result.data.eventCount} events`);
      console.log(`📅 Date: ${result.data.date}`);
      
      if (result.data.events && result.data.events.length > 0) {
        console.log('\n📋 Sample events with enhanced names:');
        result.data.events.slice(0, 10).forEach((event, index) => {
          console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact})`);
        });
        
        // Analyze event name quality
        const eventNames = result.data.events.map(e => e.event);
        const avgLength = eventNames.reduce((sum, name) => sum + name.length, 0) / eventNames.length;
        const shortNames = eventNames.filter(name => name.length <= 10);
        const goodNames = eventNames.filter(name => name.length > 10 && name.length <= 50);
        
        console.log('\n📊 Event Name Quality Analysis:');
        console.log(`  Average length: ${Math.round(avgLength)} characters`);
        console.log(`  Short names (≤10): ${shortNames.length}`);
        console.log(`  Good names (11-50): ${goodNames.length}`);
        
        if (shortNames.length > 0) {
          console.log('\n⚠️ Short names that may need attention:');
          shortNames.slice(0, 5).forEach(name => console.log(`    - "${name}"`));
        }
        
        console.log('\n✅ Good quality event names:');
        goodNames.slice(0, 8).forEach(name => console.log(`    - "${name}"`));
        
      } else {
        console.log('❌ No events returned from scraper');
      }
      
    } else {
      console.log('❌ Scraping failed:', result.data.error);
    }
    
    // Now test the manual population with enhanced scraping
    console.log('\n🔄 Testing manual database population with enhanced scraping...');
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
    
  } catch (error) {
    console.error('❌ Error testing enhanced scraping:', error);
  }
}

testSimpleScraping();
