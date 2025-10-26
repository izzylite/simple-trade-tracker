const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://gwubzauelilziaqnsfac.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dWJ6YXVlbGlsemlhcW5zZmFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ0MjQwMywiZXhwIjoyMDY4MDE4NDAzfQ.ATcbDJAbz_OZ8DS6uZXfk8V-3GGn5xlKZVLps51wmuU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '016_fix_jsonb_null_casting.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration 016_fix_jsonb_null_casting.sql...');

    // Execute the SQL using RPC
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;

      console.log('Executing statement...');
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

      if (error) {
        // If the RPC doesn't exist, try using the postgREST API directly
        console.log('exec_sql RPC not available, trying direct execution...');
        throw new Error('Direct execution via REST API not supported. Please use Supabase Dashboard SQL Editor');
      }

      console.log('Statement executed successfully');
    }

    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Error applying migration:', error.message);
    console.log('\nPlease apply the migration manually via Supabase Dashboard:');
    console.log('1. Go to https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/sql');
    console.log('2. Copy the content from supabase/migrations/016_fix_jsonb_null_casting.sql');
    console.log('3. Paste and run in the SQL Editor');
    process.exit(1);
  }
}

applyMigration();
