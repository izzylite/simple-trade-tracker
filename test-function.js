/**
 * Test AI Trading Agent Function
 *
 * Send a test request to verify the function is working
 */

const https = require('https');

// You'll need to get this from your browser's developer tools
// Go to Application > Local Storage > look for supabase.auth.token
const USER_JWT = process.argv[2] || '';

if (!USER_JWT) {
  console.log('❌ Please provide a JWT token:');
  console.log('   node test-function.js YOUR_JWT_TOKEN_HERE');
  console.log('\nGet your JWT from browser DevTools:');
  console.log('   1. Open your app');
  console.log('   2. Press F12 (DevTools)');
  console.log('   3. Go to Application > Local Storage');
  console.log('   4. Find supabase.auth.token');
  console.log('   5. Copy the access_token value');
  process.exit(1);
}

const payload = JSON.stringify({
  message: 'Hello, can you help me?',
  userId: 'test-user-id',
  calendarId: 'test-calendar-id',
  conversationHistory: []
});

const options = {
  hostname: 'gwubzauelilziaqnsfac.supabase.co',
  port: 443,
  path: '/functions/v1/ai-trading-agent',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${USER_JWT}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log('🧪 Testing AI Trading Agent...\n');
console.log('Endpoint: https://gwubzauelilziaqnsfac.supabase.co/functions/v1/ai-trading-agent');
console.log('Method: POST\n');

const req = https.request(options, (res) => {
  let data = '';

  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  console.log('');

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Response:');
      console.log(JSON.stringify(response, null, 2));

      if (response.error) {
        console.log('\n❌ Error:', response.error);

        if (response.error.includes('OPENAI_API_KEY')) {
          console.log('\n💡 Solution: Set your OpenAI API key');
          console.log('   Go to: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/settings/functions');
          console.log('   Add secret: OPENAI_API_KEY = sk-proj-YOUR_KEY');
        }
      } else {
        console.log('\n✅ Function is working!');
      }
    } catch (error) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);

  if (error.message.includes('ECONNREFUSED')) {
    console.log('\n💡 Connection refused - check if the function exists');
  }
});

req.write(payload);
req.end();

console.log('⏳ Sending request...\n');
