# Firebase to Supabase Migration - Ready to Execute

## ✅ What's Ready

### 1. Migration Script Updated
- **File**: `scripts/migrate-firestore-data.js`
- **Changes Made**: 
  - All data will be assigned to user ID: `69054344-5b35-4e7c-85a6-6f0b0d1d0688`
  - Script will create this user if it doesn't exist
  - Script will use existing user if already present

### 2. Export Script Available
- **File**: `scripts/export-firestore-data.js`
- **Purpose**: Backup Firebase data before migration
- **Output**: Creates `firestore-export/` directory with JSON files

### 3. Dependencies Installed
- ✅ `@supabase/supabase-js` - Supabase client
- ✅ `cli-progress` - Progress bars for migration
- ✅ `firebase` - Firebase SDK
- ✅ `dotenv` - Environment variables

## ⚠️ What You Need to Do

### STEP 1: Get Supabase Service Role Key

**Why?** The migration script needs admin privileges to bypass RLS policies and insert data directly.

**How to get it:**
1. Go to: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/settings/api
2. Scroll down to **Project API keys**
3. Find the **service_role** key (it's different from the anon key)
4. Click the eye icon to reveal it
5. Copy the entire key

**Add to .env file:**
```env
REACT_APP_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dWJ6YXVlbGlsemlhcW5zZmFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ0MjQwMywiZXhwIjoyMDY4MDE4NDAzfQ.YOUR_ACTUAL_KEY_HERE
```

⚠️ **SECURITY WARNING:**
- This key has FULL admin access to your database
- Never commit it to Git
- Never share it publicly
- Only use it for server-side operations
- Remove it from .env after migration (optional)

### STEP 2: Verify Target User Exists

Check if user `69054344-5b35-4e7c-85a6-6f0b0d1d0688` exists in Supabase:

**Option A: Using Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/editor
2. Click on `users` table
3. Search for ID: `69054344-5b35-4e7c-85a6-6f0b0d1d0688`

**Option B: Using SQL**
```sql
SELECT * FROM users WHERE id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688';
```

**If user doesn't exist:**
- The migration script will create it automatically
- It will use the first Firebase user's data (email, display name, etc.)

**If user exists:**
- The migration script will use it
- All calendars and trades will be assigned to this user

## 🚀 Migration Steps

### STEP 1: Backup Firebase Data (CRITICAL!)

```bash
node scripts/export-firestore-data.js
```

**What this does:**
- Exports all calendars with their trades
- Exports all economic events
- Exports shared trades and calendars
- Creates JSON files in `scripts/firestore-export/` directory

**Expected output:**
```
📋 Exporting calendars collection...
Calendars |████████████████████| 100% | 5/5

📋 Exporting economicEvents collection...
Events |████████████████████| 100% | 500/500

✅ Export completed!
   Calendars: 5
   Trades: 150
   Economic Events: 500
```

**⚠️ IMPORTANT:** Keep these backup files safe! You'll need them if something goes wrong.

### STEP 2: Run Migration

```bash
node scripts/migrate-firestore-data.js
```

**What this does:**
1. Creates/verifies user `69054344-5b35-4e7c-85a6-6f0b0d1d0688`
2. Migrates all calendars to Supabase
3. Migrates all trades from all years
4. Migrates all economic events
5. Shows progress bars for each step

**Expected output:**
```
🚀 Starting Firestore to Supabase Data Migration...

📅 Migrating calendars...
✅ Using existing target user: 69054344-5b35-4e7c-85a6-6f0b0d1d0688
Calendars |████████████████████| 100% | 5/5
✅ Calendars: 5/5 migrated

💰 Migrating trades from subcollections...
Trades |████████████████████| 100% | 150/150
✅ Trades: 150/150 migrated

📈 Migrating economic events...
Events |████████████████████| 100% | 500/500
✅ Economic Events: 500/500 migrated

🎉 Migration completed!

📊 Migration Summary:
   Users: 1 migrated, 0 errors
   Calendars: 5/5 migrated, 0 errors
   Trades: 150/150 migrated, 0 errors
   Economic Events: 500/500 migrated, 0 errors

✅ Data migration process completed!
```

### STEP 3: Verify Migration

**Check in Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/editor

**Verify Calendars:**
```sql
SELECT id, name, user_id, account_balance, created_at 
FROM calendars 
WHERE user_id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688'
ORDER BY created_at DESC;
```

**Verify Trades:**
```sql
SELECT 
  c.name as calendar_name,
  COUNT(t.id) as trade_count,
  SUM(t.amount) as total_pnl
FROM trades t
JOIN calendars c ON t.calendar_id = c.id
WHERE t.user_id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688'
GROUP BY c.id, c.name;
```

**Verify Economic Events:**
```sql
SELECT 
  COUNT(*) as total_events,
  currency,
  impact
FROM economic_events
GROUP BY currency, impact
ORDER BY currency, impact;
```

### STEP 4: Test in Application

1. Log into your app
2. Check that all calendars are visible
3. Open each calendar and verify trades
4. Create a new trade to test functionality
5. Verify economic calendar events are showing

## 📋 Data Mapping Reference

### Calendar Fields
```
Firebase (camelCase)     →  Supabase (snake_case)
─────────────────────────────────────────────────
userId                   →  user_id (set to 69054344-5b35-4e7c-85a6-6f0b0d1d0688)
currentBalance           →  account_balance
maxDailyDrawdown         →  max_daily_drawdown
weeklyTarget             →  weekly_target
monthlyTarget            →  monthly_target
yearlyTarget             →  yearly_target
riskPerTrade             →  risk_per_trade
dynamicRiskEnabled       →  dynamic_risk_enabled
increasedRiskPercentage  →  increased_risk_percentage
profitThresholdPercentage→  profit_threshold_percentage
requiredTagGroups        →  required_tag_groups
heroImageUrl             →  hero_image_url
heroImageAttribution     →  hero_image_attribution
daysNotes                →  days_notes
scoreSettings            →  score_settings
createdAt                →  created_at
updatedAt                →  updated_at
```

### Trade Fields
```
Firebase (camelCase)     →  Supabase (snake_case)
─────────────────────────────────────────────────
tradeType                →  trade_type
tradeDate                →  trade_date
entryPrice               →  entry_price
exitPrice                →  exit_price
riskToReward             →  risk_to_reward
partialsTaken            →  partials_taken
isDeleted                →  is_deleted
isTemporary              →  is_temporary
isPinned                 →  is_pinned
shareLink                →  share_link
isShared                 →  is_shared
sharedAt                 →  shared_at
shareId                  →  share_id
createdAt                →  created_at
updatedAt                →  updated_at
```

## 🔄 Rollback Plan

If something goes wrong, you can rollback:

### Delete Migrated Data
```sql
-- Delete trades
DELETE FROM trades WHERE user_id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688';

-- Delete calendars
DELETE FROM calendars WHERE user_id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688';

-- Delete user (optional)
DELETE FROM users WHERE id = '69054344-5b35-4e7c-85a6-6f0b0d1d0688';
```

### Restore from Backup
Your Firebase data is still intact! The migration only reads from Firebase, it doesn't delete anything.

## ❓ Troubleshooting

### "Missing Supabase credentials"
- Add `REACT_APP_SUPABASE_SERVICE_KEY` to `.env`
- Restart your terminal

### "User already exists"
- This is normal - the script will use the existing user
- No action needed

### "Calendar migration error"
- Check the error message
- Verify data types in Firebase
- Check for missing required fields

### "Trade migration error"
- Verify calendar was migrated successfully
- Check trade data structure in Firebase
- Look for invalid timestamps

## 📞 Next Steps After Migration

1. ✅ Verify all data migrated correctly
2. ✅ Test application functionality
3. ✅ Remove `REACT_APP_SUPABASE_SERVICE_KEY` from `.env` (for security)
4. ✅ Keep Firebase backup files safe
5. ✅ Consider archiving Firebase project (don't delete yet!)

## 🎯 Summary

**You need to:**
1. Get Supabase service_role key from dashboard
2. Add it to `.env` as `REACT_APP_SUPABASE_SERVICE_KEY`
3. Run `node scripts/export-firestore-data.js` (backup)
4. Run `node scripts/migrate-firestore-data.js` (migrate)
5. Verify data in Supabase dashboard
6. Test in application

**All data will be assigned to:** `69054344-5b35-4e7c-85a6-6f0b0d1d0688`

Ready to proceed? Let me know when you have the service_role key and I'll help you run the migration! 🚀

