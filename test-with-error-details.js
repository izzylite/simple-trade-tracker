/**
 * Test Function and Show Error Details
 */

const https = require('https');

// Test payload
const payload = JSON.stringify({
  message: 'hello',
  userId: 'test-user-123',
  calendarId: 'test-calendar-123',
  conversationHistory: []
});

const options = {
  hostname: 'gwubzauelilziaqnsfac.supabase.co',
  port: 443,
  path: '/functions/v1/ai-trading-agent',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dWJ6YXVlbGlsemlhcW5zZmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NDI0MDMsImV4cCI6MjA2ODAxODQwM30.LkDhWPcJBIJThPPQ-YEmMi_3tl7GMp0lvDoawXehLho',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log('🧪 Testing AI Trading Agent with detailed error output...\n');

const req = https.request(options, (res) => {
  let data = '';

  console.log(`Status: ${res.statusCode}\n`);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response Body:');
    console.log(data);
    console.log('\n');

    try {
      const response = JSON.parse(data);
      console.log('Parsed Response:');
      console.log(JSON.stringify(response, null, 2));

      if (response.error) {
        console.log('\n❌ Error Details:');
        console.log(response.error);
      }
    } catch (error) {
      console.log('Could not parse as JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(payload);
req.end();
