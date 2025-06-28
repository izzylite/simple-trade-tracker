const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getFirestore, collection, getDocs, query, orderBy, limit, where } = require('firebase/firestore');

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

async function testManualPopulation() {
  try {
    console.log('🚀 Testing Manual Database Population...\n');
    
    // Step 1: Call manual population function
    console.log('📡 Calling populateDatabaseManually function...');
    const populateFunction = httpsCallable(functions, 'populateDatabaseManually');
    const result = await populateFunction();
    
    console.log('✅ Population result:', result.data);
    
    if (result.data.success) {
      console.log(`📊 Successfully stored ${result.data.storedEvents} events out of ${result.data.totalEvents} total events`);
      console.log(`💱 Currencies: ${result.data.currencies.join(', ')}`);
      console.log(`📅 Date range: ${result.data.dateRange.start} to ${result.data.dateRange.end}`);
    } else {
      console.log('❌ Population failed:', result.data.error);
      return;
    }
    
    // Step 2: Wait a moment for indexes to be ready
    console.log('\n⏳ Waiting for indexes to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Test database queries
    console.log('\n📊 Testing database queries...');
    
    // Simple query without compound index
    const simpleQuery = query(
      collection(db, 'economicEvents'),
      limit(10)
    );
    
    const simpleSnapshot = await getDocs(simpleQuery);
    console.log(`Found ${simpleSnapshot.size} events with simple query`);
    
    if (simpleSnapshot.size > 0) {
      console.log('\n📋 Sample events from database:');
      simpleSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  ${index + 1}. ${data.currency} - ${data.event} (${data.impact}) at ${data.date}`);
      });
    }
    
    // Test currency filtering
    console.log('\n💱 Testing currency filtering...');
    const allEvents = [];
    simpleSnapshot.forEach((doc) => {
      allEvents.push(doc.data());
    });
    
    const eurEvents = allEvents.filter(event => event.currency === 'EUR');
    const usdEvents = allEvents.filter(event => event.currency === 'USD');
    const highImpactEvents = allEvents.filter(event => event.impact === 'High');
    
    console.log(`EUR events: ${eurEvents.length}`);
    console.log(`USD events: ${usdEvents.length}`);
    console.log(`High impact events: ${highImpactEvents.length}`);
    
    console.log('\n✅ Manual population and database testing complete!');
    console.log('🎉 Frontend can now query the economicEvents collection!');
    
  } catch (error) {
    console.error('❌ Error testing manual population:', error);
  }
}

testManualPopulation();
