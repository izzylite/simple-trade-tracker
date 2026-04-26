-- Adds rotation/backoff state to api_keys for the search-provider key pool.
-- Strips the leaked default token from the `key` column (was visible in
-- pg_attrdef + migration dumps). Locks the table down to service_role only.

BEGIN;

-- 1. Strip the leaked default and enforce NOT NULL on identity columns.
ALTER TABLE public.api_keys
  ALTER COLUMN key DROP DEFAULT,
  ALTER COLUMN key SET NOT NULL,
  ALTER COLUMN source SET NOT NULL;

-- 2. Add rotation state.
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consecutive_failures int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_reason text;

-- 3. Pickable-keys index: NULLS FIRST puts never-used / never-failed keys at
-- the front; ordering by last_used_at after that gives round-robin.
CREATE INDEX IF NOT EXISTS api_keys_pickable_idx
  ON public.api_keys (source, next_retry_at NULLS FIRST, last_used_at NULLS FIRST)
  WHERE disabled = false;

-- 4. RLS: deny all by default; service_role bypasses RLS so edge functions
-- using the service key keep full access. No anon/authenticated policies =
-- table is invisible to client SDKs.
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies that may have been added during exploration.
DROP POLICY IF EXISTS "api_keys_read" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_write" ON public.api_keys;

COMMIT;
