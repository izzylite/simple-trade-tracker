/**
 * Test script to manually populate the economic calendar database using HTTP request
 */

const https = require('https');

async function populateDatabase() {
  try {
    console.log('🚀 Calling populateDatabaseManually function via HTTP...');

    // The deployed function URL
    const functionUrl = 'https://us-central1-tradetracker-30ec1.cloudfunctions.net/populateDatabaseManually';

    console.log('📞 Making HTTP request to:', functionUrl);

    // Make HTTP POST request
    const postData = JSON.stringify({
      data: {}
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const response = await new Promise((resolve, reject) => {
      const req = https.request(functionUrl, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });

    console.log('✅ Function completed!');
    console.log('📊 Status Code:', response.statusCode);
    console.log('📊 Response:', response.data);

  } catch (error) {
    console.error('❌ Error calling function:', error);
  }
}

// Run the function
populateDatabase();
