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

async function testScraperOnly() {
  try {
    console.log('🔍 Testing ONLY the scraper (no database population)...\n');
    
    // Test just the scraper
    console.log('📡 Testing MyFXBook scraper...');
    const testFunction = httpsCallable(functions, 'testMyFXBookScraper');
    const result = await testFunction();
    
    if (result.data.success) {
      console.log(`✅ Successfully scraped ${result.data.eventCount} events`);
      console.log(`📅 Date: ${result.data.date}`);
      
      if (result.data.events && result.data.events.length > 0) {
        console.log('\n📋 Raw scraped events (first 15):');
        result.data.events.slice(0, 15).forEach((event, index) => {
          console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact})`);
        });
        
        // Analyze event name quality in detail
        const eventNames = result.data.events.map(e => e.event);
        
        console.log('\n🔍 Detailed Event Name Analysis:');
        
        // Check for currency prefixes
        const withCurrencyPrefix = eventNames.filter(name => 
          /^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)\s/.test(name)
        );
        
        // Check for time indicators
        const withTimeIndicators = eventNames.filter(name => 
          /\d+h|\d+min|days/.test(name)
        );
        
        // Check for clean names
        const cleanNames = eventNames.filter(name => 
          !/^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)\s/.test(name) && 
          !/\d+h|\d+min|days/.test(name)
        );
        
        console.log(`  Total events: ${eventNames.length}`);
        console.log(`  With currency prefix: ${withCurrencyPrefix.length}`);
        console.log(`  With time indicators: ${withTimeIndicators.length}`);
        console.log(`  Clean names: ${cleanNames.length}`);
        console.log(`  Clean percentage: ${Math.round((cleanNames.length / eventNames.length) * 100)}%`);
        
        if (withCurrencyPrefix.length > 0) {
          console.log('\n⚠️ Events with currency prefix (first 10):');
          withCurrencyPrefix.slice(0, 10).forEach(name => console.log(`    - "${name}"`));
        }
        
        if (withTimeIndicators.length > 0) {
          console.log('\n⚠️ Events with time indicators (first 5):');
          withTimeIndicators.slice(0, 5).forEach(name => console.log(`    - "${name}"`));
        }
        
        if (cleanNames.length > 0) {
          console.log('\n✅ Clean event names (first 10):');
          cleanNames.slice(0, 10).forEach(name => console.log(`    - "${name}"`));
        }
        
        // Check specific currencies
        const usdEvents = result.data.events.filter(e => e.currency === 'USD');
        const eurEvents = result.data.events.filter(e => e.currency === 'EUR');
        
        console.log('\n💱 Currency breakdown:');
        console.log(`  USD events: ${usdEvents.length}`);
        console.log(`  EUR events: ${eurEvents.length}`);
        
        if (usdEvents.length > 0) {
          console.log('\n🇺🇸 Sample USD events:');
          usdEvents.slice(0, 5).forEach(event => {
            console.log(`    - "${event.event}"`);
          });
        }
        
        if (eurEvents.length > 0) {
          console.log('\n🇪🇺 Sample EUR events:');
          eurEvents.slice(0, 5).forEach(event => {
            console.log(`    - "${event.event}"`);
          });
        }
        
      } else {
        console.log('❌ No events returned from scraper');
      }
      
    } else {
      console.log('❌ Scraping failed:', result.data.error);
    }
    
  } catch (error) {
    console.error('❌ Error testing scraper:', error);
  }
}

testScraperOnly();
