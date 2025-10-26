#!/usr/bin/env node

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

console.log('🧪 Real User Scenario Test\n');

// Simulate a real user with conversation history
const userId = 'test-user-' + Math.random().toString(36).substring(7);
const calendarId = 'test-calendar-' + Math.random().toString(36).substring(7);

const conversationHistory = [
  {
    role: 'user',
    content: 'I\'m interested in trading EUR/USD. What should I know?',
  },
  {
    role: 'assistant',
    content: 'EUR/USD is the most traded currency pair. Key factors include ECB and Fed policy, economic data, and geopolitical events.',
  },
];

async function testWithConversationHistory() {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const path = '/functions/v1/ai-trading-agent';

    const payload = JSON.stringify({
      message: 'Based on what you know, should I go long or short EUR/USD this week?',
      userId,
      calendarId,
      conversationHistory,
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

    console.log('📋 Test: Real User with Conversation History');
    console.log('='.repeat(70));
    console.log(`👤 User ID: ${userId}`);
    console.log(`📅 Calendar ID: ${calendarId}`);
    console.log(`\n📝 Previous Context:`);
    console.log(`   User: "${conversationHistory[0].content}"`);
    console.log(`   Assistant: "${conversationHistory[1].content}"`);
    console.log(`\n💬 Current Query: "Based on what you know, should I go long or short EUR/USD this week?"\n`);

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
            console.log(result.message);
            
            console.log(`\n\n🔧 Function Calls Made: ${result.metadata.functionCalls.length}`);
            for (let i = 0; i < result.metadata.functionCalls.length; i++) {
              const call = result.metadata.functionCalls[i];
              console.log(`   ${i + 1}. ${call.name}`);
              if (call.args && Object.keys(call.args).length > 0) {
                console.log(`      Args: ${JSON.stringify(call.args).substring(0, 60)}...`);
              }
            }
            
            console.log(`\n✨ Model: ${result.metadata.model}`);
            console.log(`📅 Timestamp: ${result.metadata.timestamp}`);
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

async function runTest() {
  console.log(`🌐 Supabase Project: ${SUPABASE_URL.split('//')[1].split('.')[0]}`);
  console.log(`🔑 API Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...\n`);
  
  await testWithConversationHistory();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Real user scenario test completed!');
  console.log(`${'='.repeat(70)}\n`);
}

runTest();

