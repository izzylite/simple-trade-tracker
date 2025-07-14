/**
 * Vector Search Test Script
 * Test the vector search functionality after migration
 * 
 * Usage: node scripts/testVectorSearch.js <calendarId> <userId> <searchQuery>
 * Example: node scripts/testVectorSearch.js "my-calendar-123" "user-456" "profitable EUR/USD trades"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simple hash-based embedding generation (same as migration script)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

function generateHashEmbedding(text, dimension = 384) {
  const normalized = text.toLowerCase();
  const embedding = [];
  
  for (let i = 0; i < dimension; i++) {
    const seed = normalized + i.toString();
    const hash = simpleHash(seed);
    const value = (hash % 2000 - 1000) / 1000; // Normalize to [-1, 1]
    embedding.push(value);
  }
  
  return embedding;
}

async function testVectorSearch(calendarId, userId, searchQuery) {
  try {
    console.log('🔍 Testing vector search...');
    console.log(`📋 Calendar ID: ${calendarId}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🔎 Search Query: "${searchQuery}"`);
    console.log('');
    
    // Generate embedding for the search query
    console.log('🧠 Generating embedding for search query...');
    const queryEmbedding = generateHashEmbedding(searchQuery);
    console.log(`✅ Generated ${queryEmbedding.length}-dimensional embedding`);
    
    // Perform vector search
    console.log('🔍 Performing vector search...');
    const { data, error } = await supabase.rpc('search_similar_trades', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      user_id_param: userId,
      calendar_id_param: calendarId,
      similarity_threshold: 0.1, // Lower threshold for testing
      max_results: 10
    });
    
    if (error) {
      console.error('❌ Vector search failed:', error.message);
      return;
    }
    
    console.log(`✅ Search completed! Found ${data.length} similar trades:`);
    console.log('');
    
    if (data.length === 0) {
      console.log('⚠️  No similar trades found. This could mean:');
      console.log('   - No trades have been migrated yet');
      console.log('   - The similarity threshold is too high');
      console.log('   - The search query doesn\'t match any trade content');
      console.log('');
      console.log('💡 Try running the migration script first:');
      console.log(`   node scripts/migrateToVectors.js "${calendarId}" "${userId}"`);
    } else {
      // Display results
      data.forEach((result, index) => {
        console.log(`📊 Result ${index + 1}:`);
        console.log(`   Trade ID: ${result.trade_id}`);
        console.log(`   Type: ${result.trade_type}`);
        console.log(`   Amount: ${result.trade_amount}`);
        console.log(`   Date: ${new Date(result.trade_date).toLocaleDateString()}`);
        console.log(`   Session: ${result.trade_session || 'N/A'}`);
        console.log(`   Tags: ${result.tags.length > 0 ? result.tags.join(', ') : 'None'}`);
        console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
        console.log(`   Content: ${result.embedded_content.substring(0, 100)}...`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function getStats(calendarId, userId) {
  try {
    console.log('📊 Getting migration statistics...');
    
    // Get total embeddings
    const { data: embeddings, error: embeddingsError } = await supabase
      .from('trade_embeddings')
      .select('count', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('calendar_id', calendarId);
    
    if (embeddingsError) {
      console.error('❌ Failed to get embeddings count:', embeddingsError.message);
      return;
    }
    
    // Get metadata
    const { data: metadata, error: metadataError } = await supabase
      .from('embedding_metadata')
      .select('*')
      .eq('user_id', userId)
      .eq('calendar_id', calendarId)
      .single();
    
    if (metadataError && metadataError.code !== 'PGRST116') {
      console.error('❌ Failed to get metadata:', metadataError.message);
      return;
    }
    
    console.log('📈 Migration Statistics:');
    console.log(`   Total Embeddings: ${embeddings.count || 0}`);
    
    if (metadata) {
      console.log(`   Model: ${metadata.model_name}`);
      console.log(`   Last Sync: ${new Date(metadata.last_sync_at).toLocaleString()}`);
      console.log(`   Total Trades: ${metadata.total_trades}`);
    } else {
      console.log('   No metadata found - migration may not have been run yet');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Failed to get stats:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node scripts/testVectorSearch.js <calendarId> <userId> [searchQuery]');
    console.log('Example: node scripts/testVectorSearch.js "my-calendar-123" "user-456" "profitable trades"');
    console.log('');
    console.log('If no search query is provided, only statistics will be shown.');
    process.exit(1);
  }
  
  const [calendarId, userId, searchQuery] = args;
  
  console.log('🧪 Vector Search Test');
  console.log('===================');
  console.log('');
  
  // Always show stats first
  await getStats(calendarId, userId);
  
  // If search query provided, test search
  if (searchQuery) {
    await testVectorSearch(calendarId, userId, searchQuery);
  } else {
    console.log('💡 To test search, provide a search query:');
    console.log(`   node scripts/testVectorSearch.js "${calendarId}" "${userId}" "your search query"`);
  }
}

// Run the script
main();
