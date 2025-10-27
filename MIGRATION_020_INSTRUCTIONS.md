# Migration 020: Add economic_events Column to Trades Table

**Date:** October 27, 2025  
**Migration File:** `supabase/migrations/020_add_economic_events_to_trades.sql`

---

## 🎯 **Purpose**

Add the `economic_events` JSONB column to the `trades` table to store economic events data directly with each trade. This fixes the error:

```
Could not find the 'economic_events' column of 'trades' in the schema cache
```

---

## 📋 **Migration Steps**

### **Option 1: Using Supabase Dashboard (Recommended)**

1. **Open Supabase SQL Editor:**
   - Go to your Supabase project dashboard
   - Navigate to **SQL Editor** in the left sidebar
   - Click **New Query**

2. **Copy and paste the migration SQL:**
   ```sql
   -- Add economic_events column to trades table
   -- This stores a denormalized copy of economic events for quick access
   -- The canonical source remains the trade_economic_events junction table
   -- Created: 2025-10-27

   -- =====================================================
   -- ADD ECONOMIC_EVENTS COLUMN
   -- =====================================================
   -- Add JSONB column to store economic events array
   ALTER TABLE trades
   ADD COLUMN IF NOT EXISTS economic_events JSONB DEFAULT '[]'::jsonb;

   -- =====================================================
   -- ADD INDEX FOR ECONOMIC EVENTS QUERIES
   -- =====================================================
   -- Add GIN index for efficient JSONB queries
   CREATE INDEX IF NOT EXISTS idx_trades_economic_events ON trades USING GIN (economic_events);

   -- =====================================================
   -- COMMENTS
   -- =====================================================
   COMMENT ON COLUMN trades.economic_events IS 'Denormalized array of economic events for quick access. Canonical source is trade_economic_events junction table.';
   COMMENT ON INDEX idx_trades_economic_events IS 'GIN index for efficient JSONB queries on economic_events column';
   ```

3. **Run the query:**
   - Click **Run** or press `Ctrl+Enter`
   - Wait for the success message

4. **Verify the migration:**
   - Go to **Table Editor** → **trades** table
   - Verify that the `economic_events` column exists
   - Check that it's of type `jsonb` with default value `[]`

---

### **Option 2: Using Supabase CLI (If Installed)**

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Link your project:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Push the migration:**
   ```bash
   supabase db push
   ```

---

## ✅ **Verification**

After running the migration, verify it worked:

### **1. Check Column Exists**
Run this query in Supabase SQL Editor:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'trades' AND column_name = 'economic_events';
```

**Expected Result:**
```
column_name      | data_type | column_default
-----------------+-----------+----------------
economic_events  | jsonb     | '[]'::jsonb
```

### **2. Check Index Exists**
Run this query:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'trades' AND indexname = 'idx_trades_economic_events';
```

**Expected Result:**
```
indexname                    | indexdef
-----------------------------+--------------------------------------------------
idx_trades_economic_events   | CREATE INDEX idx_trades_economic_events ON...
```

### **3. Test Trade Creation**
Try creating a new trade in your application. The error should be gone!

---

## 🔄 **What This Migration Does**

1. **Adds `economic_events` column:**
   - Type: `JSONB` (JSON Binary)
   - Default: `[]` (empty array)
   - Nullable: Yes
   - Purpose: Store economic events data with each trade

2. **Creates GIN index:**
   - Index name: `idx_trades_economic_events`
   - Type: GIN (Generalized Inverted Index)
   - Purpose: Fast JSONB queries and searches

3. **Adds documentation:**
   - Column comment explaining the purpose
   - Index comment explaining the optimization

---

## 📊 **Data Structure**

The `economic_events` column will store an array of economic event objects:

```json
[
  {
    "name": "Non-Farm Payrolls",
    "flag_code": "US",
    "impact": "High",
    "currency": "USD",
    "time_utc": "13:30"
  },
  {
    "name": "ECB Interest Rate Decision",
    "flag_code": "EU",
    "impact": "High",
    "currency": "EUR",
    "time_utc": "12:45"
  }
]
```

---

## 🔧 **Rollback (If Needed)**

If you need to rollback this migration:

```sql
-- Remove the index
DROP INDEX IF EXISTS idx_trades_economic_events;

-- Remove the column
ALTER TABLE trades DROP COLUMN IF EXISTS economic_events;
```

---

## 📝 **Notes**

- This migration is **safe to run** - it uses `IF NOT EXISTS` clauses
- The column is **nullable** and has a default value, so existing trades won't be affected
- The GIN index will improve query performance for JSONB operations
- This is a **denormalized** copy - the canonical source remains the `trade_economic_events` junction table
- The migration is **idempotent** - you can run it multiple times safely

---

## 🚀 **After Migration**

Once the migration is complete:

1. ✅ Trade creation will work without errors
2. ✅ Economic events will be stored with each trade
3. ✅ You can query trades by economic events efficiently
4. ✅ The application will function normally

---

## 🆘 **Troubleshooting**

### **Error: "permission denied for table trades"**
- Make sure you're using the **service role key** or running the query as a **superuser**
- In Supabase Dashboard, you should have admin access by default

### **Error: "column already exists"**
- The migration has already been run
- This is safe - the `IF NOT EXISTS` clause prevents errors

### **Error: "index already exists"**
- The migration has already been run
- This is safe - the `IF NOT EXISTS` clause prevents errors

---

## 📞 **Support**

If you encounter any issues:
1. Check the Supabase logs in the Dashboard
2. Verify your database connection
3. Ensure you have the correct permissions
4. Try running the SQL statements one at a time

---

**Migration Status:** ⏳ **Pending - Awaiting Manual Execution**

Once you've run the migration, the trade creation error will be resolved! 🎉

