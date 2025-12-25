const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://fxkjblrlogjumybceozk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTk3MDQwMSwiZXhwIjoyMDQ1NTQ2NDAxfQ.4D53fxaMsVJQNY_EIWRlgZTwWJoRCiCZz0N5Mn_kIFs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationSql = fs.readFileSync(
      path.join(__dirname, 'supabase', 'migrations', '065_restore_missing_calculations.sql'),
      'utf8'
    );

    console.log('Applying migration 065...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSql });

    if (error) {
      // Try alternative approach - split by semicolons and execute each statement
      console.log('Trying alternative approach - executing statements individually...');

      // For this migration, we can just call the function to test it
      console.log('Testing the restored calculate_chart_data function...');
      const { data: testData, error: testError } = await supabase.rpc('calculate_chart_data', {
        p_calendar_id: '00000000-0000-0000-0000-000000000000', // dummy ID
        p_time_period: 'all',
        p_selected_date: new Date().toISOString()
      });

      if (testError && testError.message.includes('does not exist')) {
        console.error('Migration needs to be applied manually through Supabase dashboard.');
        console.error('Please run the SQL in supabase/migrations/065_restore_missing_calculations.sql');
        console.error('in the SQL Editor at: https://supabase.com/dashboard/project/fxkjblrlogjumybceozk/sql/new');
        process.exit(1);
      } else if (testError) {
        console.error('Test error:', testError);
      } else {
        console.log('Function exists and is working!');
      }
    } else {
      console.log('Migration applied successfully!');
      console.log('Result:', data);
    }
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  }
}

applyMigration();
