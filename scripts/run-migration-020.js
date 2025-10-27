/**
 * Run migration 020: Add economic_events column to trades table
 * 
 * This script applies the migration directly to the Supabase database
 * using the service role key for admin access.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please ensure REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('🚀 Starting migration 020: Add economic_events to trades table...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/020_add_economic_events_to_trades.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(80));
    console.log(migrationSQL);
    console.log('─'.repeat(80));
    console.log('');

    // Execute the migration using Supabase RPC
    // Note: We need to execute raw SQL, so we'll use the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    if (!response.ok) {
      // If exec_sql doesn't exist, try executing statements individually
      console.log('⚠️  exec_sql RPC not available, executing statements individually...\n');
      
      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';';
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        // Use Supabase's query method
        const { data, error } = await supabase.rpc('exec', { sql: statement });
        
        if (error) {
          console.error(`❌ Error executing statement ${i + 1}:`, error);
          throw error;
        }
        
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    } else {
      console.log('✅ Migration executed successfully via exec_sql RPC');
    }

    console.log('\n🎉 Migration 020 completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  ✅ Added economic_events JSONB column to trades table');
    console.log('  ✅ Created GIN index for efficient JSONB queries');
    console.log('  ✅ Added column and index comments');
    console.log('\n💡 The trades table now supports storing economic events directly!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n🔧 Manual migration required:');
    console.error('Please run the SQL in supabase/migrations/020_add_economic_events_to_trades.sql');
    console.error('manually in the Supabase SQL Editor at:');
    console.error(`${supabaseUrl.replace('/v1', '')}/project/_/sql`);
    process.exit(1);
  }
}

runMigration();

