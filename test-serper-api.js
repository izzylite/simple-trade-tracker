#!/usr/bin/env node

require('dotenv').config();
const https = require('https');

const SERPER_API_KEY = process.env.SERPER_API_KEY;

if (!SERPER_API_KEY) {
  console.error('❌ SERPER_API_KEY not found in .env');
  process.exit(1);
}

console.log('🧪 Testing Serper API\n');
console.log('📋 Configuration:');
console.log(`   API Key: ${SERPER_API_KEY.substring(0, 10)}...`);

// Test queries
const testQueries = [
  { query: 'EURUSD forecast', type: 'search' },
  { query: 'EUR USD sentiment', type: 'news' },
  { query: 'forex trading analysis', type: 'search' },
  { query: 'bitcoin price today', type: 'news' },
];

async function testSerperAPI(query, searchType) {
  return new Promise((resolve) => {
    const endpoint = searchType === 'news'
      ? 'https://google.serper.dev/news'
      : 'https://google.serper.dev/search';

    const payload = JSON.stringify({
      q: query,
      gl: 'us',
      hl: 'en',
      num: 10,
    });

    const options = {
      hostname: 'google.serper.dev',
      path: searchType === 'news' ? '/news' : '/search',
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    console.log(`\n🔍 Testing: "${query}" (${searchType})`);
    console.log(`   Endpoint: ${endpoint}`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);

          console.log(`   Status: ${res.statusCode}`);

          if (result.organic && result.organic.length > 0) {
            console.log(`   ✅ Results found: ${result.organic.length} results`);
            console.log(`   Top result: ${result.organic[0].title}`);
            console.log(`   URL: ${result.organic[0].link}`);
          } else if (result.news && result.news.length > 0) {
            console.log(`   ✅ News results found: ${result.news.length} results`);
            console.log(`   Top result: ${result.news[0].title}`);
            console.log(`   URL: ${result.news[0].link}`);
          } else if (result.knowledgeGraph) {
            console.log(`   ✅ Knowledge graph found: ${result.knowledgeGraph.title}`);
          } else {
            console.log(`   ⚠️  No results found`);
            console.log(`   Response keys: ${Object.keys(result).join(', ')}`);
            if (result.news) {
              console.log(`   News array length: ${result.news.length}`);
            }
            if (result.organic) {
              console.log(`   Organic array length: ${result.organic.length}`);
            }
          }
        } catch (e) {
          console.log(`   ❌ Error parsing response: ${e.message}`);
          console.log(`   Response: ${data.substring(0, 200)}`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`   ❌ Request error: ${e.message}`);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

async function runTests() {
  for (const test of testQueries) {
    await testSerperAPI(test.query, test.type);
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ All tests completed');
}

runTests();

