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

async function finalTestRepopulate() {
  try {
    console.log('🧹 FINAL TEST: Clear and Repopulate with Fixed Function\n');
    
    // Step 1: Clear existing events
    console.log('📊 Step 1: Clearing existing events...');
    const eventsQuery = collection(db, 'economicEvents');
    const eventsSnapshot = await getDocs(eventsQuery);
    const eventCount = eventsSnapshot.size;
    
    console.log(`Found ${eventCount} existing events to delete`);
    
    if (eventCount > 0) {
      const deletePromises = [];
      eventsSnapshot.forEach(eventDoc => {
        deletePromises.push(deleteDoc(doc(db, 'economicEvents', eventDoc.id)));
      });
      
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${eventCount} existing events`);
    }
    
    // Step 2: Populate with newly deployed function
    console.log('\n🚀 Step 2: Populating with NEWLY DEPLOYED function...');
    const populateFunction = httpsCallable(functions, 'populateDatabaseManually');
    const populateResult = await populateFunction();
    
    if (populateResult.data.success) {
      console.log(`✅ Population successful!`);
      console.log(`📊 Events processed: ${populateResult.data.storedEvents}`);
    } else {
      console.log('❌ Population failed:', populateResult.data.error);
      return;
    }
    
    // Step 3: Wait and verify
    console.log('\n⏳ Step 3: Waiting for data to be stored...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Test specific problematic events
    console.log('\n🔍 Step 4: Testing specific problematic events...');
    const finalQuery = collection(db, 'economicEvents');
    const finalSnapshot = await getDocs(finalQuery);
    
    console.log(`📊 Total events stored: ${finalSnapshot.size}`);
    
    // Look for the specific events that were problematic
    const problematicEventNames = [
      'bostic', 'golbee', 'lagarde', 'williams', 'cook', 'hammack'
    ];
    
    let foundProblematicEvents = [];
    let cleanedCount = 0;
    let uncleanedCount = 0;
    
    finalSnapshot.forEach(doc => {
      const data = doc.data();
      const eventLower = data.event.toLowerCase();
      
      // Check if this is one of our problematic events
      const isProblematic = problematicEventNames.some(name => eventLower.includes(name));
      
      if (isProblematic) {
        const hasImpactInName = data.event.includes('High') || data.event.includes('Medium') || data.event.includes('Low');
        foundProblematicEvents.push({
          event: data.event,
          impact: data.impact,
          currency: data.currency,
          hasImpactInName: hasImpactInName
        });
        
        if (hasImpactInName) {
          uncleanedCount++;
        } else {
          cleanedCount++;
        }
      }
    });
    
    console.log('\n📋 Found Problematic Events (Fed/ECB speeches):');
    foundProblematicEvents.forEach((event, index) => {
      const status = event.hasImpactInName ? '❌ STILL HAS IMPACT' : '✅ CLEANED';
      console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact}) ${status}`);
    });
    
    console.log(`\n🎯 Final Results:`);
    console.log(`✅ Cleaned Fed/ECB events: ${cleanedCount}`);
    console.log(`❌ Uncleaned Fed/ECB events: ${uncleanedCount}`);
    console.log(`📊 Total Fed/ECB events found: ${foundProblematicEvents.length}`);
    
    if (uncleanedCount === 0 && foundProblematicEvents.length > 0) {
      console.log('\n🎉 SUCCESS! Event name cleaning is now working correctly!');
      console.log('✅ All Fed/ECB speeches have clean names');
      console.log('✅ No more "Medium", "High", or "Low" text in event names');
      console.log('✅ Frontend should now display clean event names');
    } else if (foundProblematicEvents.length === 0) {
      console.log('\n⚠️ No Fed/ECB speeches found - may need to check date range');
    } else {
      console.log('\n❌ Still have issues with event name cleaning');
      console.log('Need to investigate further...');
    }
    
    // Step 5: Sample random events to verify overall cleaning
    console.log('\n📊 Step 5: Sampling random events for overall verification...');
    const allEvents = [];
    finalSnapshot.forEach(doc => {
      allEvents.push(doc.data());
    });
    
    // Get random sample of 10 events
    const sampleSize = Math.min(10, allEvents.length);
    const randomSample = [];
    for (let i = 0; i < sampleSize; i++) {
      const randomIndex = Math.floor(Math.random() * allEvents.length);
      randomSample.push(allEvents[randomIndex]);
    }
    
    console.log('\n📋 Random sample of events:');
    let totalClean = 0;
    let totalUncleaned = 0;
    
    randomSample.forEach((event, index) => {
      const hasImpactInName = event.event.includes('High') || event.event.includes('Medium') || event.event.includes('Low');
      const status = hasImpactInName ? '❌ HAS IMPACT' : '✅ CLEAN';
      
      console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact}) ${status}`);
      
      if (hasImpactInName) {
        totalUncleaned++;
      } else {
        totalClean++;
      }
    });
    
    const cleanPercentage = Math.round((totalClean / sampleSize) * 100);
    console.log(`\n📈 Sample cleaning rate: ${totalClean}/${sampleSize} (${cleanPercentage}%)`);
    
    if (cleanPercentage === 100) {
      console.log('🎉 Perfect! All sampled events have clean names!');
    } else if (cleanPercentage >= 90) {
      console.log('✅ Very good! Most events have clean names.');
    } else {
      console.log('⚠️ Still some issues with event name cleaning.');
    }
    
  } catch (error) {
    console.error('❌ Error in final test repopulate:', error);
  }
}

finalTestRepopulate();
