/**
 * Deploy Supabase SQL Functions Script
 * This script deploys the SQL functions needed for AI-driven database queries
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or service key not found in environment variables.');
  console.error('Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_SERVICE_KEY in your .env file.');
  process.exit(1);
}

// Create Supabase client with service key (admin privileges)
const supabase = createClient(supabaseUrl, supabaseKey);

// Path to SQL file
const sqlFilePath = path.join(__dirname, '..', 'database', 'supabase-sql-functions-fixed.sql');

async function deploySQLFunctions() {
  try {
    console.log('Reading SQL file...');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Split SQL into individual statements (simple approach)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute.`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      // Skip comments-only statements
      if (statement.startsWith('--')) {
        console.log('Skipping comment-only statement.');
        continue;
      }

      try {
        // Execute the SQL statement
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error.message);
          console.error('Statement:', statement);
        } else {
          console.log(`Statement ${i + 1} executed successfully.`);
        }
      } catch (stmtError) {
        console.error(`Exception executing statement ${i + 1}:`, stmtError.message);
        console.error('Statement:', statement);
      }
    }

    console.log('SQL functions deployment completed.');
  } catch (error) {
    console.error('Error deploying SQL functions:', error.message);
    process.exit(1);
  }
}

// Execute the deployment
deploySQLFunctions().catch(console.error);
