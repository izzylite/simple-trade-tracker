/**
 * Test Firestore Connection and Data Discovery
 * This script tests the connection to Firestore and discovers available data
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

console.log('🔧 Firebase Config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

/**
 * Test Firestore connection and discover data
 */
async function testFirestoreConnection() {
  console.log('🚀 Testing Firestore Connection...\n');
  
  try {
    // Test collections to check
    const collectionsToTest = [
      'calendars',
      'economicEvents', 
      'sharedTrades',
      'sharedCalendars',
      'economicCalendarCache'
    ];

    for (const collectionName of collectionsToTest) {
      try {
        console.log(`📋 Testing collection: ${collectionName}`);
        const snapshot = await getDocs(collection(firestore, collectionName));
        console.log(`   ✅ Found ${snapshot.size} documents`);
        
        if (snapshot.size > 0) {
          // Show first document structure
          const firstDoc = snapshot.docs[0];
          const data = firstDoc.data();
          console.log(`   📄 Sample document ID: ${firstDoc.id}`);
          console.log(`   🔑 Sample fields:`, Object.keys(data).slice(0, 10).join(', '));
          
          // For calendars, check subcollections
          if (collectionName === 'calendars') {
            try {
              const yearsSnapshot = await getDocs(collection(firestore, `calendars/${firstDoc.id}/years`));
              console.log(`   📅 Subcollection 'years': ${yearsSnapshot.size} documents`);
              
              if (yearsSnapshot.size > 0) {
                const firstTrade = yearsSnapshot.docs[0];
                const tradeData = firstTrade.data();
                console.log(`   💰 Sample trade ID: ${firstTrade.id}`);
                console.log(`   🔑 Trade fields:`, Object.keys(tradeData).slice(0, 10).join(', '));
              }
            } catch (subError) {
              console.log(`   ⚠️  Could not access subcollection: ${subError.message}`);
            }
          }
        }
        console.log('');
      } catch (error) {
        console.log(`   ❌ Error accessing ${collectionName}: ${error.message}\n`);
      }
    }

    console.log('🎉 Firestore connection test completed!');
    
  } catch (error) {
    console.error('❌ Firestore connection test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testFirestoreConnection().catch(console.error);
}

module.exports = { testFirestoreConnection };
