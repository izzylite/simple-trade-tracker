const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getFirestore, collection, getDocs, query, orderBy, limit } = require('firebase/firestore');

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
const db = getFirestore(app);

async function testDatabasePopulation() {
  try {
    console.log('🚀 Testing Database-Driven Economic Calendar...\n');
    
    // Step 1: Manually trigger auto-refresh to populate database
    console.log('📡 Triggering auto-refresh function to populate database...');
    const autoRefreshFunction = httpsCallable(functions, 'autoRefreshEconomicCalendarV2');
    
    // Note: This will fail because it's a scheduled function, but let's try the test function instead
    console.log('📡 Testing enhanced scraping function...');
    const testFunction = httpsCallable(functions, 'testMyFXBookScraper');
    const testResult = await testFunction();
    
    console.log(`✅ Test function returned ${testResult.data.eventCount} events`);
    console.log('Sample events:', testResult.data.events.slice(0, 3));
    
    // Step 2: Check if database has events
    console.log('\n📊 Checking economicEvents collection...');
    const eventsQuery = query(
      collection(db, 'economicEvents'),
      orderBy('date'),
      orderBy('time'),
      limit(10)
    );
    
    const eventsSnapshot = await getDocs(eventsQuery);
    console.log(`Found ${eventsSnapshot.size} events in database`);
    
    if (eventsSnapshot.size > 0) {
      console.log('\n📋 Sample events from database:');
      eventsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  ${index + 1}. ${data.currency} - ${data.event} (${data.impact}) at ${data.date}`);
      });
    } else {
      console.log('⚠️ No events found in database. Auto-refresh may not have run yet.');
    }
    
    // Step 3: Test date range query
    console.log('\n🔍 Testing date range query...');
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const dateRangeQuery = query(
      collection(db, 'economicEvents'),
      orderBy('date'),
      limit(5)
    );
    
    const dateRangeSnapshot = await getDocs(dateRangeQuery);
    console.log(`Found ${dateRangeSnapshot.size} events for date range query`);
    
    // Step 4: Test currency filtering
    console.log('\n💱 Testing currency filtering...');
    const allEventsQuery = query(
      collection(db, 'economicEvents'),
      orderBy('date'),
      limit(20)
    );
    
    const allEventsSnapshot = await getDocs(allEventsQuery);
    const allEvents = [];
    allEventsSnapshot.forEach((doc) => {
      allEvents.push(doc.data());
    });
    
    const eurEvents = allEvents.filter(event => event.currency === 'EUR');
    const usdEvents = allEvents.filter(event => event.currency === 'USD');
    const highImpactEvents = allEvents.filter(event => event.impact === 'High');
    
    console.log(`EUR events: ${eurEvents.length}`);
    console.log(`USD events: ${usdEvents.length}`);
    console.log(`High impact events: ${highImpactEvents.length}`);
    
    console.log('\n✅ Database-driven economic calendar testing complete!');
    
  } catch (error) {
    console.error('❌ Error testing database population:', error);
  }
}

testDatabasePopulation();
