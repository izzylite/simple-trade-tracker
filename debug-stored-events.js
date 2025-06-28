const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, limit } = require('firebase/firestore');

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

async function debugStoredEvents() {
  try {
    console.log('🔍 Debugging Stored Events in Database\n');
    
    // Query for Fed events specifically
    console.log('📊 Step 1: Checking Fed events...');
    const fedQuery = query(
      collection(db, 'economicEvents'),
      where('currency', '==', 'USD'),
      limit(10)
    );
    
    const fedSnapshot = await getDocs(fedQuery);
    console.log(`Found ${fedSnapshot.size} USD events`);
    
    console.log('\n📋 USD Events (checking for impact in names):');
    fedSnapshot.forEach((doc, index) => {
      const data = doc.data();
      const hasImpactInName = data.event.includes('High') || data.event.includes('Medium') || data.event.includes('Low');
      const status = hasImpactInName ? '❌ HAS IMPACT TEXT' : '✅ CLEAN';
      
      console.log(`  ${index + 1}. "${data.event}" (Impact: ${data.impact}) ${status}`);
      console.log(`     ID: ${data.id}`);
      console.log(`     Date: ${data.date} Time: ${data.timeUtc}`);
      
      if (hasImpactInName) {
        console.log(`     ⚠️  PROBLEM: Event name contains impact text!`);
      }
      console.log('');
    });
    
    // Query for EUR events specifically  
    console.log('\n📊 Step 2: Checking EUR events...');
    const eurQuery = query(
      collection(db, 'economicEvents'),
      where('currency', '==', 'EUR'),
      limit(10)
    );
    
    const eurSnapshot = await getDocs(eurQuery);
    console.log(`Found ${eurSnapshot.size} EUR events`);
    
    console.log('\n📋 EUR Events (checking for impact in names):');
    eurSnapshot.forEach((doc, index) => {
      const data = doc.data();
      const hasImpactInName = data.event.includes('High') || data.event.includes('Medium') || data.event.includes('Low');
      const status = hasImpactInName ? '❌ HAS IMPACT TEXT' : '✅ CLEAN';
      
      console.log(`  ${index + 1}. "${data.event}" (Impact: ${data.impact}) ${status}`);
      console.log(`     ID: ${data.id}`);
      console.log(`     Date: ${data.date} Time: ${data.timeUtc}`);
      
      if (hasImpactInName) {
        console.log(`     ⚠️  PROBLEM: Event name contains impact text!`);
      }
      console.log('');
    });
    
    // Look for specific events from the user's screenshot
    console.log('\n📊 Step 3: Looking for specific events from screenshot...');
    
    // Search for Fed Bostic Speech
    const bosticQuery = query(
      collection(db, 'economicEvents'),
      where('currency', '==', 'USD')
    );
    
    const bosticSnapshot = await getDocs(bosticQuery);
    console.log('\n🔍 Searching for Fed Bostic and Fed Golbee speeches...');
    
    let foundBostic = false;
    let foundGolbee = false;
    let foundLagarde = false;
    
    bosticSnapshot.forEach(doc => {
      const data = doc.data();
      
      if (data.event.toLowerCase().includes('bostic')) {
        console.log(`📍 FOUND Fed Bostic: "${data.event}" (Impact: ${data.impact})`);
        foundBostic = true;
      }
      
      if (data.event.toLowerCase().includes('golbee')) {
        console.log(`📍 FOUND Fed Golbee: "${data.event}" (Impact: ${data.impact})`);
        foundGolbee = true;
      }
    });
    
    // Search for ECB Lagarde
    const eurAllQuery = query(
      collection(db, 'economicEvents'),
      where('currency', '==', 'EUR')
    );
    
    const eurAllSnapshot = await getDocs(eurAllQuery);
    eurAllSnapshot.forEach(doc => {
      const data = doc.data();
      
      if (data.event.toLowerCase().includes('lagarde')) {
        console.log(`📍 FOUND ECB Lagarde: "${data.event}" (Impact: ${data.impact})`);
        foundLagarde = true;
      }
    });
    
    console.log('\n🎯 Summary:');
    console.log(`Fed Bostic found: ${foundBostic ? '✅' : '❌'}`);
    console.log(`Fed Golbee found: ${foundGolbee ? '✅' : '❌'}`);
    console.log(`ECB Lagarde found: ${foundLagarde ? '✅' : '❌'}`);
    
    // Count total events with impact in names
    console.log('\n📊 Step 4: Counting all events with impact text in names...');
    const allEventsQuery = collection(db, 'economicEvents');
    const allEventsSnapshot = await getDocs(allEventsQuery);
    
    let totalEvents = 0;
    let eventsWithImpactText = 0;
    let cleanEvents = 0;
    
    allEventsSnapshot.forEach(doc => {
      const data = doc.data();
      totalEvents++;
      
      const hasImpactInName = data.event.includes('High') || data.event.includes('Medium') || data.event.includes('Low');
      if (hasImpactInName) {
        eventsWithImpactText++;
      } else {
        cleanEvents++;
      }
    });
    
    console.log(`📊 Total events: ${totalEvents}`);
    console.log(`❌ Events with impact text in names: ${eventsWithImpactText}`);
    console.log(`✅ Clean events: ${cleanEvents}`);
    console.log(`📈 Clean percentage: ${Math.round((cleanEvents / totalEvents) * 100)}%`);
    
    if (eventsWithImpactText > 0) {
      console.log('\n⚠️  CRITICAL ISSUE: Event name cleaning is NOT working!');
      console.log('The cleanEventName function is not being applied during storage.');
      console.log('Need to investigate the storeEventsInDatabase function.');
    } else {
      console.log('\n✅ Event name cleaning is working correctly!');
      console.log('The issue might be in frontend caching or data fetching.');
    }
    
  } catch (error) {
    console.error('❌ Error debugging stored events:', error);
  }
}

debugStoredEvents();
