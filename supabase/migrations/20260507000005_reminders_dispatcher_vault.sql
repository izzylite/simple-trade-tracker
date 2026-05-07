-- Move reminders dispatcher secret from inline pg_cron command into Supabase Vault.
--
-- Background: postgres logs every cron job's command text on each run.
-- Migration 20260501000002 stored the X-Reminders-Dispatcher-Secret as a
-- literal inside the cron command, causing the secret to appear in
-- plain text inside `cron job 21 starting:` log entries (visible to
-- anyone with project log access).
--
-- New design:
--   * Secret stored encrypted in `vault.secrets` (rotated to a fresh
--     random value as part of this migration — the previous secret is
--     burned).
--   * `public.dispatch_reminders_call()` is a SECURITY DEFINER function
--     that reads the decrypted secret and issues `net.http_post`. Only
--     the postgres role can EXECUTE it; the source code reveals only the
--     vault lookup, not the secret value.
--   * pg_cron job body becomes the single line
--     `SELECT public.dispatch_reminders_call();` — nothing sensitive in
--     command text any more.
--
-- Operator action required AFTER applying this migration:
--   1. Read the new secret:
--        SELECT decrypted_secret
--        FROM vault.decrypted_secrets
--        WHERE name = 'reminders_dispatcher_secret';
--   2. Set the edge function env var to the same value:
--        supabase secrets set REMINDERS_DISPATCHER_SECRET=<value>
--      (or via Supabase dashboard → Project → Settings → Edge Functions).
--   3. Until step 2 lands, the dispatcher will return 401. The browser
--      local timer keeps firing reminders, so missed-fire risk stays low.

-- 1. Rotate the secret in vault. Drop any existing entry first so
--    re-running the migration produces a fresh random value (and burns
--    the leaked one if it was previously inserted manually).
DELETE FROM vault.secrets WHERE name = 'reminders_dispatcher_secret';

SELECT vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'reminders_dispatcher_secret',
  'Shared secret for pg_cron → dispatch-reminders edge function. Rotate by re-running this migration; then update the REMINDERS_DISPATCHER_SECRET edge-function env var to match.'
);

-- 2. SECURITY DEFINER wrapper. Reads the decrypted secret inside the
--    function body and POSTs via pg_net. Postgres logs the function
--    call, not its internals.
CREATE OR REPLACE FUNCTION public.dispatch_reminders_call()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret
  INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'reminders_dispatcher_secret';

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'reminders_dispatcher_secret missing from vault';
  END IF;

  SELECT net.http_post(
    url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/dispatch-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Reminders-Dispatcher-Secret', v_secret
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Lock down: only postgres (the role pg_cron runs as) may invoke it.
REVOKE ALL ON FUNCTION public.dispatch_reminders_call() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_reminders_call() FROM authenticated;
REVOKE ALL ON FUNCTION public.dispatch_reminders_call() FROM anon;
GRANT EXECUTE ON FUNCTION public.dispatch_reminders_call() TO postgres;

-- 3. Replace the cron command body. Unschedule the existing job so the
--    leaked secret literal stops being re-logged each minute.
SELECT cron.unschedule('reminders-dispatcher')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminders-dispatcher');

SELECT cron.schedule(
  'reminders-dispatcher',
  '*/5 * * * *',
  $$ SELECT public.dispatch_reminders_call(); $$
);

COMMENT ON FUNCTION public.dispatch_reminders_call() IS
'Reads X-Reminders-Dispatcher-Secret from vault, POSTs to dispatch-reminders
edge function. Called by pg_cron job `reminders-dispatcher` every 5 min.';
