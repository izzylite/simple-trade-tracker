const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getFirestore, collection, query, where, getCountFromServer } = require('firebase/firestore');

/**
 * Upload HTML file to Firebase Cloud Function for processing
 * This script demonstrates how to use the new processHtmlEconomicEvents function
 */

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

async function uploadHtmlToCloud(htmlFilePath) {
  try {
    console.log('🚀 UPLOAD HTML TO CLOUD FUNCTION');
    console.log('============================================================');
    
    // Check if file exists
    if (!fs.existsSync(htmlFilePath)) {
      throw new Error(`HTML file not found: ${htmlFilePath}`);
    }

    // Step 1: Check current database state (using efficient count query)
    console.log('📊 Step 1: Checking current database state...');
    const eventsQuery = query(collection(db, 'economicEvents'), where('impact', '!=', 'NonExistent'));
    const initialCountSnapshot = await getCountFromServer(eventsQuery);
    const initialCount = initialCountSnapshot.data().count;
    console.log(`Current event count: ${initialCount}`);

    // Step 2: Read HTML file
    console.log('\n📄 Step 2: Reading HTML file...');
    console.log(`File: ${htmlFilePath}`);
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    console.log(`📊 HTML file size: ${htmlContent.length} characters`);

    // Step 3: Upload to cloud function
    console.log('\n🔄 Step 3: Processing HTML content via cloud function...');
    const processHtmlFunction = httpsCallable(functions, 'processHtmlEconomicEvents');
    const result = await processHtmlFunction({
      htmlContent: htmlContent
    });
    
    if (result.data.success) {
      console.log('✅ PROCESSING COMPLETE!');
      console.log('============================================================');
      console.log(`🎉 Successfully processed ${result.data.totalEvents} events`);
      console.log(`💾 Stored ${result.data.majorCurrencyEvents} major currency events`);
      console.log(`💱 Currencies found: ${result.data.currencies.join(', ')}`);
      
      if (result.data.dateRange.start && result.data.dateRange.end) {
        console.log(`📅 Date range: ${result.data.dateRange.start} to ${result.data.dateRange.end}`);
      }
      
      console.log('\n📋 SAMPLE EVENTS:');
      result.data.sampleEvents.forEach((event, i) => {
        console.log(`  ${i + 1}. ${event.currency} - "${event.event}" (${event.impact})`);
        console.log(`     📅 ${event.time_utc}`);
        if (event.country) console.log(`     🌍 ${event.country} (${event.flagCode})`);
      });
    } else {
      console.error('❌ Processing failed:', result.data.error);
      return result.data;
    }

    // Step 4: Wait for data to be stored
    console.log('\n⏳ Step 4: Waiting for data to be stored...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Verify final count (using efficient count query)
    console.log('\n📊 Step 5: Verifying final data count...');
    const finalCountSnapshot = await getCountFromServer(eventsQuery);
    const finalCount = finalCountSnapshot.data().count;
    const newEvents = finalCount - initialCount;
    console.log(`Initial count: ${initialCount}`);
    console.log(`Final count: ${finalCount}`);
    console.log(`New events added: ${newEvents}`);

    console.log('\n🎉 HTML UPLOAD COMPLETE!');
    console.log(`✅ ${newEvents} new events successfully stored`);
    console.log('✅ Database updated with HTML content');

    return result.data;

  } catch (error) {
    console.error('❌ Error uploading HTML to cloud:', error);
    throw error;
  }
}

// Main execution function
async function main() {
  const htmlFile = process.argv[2];
  
  if (!htmlFile) {
    console.log('Usage: node upload-html-to-cloud.js <html-file-path>');
    console.log('Example: node upload-html-to-cloud.js sample-economic-calendar.html');
    console.log('');
    console.log('This script will:');
    console.log('1. Check current database state');
    console.log('2. Read the HTML file');
    console.log('3. Upload to cloud function for processing');
    console.log('4. Verify the results in database');
    process.exit(1);
  }

  try {
    const result = await uploadHtmlToCloud(htmlFile);
    
    if (result.success) {
      console.log('\n🎉 SUCCESS! HTML file processed and stored in database.');
    } else {
      console.log('\n❌ FAILED! Check the error messages above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { uploadHtmlToCloud };
