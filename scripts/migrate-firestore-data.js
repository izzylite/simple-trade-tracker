/**
 * Firestore to Supabase Data Migration Script
 * Migrates all Firestore collections and subcollections to PostgreSQL tables
 * Handles complex nested structures and relationships
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

// Initialize Firebase and Supabase
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Migration statistics
const stats = {
  users: { total: 0, migrated: 0, errors: 0 },
  calendars: { total: 0, migrated: 0, errors: 0 },
  trades: { total: 0, migrated: 0, errors: 0 },
  economicEvents: { total: 0, migrated: 0, errors: 0 },
  sharedTrades: { total: 0, migrated: 0, errors: 0 },
  sharedCalendars: { total: 0, migrated: 0, errors: 0 },
  errors: []
};

/**
 * Convert Firestore timestamp to PostgreSQL timestamp
 */
function convertTimestamp(firestoreTimestamp) {
  if (!firestoreTimestamp) return null;
  if (firestoreTimestamp.toDate) {
    return firestoreTimestamp.toDate().toISOString();
  }
  if (firestoreTimestamp.seconds) {
    return new Date(firestoreTimestamp.seconds * 1000).toISOString();
  }
  return new Date(firestoreTimestamp).toISOString();
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
 * Create or get user from Firebase Auth data
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
 * Migrate calendars collection
 */
async function migrateCalendars() {
  console.log('\n📅 Migrating calendars...');
  
  try {
    const calendarsSnapshot = await getDocs(collection(firestore, 'calendars'));
    stats.calendars.total = calendarsSnapshot.size;
    
    if (stats.calendars.total === 0) {
      console.log('📭 No calendars found');
      return {};
    }

    const progressBar = new cliProgress.SingleBar({
      format: 'Calendars |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    progressBar.start(stats.calendars.total, 0);

    const calendarIdMap = {}; // Map Firestore ID to Supabase UUID

    for (const calendarDoc of calendarsSnapshot.docs) {
      try {
        const calendarData = calendarDoc.data();
        const firestoreId = calendarDoc.id;

        console.log(`📅 Processing calendar: ${firestoreId}`);
        console.log(`   User ID: ${calendarData.userId || 'unknown'}`);

        // Get or create user
        const userId = await migrateUser(calendarData.userId || 'unknown');

        // Generate new UUID for calendar
        const calendarId = generateUUID();
        calendarIdMap[firestoreId] = calendarId;

        // Prepare calendar data for PostgreSQL
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
        stats.errors.push(`Calendar migration error for ${calendarDoc.id}: ${error.message}`);
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
 * Migrate trades from subcollections (actual structure: calendars/{id}/years/{year} with trades array)
 */
async function migrateTrades(calendarIdMap) {
  console.log('\n💰 Migrating trades from subcollections...');

  let totalTrades = 0;
  let processedTrades = 0;

  try {
    // First, count all trades across all calendars and years
    for (const [firestoreCalendarId, supabaseCalendarId] of Object.entries(calendarIdMap)) {
      const yearsSnapshot = await getDocs(collection(firestore, `calendars/${firestoreCalendarId}/years`));

      for (const yearDoc of yearsSnapshot.docs) {
        const yearData = yearDoc.data();
        if (yearData.trades && Array.isArray(yearData.trades)) {
          totalTrades += yearData.trades.length;
        }
      }
    }

    stats.trades.total = totalTrades;
    if (totalTrades === 0) {
      console.log('📭 No trades found');
      return;
    }

    const progressBar = new cliProgress.SingleBar({
      format: 'Trades |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    progressBar.start(totalTrades, 0);

    // Migrate trades for each calendar
    for (const [firestoreCalendarId, supabaseCalendarId] of Object.entries(calendarIdMap)) {
      const yearsSnapshot = await getDocs(collection(firestore, `calendars/${firestoreCalendarId}/years`));

      // Get user ID from calendar
      const { data: calendar } = await supabase
        .from('calendars')
        .select('user_id')
        .eq('id', supabaseCalendarId)
        .single();

      if (!calendar) {
        console.log(`⚠️ Calendar not found: ${supabaseCalendarId}`);
        continue;
      }

      for (const yearDoc of yearsSnapshot.docs) {
        try {
          const yearData = yearDoc.data();
          const year = yearDoc.id;

          if (!yearData.trades || !Array.isArray(yearData.trades)) {
            continue;
          }

          // Process each trade in the trades array
          for (const trade of yearData.trades) {
            try {
              // Generate new UUID for trade
              const tradeId = generateUUID();

              // Create a unique Firestore ID for tracking
              const firestoreTradeId = `${firestoreCalendarId}_${year}_${trade.id || processedTrades}`;

              // Prepare trade data for PostgreSQL
              const tradeRecord = {
                id: tradeId,
                calendar_id: supabaseCalendarId,
                user_id: calendar.user_id,
                firestore_id: firestoreTradeId,
                name: trade.name || 'Untitled Trade',
                amount: parseFloat(trade.amount) || 0,
                trade_type: trade.tradeType || 'breakeven',
                trade_date: convertTimestamp(trade.tradeDate) || new Date().toISOString(),
                entry_price: parseFloat(trade.entryPrice) || null,
                exit_price: parseFloat(trade.exitPrice) || null,
                risk_to_reward: parseFloat(trade.riskToReward) || null,
                partials_taken: trade.partialsTaken || false,
                session: trade.session || null,
                notes: trade.notes || null,
                tags: trade.tags || [],
                is_deleted: trade.isDeleted || false,
                is_temporary: trade.isTemporary || false,
                is_pinned: trade.isPinned || false,
                share_link: trade.shareLink || null,
                is_shared: trade.isShared || false,
                shared_at: convertTimestamp(trade.sharedAt) || null,
                share_id: trade.shareId || null,
                created_at: convertTimestamp(trade.createdAt) || new Date().toISOString(),
                updated_at: convertTimestamp(trade.updatedAt) || new Date().toISOString()
              };

              // Insert trade
              const { error: tradeError } = await supabase
                .from('trades')
                .insert(tradeRecord);

              if (tradeError) {
                throw tradeError;
              }

              stats.trades.migrated++;
              processedTrades++;
              progressBar.increment();

            } catch (error) {
              stats.trades.errors++;
              stats.errors.push(`Trade migration error for trade in ${year}: ${error.message}`);
              processedTrades++;
              progressBar.increment();
            }
          }

        } catch (error) {
          stats.trades.errors++;
          stats.errors.push(`Year document migration error for ${yearDoc.id}: ${error.message}`);
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
 * Migrate economic events collection
 */
async function migrateEconomicEvents() {
  console.log('\n📈 Migrating economic events...');

  try {
    const eventsSnapshot = await getDocs(collection(firestore, 'economicEvents'));
    stats.economicEvents.total = eventsSnapshot.size;

    if (stats.economicEvents.total === 0) {
      console.log('📭 No economic events found');
      return;
    }

    const progressBar = new cliProgress.SingleBar({
      format: 'Events |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    progressBar.start(stats.economicEvents.total, 0);

    for (const eventDoc of eventsSnapshot.docs) {
      try {
        const eventData = eventDoc.data();
        const firestoreId = eventDoc.id;

        // Generate new UUID for event
        const eventId = generateUUID();

        // Prepare event data for PostgreSQL
        const eventRecord = {
          id: eventId,
          external_id: firestoreId,
          event_name: eventData.name || eventData.title || 'Unknown Event',
          currency: eventData.currency || 'USD',
          impact: eventData.impact || 'medium',
          event_date: convertTimestamp(eventData.date || eventData.eventDate) || new Date().toISOString().split('T')[0],
          event_time: convertTimestamp(eventData.date || eventData.eventDate) || new Date().toISOString(),
          time_utc: eventData.timeUtc || '00:00',
          unix_timestamp: eventData.unixTimestamp || null,
          actual_value: eventData.actual || null,
          forecast_value: eventData.forecast || null,
          previous_value: eventData.previous || null,
          country: eventData.country || null,
          description: eventData.description || null,
          data_source: eventData.source || 'myfxbook',
          created_at: convertTimestamp(eventData.createdAt) || new Date().toISOString()
        };

        // Insert event
        const { error: eventError } = await supabase
          .from('economic_events')
          .insert(eventRecord);

        if (eventError) {
          throw eventError;
        }

        stats.economicEvents.migrated++;
        progressBar.increment();

      } catch (error) {
        stats.economicEvents.errors++;
        stats.errors.push(`Economic event migration error for ${eventDoc.id}: ${error.message}`);
        progressBar.increment();
      }
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
async function migrateFirestoreData() {
  console.log('🚀 Starting Firestore to Supabase Data Migration...\n');

  try {
    // Step 1: Migrate calendars (this also creates users)
    const calendarIdMap = await migrateCalendars();

    // Step 2: Migrate trades from subcollections
    await migrateTrades(calendarIdMap);

    // Step 3: Migrate economic events
    await migrateEconomicEvents();

    // Display final results
    console.log('\n🎉 Migration completed!\n');
    console.log('📊 Migration Summary:');
    console.log(`   Users: ${stats.users.migrated} migrated, ${stats.users.errors} errors`);
    console.log(`   Calendars: ${stats.calendars.migrated}/${stats.calendars.total} migrated, ${stats.calendars.errors} errors`);
    console.log(`   Trades: ${stats.trades.migrated}/${stats.trades.total} migrated, ${stats.trades.errors} errors`);
    console.log(`   Economic Events: ${stats.economicEvents.migrated}/${stats.economicEvents.total} migrated, ${stats.economicEvents.errors} errors`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }

    console.log('\n✅ Data migration process completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateFirestoreData().catch(console.error);
}

module.exports = { migrateFirestoreData };
