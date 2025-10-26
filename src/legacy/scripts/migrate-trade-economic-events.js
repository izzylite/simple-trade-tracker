const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, updateDoc, writeBatch, query, where, orderBy } = require('firebase/firestore');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Try to load dotenv if available
try {
  require('dotenv').config();
} catch (error) {
  // dotenv not available, environment variables should be set manually
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Validate configuration
if (!firebaseConfig.projectId) {
  console.error('❌ Firebase configuration missing. Please ensure environment variables are set.');
  console.error('Required variables:');
  console.error('  - REACT_APP_FIREBASE_PROJECT_ID');
  console.error('  - REACT_APP_FIREBASE_API_KEY');
  console.error('  - REACT_APP_FIREBASE_AUTH_DOMAIN');
  console.error('  - REACT_APP_FIREBASE_STORAGE_BUCKET');
  console.error('  - REACT_APP_FIREBASE_MESSAGING_SENDER_ID');
  console.error('  - REACT_APP_FIREBASE_APP_ID');
  console.error('');
  console.error('You can set these by:');
  console.error('1. Creating a .env file in the project root with the variables');
  console.error('2. Setting them as system environment variables');
  console.error('3. Running: export REACT_APP_FIREBASE_PROJECT_ID=your-project-id (etc.)');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);

// Default currencies for economic events
const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];

/**
 * Determine if a given date falls within daylight saving time
 * Uses actual DST transition rules for better accuracy
 */
function isDaylightSavingTime(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  // Before March or after October - definitely not DST
  if (month < 2 || month > 9) {
    return false;
  }

  // April through September - definitely DST
  if (month > 2 && month < 9) {
    return true;
  }

  // March - check if after last Sunday
  if (month === 2) {
    // Find last Sunday of March
    const lastSunday = new Date(year, 3, 0); // Last day of March
    lastSunday.setDate(lastSunday.getDate() - lastSunday.getDay());
    return day >= lastSunday.getDate();
  }

  // October - check if before last Sunday
  if (month === 9) {
    // Find last Sunday of October
    const lastSunday = new Date(year, 10, 0); // Last day of October
    lastSunday.setDate(lastSunday.getDate() - lastSunday.getDay());
    return day < lastSunday.getDate();
  }

  return false;
}

/**
 * Get session time range for a specific date and session
 * Uses improved DST detection logic for better accuracy
 */
function getSessionTimeRange(session, tradeDate) {
  const year = tradeDate.getFullYear();
  const month = tradeDate.getMonth();
  const day = tradeDate.getDate();

  // Improved DST detection logic
  const isDST = isDaylightSavingTime(tradeDate);

  let startHour, endHour;

  switch (session) {
    case 'London':
      startHour = isDST ? 7 : 8;  // 7:00 AM UTC (summer) / 8:00 AM UTC (winter)
      endHour = isDST ? 12 : 13; // 12:00 PM UTC (summer) / 1:00 PM UTC (winter)
     // endHour = isDST ? 16 : 17;  // 4:00 PM UTC (summer) / 5:00 PM UTC (winter)  // Right session range but overlaps with NY PM
      break;
    case 'NY AM':
      startHour = isDST ? 12 : 13; // 12:00 PM UTC (summer) / 1:00 PM UTC (winter)
      endHour = isDST ? 17 : 18;   // 5:00 PM UTC (summer) / 6:00 PM UTC (winter)
      break;
    case 'NY PM':
      startHour = isDST ? 17 : 18; // 5:00 PM UTC (summer) / 6:00 PM UTC (winter)
      endHour = isDST ? 21 : 22;   // 9:00 PM UTC (summer) / 10:00 PM UTC (winter)
      break;
    case 'Asia':
      // Asia session spans midnight, so we need to handle day boundaries
      const asiaStartHour = isDST ? 22 : 23; // 10:00 PM UTC (summer) / 11:00 PM UTC (winter)
      const asiaEndHour = isDST ? 7 : 8;     // 7:00 AM UTC (summer) / 8:00 AM UTC (winter)

      // Start time is on the previous day
      const startDate = new Date(year, month, day - 1, asiaStartHour, 0, 0);
      const endDate = new Date(year, month, day, asiaEndHour, 0, 0);
      return { start: startDate, end: endDate };
    default:
      // Default to full day range if session is unknown
      startHour = 0;
      endHour = 23;
  }

  const start = new Date(year, month, day, startHour, 0, 0);
  const end = new Date(year, month, day, endHour, 59, 59);

  return { start, end };
}

/**
 * Check if an economic event falls within a trade session
 */
function isEventInTradeSession(event, tradeDate, session) {
  if (!session) return true; // If no session specified, include all events for the day

  const eventTime = new Date(event.timeUtc);
  const sessionRange = getSessionTimeRange(session, tradeDate);

  return eventTime >= sessionRange.start && eventTime <= sessionRange.end;
}

/**
 * Convert economic event to simplified trade event format
 */
function convertToTradeEvent(event) {
  return {
    name: event.event,
    flagCode: event.flagCode,
    impact: event.impact,
    currency: event.currency,
    timeUtc: event.timeUtc
  };
}

/**
 * Fetch economic events for a specific trade
 * Uses the same query approach as economicCalendarService
 */
async function fetchEventsForTrade(tradeDate, session) {
  try {
    // Calculate date range based on session
    let startDate, endDate;

    if (session) {
      const sessionRange = getSessionTimeRange(session, tradeDate);
      startDate = sessionRange.start;
      endDate = sessionRange.end;
    } else {
      // Fallback to full day range
      startDate = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(), 0, 0, 0);
      endDate = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(), 23, 59, 59);
    }
 

    // Build Firestore query with server-side filtering (same as economicCalendarService)
    const baseCollection = collection(db, 'economicEvents');
    const queryConstraints = [
      where('time', '>=', startDate),
      where('time', '<=', endDate),
      where('impact', 'in', ['High', 'Medium']), // Server-side currency filtering
      orderBy('time'), 
    ];

    const eventsQuery = query(baseCollection, ...queryConstraints);
    const eventsSnapshot = await getDocs(eventsQuery);

    let events = [];
    eventsSnapshot.forEach(doc => {
      const data = doc.data();
      events.push({
        id: data.id,
        currency: data.currency,
        event: data.event,
        impact: data.impact,
        timeUtc: data.timeUtc,
        date: data.date,
        flagCode: data.flagCode || '',
        time: data.time?.toDate?.()?.toISOString() || data.timeUtc
      });
    })
    events = events.filter(event => event.currency === 'USD' || event.currency === 'EUR');  

    // Filter events that fall within trade session
    const sessionEvents = events.filter(event =>
      isEventInTradeSession(event, tradeDate, session)
    );

    // Convert to simplified trade events
    const tradeEvents = sessionEvents.map(event => convertToTradeEvent(event));

    console.log(`📊 Found ${tradeEvents.length} economic events for trade session`, {
      date: tradeDate.toISOString().split('T')[0],
      session: session || 'full-day',
      totalEvents: events.length,
      sessionEvents: sessionEvents.length
    });

    return tradeEvents;
  } catch (error) {
    console.error('Failed to fetch economic events for trade:', error);
    return [];
  }
}

/**
 * Get all calendars from Firestore
 */
async function getAllCalendars() {
  const calendarsSnapshot = await getDocs(collection(db, 'calendars'));
  const calendars = [];

  calendarsSnapshot.forEach(doc => {
    calendars.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return calendars;
}

/**
 * Get all year documents for a calendar
 */
async function getCalendarYears(calendarId) {
  const yearsSnapshot = await getDocs(collection(db, 'calendars', calendarId, 'years'));
  const years = [];

  yearsSnapshot.forEach(doc => {
    years.push({
      id: doc.id,
      year: parseInt(doc.id),
      ...doc.data()
    });
  });

  return years;
}

/**
 * Update trades in a year document with economic events
 */
async function updateTradesWithEconomicEvents(calendarId, yearDoc, dryRun = false) {
  const trades = yearDoc.trades || [];
  let updatedCount = 0;
  const updatedTrades = [];

  console.log(`\n📅 Processing ${trades.length} trades for year ${yearDoc.year}...`);

  // Process trades in parallel with a concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < trades.length; i += BATCH_SIZE) {
    const batch = trades.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async trade => {
      // Skip if trade already has events or no session
    
      if (!trade.session) {
        console.log(`⏭️  Skipping trade ${trade.id} - no session`);
        return { trade, updated: false };
      }

      try {
        const tradeDate = trade.date.toDate?.() || new Date(trade.date);
        console.log(`🔄 Processing trade ${trade.id} (${trade.session} - ${tradeDate.toISOString().split('T')[0]})`);

        const economicEvents = await fetchEventsForTrade(tradeDate, trade.session);

        if (economicEvents.length > 0) {
          console.log(`✅ Found ${economicEvents.length} events for trade ${trade.id}`);
          return { trade: { ...trade, economicEvents, tags: [...new Set([...trade.tags, ...['pair:EURUSD']])] }, updated: true };
        }
        console.log(`ℹ️  No events for trade ${trade.id}`);
        return { trade, updated: false };
      } catch (error) {
        console.error(`❌ Error processing trade ${trade.id}:`, error);
        return { trade, updated: false };
      }
    }));

    results.forEach(({ trade, updated }) => {
      updatedTrades.push(trade);
      if (updated) updatedCount++;
    });
  }

  // Update the year document if any trades were updated
  if (updatedCount > 0) {
    if (dryRun) {
      console.log(`🔍 DRY RUN: Would update year ${yearDoc.year} with ${updatedCount} trades containing economic events`);
    } else {
      try {
        const yearDocRef = doc(db, 'calendars', calendarId, 'years', yearDoc.year.toString());
        await updateDoc(yearDocRef, {
          trades: updatedTrades,
          lastModified: new Date()
        });

        console.log(`✅ Updated year ${yearDoc.year} with ${updatedCount} trades containing economic events`);
      } catch (error) {
        console.error(`❌ Error updating year document ${yearDoc.year}:`, error);
      }
    }
  } else {
    console.log(`ℹ️  No trades updated for year ${yearDoc.year}`);
  }

  return updatedCount;
}

/**
 * Main migration function
 */
async function migrateTradeEconomicEvents(specificCalendarId = null, dryRun = false) {
  console.log('🚀 Starting Trade Economic Events Migration...\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE: No changes will be made to the database\n');
  }

  if (specificCalendarId) {
    console.log(`🎯 Targeting specific calendar: ${specificCalendarId}\n`);
  }

  let totalTradesUpdated = 0;
  let totalCalendarsProcessed = 0;
  let totalYearsProcessed = 0;

  try {
    // Step 1: Get calendar(s) efficiently
    console.log('📊 Step 1: Fetching calendars...');
    let calendars;

    if (specificCalendarId) {
      // Get specific calendar directly using getDoc() for optimal performance
      try {
        const calendarDocRef = doc(db, 'calendars', specificCalendarId);
        const calendarDoc = await getDoc(calendarDocRef);

        if (!calendarDoc.exists()) {
          console.error(`❌ Calendar with ID '${specificCalendarId}' not found`);
          console.error('💡 Please check the calendar ID and try again');
          process.exit(1);
        }

        calendars = [{
          id: calendarDoc.id,
          ...calendarDoc.data()
        }];

      } catch (error) {
        console.error(`❌ Error fetching calendar '${specificCalendarId}':`, error);
        process.exit(1);
      }
    } else {
      calendars = await getAllCalendars();
      if (calendars.length === 0) {
        console.error('❌ No calendars found in the database');
        process.exit(1);
      }
    }

    console.log(`Found ${calendars.length} calendar(s) to process\n`);

    // Step 2: Process each calendar
    for (const calendar of calendars) {
      console.log(`\n🗓️  Processing calendar: ${calendar.name || calendar.id}`);

      try {
        // Get all year documents for this calendar
        const years = await getCalendarYears(calendar.id);
        console.log(`Found ${years.length} year documents`);

        // Process each year
        for (const yearDoc of years) {
          console.log(`\n📅 Processing year ${yearDoc.year} for calendar ${calendar.id}`);
          const updatedCount = await updateTradesWithEconomicEvents(calendar.id, yearDoc, dryRun);
          totalTradesUpdated += updatedCount;
          totalYearsProcessed++;
        }

        totalCalendarsProcessed++;

      } catch (error) {
        console.error(`❌ Error processing calendar ${calendar.id}:`, error);
      }
    }

    // Step 3: Summary
    console.log('\n🎉 Migration Complete!');
    console.log(`✅ Calendars processed: ${totalCalendarsProcessed}/${calendars.length}`);
    console.log(`✅ Year documents processed: ${totalYearsProcessed}`);
    console.log(`✅ Trades updated with economic events: ${totalTradesUpdated}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const calendarIdArg = args.find(arg => arg.startsWith('--calendar='));
const specificCalendarId = calendarIdArg ? calendarIdArg.split('=')[1] : null;
const dryRun = args.includes('--dry-run') || args.includes('--dry');

// Display usage information
if (args.includes('--help') || args.includes('-h')) {
  console.log('📖 Trade Economic Events Migration Script');
  console.log('');
  console.log('Usage:');
  console.log('  node migrate-trade-economic-events.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --calendar=<id>    Migrate only the specified calendar ID');
  console.log('  --dry-run, --dry   Preview changes without making updates');
  console.log('  --help, -h         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node migrate-trade-economic-events.js');
  console.log('  node migrate-trade-economic-events.js --calendar=abc123');
  console.log('  node migrate-trade-economic-events.js --dry-run');
  console.log('  node migrate-trade-economic-events.js --calendar=abc123 --dry-run');
  console.log('');
  process.exit(0);
}

// Run the migration
console.log('🔧 Configuration:');
console.log(`   Project ID: ${firebaseConfig.projectId}`);
console.log(`   Target Calendar: ${specificCalendarId || 'All calendars'}`);
console.log(`   Mode: ${dryRun ? 'DRY RUN (preview only)' : 'LIVE (will make changes)'}`);
console.log('');

migrateTradeEconomicEvents(specificCalendarId, dryRun);
