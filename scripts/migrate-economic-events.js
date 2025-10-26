/**
 * Migrate Economic Events from JSON to Supabase
 * This script specifically handles the 6,831 economic events
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Export directory
const exportDir = path.join(__dirname, 'firestore-export');

// Migration statistics
const stats = {
  economicEvents: { total: 0, migrated: 0, errors: 0 },
  errors: []
};

/**
 * Convert exported timestamp to PostgreSQL timestamp
 */
function convertTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp._type === 'timestamp' && timestamp.iso) {
    return timestamp.iso;
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }
  return new Date(timestamp).toISOString();
}

/**
 * Generate UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Migrate economic events from JSON
 */
async function migrateEconomicEvents() {
  console.log('\n📈 Migrating economic events from JSON...');
  
  try {
    const filePath = path.join(exportDir, 'economicEvents.json');
    if (!fs.existsSync(filePath)) {
      console.log('📭 No economic events file found');
      return;
    }

    console.log('📖 Loading economic events data...');
    const eventsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    stats.economicEvents.total = eventsData.length;
    
    if (stats.economicEvents.total === 0) {
      console.log('📭 No economic events found in JSON');
      return;
    }

    console.log(`📊 Found ${stats.economicEvents.total} economic events to migrate`);

    const progressBar = new cliProgress.SingleBar({
      format: 'Economic Events |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    progressBar.start(stats.economicEvents.total, 0);

    // Process events in batches for better performance
    const batchSize = 100;
    for (let i = 0; i < eventsData.length; i += batchSize) {
      const batch = eventsData.slice(i, i + batchSize);
      const batchRecords = [];

      for (const event of batch) {
        try {
          const eventData = event.data;
          const firestoreId = event.id;
          
          // Generate new UUID for event
          const eventId = generateUUID();

          // Parse the date properly
          let eventDate, eventTime;
          if (eventData.date) {
            eventDate = eventData.date; // Already in YYYY-MM-DD format
            eventTime = convertTimestamp(eventData.time) || new Date().toISOString();
          } else {
            const timestamp = convertTimestamp(eventData.time) || new Date().toISOString();
            eventDate = timestamp.split('T')[0];
            eventTime = timestamp;
          }

          // Map impact values to match constraint
          let impact = eventData.impact || 'Medium';
          // Ensure proper case for constraint
          if (impact.toLowerCase() === 'low') impact = 'Low';
          else if (impact.toLowerCase() === 'medium') impact = 'Medium';
          else if (impact.toLowerCase() === 'high') impact = 'High';
          else if (impact.toLowerCase() === 'holiday') impact = 'Holiday';
          else if (impact.toLowerCase() === 'non-economic') impact = 'Non-Economic';
          else impact = 'Medium'; // Default fallback

          // Prepare event data for PostgreSQL (using correct schema)
          const eventRecord = {
            id: eventId,
            external_id: firestoreId,
            event_name: eventData.event || 'Unknown Event',
            currency: eventData.currency || 'USD',
            impact: impact,
            event_date: eventDate,
            event_time: eventTime,
            time_utc: eventData.timeUtc || eventData.time_utc || '00:00',
            unix_timestamp: eventData.unixTimestamp || null,
            actual_value: eventData.actual || null,
            forecast_value: eventData.forecast || null,
            previous_value: eventData.previous || null,
            actual_result_type: eventData.actualResultType || null,
            country: eventData.country || null,
            flag_code: eventData.flagCode || null,
            flag_url: eventData.flagUrl || null,
            is_all_day: eventData.isAllDay || false,
            description: eventData.description || null,
            source_url: eventData.sourceUrl || null,
            data_source: eventData.source || 'myfxbook',
            last_updated: eventData.lastUpdated ? new Date(eventData.lastUpdated).toISOString() : null,
            created_at: new Date().toISOString()
          };

          batchRecords.push(eventRecord);

        } catch (error) {
          stats.economicEvents.errors++;
          stats.errors.push(`Event preparation error for ${event.id}: ${error.message}`);
        }
      }

      // Insert batch
      if (batchRecords.length > 0) {
        try {
          const { error: batchError } = await supabase
            .from('economic_events')
            .insert(batchRecords);

          if (batchError) {
            throw batchError;
          }

          stats.economicEvents.migrated += batchRecords.length;
        } catch (error) {
          stats.economicEvents.errors += batchRecords.length;
          stats.errors.push(`Batch insert error: ${error.message}`);
        }
      }

      // Update progress
      progressBar.update(Math.min(i + batchSize, eventsData.length));
    }

    progressBar.stop();
    console.log(`✅ Economic Events: ${stats.economicEvents.migrated}/${stats.economicEvents.total} migrated`);

  } catch (error) {
    console.error('❌ Error migrating economic events:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrateEconomicEventsFromJSON() {
  console.log('🚀 Starting Economic Events Migration from JSON...\n');
  console.log(`📁 Reading from: ${exportDir}\n`);
  
  try {
    await migrateEconomicEvents();
    
    // Display final results
    console.log('\n🎉 Economic Events Migration completed!\n');
    console.log('📊 Migration Summary:');
    console.log(`   Economic Events: ${stats.economicEvents.migrated}/${stats.economicEvents.total} migrated, ${stats.economicEvents.errors} errors`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }
    
    console.log('\n✅ Economic Events migration process completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateEconomicEventsFromJSON().catch(console.error);
}

module.exports = { migrateEconomicEventsFromJSON };
