#!/usr/bin/env node

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

console.log('🧪 HTML & Citations Test\n');

const userId = 'test-user-' + Math.random().toString(36).substring(7);
const calendarId = 'test-calendar-' + Math.random().toString(36).substring(7);

async function testHtmlAndCitations() {
  return new Promise((resolve) => {
    const url = new URL(SUPABASE_URL);
    const path = '/functions/v1/ai-trading-agent';

    const payload = JSON.stringify({
      message: 'What is the current sentiment for Bitcoin? Include recent news.',
      userId,
      calendarId,
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

    console.log('📋 Test: HTML Formatting & Citations Extraction');
    console.log('='.repeat(70));
    console.log(`💬 Query: "What is the current sentiment for Bitcoin? Include recent news."\n`);

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
          console.log(`📊 Success: ${result.success}\n`);
          
          if (result.success) {
            // Show plain text message
            console.log('📝 Plain Text Message:');
            console.log('-'.repeat(70));
            console.log(result.message);
            console.log('-'.repeat(70));
            
            // Show HTML message
            console.log('\n\n🌐 HTML Formatted Message:');
            console.log('-'.repeat(70));
            console.log(result.messageHtml);
            console.log('-'.repeat(70));
            
            // Show citations
            if (result.citations && result.citations.length > 0) {
              console.log('\n\n📚 Citations/Sources:');
              console.log('-'.repeat(70));
              result.citations.forEach((citation, index) => {
                console.log(`\n[${index + 1}] ${citation.title}`);
                console.log(`    URL: ${citation.url}`);
                console.log(`    Source Tool: ${citation.toolName}`);
              });
              console.log('-'.repeat(70));
            } else {
              console.log('\n⚠️  No citations extracted');
            }
            
            // Show function calls
            console.log(`\n\n🔧 Function Calls Made: ${result.metadata.functionCalls.length}`);
            result.metadata.functionCalls.forEach((call, i) => {
              console.log(`   ${i + 1}. ${call.name}`);
              if (call.urls && call.urls.length > 0) {
                console.log(`      URLs: ${call.urls.length} extracted`);
              }
            });
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
  
  await testHtmlAndCitations();
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ HTML & Citations test completed!');
  console.log(`${'='.repeat(70)}\n`);
}

runTest();

