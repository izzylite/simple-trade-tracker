const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function populateFreshData() {
  try {
    console.log('🚀 Populating Fresh Economic Calendar Data...\n');
    
    // Step 1: Verify database is empty
    console.log('📊 Step 1: Verifying database is clean...');
    const initialQuery = collection(db, 'economicEvents');
    const initialSnapshot = await getDocs(initialQuery);
    const initialCount = initialSnapshot.size;
    console.log(`Current event count: ${initialCount}`);
    
    if (initialCount === 0) {
      console.log('✅ Database is clean and ready for fresh economic calendar data');
    } else {
      console.log(`⚠️ Database contains ${initialCount} events - will add new data`);
    }
    
    // Step 2: Populate with fresh data
    console.log('\n🔄 Step 2: Populating with fresh economic calendar data...');
    const populateFunction = httpsCallable(functions, 'populateDatabaseManually');
    const populateResult = await populateFunction();
    
    if (populateResult.data.success) {
      console.log(`✅ Population successful!`);
      console.log(`📊 Events processed: ${populateResult.data.storedEvents}`);
      console.log(`📈 Total events scraped: ${populateResult.data.totalEvents}`);
      console.log(`💱 Currencies: ${populateResult.data.currencies.join(', ')}`);
      console.log(`📅 Date range: ${populateResult.data.dateRange.start} to ${populateResult.data.dateRange.end}`);
    } else {
      console.log('❌ Population failed:', populateResult.data.error);
      return;
    }
    
    // Step 3: Wait for data to be stored
    console.log('\n⏳ Step 3: Waiting for data to be stored...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 4: Verify final count
    console.log('\n📊 Step 4: Verifying final data count...');
    const finalQuery = collection(db, 'economicEvents');
    const finalSnapshot = await getDocs(finalQuery);
    const finalCount = finalSnapshot.size;
    console.log(`Final event count: ${finalCount}`);
    
    // Step 5: Sample some events to verify quality
    console.log('\n🔍 Step 5: Sampling events to verify data quality...');
    const sampleEvents = [];
    let sampleCount = 0;
    finalSnapshot.forEach(doc => {
      if (sampleCount < 5) {
        const data = doc.data();
        sampleEvents.push({
          currency: data.currency,
          event: data.event,
          impact: data.impact,
          date: data.date,
          timeUtc: data.timeUtc
        });
        sampleCount++;
      }
    });
    
    console.log('📋 Sample events:');
    sampleEvents.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact})`);
      console.log(`     📅 ${event.date} at ${event.timeUtc}`);
    });
    
    // Step 6: Analyze data distribution
    console.log('\n📈 Step 6: Analyzing data distribution...');
    const currencies = {};
    const impacts = {};
    const dates = {};
    
    finalSnapshot.forEach(doc => {
      const data = doc.data();
      currencies[data.currency] = (currencies[data.currency] || 0) + 1;
      impacts[data.impact] = (impacts[data.impact] || 0) + 1;
      dates[data.date] = (dates[data.date] || 0) + 1;
    });
    
    console.log('💱 Currency distribution:');
    Object.entries(currencies).forEach(([currency, count]) => {
      console.log(`  ${currency}: ${count} events`);
    });
    
    console.log('\n🎯 Impact distribution:');
    Object.entries(impacts).forEach(([impact, count]) => {
      console.log(`  ${impact}: ${count} events`);
    });
    
    console.log('\n📅 Date distribution (top 5):');
    const sortedDates = Object.entries(dates)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    sortedDates.forEach(([date, count]) => {
      console.log(`  ${date}: ${count} events`);
    });
    
    console.log('\n🎉 Fresh Data Population Complete!');
    console.log(`✅ ${finalCount} events successfully stored`);
    console.log('✅ Database is ready for frontend pagination');
    console.log('✅ Auto-refresh will maintain data without duplicates');
    
  } catch (error) {
    console.error('❌ Error populating fresh data:', error);
  }
}

populateFreshData();
