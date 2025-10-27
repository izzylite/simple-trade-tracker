# Firebase to Supabase Data Migration Guide

## Overview
This guide will help you migrate all your calendars and trades from Firebase Firestore to Supabase PostgreSQL. All data will be assigned to user ID: `69054344-5b35-4e7c-85a6-6f0b0d1d0688`.

## Prerequisites

### 1. Get Supabase Service Role Key
The migration script requires admin privileges to bypass RLS policies.

**Steps:**
1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac
2. Navigate to **Settings** → **API**
3. Find the **service_role** key (NOT the anon key)
4. Copy the service_role key

### 2. Add Service Role Key to .env
Add this line to your `.env` file:
```env
REACT_APP_SUPABASE_SERVICE_KEY=your_service_role_key_here
```

**⚠️ IMPORTANT:** 
- The service_role key has admin privileges - keep it secret!
- Never commit this key to version control
- Only use it for server-side operations

### 3. Verify Firebase Credentials
Make sure these are in your `.env` file (already present):
```env
REACT_APP_FIREBASE_API_KEY=AIzaSyCcIgXUCcuWmlmf9Vapvg_wpcQllHQBc-o
REACT_APP_FIREBASE_AUTH_DOMAIN=tradetracker-30ec1.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=tradetracker-30ec1
REACT_APP_FIREBASE_STORAGE_BUCKET=tradetracker-30ec1.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=89378078918
REACT_APP_FIREBASE_APP_ID=1:89378078918:web:f341f8039c0834247657c7
```

## Migration Script Details

### What Gets Migrated

**1. Calendars** (`calendars` collection)
- All calendar metadata (name, settings, targets, etc.)
- Account balance and risk settings
- Dynamic risk configuration
- Tags and required tag groups
- Hero images and notes
- Score settings

**2. Trades** (`calendars/{id}/years/{year}` subcollections)
- All trades from all years
- Trade metadata (name, amount, type, date)
- Entry/exit prices, stop loss, take profit
- Risk-to-reward ratios
- Tags and sessions
- Notes and images
- Partials and pinned status

**3. Economic Events** (`economicEvents` collection)
- All economic calendar events
- Event metadata (name, currency, impact)
- Actual/forecast/previous values
- Timestamps and descriptions

### User ID Mapping
- **Target User ID**: `69054344-5b35-4e7c-85a6-6f0b0d1d0688`
- All calendars will be assigned to this user
- All trades will be assigned to this user
- The script will create this user if it doesn't exist

### Field Mapping

**Calendar Fields (Firestore → Supabase):**
```
userId → user_id (set to 69054344-5b35-4e7c-85a6-6f0b0d1d0688)
currentBalance/startingBalance → account_balance
maxDailyDrawdown → max_daily_drawdown
weeklyTarget → weekly_target
monthlyTarget → monthly_target
yearlyTarget/targetBalance → yearly_target
riskPerTrade → risk_per_trade
dynamicRiskEnabled → dynamic_risk_enabled
increasedRiskPercentage → increased_risk_percentage
profitThresholdPercentage → profit_threshold_percentage
duplicatedCalendar → duplicated_calendar
isDeleted → is_deleted
requiredTagGroups → required_tag_groups
heroImageUrl → hero_image_url
heroImageAttribution → hero_image_attribution
daysNotes → days_notes
scoreSettings → score_settings
createdAt → created_at
updatedAt → updated_at
```

**Trade Fields (Firestore → Supabase):**
```
tradeType → trade_type
tradeDate → trade_date
entryPrice → entry_price
exitPrice → exit_price
riskToReward → risk_to_reward
partialsTaken → partials_taken
isDeleted → is_deleted
isTemporary → is_temporary
isPinned → is_pinned
shareLink → share_link
isShared → is_shared
sharedAt → shared_at
shareId → share_id
createdAt → created_at
updatedAt → updated_at
```

## Running the Migration

### Step 1: Backup Your Data (IMPORTANT!)
Before running the migration, export your Firebase data as a backup:

```bash
node scripts/export-firestore-data.js
```

This will create a backup in `firestore-export-{timestamp}.json`.

### Step 2: Run the Migration Script

```bash
node scripts/migrate-firestore-data.js
```

### Step 3: Monitor Progress
The script will show progress bars for each collection:
```
📅 Migrating calendars...
Calendars |████████████████████| 100% | 5/5

💰 Migrating trades from subcollections...
Trades |████████████████████| 100% | 150/150

📈 Migrating economic events...
Events |████████████████████| 100% | 500/500
```

### Step 4: Review Results
At the end, you'll see a summary:
```
🎉 Migration completed!

📊 Migration Summary:
   Users: 1 migrated, 0 errors
   Calendars: 5/5 migrated, 0 errors
   Trades: 150/150 migrated, 0 errors
   Economic Events: 500/500 migrated, 0 errors
```

## Verification

### 1. Check User Record
```sql
SELECT * FROM users WHERE id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688';
```

### 2. Check Calendars
```sql
SELECT id, name, user_id, account_balance, created_at 
FROM calendars 
WHERE user_id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688';
```

### 3. Check Trades
```sql
SELECT COUNT(*) as total_trades, calendar_id
FROM trades 
WHERE user_id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688'
GROUP BY calendar_id;
```

### 4. Check Economic Events
```sql
SELECT COUNT(*) as total_events, currency, impact
FROM economic_events
GROUP BY currency, impact;
```

## Troubleshooting

### Error: "Missing Supabase credentials"
- Make sure `REACT_APP_SUPABASE_SERVICE_KEY` is in your `.env` file
- Restart your terminal after adding the key

### Error: "User already exists"
- This is normal if the user was created in a previous migration attempt
- The script will use the existing user

### Error: "Calendar migration error"
- Check the error message for details
- Common issues:
  - Invalid data types (e.g., non-numeric values in numeric fields)
  - Missing required fields
  - Constraint violations

### Error: "Trade migration error"
- Check if the calendar was migrated successfully
- Verify the trade data structure in Firebase
- Check for invalid timestamps or data types

## Post-Migration Steps

### 1. Verify Data Integrity
- Log into your app with the Supabase user
- Check that all calendars are visible
- Verify trade counts match Firebase
- Test creating new trades

### 2. Update RLS Policies (if needed)
The migration uses service_role key to bypass RLS. After migration, verify that:
- Regular users can access their own data
- RLS policies are working correctly

### 3. Clean Up (Optional)
After verifying the migration:
- Remove `REACT_APP_SUPABASE_SERVICE_KEY` from `.env` (for security)
- Keep the Firebase backup file safe
- Consider archiving Firebase data

## Rollback Plan

If something goes wrong:

### 1. Delete Migrated Data
```sql
-- Delete trades
DELETE FROM trades WHERE user_id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688';

-- Delete calendars
DELETE FROM calendars WHERE user_id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688';

-- Delete user (optional)
DELETE FROM users WHERE id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688';
```

### 2. Re-run Migration
After fixing any issues, you can re-run the migration script.

## Notes

- The migration script generates new UUIDs for all records
- Original Firestore IDs are preserved in the `firestore_id` field for trades
- Timestamps are converted from Firestore format to PostgreSQL ISO format
- All numeric fields are properly parsed and validated
- Arrays and JSON objects are preserved
- The script is idempotent - you can run it multiple times (but it will create duplicates)

## Support

If you encounter issues:
1. Check the error messages in the console
2. Review the backup file to verify source data
3. Check Supabase logs in the dashboard
4. Verify database schema matches expectations

