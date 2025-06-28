const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, limit, getDocs, orderBy } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBJqJNvW_WwM2d8kKs8Z8Z8Z8Z8Z8Z8Z8Z',
  authDomain: 'tradetracker-30ec1.firebaseapp.com',
  projectId: 'tradetracker-30ec1',
  storageBucket: 'tradetracker-30ec1.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdefghijklmnop'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCurrentEvents() {
  try {
    console.log('🔍 Checking current event names in database...\n');
    
    // Get a sample of events from the database
    const eventsQuery = query(
      collection(db, 'economicEvents'),
      orderBy('date'),
      orderBy('time'),
      limit(20)
    );
    
    const querySnapshot = await getDocs(eventsQuery);
    const events = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      events.push({
        currency: data.currency,
        event: data.event,
        impact: data.impact,
        date: data.date,
        timeUtc: data.timeUtc
      });
    });
    
    console.log(`📊 Found ${events.length} events in database`);
    console.log('\n📋 Sample event names:');
    
    events.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact})`);
      console.log(`     Date: ${event.date}, Time: ${event.timeUtc}`);
    });
    
    // Analyze event name quality
    const eventNames = events.map(e => e.event);
    const avgLength = eventNames.reduce((sum, name) => sum + name.length, 0) / eventNames.length;
    const shortNames = eventNames.filter(name => name.length <= 10);
    const goodNames = eventNames.filter(name => name.length > 10 && name.length <= 50);
    const longNames = eventNames.filter(name => name.length > 50);
    
    console.log('\n📈 Event Name Quality Analysis:');
    console.log(`  Average length: ${Math.round(avgLength)} characters`);
    console.log(`  Short names (≤10): ${shortNames.length}`);
    console.log(`  Good names (11-50): ${goodNames.length}`);
    console.log(`  Long names (>50): ${longNames.length}`);
    
    // Check for currency prefixes
    const withCurrencyPrefix = eventNames.filter(name => 
      /^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)\s/.test(name)
    );
    
    const withTimeIndicators = eventNames.filter(name => 
      /\d+h|\d+min|days/.test(name)
    );
    
    console.log('\n🔍 Quality Issues:');
    console.log(`  Events with currency prefix: ${withCurrencyPrefix.length}`);
    console.log(`  Events with time indicators: ${withTimeIndicators.length}`);
    
    if (withCurrencyPrefix.length > 0) {
      console.log('\n⚠️ Events still with currency prefix:');
      withCurrencyPrefix.slice(0, 5).forEach(name => console.log(`    - "${name}"`));
    }
    
    if (withTimeIndicators.length > 0) {
      console.log('\n⚠️ Events still with time indicators:');
      withTimeIndicators.slice(0, 5).forEach(name => console.log(`    - "${name}"`));
    }
    
    // Show clean events
    const cleanEvents = eventNames.filter(name => 
      !/^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)\s/.test(name) && 
      !/\d+h|\d+min|days/.test(name)
    );
    
    console.log('\n✅ Clean event names:');
    cleanEvents.slice(0, 10).forEach(name => console.log(`    - "${name}"`));
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total events checked: ${events.length}`);
    console.log(`  Clean events: ${cleanEvents.length}`);
    console.log(`  Events needing improvement: ${events.length - cleanEvents.length}`);
    
    const cleanPercentage = Math.round((cleanEvents.length / events.length) * 100);
    console.log(`  Clean percentage: ${cleanPercentage}%`);
    
    if (cleanPercentage >= 80) {
      console.log('\n🎉 Event names are mostly clean!');
    } else {
      console.log('\n⚠️ Event names need more cleaning.');
    }
    
  } catch (error) {
    console.error('❌ Error checking events:', error);
  }
}

checkCurrentEvents();
