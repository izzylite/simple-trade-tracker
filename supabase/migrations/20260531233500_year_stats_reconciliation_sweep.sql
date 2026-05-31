-- Year-stats reconciliation sweep.
--
-- Backstops year_stats recomputes dropped by the coalescing guard
-- (claim_year_stats_recompute, ~5s window) or by a transient handle-trade-changes
-- failure: the last write in a burst, or a one-off write (esp. DELETE) whose single
-- fire-and-forget webhook errored, can leave calendars.year_stats stale forever with
-- no retry (audit reliability findings). A pg_cron job invokes the reconcile-year-stats
-- edge function, which recomputes any calendar whose latest trade change is newer than
-- its last recompute. Covers the source AND any linked calendar uniformly.

-- 1. Dispatcher secret (Vault, server-side) + service_role-only accessor.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'year_stats_sweep_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'year_stats_sweep_secret',
      'Shared secret authenticating the pg_cron -> reconcile-year-stats sweep'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_year_stats_sweep_secret()
  RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'year_stats_sweep_secret';
$function$;
REVOKE ALL ON FUNCTION public.get_year_stats_sweep_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_year_stats_sweep_secret() TO service_role;

-- 2. Stale-calendar detector. Returns (calendar_id, threshold) where threshold is the
--    max trades.updated_at captured atomically — the edge fn stamps it post-recompute
--    so a later write keeps a newer updated_at and is re-detected next sweep.
CREATE OR REPLACE FUNCTION public.find_stale_year_stats_calendars(p_limit int DEFAULT 100)
  RETURNS TABLE(calendar_id uuid, threshold timestamptz)
  LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT c.id, m.max_updated
  FROM public.calendars c
  CROSS JOIN LATERAL (
    SELECT max(t.updated_at) AS max_updated FROM public.trades t WHERE t.calendar_id = c.id
  ) m
  WHERE c.deleted_at IS NULL
    AND m.max_updated IS NOT NULL
    AND m.max_updated > COALESCE(c.year_stats_last_recomputed_at, '-infinity'::timestamptz)
  ORDER BY c.year_stats_last_recomputed_at ASC NULLS FIRST
  LIMIT p_limit;
$function$;
REVOKE ALL ON FUNCTION public.find_stale_year_stats_calendars(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_stale_year_stats_calendars(int) TO service_role;

-- 3. Cron wrapper: read Vault secret, POST to the edge function with the secret header.
CREATE OR REPLACE FUNCTION public.year_stats_sweep_call()
  RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'year_stats_sweep_secret';
  IF v_secret IS NULL THEN
    RAISE WARNING 'year_stats_sweep_secret missing from vault; skipping sweep';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/reconcile-year-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Year-Stats-Sweep-Secret', v_secret
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$function$;

-- 4. Schedule it every 5 minutes (idempotent: unschedule any prior job of this name).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'year-stats-sweep') THEN
    PERFORM cron.unschedule('year-stats-sweep');
  END IF;
  PERFORM cron.schedule('year-stats-sweep', '*/5 * * * *', 'SELECT public.year_stats_sweep_call();');
END $$;
