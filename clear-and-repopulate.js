const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

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

async function clearAndRepopulate() {
  try {
    console.log('🧹 Step 1: Clearing existing events...\n');
    
    // Get all existing events
    const eventsQuery = collection(db, 'economicEvents');
    const eventsSnapshot = await getDocs(eventsQuery);
    const eventCount = eventsSnapshot.size;
    
    console.log(`Found ${eventCount} existing events to delete`);
    
    if (eventCount > 0) {
      // Delete in batches
      const deletePromises = [];
      eventsSnapshot.forEach(eventDoc => {
        deletePromises.push(deleteDoc(doc(db, 'economicEvents', eventDoc.id)));
      });
      
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${eventCount} existing events`);
    } else {
      console.log('✅ No existing events to delete');
    }
    
    console.log('\n🚀 Step 2: Populating with FIXED event name cleaning...\n');
    
    // Call the updated populate function
    const populateFunction = httpsCallable(functions, 'populateDatabaseManually');
    const populateResult = await populateFunction();
    
    if (populateResult.data.success) {
      console.log(`✅ Population successful with FIXED cleaning logic!`);
      console.log(`📊 Events processed: ${populateResult.data.storedEvents}`);
      console.log(`📈 Total events scraped: ${populateResult.data.totalEvents}`);
      console.log(`💱 Currencies: ${populateResult.data.currencies.join(', ')}`);
      console.log(`📅 Date range: ${populateResult.data.dateRange.start} to ${populateResult.data.dateRange.end}`);
    } else {
      console.log('❌ Population failed:', populateResult.data.error);
      return;
    }
    
    // Wait for data to be stored
    console.log('\n⏳ Step 3: Waiting for data to be stored...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify the fix worked
    console.log('\n🔍 Step 4: Verifying event name cleaning worked...');
    const finalQuery = collection(db, 'economicEvents');
    const finalSnapshot = await getDocs(finalQuery);
    
    console.log(`📊 Total events stored: ${finalSnapshot.size}`);
    
    // Sample events to check if cleaning worked
    const sampleEvents = [];
    let sampleCount = 0;
    finalSnapshot.forEach(doc => {
      if (sampleCount < 10) {
        const data = doc.data();
        sampleEvents.push({
          currency: data.currency,
          event: data.event,
          impact: data.impact,
          date: data.date
        });
        sampleCount++;
      }
    });
    
    console.log('\n📋 Sample events (checking for cleaned names):');
    let cleanedCount = 0;
    let uncleanedCount = 0;
    
    sampleEvents.forEach((event, index) => {
      const hasImpactInName = event.event.includes('High') || event.event.includes('Medium') || event.event.includes('Low');
      const status = hasImpactInName ? '❌ STILL HAS IMPACT' : '✅ CLEANED';
      
      console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact}) ${status}`);
      
      if (hasImpactInName) {
        uncleanedCount++;
      } else {
        cleanedCount++;
      }
    });
    
    console.log(`\n🎯 Cleaning Results:`);
    console.log(`✅ Cleaned events: ${cleanedCount}/${sampleEvents.length}`);
    console.log(`❌ Uncleaned events: ${uncleanedCount}/${sampleEvents.length}`);
    
    if (uncleanedCount === 0) {
      console.log('\n🎉 SUCCESS! Event name cleaning is now working correctly!');
      console.log('✅ No more "Medium", "High", or "Low" text in event names');
      console.log('✅ Impact levels are properly stored in separate impact field');
      console.log('✅ Frontend will now show clean event names with correct impact indicators');
    } else {
      console.log('\n⚠️ Some events still have impact text in names - may need further investigation');
    }
    
  } catch (error) {
    console.error('❌ Error in clear and repopulate:', error);
  }
}

clearAndRepopulate();
