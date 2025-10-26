/**
 * Migrate from Exported JSON Files to Supabase
 * This script migrates data from the exported JSON files to Supabase
 * Much more efficient than reading directly from Firestore
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
  users: { total: 0, migrated: 0, errors: 0 },
  calendars: { total: 0, migrated: 0, errors: 0 },
  trades: { total: 0, migrated: 0, errors: 0 },
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
 * Create or get user
 */
async function migrateUser(firebaseUid, userData = {}) {
  try {
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (existingUser) {
      return existingUser.id;
    }

    // Create new user
    const userId = generateUUID();
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        firebase_uid: firebaseUid,
        email: userData.email || null,
        display_name: userData.displayName || null,
        photo_url: userData.photoURL || null,
        created_at: convertTimestamp(userData.createdAt) || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      throw insertError;
    }

    stats.users.migrated++;
    return userId;
  } catch (error) {
    stats.users.errors++;
    stats.errors.push(`User migration error for ${firebaseUid}: ${error.message}`);
    throw error;
  }
}

/**
 * Migrate calendars from JSON
 */
async function migrateCalendars() {
  console.log('\n📅 Migrating calendars from JSON...');
  
  try {
    const filePath = path.join(exportDir, 'calendars-with-trades.json');
    if (!fs.existsSync(filePath)) {
      console.log('📭 No calendars file found');
      return {};
    }

    const calendarsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    stats.calendars.total = calendarsData.length;
    
    if (stats.calendars.total === 0) {
      console.log('📭 No calendars found in JSON');
      return {};
    }

    const progressBar = new cliProgress.SingleBar({
      format: 'Calendars |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    progressBar.start(stats.calendars.total, 0);

    const calendarIdMap = {}; // Map Firestore ID to Supabase UUID

    for (const calendar of calendarsData) {
      try {
        const calendarData = calendar.data;
        const firestoreId = calendar.id;
        
        // Get or create user
        const userId = await migrateUser(calendarData.userId || 'unknown');
        
        // Generate new UUID for calendar
        const calendarId = generateUUID();
        calendarIdMap[firestoreId] = calendarId;

        // Prepare calendar data for PostgreSQL (using correct schema)
        const calendarRecord = {
          id: calendarId,
          user_id: userId,
          name: calendarData.name || 'Untitled Calendar',
          account_balance: parseFloat(calendarData.currentBalance || calendarData.startingBalance) || 0,
          max_daily_drawdown: parseFloat(calendarData.maxDailyDrawdown) || 0,
          weekly_target: parseFloat(calendarData.weeklyTarget) || null,
          monthly_target: parseFloat(calendarData.monthlyTarget) || null,
          yearly_target: parseFloat(calendarData.yearlyTarget || calendarData.targetBalance) || null,
          risk_per_trade: parseFloat(calendarData.riskPerTrade) || null,
          dynamic_risk_enabled: calendarData.dynamicRiskEnabled || false,
          increased_risk_percentage: parseFloat(calendarData.increasedRiskPercentage) || null,
          profit_threshold_percentage: parseFloat(calendarData.profitThresholdPercentage) || null,
          duplicated_calendar: calendarData.duplicatedCalendar || false,
          is_deleted: calendarData.isDeleted || false,
          required_tag_groups: calendarData.requiredTagGroups || null,
          tags: calendarData.tags || null,
          note: calendarData.note || null,
          hero_image_url: calendarData.heroImageUrl || null,
          hero_image_attribution: calendarData.heroImageAttribution || null,
          days_notes: calendarData.daysNotes || null,
          score_settings: calendarData.scoreSettings || null,
          created_at: convertTimestamp(calendarData.createdAt) || new Date().toISOString(),
          updated_at: convertTimestamp(calendarData.updatedAt) || new Date().toISOString()
        };

        // Insert calendar
        const { error: calendarError } = await supabase
          .from('calendars')
          .insert(calendarRecord);

        if (calendarError) {
          throw calendarError;
        }

        stats.calendars.migrated++;
        progressBar.increment();

      } catch (error) {
        stats.calendars.errors++;
        stats.errors.push(`Calendar migration error for ${calendar.id}: ${error.message}`);
        progressBar.increment();
      }
    }

    progressBar.stop();
    console.log(`✅ Calendars: ${stats.calendars.migrated}/${stats.calendars.total} migrated`);
    return calendarIdMap;

  } catch (error) {
    console.error('❌ Error migrating calendars:', error);
    throw error;
  }
}

/**
 * Migrate trades from JSON
 */
async function migrateTrades(calendarIdMap) {
  console.log('\n💰 Migrating trades from JSON...');
  
  try {
    const filePath = path.join(exportDir, 'calendars-with-trades.json');
    if (!fs.existsSync(filePath)) {
      console.log('📭 No calendars file found');
      return;
    }

    const calendarsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Count total trades
    let totalTrades = 0;
    calendarsData.forEach(calendar => {
      totalTrades += calendar.trades ? calendar.trades.length : 0;
    });

    stats.trades.total = totalTrades;
    if (totalTrades === 0) {
      console.log('📭 No trades found in JSON');
      return;
    }

    const progressBar = new cliProgress.SingleBar({
      format: 'Trades |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    progressBar.start(totalTrades, 0);

    // Migrate trades for each calendar
    for (const calendar of calendarsData) {
      const firestoreCalendarId = calendar.id;
      const supabaseCalendarId = calendarIdMap[firestoreCalendarId];
      
      if (!supabaseCalendarId) {
        console.log(`⚠️ Calendar mapping not found for: ${firestoreCalendarId}`);
        continue;
      }

      // Get user ID from calendar
      const { data: calendarInfo } = await supabase
        .from('calendars')
        .select('user_id')
        .eq('id', supabaseCalendarId)
        .single();

      if (!calendarInfo) {
        console.log(`⚠️ Calendar not found in Supabase: ${supabaseCalendarId}`);
        continue;
      }

      // Process each trade
      for (const trade of calendar.trades || []) {
        try {
          const tradeData = trade.data;
          const tradeId = generateUUID();
          
          // Prepare trade data for PostgreSQL
          const tradeRecord = {
            id: tradeId,
            calendar_id: supabaseCalendarId,
            user_id: calendarInfo.user_id,
            name: tradeData.name || 'Untitled Trade',
            amount: parseFloat(tradeData.amount) || 0,
            trade_type: tradeData.tradeType || 'breakeven',
            trade_date: convertTimestamp(tradeData.tradeDate) || new Date().toISOString(),
            entry_price: parseFloat(tradeData.entryPrice) || null,
            exit_price: parseFloat(tradeData.exitPrice) || null,
            risk_to_reward: parseFloat(tradeData.riskToReward) || null,
            partials_taken: tradeData.partialsTaken || false,
            session: tradeData.session || null,
            notes: tradeData.notes || null,
            tags: tradeData.tags || [],
            is_deleted: tradeData.isDeleted || false,
            is_temporary: tradeData.isTemporary || false,
            is_pinned: tradeData.isPinned || false,
            share_link: tradeData.shareLink || null,
            is_shared: tradeData.isShared || false,
            shared_at: convertTimestamp(tradeData.sharedAt) || null,
            share_id: tradeData.shareId || null,
            created_at: convertTimestamp(tradeData.createdAt) || new Date().toISOString(),
            updated_at: convertTimestamp(tradeData.updatedAt) || new Date().toISOString()
          };

          // Insert trade
          const { error: tradeError } = await supabase
            .from('trades')
            .insert(tradeRecord);

          if (tradeError) {
            throw tradeError;
          }

          stats.trades.migrated++;
          progressBar.increment();

        } catch (error) {
          stats.trades.errors++;
          stats.errors.push(`Trade migration error: ${error.message}`);
          progressBar.increment();
        }
      }
    }

    progressBar.stop();
    console.log(`✅ Trades: ${stats.trades.migrated}/${stats.trades.total} migrated`);

  } catch (error) {
    console.error('❌ Error migrating trades:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrateFromJSON() {
  console.log('🚀 Starting JSON to Supabase Migration...\n');
  console.log(`📁 Reading from: ${exportDir}\n`);
  
  try {
    // Step 1: Migrate calendars (this also creates users)
    const calendarIdMap = await migrateCalendars();
    
    // Step 2: Migrate trades
    await migrateTrades(calendarIdMap);
    
    // Display final results
    console.log('\n🎉 Migration completed!\n');
    console.log('📊 Migration Summary:');
    console.log(`   Users: ${stats.users.migrated} migrated, ${stats.users.errors} errors`);
    console.log(`   Calendars: ${stats.calendars.migrated}/${stats.calendars.total} migrated, ${stats.calendars.errors} errors`);
    console.log(`   Trades: ${stats.trades.migrated}/${stats.trades.total} migrated, ${stats.trades.errors} errors`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }
    
    console.log('\n✅ JSON migration process completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateFromJSON().catch(console.error);
}

module.exports = { migrateFromJSON };
