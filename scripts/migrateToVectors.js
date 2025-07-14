/**
 * Vector Migration Script
 * Standalone script to migrate trades to vector embeddings
 * 
 * Usage: node scripts/migrateToVectors.js <calendarId> <userId>
 * Example: node scripts/migrateToVectors.js "my-calendar-123" "user-456"
 */

const { createClient } = require('@supabase/supabase-js');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

// Try to load dotenv if available
try {
  require('dotenv').config();
} catch (error) {
  // dotenv not available, environment variables should be set manually
}

// Firebase configuration from environment variables (same as working script)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Validate Firebase configuration
if (!firebaseConfig.projectId) {
  console.error('❌ Firebase configuration missing. Please ensure environment variables are set.');
  process.exit(1);
}

// Supabase configuration
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase configuration missing. Please ensure environment variables are set.');
  process.exit(1);
}

// Initialize services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simple hash-based embedding generation (fallback method)
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

function tradeToSearchableText(trade) {
  const parts = [];
  
  // Basic trade info
  parts.push(`${trade.type} trade`);
  parts.push(`amount ${Math.abs(trade.amount)}`);
  
  // Trade details
  if (trade.name) parts.push(`name ${trade.name}`);
  if (trade.session) parts.push(`session ${trade.session}`);
  if (trade.entry) parts.push(`entry ${trade.entry}`);
  if (trade.exit) parts.push(`exit ${trade.exit}`);
  if (trade.riskToReward) parts.push(`risk reward ratio ${trade.riskToReward}`);
  if (trade.partialsTaken) parts.push('partials taken');
  
  // Tags
  if (trade.tags && trade.tags.length > 0) {
    parts.push(`tags ${trade.tags.join(' ')}`);
  }
  
  // Notes
  if (trade.notes) parts.push(`notes ${trade.notes}`);
  
  // Economic events
  if (trade.economicEvents && trade.economicEvents.length > 0) {
    const events = trade.economicEvents.map(event => 
      `${event.name} ${event.impact} ${event.currency}`
    ).join(' ');
    parts.push(`economic events ${events}`);
  }
  
  // Date information
  const date = trade.date.toDate ? trade.date.toDate() : new Date(trade.date);
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const quarter = Math.ceil((date.getMonth() + 1) / 3);

  parts.push(`day ${dayOfWeek} month ${month} year ${year} quarter ${quarter}`);

  // Add week-related terms
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';
  const isWeekday = !isWeekend;
  if (isWeekend) parts.push('weekend');
  if (isWeekday) parts.push('weekday');

  // Add month groupings
  const season = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter'][date.getMonth()];
  parts.push(`season ${season}`);
  
  return parts.join(' ').toLowerCase();
}

async function testSupabaseConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    const { data, error } = await supabase
      .from('trade_embeddings')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    return false;
  }
}

/**
 * Get all year documents for a calendar (same as working script)
 */
async function getCalendarYears(calendarId) {
  const yearsSnapshot = await getDocs(collection(db, 'calendars', calendarId, 'years'));
  const years = [];

  yearsSnapshot.forEach(doc => {
    years.push({
      id: doc.id,
      year: doc.data().year,
      trades: doc.data().trades || [],
      ...doc.data()
    });
  });

  return years;
}

async function getTradesFromFirebase(calendarId, userId) {
  try {
    console.log(`� Fetching trades for calendar: ${calendarId}, user: ${userId}`);

    // Get all year documents for the calendar (same approach as working script)
    const years = await getCalendarYears(calendarId);

    if (years.length === 0) {
      console.log('⚠️  No year documents found for this calendar');
      return [];
    }

    let allTrades = [];

    for (const yearDoc of years) {
      if (yearDoc.trades && yearDoc.trades.length > 0) {
        console.log(`� Found ${yearDoc.trades.length} trades for year ${yearDoc.year}`);
        allTrades = allTrades.concat(yearDoc.trades);
      }
    }

    console.log(`✅ Total trades found: ${allTrades.length}`);
    return allTrades;

  } catch (error) {
    console.error('❌ Error fetching trades from Firebase:', error.message);
    throw error;
  }
}

async function migrateTradeToVector(trade, calendarId, userId) {
  try {
    // Generate searchable text
    const content = tradeToSearchableText(trade);
    
    // Generate embedding
    const embedding = generateHashEmbedding(content);
    
    // Prepare trade data
    const tradeDate = trade.date.toDate ? trade.date.toDate() : new Date(trade.date);
    
    // Store in Supabase
    const { error } = await supabase
      .from('trade_embeddings')
      .upsert({
        trade_id: trade.id,
        calendar_id: calendarId,
        user_id: userId,
        trade_type: trade.type,
        trade_amount: trade.amount,
        trade_date: tradeDate.toISOString(),
        trade_session: trade.session || null,
        tags: trade.tags || [],
        embedding: `[${embedding.join(',')}]`,
        embedded_content: content
      }, {
        onConflict: 'trade_id,calendar_id,user_id'
      });
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to migrate trade ${trade.id}:`, error.message);
    return false;
  }
}

async function updateMetadata(calendarId, userId, totalEmbeddings) {
  try {
    const { error } = await supabase
      .from('embedding_metadata')
      .upsert({
        user_id: userId,
        calendar_id: calendarId,
        model_name: 'hash-based-fallback',
        model_version: 'v1',
        total_trades: totalEmbeddings,
        total_embeddings: totalEmbeddings,
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,calendar_id,model_name'
      });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Metadata updated successfully');
  } catch (error) {
    console.error('❌ Failed to update metadata:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);

  console.log('🔧 Vector Migration Script Starting...');
  console.log(`Node.js version: ${process.version}`);
  console.log(`Arguments: ${args.join(', ')}`);

  if (args.length < 2) {
    console.log('Usage: node scripts/migrateToVectors.js <calendarId> <userId>');
    console.log('Example: node scripts/migrateToVectors.js "my-calendar-123" "user-456"');
    process.exit(1);
  }

  const [calendarId, userId] = args;

  console.log('🚀 Starting vector migration...');
  console.log(`📋 Calendar ID: ${calendarId}`);
  console.log(`👤 User ID: ${userId}`);
  console.log(`🔧 Firebase Project: ${firebaseConfig.projectId}`);
  console.log(`🔧 Supabase URL: ${SUPABASE_URL}`);
  console.log('');
  
  try {
    // Test connections
    const supabaseOk = await testSupabaseConnection();
    if (!supabaseOk) {
      console.error('❌ Cannot proceed without Supabase connection');
      process.exit(1);
    }
    
    // Get trades from Firebase
    const trades = await getTradesFromFirebase(calendarId, userId);
    
    if (trades.length === 0) {
      console.log('⚠️  No trades found to migrate');
      process.exit(0);
    }
    
    // Migrate trades
    console.log('🔄 Starting migration...');
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      process.stdout.write(`\r📊 Processing trade ${i + 1}/${trades.length}: ${trade.name || trade.id}`);
      
      const success = await migrateTradeToVector(trade, calendarId, userId);
      if (success) {
        successful++;
      } else {
        failed++;
      }
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n');
    console.log('✅ Migration completed!');
    console.log(`📊 Results: ${successful} successful, ${failed} failed`);
    
    // Update metadata
    await updateMetadata(calendarId, userId, successful);
    
    console.log('🎉 All done! Your trades are now available for vector search.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script with proper error handling
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
