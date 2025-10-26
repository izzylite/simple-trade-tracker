-- Migration: Change user_id from custom UUID to Supabase auth.uid()
-- This migration updates all tables to use firebase_uid (Supabase auth ID) instead of custom user ID

-- =====================================================
-- STEP 0: Drop all RLS policies first (they depend on user_id columns)
-- =====================================================

-- Drop calendar policies
DROP POLICY IF EXISTS "Users can view own calendars" ON calendars;
DROP POLICY IF EXISTS "Users can create own calendars" ON calendars;
DROP POLICY IF EXISTS "Users can update own calendars" ON calendars;
DROP POLICY IF EXISTS "Users can delete own calendars" ON calendars;

-- Drop trade policies
DROP POLICY IF EXISTS "Users can view own trades" ON trades;
DROP POLICY IF EXISTS "Users can create own trades" ON trades;
DROP POLICY IF EXISTS "Users can update own trades" ON trades;
DROP POLICY IF EXISTS "Users can delete own trades" ON trades;

-- Drop shared_calendars policies
DROP POLICY IF EXISTS "Users can view own shared calendars" ON shared_calendars;
DROP POLICY IF EXISTS "Users can create own shared calendars" ON shared_calendars;
DROP POLICY IF EXISTS "Users can update own shared calendars" ON shared_calendars;
DROP POLICY IF EXISTS "Users can delete own shared calendars" ON shared_calendars;

-- Drop shared_trades policies
DROP POLICY IF EXISTS "Users can view own shared trades" ON shared_trades;
DROP POLICY IF EXISTS "Users can create own shared trades" ON shared_trades;
DROP POLICY IF EXISTS "Users can update own shared trades" ON shared_trades;
DROP POLICY IF EXISTS "Users can delete own shared trades" ON shared_trades;

-- =====================================================
-- STEP 1: Update calendars table
-- =====================================================

-- Add temporary column for new user_id
ALTER TABLE calendars ADD COLUMN new_user_id TEXT;

-- Populate new_user_id with firebase_uid from users table
UPDATE calendars c
SET new_user_id = u.firebase_uid
FROM users u
WHERE c.user_id = u.id;

-- Drop old foreign key constraint
ALTER TABLE calendars DROP CONSTRAINT calendars_user_id_fkey;

-- Drop old user_id column
ALTER TABLE calendars DROP COLUMN user_id;

-- Rename new_user_id to user_id
ALTER TABLE calendars RENAME COLUMN new_user_id TO user_id;

-- Make user_id NOT NULL
ALTER TABLE calendars ALTER COLUMN user_id SET NOT NULL;

-- =====================================================
-- STEP 2: Update trades table
-- =====================================================

-- Add temporary column for new user_id
ALTER TABLE trades ADD COLUMN new_user_id TEXT;

-- Populate new_user_id with firebase_uid from users table
UPDATE trades t
SET new_user_id = u.firebase_uid
FROM users u
WHERE t.user_id = u.id;

-- Drop old foreign key constraint
ALTER TABLE trades DROP CONSTRAINT trades_user_id_fkey;

-- Drop old user_id column
ALTER TABLE trades DROP COLUMN user_id;

-- Rename new_user_id to user_id
ALTER TABLE trades RENAME COLUMN new_user_id TO user_id;

-- Make user_id NOT NULL
ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;

-- =====================================================
-- STEP 3: Update shared_calendars table
-- =====================================================

-- Add temporary column for new user_id
ALTER TABLE shared_calendars ADD COLUMN new_user_id TEXT;

-- Populate new_user_id with firebase_uid from users table
UPDATE shared_calendars sc
SET new_user_id = u.firebase_uid
FROM users u
WHERE sc.user_id = u.id;

-- Drop old foreign key constraint
ALTER TABLE shared_calendars DROP CONSTRAINT shared_calendars_user_id_fkey;

-- Drop old user_id column
ALTER TABLE shared_calendars DROP COLUMN user_id;

-- Rename new_user_id to user_id
ALTER TABLE shared_calendars RENAME COLUMN new_user_id TO user_id;

-- Make user_id NOT NULL
ALTER TABLE shared_calendars ALTER COLUMN user_id SET NOT NULL;

-- =====================================================
-- STEP 4: Update shared_trades table
-- =====================================================

-- Add temporary column for new user_id
ALTER TABLE shared_trades ADD COLUMN new_user_id TEXT;

-- Populate new_user_id with firebase_uid from users table
UPDATE shared_trades st
SET new_user_id = u.firebase_uid
FROM users u
WHERE st.user_id = u.id;

-- Drop old foreign key constraint
ALTER TABLE shared_trades DROP CONSTRAINT shared_trades_user_id_fkey;

-- Drop old user_id column
ALTER TABLE shared_trades DROP COLUMN user_id;

-- Rename new_user_id to user_id
ALTER TABLE shared_trades RENAME COLUMN new_user_id TO user_id;

-- Make user_id NOT NULL
ALTER TABLE shared_trades ALTER COLUMN user_id SET NOT NULL;

-- =====================================================
-- STEP 5: Recreate RLS policies to use auth.uid() directly
-- =====================================================

-- Create new calendar policies using auth.uid() directly
CREATE POLICY "Users can view own calendars" ON calendars
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create own calendars" ON calendars
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own calendars" ON calendars
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own calendars" ON calendars
    FOR DELETE USING (user_id = auth.uid()::text);

-- Create new trade policies using auth.uid() directly
CREATE POLICY "Users can view own trades" ON trades
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create own trades" ON trades
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own trades" ON trades
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own trades" ON trades
    FOR DELETE USING (user_id = auth.uid()::text);

-- Create new shared_calendars policies using auth.uid() directly
CREATE POLICY "Users can view own shared calendars" ON shared_calendars
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create own shared calendars" ON shared_calendars
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own shared calendars" ON shared_calendars
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own shared calendars" ON shared_calendars
    FOR DELETE USING (user_id = auth.uid()::text);

-- Create new shared_trades policies using auth.uid() directly
CREATE POLICY "Users can view own shared trades" ON shared_trades
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create own shared trades" ON shared_trades
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own shared trades" ON shared_trades
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own shared trades" ON shared_trades
    FOR DELETE USING (user_id = auth.uid()::text);

-- =====================================================
-- STEP 6: Update indexes
-- =====================================================

-- Recreate indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_calendars_user_id ON shared_calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_trades_user_id ON shared_trades(user_id);

-- =====================================================
-- NOTES
-- =====================================================
-- After this migration:
-- 1. All user_id columns now store Supabase auth.uid() (TEXT) instead of custom UUID
-- 2. RLS policies now use auth.uid() directly without joining users table
-- 3. Edge functions can compare user_id with user.id from supabase.auth.getUser()
-- 4. The users table is still kept for additional user metadata (display_name, photo_url, etc.)

