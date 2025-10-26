# Trade Economic Events Migration Script

This script migrates existing trades to include economic events data. It fetches economic events from the database and associates them with trades based on their session and date.

## Overview

The migration script:
1. Scans all calendars (or a specific calendar if specified)
2. Finds trades that don't have `economicEvents` data
3. Fetches relevant economic events for each trade's session and date
4. Updates trades with the economic events data
5. Only includes High and Medium impact events for major currencies (USD, EUR, GBP, JPY)

## Prerequisites

1. **Firebase Configuration**: Ensure your Firebase environment variables are set
2. **Economic Events Data**: The `economicEvents` collection must be populated with data
3. **Node.js**: Node.js must be installed to run the script

## Setup

### 1. Environment Variables

The script requires Firebase configuration through environment variables. You can set these in several ways:

#### Option A: Create a `.env` file in the project root:
```bash
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdefghijklmnop
```

#### Option B: Set environment variables directly:
```bash
export REACT_APP_FIREBASE_PROJECT_ID=your-project-id
export REACT_APP_FIREBASE_API_KEY=your-api-key
# ... etc
```

### 2. Install Dependencies (if needed)

If you don't have dotenv installed and want to use a `.env` file:
```bash
npm install dotenv
```

## Usage

### Migrate All Calendars
```bash
node migrate-trade-economic-events.js
```

### Migrate Specific Calendar
```bash
node migrate-trade-economic-events.js --calendar=your-calendar-id
```

### Dry Run (Preview Changes)
```bash
node migrate-trade-economic-events.js --dry-run
node migrate-trade-economic-events.js --calendar=your-calendar-id --dry-run
```

### Using npm script
```bash
npm run migrate-trade-events
npm run migrate-trade-events -- --calendar=your-calendar-id
npm run migrate-trade-events -- --dry-run
```

### Show Help
```bash
node migrate-trade-economic-events.js --help
```

## How It Works

### Session Time Ranges
The script uses the same session logic as the application:
- **Asia**: 21:00 - 06:00 UTC (next day)
- **London**: 07:00 - 16:00 UTC  
- **NY AM**: 13:00 - 17:00 UTC
- **NY PM**: 17:00 - 22:00 UTC

### Economic Events Filtering
- Only **High** and **Medium** impact events are included
- Only events for major currencies: **USD, EUR, GBP, JPY**
- Events must fall within the trade's session time range
- Events are converted to simplified format for storage with trades

### Data Structure
Each trade will be updated with an `economicEvents` array containing:
```javascript
{
  name: "Non-Farm Payrolls",
  flagCode: "us", 
  impact: "High",
  currency: "USD",
  timeUtc: "2024-01-05T13:30:00.000Z"
}
```

## Safety Features

- **Dry Run Mode**: Use `--dry-run` to preview changes without making any database updates
- **Non-destructive**: Only adds data, doesn't remove existing data
- **Skip existing**: Trades that already have economic events are skipped
- **Error handling**: Individual trade failures don't stop the entire migration
- **Validation**: Skips trades without session information
- **Rate limiting**: Small delays between operations to avoid overwhelming the database

## Output

The script provides detailed logging:
- Progress for each calendar and year
- Number of events found for each trade
- Summary of total trades updated
- Error messages for any failures

Example output:
```
🚀 Starting Trade Economic Events Migration...

📊 Step 1: Fetching calendars...
Found 2 calendar(s) to process

🗓️  Processing calendar: My Trading Calendar
Found 3 year documents

📅 Processing year 2024 for calendar abc123
🔄 Fetching events for trade trade-456 (London session on 2024-01-15)
✅ Found 2 events for trade trade-456
✅ Updated year 2024 with 1 trades containing economic events

🎉 Migration Complete!
✅ Calendars processed: 2/2
✅ Year documents processed: 3
✅ Trades updated with economic events: 15
```

## Troubleshooting

### Common Issues

1. **Firebase configuration missing**
   - Ensure all required environment variables are set
   - Check that your Firebase project ID is correct

2. **No economic events found**
   - Verify the `economicEvents` collection has data
   - Check that events exist for the date ranges of your trades
   - Ensure events have the correct impact levels (High/Medium)

3. **Permission errors**
   - Ensure your Firebase project allows read/write access
   - Check Firestore security rules

### Verification

After running the migration, you can verify the results by:
1. Checking the console output for the number of trades updated
2. Looking at trades in the Firebase console to see the `economicEvents` field
3. Using the application's Economic Event Correlation Analysis feature

## Rollback

If you need to remove the economic events data:
1. The script doesn't provide automatic rollback
2. You would need to manually remove the `economicEvents` field from trades
3. Consider backing up your data before running the migration

## Performance

- The script processes trades sequentially to avoid overwhelming the database
- Small delays (100ms) are added between trade processing
- Batch updates are used for year documents to minimize database writes
- Memory usage is kept low by processing one calendar/year at a time
