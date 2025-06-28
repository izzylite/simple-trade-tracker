const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, getDocs, doc, updateDoc, writeBatch } = require('firebase/firestore');

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

function cleanEventName(eventText) {
  let cleanEventName = eventText.trim();
  
  // Remove currency codes from event name (more aggressive cleaning)
  const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
  
  // Remove currency at the beginning of the string
  validCurrencies.forEach(curr => {
    cleanEventName = cleanEventName.replace(new RegExp(`^${curr}\\s+`, 'g'), '').trim();
  });
  
  // Remove currency anywhere in the string
  validCurrencies.forEach(curr => {
    cleanEventName = cleanEventName.replace(new RegExp(`\\b${curr}\\b`, 'g'), '').trim();
  });
  
  // Remove time indicators like "4h 5min", "35 min", etc.
  cleanEventName = cleanEventName.replace(/\d+h\s*\d*min?/gi, '').trim();
  cleanEventName = cleanEventName.replace(/\d+\s*min/gi, '').trim();
  cleanEventName = cleanEventName.replace(/\d+h/gi, '').trim();
  
  // Remove "days" prefix that sometimes appears
  cleanEventName = cleanEventName.replace(/^days\s+/i, '').trim();
  
  // Remove leading/trailing special characters and extra spaces
  cleanEventName = cleanEventName.replace(/^[^\w]+|[^\w]+$/g, '').trim();
  cleanEventName = cleanEventName.replace(/\s+/g, ' ').trim();
  
  // Remove any remaining currency codes that might be embedded
  validCurrencies.forEach(curr => {
    cleanEventName = cleanEventName.replace(new RegExp(`\\s+${curr}\\s+`, 'g'), ' ').trim();
  });
  
  // Final cleanup
  cleanEventName = cleanEventName.replace(/^\s+|\s+$/g, '').trim();
  
  return cleanEventName;
}

async function cleanExistingEvents() {
  try {
    console.log('🧹 Cleaning existing event names in database...\n');
    
    // Get all events from the database
    const eventsQuery = query(collection(db, 'economicEvents'));
    const querySnapshot = await getDocs(eventsQuery);
    
    console.log(`📊 Found ${querySnapshot.size} events to process`);
    
    let cleanedCount = 0;
    let unchangedCount = 0;
    let batchCount = 0;
    const batchSize = 500; // Firestore batch limit
    
    let batch = writeBatch(db);
    
    for (const docSnapshot of querySnapshot.docs) {
      const data = docSnapshot.data();
      const originalEvent = data.event;
      const cleanedEvent = cleanEventName(originalEvent);
      
      if (originalEvent !== cleanedEvent) {
        // Update the document in the batch
        const docRef = doc(db, 'economicEvents', docSnapshot.id);
        batch.update(docRef, { event: cleanedEvent });
        
        cleanedCount++;
        
        if (cleanedCount <= 10) {
          console.log(`✅ Cleaning: "${originalEvent}" → "${cleanedEvent}"`);
        }
        
        // Commit batch when it reaches the limit
        if (batchCount >= batchSize - 1) {
          await batch.commit();
          console.log(`📦 Committed batch of ${batchCount + 1} updates`);
          batch = writeBatch(db);
          batchCount = 0;
        } else {
          batchCount++;
        }
      } else {
        unchangedCount++;
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`📦 Committed final batch of ${batchCount} updates`);
    }
    
    console.log('\n📊 Cleaning Summary:');
    console.log(`  Total events processed: ${querySnapshot.size}`);
    console.log(`  Events cleaned: ${cleanedCount}`);
    console.log(`  Events unchanged: ${unchangedCount}`);
    console.log(`  Cleaning percentage: ${Math.round((cleanedCount / querySnapshot.size) * 100)}%`);
    
    if (cleanedCount > 0) {
      console.log('\n🎉 Event names have been cleaned!');
      console.log('📱 Frontend should now show improved event names like:');
      console.log('   ✅ "Inflation Rate MoM (Jun)" instead of "days EUR Inflation Rate MoM (Jun"');
      console.log('   ✅ "Core PCE Price Index YoY (May)" instead of "4h 5min USD Core PCE Price Index YoY (May)"');
      console.log('   ✅ "Fed Williams Speech" instead of "USD Fed Williams Speech"');
      console.log('   ✅ "Retail Sales YoY (May)" instead of "EUR Retail Sales YoY (May)"');
      
      console.log('\n🔄 Refresh your Economic Calendar to see the cleaned event names!');
    } else {
      console.log('\n✅ All event names were already clean!');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning events:', error);
  }
}

cleanExistingEvents();
