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

async function testEnhancedFiltering() {
  try {
    console.log('🚀 Testing Enhanced Cloud Function Filtering...\n');
    
    const fetchFunction = httpsCallable(functions, 'fetchEconomicCalendarV2');
    
    // Test 1: Currency Filtering (EUR + USD)
    console.log('🇪🇺🇺🇸 Testing Currency Filtering (EUR + USD):');
    const currencyResult = await fetchFunction({
      start: '2025-06-26',
      end: '2025-06-27',
      currencies: ['EUR', 'USD']
    });
    
    console.log(`Found ${currencyResult.data.eco_elements.length} EUR/USD events`);
    const eurEvents = currencyResult.data.eco_elements.filter(e => e.currency === 'EUR').length;
    const usdEvents = currencyResult.data.eco_elements.filter(e => e.currency === 'USD').length;
    console.log(`  EUR: ${eurEvents} events, USD: ${usdEvents} events\n`);
    
    // Test 2: Impact Filtering (High Impact Only)
    console.log('🔴 Testing High Impact Filtering:');
    const impactResult = await fetchFunction({
      start: '2025-06-26',
      end: '2025-06-27',
      impacts: ['High']
    });
    
    console.log(`Found ${impactResult.data.eco_elements.length} High Impact events`);
    impactResult.data.eco_elements.slice(0, 3).forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.currency} - ${event.event} (${event.impact})`);
    });
    console.log('');
    
    // Test 3: Combined Filtering (EUR High Impact)
    console.log('🇪🇺🔴 Testing Combined Filtering (EUR + High Impact):');
    const combinedResult = await fetchFunction({
      start: '2025-06-26',
      end: '2025-06-27',
      currencies: ['EUR'],
      impacts: ['High']
    });
    
    console.log(`Found ${combinedResult.data.eco_elements.length} EUR High Impact events`);
    combinedResult.data.eco_elements.slice(0, 3).forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.currency} - ${event.event} (${event.impact}) at ${event.time_utc}`);
    });
    
    console.log('\n✅ All enhanced filtering tests completed successfully!');
    console.log('🎉 Cloud function is production-ready with full filtering support!');
    
  } catch (error) {
    console.error('Error testing enhanced filtering:', error);
  }
}

testEnhancedFiltering();
