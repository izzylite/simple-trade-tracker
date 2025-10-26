#!/usr/bin/env node

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

console.log('🧪 Comprehensive AI Trading Agent Test\n');

// Test queries
const testQueries = [
  {
    name: 'Economic Sentiment Analysis',
    message: 'What\'s the economic sentiment for EURUSD this coming week?',
  },
  {
    name: 'Crypto Price Analysis',
    message: 'What\'s the current price of Bitcoin and what\'s the market sentiment?',
  },
  {
    name: 'Forex Pair Analysis',
    message: 'Analyze GBP/USD for me - what are the key drivers this week?',
  },
];

async function testAIAgent(testName, message) {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const path = '/functions/v1/ai-trading-agent';

    const payload = JSON.stringify({
      message,
      userId: 'test-user-' + Math.random().toString(36).substring(7),
      calendarId: 'test-calendar-' + Math.random().toString(36).substring(7),
    });

    const options = {
      hostname: url.hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    };

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📋 Test: ${testName}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`📝 Query: "${message}"\n`);

    const startTime = Date.now();
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        try {
          const result = JSON.parse(data);
          
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`⏱️  Duration: ${duration}s`);
          console.log(`📊 Success: ${result.success}`);
          
          if (result.success) {
            console.log(`\n📄 Response:\n`);
            // Print first 500 chars of message
            const preview = result.message.substring(0, 500);
            console.log(preview + (result.message.length > 500 ? '...' : ''));
            
            console.log(`\n🔧 Function Calls: ${result.metadata.functionCalls.length}`);
            for (let i = 0; i < result.metadata.functionCalls.length; i++) {
              const call = result.metadata.functionCalls[i];
              console.log(`   ${i + 1}. ${call.name}`);
            }
            
            console.log(`\n✨ Model: ${result.metadata.model}`);
          } else {
            console.log(`\n❌ Error: ${result.message || 'Unknown error'}`);
          }
        } catch (e) {
          console.log(`❌ Error parsing response: ${e.message}`);
          console.log(`Response: ${data.substring(0, 200)}`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`❌ Request error: ${e.message}`);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log(`🌐 Supabase Project: ${SUPABASE_URL.split('//')[1].split('.')[0]}`);
  console.log(`🔑 API Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
  
  for (const test of testQueries) {
    await testAIAgent(test.name, test.message);
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ All tests completed!');
  console.log(`${'='.repeat(70)}\n`);
}

runTests();

