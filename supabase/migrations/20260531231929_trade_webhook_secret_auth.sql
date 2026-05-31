-- Authenticate the trade webhook with a shared secret.
--
-- handle-trade-changes is verify_jwt=false (a DB webhook can't present a JWT), so
-- without a secret it is an unauthenticated, internet-reachable, service-role
-- endpoint driven by the request body (audit Critical). This migration:
--   1. Provisions a `trade_webhook_secret` in Vault (generated server-side via
--      gen_random_bytes — the value never appears in this file, logs, or env).
--   2. Exposes it to the edge function via a service_role-only RPC
--      (get_trade_webhook_secret). Single source of truth — no env/Vault dual copy
--      to drift.
--   3. Makes notify_trade_changes() send it as the `X-Trade-Webhook-Secret` header.
-- The edge function fetches the expected secret via the RPC and rejects (401)
-- requests whose header doesn't match (constant-time).
--
-- The old `Authorization: Bearer <service_role_key>` header is dropped: it read
-- `app.settings.service_role_key`, which is NULL on this project, so it never
-- authenticated anything.
--
-- SAFETY: if the Vault secret is somehow missing, notify_trade_changes RAISES
-- WARNING and skips the webhook (returns normally) rather than RAISE EXCEPTION — a
-- trigger that errors would block the trade write itself. A skipped recompute is
-- backstopped by the year-stats reconciliation sweep, so stats still converge.

-- 1. Provision the secret in Vault (idempotent; server-side random).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'trade_webhook_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'trade_webhook_secret',
      'Shared secret authenticating the trades -> handle-trade-changes webhook'
    );
  END IF;
END $$;

-- 2. Service-role-only accessor for the edge function.
CREATE OR REPLACE FUNCTION public.get_trade_webhook_secret()
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = ''
AS $function$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'trade_webhook_secret';
$function$;

REVOKE ALL ON FUNCTION public.get_trade_webhook_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trade_webhook_secret() TO service_role;

-- 3. Trigger sends the secret header (and drops the meaningless Bearer header).
CREATE OR REPLACE FUNCTION public.notify_trade_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_payload jsonb;
  v_secret text;
  v_skip text;
  v_url text := 'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/handle-trade-changes';
BEGIN
  -- Bulk operations set this GUC to suppress the per-row webhook flood.
  v_skip := current_setting('app.skip_trade_webhook', true);
  IF v_skip = 'true' THEN
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'trade_webhook_secret';

  IF v_secret IS NULL THEN
    -- Misconfiguration: do NOT block the trade write. The reconciliation sweep
    -- will pick up the missed recompute.
    RAISE WARNING 'trade_webhook_secret missing from vault; skipping handle-trade-changes webhook';
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME, 'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb,
      'calendar_id', OLD.calendar_id, 'user_id', OLD.user_id
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME, 'operation', TG_OP,
      'old_record', row_to_json(OLD)::jsonb, 'new_record', row_to_json(NEW)::jsonb,
      'calendar_id', NEW.calendar_id, 'user_id', NEW.user_id
    );
  ELSIF (TG_OP = 'INSERT') THEN
    v_payload := jsonb_build_object(
      'table', TG_TABLE_NAME, 'operation', TG_OP,
      'new_record', row_to_json(NEW)::jsonb,
      'calendar_id', NEW.calendar_id, 'user_id', NEW.user_id
    );
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Trade-Webhook-Secret', v_secret
    ),
    body := v_payload
  );

  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;
