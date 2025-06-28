const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

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

async function testFixedFunction() {
  try {
    console.log('Testing fixed enhanced cloud function...');
    const testFunction = httpsCallable(functions, 'testMyFXBookScraper');
    const result = await testFunction();
    
    console.log('Fixed Test Result:');
    console.log('Success:', result.data.success);
    console.log('Event Count:', result.data.eventCount);
    console.log('Sample Events:', result.data.events);
    
    if (result.data.eventCount > 0) {
      console.log('✅ Enhanced scraping is now working in cloud function!');
      result.data.events.forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.currency} - ${event.event} (${event.impact})`);
      });
    } else {
      console.log('⚠️ Still returning 0 events');
    }
  } catch (error) {
    console.error('Error testing fixed function:', error);
  }
}

testFixedFunction();
