-- Change acquire_api_key from LRU round-robin to "drain one key at a time."
--
-- Background: the prior ORDER BY (next_retry_at NULLS FIRST, last_used_at
-- NULLS FIRST) was least-recently-used round-robin. Under parallel load
-- (multiple Edge Function invocations in the same second), SKIP LOCKED caused
-- callers to fan out across every healthy key simultaneously. From Tavily's
-- perspective this looks like N dev-tier accounts hitting their API from a
-- single Supabase egress IP at the same moments — the exact pattern their
-- anti-abuse system flags, and 6 of our 10 keys had been auto-deactivated
-- with auth_401 as a result.
--
-- New ORDER BY (k.id ASC) pins selection to the lowest-id healthy key until
-- it 432s (markQuotaExhausted sets next_retry_at, removing it from the
-- candidate set), then falls through to the next id. Traffic to each provider
-- now looks like one customer using one key heavily — indistinguishable from
-- normal usage.
--
-- The rest of the function (SKIP LOCKED concurrency, last_used_at bump,
-- SECURITY DEFINER) is unchanged.

CREATE OR REPLACE FUNCTION public.acquire_api_key(p_source text)
RETURNS TABLE(acquired_id bigint, acquired_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
  v_key text;
BEGIN
  SELECT k.id, k.key INTO v_id, v_key
  FROM public.api_keys k
  WHERE k.source = p_source
    AND k.disabled = false
    AND (k.next_retry_at IS NULL OR k.next_retry_at <= now())
  ORDER BY k.id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_id;

  RETURN QUERY SELECT v_id, v_key;
END;
$function$;
