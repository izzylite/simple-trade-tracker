/**
 * Simple Connection Test
 * Test Supabase connection and basic functionality
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('🔧 Configuration:');
console.log(`Supabase URL: ${SUPABASE_URL}`);
console.log(`Supabase Key: ${SUPABASE_ANON_KEY ? 'Present' : 'Missing'}`);
console.log('');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration in .env file');
  process.exit(1);
}

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test 1: Basic connection
    const { data, error } = await supabase
      .from('trade_embeddings')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    console.log(`📊 Current embeddings count: ${data.count || 0}`);
    
    // Test 2: Test the search function
    console.log('🔍 Testing search function...');
    const testEmbedding = Array(384).fill(0.1);
    
    const { data: searchData, error: searchError } = await supabase.rpc('search_similar_trades', {
      query_embedding: `[${testEmbedding.join(',')}]`,
      user_id_param: 'test',
      calendar_id_param: 'test',
      similarity_threshold: 0.5,
      max_results: 5
    });
    
    if (searchError) {
      console.error('❌ Search function failed:', searchError.message);
      return false;
    }
    
    console.log('✅ Search function working');
    console.log(`📊 Test search returned ${searchData.length} results`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function insertTestEmbedding(calendarId, userId) {
  try {
    console.log('🧪 Inserting test embedding...');
    
    const testEmbedding = Array(384).fill(0.5);
    
    const { error } = await supabase
      .from('trade_embeddings')
      .insert({
        trade_id: 'test-trade-123',
        calendar_id: calendarId,
        user_id: userId,
        trade_type: 'win',
        trade_amount: 100,
        trade_date: new Date().toISOString(),
        trade_session: 'London',
        tags: ['test', 'demo'],
        embedding: `[${testEmbedding.join(',')}]`,
        embedded_content: 'test win trade amount 100 session london tags test demo'
      });
    
    if (error) {
      console.error('❌ Failed to insert test embedding:', error.message);
      return false;
    }
    
    console.log('✅ Test embedding inserted successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Insert test failed:', error.message);
    return false;
  }
}

async function testSearch(calendarId, userId) {
  try {
    console.log('🔍 Testing search with your credentials...');
    
    const queryEmbedding = Array(384).fill(0.5);
    
    const { data, error } = await supabase.rpc('search_similar_trades', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      user_id_param: userId,
      calendar_id_param: calendarId,
      similarity_threshold: 0.1,
      max_results: 10
    });
    
    if (error) {
      console.error('❌ Search failed:', error.message);
      return false;
    }
    
    console.log(`✅ Search successful! Found ${data.length} results`);
    
    if (data.length > 0) {
      console.log('📊 Sample results:');
      data.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. Trade: ${result.trade_id}, Type: ${result.trade_type}, Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      });
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Search test failed:', error.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('🧪 Supabase Connection Test');
  console.log('===========================');
  console.log('');
  
  // Basic connection test
  const connectionOk = await testConnection();
  
  if (!connectionOk) {
    console.log('❌ Basic connection failed. Please check your Supabase configuration.');
    process.exit(1);
  }
  
  // If calendar and user IDs provided, test with those
  if (args.length >= 2) {
    const [calendarId, userId] = args;
    console.log('');
    console.log(`📋 Testing with Calendar ID: ${calendarId}`);
    console.log(`👤 Testing with User ID: ${userId}`);
    console.log('');
    
    // Test search with user credentials
    await testSearch(calendarId, userId);
    
    // Optionally insert a test embedding
    if (args.includes('--insert-test')) {
      console.log('');
      await insertTestEmbedding(calendarId, userId);
      console.log('');
      console.log('🔄 Testing search again after insert...');
      await testSearch(calendarId, userId);
    }
  } else {
    console.log('');
    console.log('💡 To test with your specific credentials:');
    console.log('   node scripts/testConnection.js "wk5jarjse7Vbk3QTOmtb" "qfiZB8g3MoV4wbrUjywqwKTgoaS2"');
    console.log('');
    console.log('💡 To insert a test embedding:');
    console.log('   node scripts/testConnection.js "wk5jarjse7Vbk3QTOmtb" "qfiZB8g3MoV4wbrUjywqwKTgoaS2" --insert-test');
  }
  
  console.log('');
  console.log('🎉 Connection test completed!');
}

main();
