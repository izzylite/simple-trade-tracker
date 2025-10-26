const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, orderBy } = require('firebase/firestore');

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

async function checkJune30Events() {
  console.log('🔍 Checking EUR events for Monday, June 30, 2025...\n');
  
  try {
    // Query for events on June 30, 2025 (without currency filter to avoid index requirement)
    const eventsQuery = query(
      collection(db, 'economicEvents'),
      where('date', '==', '2025-06-30')
    );
    
    const snapshot = await getDocs(eventsQuery);
    const events = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Filter for EUR events only
      if (data.currency === 'EUR') {
        events.push({
          time: data.timeUtc,
          event: data.event,
          impact: data.impact,
          currency: data.currency,
          date: data.date
        });
      }
    });

    // Sort events by time
    events.sort((a, b) => a.time.localeCompare(b.time));
    
    console.log(`📊 Found ${events.length} EUR events for June 30, 2025:\n`);
    
    // Look specifically for unemployment-related events
    const unemploymentEvents = events.filter(event => 
      event.event.toLowerCase().includes('unemployment') ||
      event.event.toLowerCase().includes('jobless') ||
      event.event.toLowerCase().includes('employment')
    );
    
    if (unemploymentEvents.length > 0) {
      console.log('🎯 UNEMPLOYMENT-RELATED EVENTS FOUND:');
      console.log('=' .repeat(50));
      unemploymentEvents.forEach((event, index) => {
        console.log(`${index + 1}. "${event.event}"`);
        console.log(`   ⏰ Time: ${event.time}`);
        console.log(`   📊 Impact: ${event.impact}`);
        console.log(`   💱 Currency: ${event.currency}`);
        console.log('');
      });
    } else {
      console.log('❌ No unemployment-related events found for EUR on June 30, 2025');
    }
    
    // Show all EUR events for comparison
    console.log('\n📋 ALL EUR EVENTS FOR JUNE 30, 2025:');
    console.log('=' .repeat(60));
    events.forEach((event, index) => {
      console.log(`${index + 1}. "${event.event}" (${event.impact}) at ${event.time}`);
    });
    
    // Check for events around 08:00 (the time shown in your app)
    console.log('\n🕐 EVENTS AROUND 08:00 UTC:');
    console.log('=' .repeat(40));
    const around8am = events.filter(event => {
      const time = event.time;
      return time.includes('08:') || time.includes('T08:');
    });
    
    if (around8am.length > 0) {
      around8am.forEach((event, index) => {
        console.log(`${index + 1}. "${event.event}" (${event.impact}) at ${event.time}`);
      });
    } else {
      console.log('No events found around 08:00 UTC');
    }
    
  } catch (error) {
    console.error('❌ Error checking events:', error);
  }
}

// Run the check
if (require.main === module) {
  checkJune30Events().catch(console.error);
}

module.exports = { checkJune30Events };
