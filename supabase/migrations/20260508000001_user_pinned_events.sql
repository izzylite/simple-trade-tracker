-- Migration: Move pinned_events from per-calendar to per-user
-- Adds users.pinned_events JSONB column, backfills from existing calendar pins
-- (deduped by event_id, most recent calendar wins), and adjusts the users
-- RLS policies so the column is readable / updatable by its owner.
--
-- Existing calendars.pinned_events column is left in place for read-back
-- compatibility while the client migrates; nothing writes to it after this.

-- =====================================================
-- 1. Add column
-- =====================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pinned_events JSONB NOT NULL DEFAULT '[]'::jsonb;

-- =====================================================
-- 2. Backfill from calendars.pinned_events
--    Deduplicate per (user_id, event_id), preferring the entry from the
--    most recently updated calendar so any notes captured against the pin
--    survive the merge.
-- =====================================================
WITH all_pins AS (
  SELECT
    c.user_id,
    pe ->> 'event_id' AS event_id,
    pe              AS payload,
    ROW_NUMBER() OVER (
      PARTITION BY c.user_id, pe ->> 'event_id'
      ORDER BY c.updated_at DESC NULLS LAST
    ) AS rn
  FROM calendars c
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.pinned_events, '[]'::jsonb)) pe
  WHERE c.deleted_at IS NULL
    AND pe ->> 'event_id' IS NOT NULL
),
deduped AS (
  SELECT user_id, jsonb_agg(payload ORDER BY (payload ->> 'event_id')) AS events
  FROM all_pins
  WHERE rn = 1
  GROUP BY user_id
)
UPDATE users u
SET pinned_events = COALESCE(d.events, '[]'::jsonb)
FROM deduped d
WHERE u.id::text = d.user_id
  AND (u.pinned_events IS NULL OR u.pinned_events = '[]'::jsonb);

-- =====================================================
-- 3. RLS: ensure the owner can read & update pinned_events.
--    Earlier policies matched on firebase_uid; that column is no longer
--    populated for new auth signups (supabaseAuthService upserts only `id`).
--    Replace with auth.uid() comparison against `id` so both legacy and
--    fresh users authorize correctly.
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- 4. Realtime: include the users table so pinned_events updates broadcast
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'users'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE users';
  END IF;
END $$;

COMMENT ON COLUMN users.pinned_events IS
  'User-level pinned economic events. Replaces calendars.pinned_events. '
  'Schema: PinnedEvent[] (event, event_id, notes?, impact?, currency?, flag_url?, country?).';
