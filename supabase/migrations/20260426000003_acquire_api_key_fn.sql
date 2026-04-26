-- Atomic key reservation: pick the most-eligible row, mark it used, return it.
-- SKIP LOCKED ensures concurrent callers get different keys instead of blocking.
-- SECURITY DEFINER so service_role can call it; we lock function ownership down
-- via REVOKE/GRANT below.
--
-- DROP FUNCTION first because the OUT-parameter names were renamed
-- (id/key -> acquired_id/acquired_key) to avoid shadowing api_keys.id inside
-- the function body. Postgres treats a change in OUT param names/types as a
-- return-type change, which CREATE OR REPLACE refuses.

DROP FUNCTION IF EXISTS public.acquire_api_key(text);

CREATE OR REPLACE FUNCTION public.acquire_api_key(p_source text)
RETURNS TABLE(acquired_id bigint, acquired_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_key text;
BEGIN
  SELECT k.id, k.key INTO v_id, v_key
  FROM public.api_keys k
  WHERE k.source = p_source
    AND k.disabled = false
    AND (k.next_retry_at IS NULL OR k.next_retry_at <= now())
  ORDER BY k.next_retry_at NULLS FIRST, k.last_used_at NULLS FIRST
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;  -- empty result set: no keys available
  END IF;

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_id;

  RETURN QUERY SELECT v_id, v_key;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_api_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_api_key(text) TO service_role;
