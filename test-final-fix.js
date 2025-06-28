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

async function testFinalFix() {
  try {
    console.log('🔧 FINAL FIX TEST: JavaScript Compilation Fixed!\n');
    
    // Step 1: Clear existing events
    console.log('🧹 Step 1: Clearing existing events...');
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
    
    // Step 2: Populate with FIXED compiled JavaScript
    console.log('\n🚀 Step 2: Populating with FIXED compiled JavaScript...');
    console.log('   (JavaScript now has: event: cleanEventName(event.event))');
    
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
    
    // Step 4: Test the specific problematic events
    console.log('\n🔍 Step 4: Testing the exact problematic events...');
    const finalQuery = collection(db, 'economicEvents');
    const finalSnapshot = await getDocs(finalQuery);
    
    console.log(`📊 Total events stored: ${finalSnapshot.size}`);
    
    // Look for the specific events that were problematic
    const problematicEvents = [];
    let totalCleanedCount = 0;
    let totalUncleanedCount = 0;
    
    finalSnapshot.forEach(doc => {
      const data = doc.data();
      const eventLower = data.event.toLowerCase();
      
      // Check if this is one of our known problematic events
      const isProblematic = eventLower.includes('bostic') || 
                           eventLower.includes('golbee') || 
                           eventLower.includes('lagarde') || 
                           eventLower.includes('williams') || 
                           eventLower.includes('cook') || 
                           eventLower.includes('hammack');
      
      if (isProblematic) {
        const hasImpactInName = data.event.includes('High') || data.event.includes('Medium') || data.event.includes('Low');
        problematicEvents.push({
          event: data.event,
          impact: data.impact,
          currency: data.currency,
          hasImpactInName: hasImpactInName
        });
        
        if (hasImpactInName) {
          totalUncleanedCount++;
        } else {
          totalCleanedCount++;
        }
      }
    });
    
    console.log('\n📋 Fed/ECB Speech Events (Previously Problematic):');
    if (problematicEvents.length === 0) {
      console.log('   ⚠️ No Fed/ECB speeches found in current data');
    } else {
      problematicEvents.forEach((event, index) => {
        const status = event.hasImpactInName ? '❌ STILL HAS IMPACT' : '✅ CLEANED';
        console.log(`  ${index + 1}. ${event.currency} - "${event.event}" (${event.impact}) ${status}`);
      });
    }
    
    // Step 5: Count all events with impact text
    console.log('\n📊 Step 5: Counting ALL events with impact text...');
    let allCleanedCount = 0;
    let allUncleanedCount = 0;
    
    finalSnapshot.forEach(doc => {
      const data = doc.data();
      const hasImpactInName = data.event.includes('High') || data.event.includes('Medium') || data.event.includes('Low');
      
      if (hasImpactInName) {
        allUncleanedCount++;
      } else {
        allCleanedCount++;
      }
    });
    
    const cleanPercentage = Math.round((allCleanedCount / finalSnapshot.size) * 100);
    
    console.log(`📈 Overall Results:`);
    console.log(`✅ Clean events: ${allCleanedCount}`);
    console.log(`❌ Events with impact text: ${allUncleanedCount}`);
    console.log(`📊 Total events: ${finalSnapshot.size}`);
    console.log(`🎯 Clean percentage: ${cleanPercentage}%`);
    
    // Final verdict
    console.log('\n🎯 FINAL VERDICT:');
    if (allUncleanedCount === 0) {
      console.log('🎉 PERFECT SUCCESS! All events have clean names!');
      console.log('✅ Event name cleaning is working 100%');
      console.log('✅ Frontend should now show clean event names');
      console.log('✅ No more "Medium", "High", or "Low" in event names');
    } else if (cleanPercentage >= 95) {
      console.log('✅ EXCELLENT! Almost all events have clean names');
      console.log(`Only ${allUncleanedCount} events still have impact text`);
    } else if (cleanPercentage >= 85) {
      console.log('✅ GOOD! Most events have clean names');
      console.log(`${allUncleanedCount} events still need cleaning`);
    } else {
      console.log('❌ STILL ISSUES: Many events still have impact text');
      console.log('Need further investigation...');
    }
    
    // Show a few examples of cleaned vs uncleaned
    if (allUncleanedCount > 0) {
      console.log('\n📋 Sample of remaining uncleaned events:');
      let sampleCount = 0;
      finalSnapshot.forEach(doc => {
        if (sampleCount < 5) {
          const data = doc.data();
          const hasImpactInName = data.event.includes('High') || data.event.includes('Medium') || data.event.includes('Low');
          if (hasImpactInName) {
            console.log(`  - ${data.currency}: "${data.event}" (${data.impact})`);
            sampleCount++;
          }
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error in final fix test:', error);
  }
}

testFinalFix();
