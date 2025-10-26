/**
 * Export Firestore Data to JSON Files
 * This script exports all Firestore collections to local JSON files
 * to reduce Firebase read costs and enable efficient migration
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
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

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

// Create export directory
const exportDir = path.join(__dirname, 'firestore-export');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

// Export statistics
const stats = {
  calendars: 0,
  trades: 0,
  economicEvents: 0,
  sharedTrades: 0,
  sharedCalendars: 0,
  totalDocuments: 0
};

/**
 * Convert Firestore timestamp to serializable format
 */
function serializeTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) {
    return {
      _type: 'timestamp',
      seconds: timestamp.seconds,
      nanoseconds: timestamp.nanoseconds,
      iso: timestamp.toDate().toISOString()
    };
  }
  if (timestamp.seconds) {
    return {
      _type: 'timestamp',
      seconds: timestamp.seconds,
      nanoseconds: timestamp.nanoseconds || 0,
      iso: new Date(timestamp.seconds * 1000).toISOString()
    };
  }
  return timestamp;
}

/**
 * Recursively serialize Firestore data
 */
function serializeFirestoreData(data) {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(serializeFirestoreData);
  }
  
  if (typeof data === 'object') {
    const serialized = {};
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && (value.toDate || value.seconds)) {
        serialized[key] = serializeTimestamp(value);
      } else if (typeof value === 'object') {
        serialized[key] = serializeFirestoreData(value);
      } else {
        serialized[key] = value;
      }
    }
    return serialized;
  }
  
  return data;
}

/**
 * Export a single collection
 */
async function exportCollection(collectionName) {
  console.log(`\n📋 Exporting ${collectionName} collection...`);
  
  try {
    const snapshot = await getDocs(collection(firestore, collectionName));
    const documents = [];
    
    if (snapshot.size === 0) {
      console.log(`📭 No documents found in ${collectionName}`);
      return 0;
    }

    const progressBar = new cliProgress.SingleBar({
      format: `${collectionName} |{bar}| {percentage}% | {value}/{total}`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    progressBar.start(snapshot.size, 0);

    for (const doc of snapshot.docs) {
      const data = serializeFirestoreData(doc.data());
      documents.push({
        id: doc.id,
        data: data
      });
      progressBar.increment();
    }

    progressBar.stop();

    // Save to JSON file
    const filePath = path.join(exportDir, `${collectionName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
    
    console.log(`✅ Exported ${documents.length} documents to ${filePath}`);
    stats[collectionName] = documents.length;
    stats.totalDocuments += documents.length;
    
    return documents.length;

  } catch (error) {
    console.error(`❌ Error exporting ${collectionName}:`, error.message);
    return 0;
  }
}

/**
 * Export calendars with their subcollections (trades)
 */
async function exportCalendarsWithTrades() {
  console.log('\n📅 Exporting calendars with trades subcollections...');
  
  try {
    const calendarsSnapshot = await getDocs(collection(firestore, 'calendars'));
    const calendarsWithTrades = [];
    let totalTrades = 0;
    
    if (calendarsSnapshot.size === 0) {
      console.log('📭 No calendars found');
      return { calendars: 0, trades: 0 };
    }

    const progressBar = new cliProgress.SingleBar({
      format: 'Calendars |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });
    progressBar.start(calendarsSnapshot.size, 0);

    for (const calendarDoc of calendarsSnapshot.docs) {
      try {
        const calendarData = serializeFirestoreData(calendarDoc.data());
        const calendarId = calendarDoc.id;
        
        // Get trades from years subcollection
        const yearsSnapshot = await getDocs(collection(firestore, `calendars/${calendarId}/years`));
        const trades = [];
        
        for (const yearDoc of yearsSnapshot.docs) {
          const yearData = serializeFirestoreData(yearDoc.data());
          
          // Extract trades array from year document
          if (yearData.trades && Array.isArray(yearData.trades)) {
            yearData.trades.forEach((trade, index) => {
              trades.push({
                id: trade.id || `${calendarId}_${yearDoc.id}_${index}`,
                year: yearDoc.id,
                data: trade
              });
            });
            totalTrades += yearData.trades.length;
          }
        }
        
        calendarsWithTrades.push({
          id: calendarId,
          data: calendarData,
          trades: trades
        });
        
        progressBar.increment();
        
      } catch (error) {
        console.error(`Error processing calendar ${calendarDoc.id}:`, error.message);
        progressBar.increment();
      }
    }

    progressBar.stop();

    // Save calendars with trades
    const filePath = path.join(exportDir, 'calendars-with-trades.json');
    fs.writeFileSync(filePath, JSON.stringify(calendarsWithTrades, null, 2));
    
    console.log(`✅ Exported ${calendarsWithTrades.length} calendars with ${totalTrades} trades to ${filePath}`);
    stats.calendars = calendarsWithTrades.length;
    stats.trades = totalTrades;
    stats.totalDocuments += calendarsWithTrades.length + totalTrades;
    
    return { calendars: calendarsWithTrades.length, trades: totalTrades };

  } catch (error) {
    console.error('❌ Error exporting calendars with trades:', error.message);
    return { calendars: 0, trades: 0 };
  }
}

/**
 * Main export function
 */
async function exportFirestoreData() {
  console.log('🚀 Starting Firestore Data Export...\n');
  console.log(`📁 Export directory: ${exportDir}\n`);
  
  try {
    // Export individual collections
    const collections = [
      'economicEvents',
      'sharedTrades', 
      'sharedCalendars',
      'economicCalendarCache'
    ];

    for (const collectionName of collections) {
      await exportCollection(collectionName);
    }

    // Export calendars with trades (special handling for subcollections)
    await exportCalendarsWithTrades();

    // Create export summary
    const summary = {
      exportDate: new Date().toISOString(),
      exportDirectory: exportDir,
      statistics: stats,
      files: fs.readdirSync(exportDir).map(file => ({
        name: file,
        size: fs.statSync(path.join(exportDir, file)).size,
        path: path.join(exportDir, file)
      }))
    };

    // Save summary
    const summaryPath = path.join(exportDir, 'export-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    // Display results
    console.log('\n🎉 Export completed!\n');
    console.log('📊 Export Summary:');
    console.log(`   Calendars: ${stats.calendars}`);
    console.log(`   Trades: ${stats.trades}`);
    console.log(`   Economic Events: ${stats.economicEvents}`);
    console.log(`   Shared Trades: ${stats.sharedTrades}`);
    console.log(`   Shared Calendars: ${stats.sharedCalendars}`);
    console.log(`   Total Documents: ${stats.totalDocuments}`);
    
    console.log('\n📁 Exported Files:');
    summary.files.forEach(file => {
      console.log(`   ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    });
    
    console.log(`\n✅ All data exported to: ${exportDir}`);
    console.log('💡 Next step: Run the migration script using these JSON files');
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

// Run the export
if (require.main === module) {
  exportFirestoreData().catch(console.error);
}

module.exports = { exportFirestoreData };
