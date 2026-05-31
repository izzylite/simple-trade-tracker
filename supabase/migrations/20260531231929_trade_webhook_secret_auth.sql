-- Authenticate the trade webhook with a shared secret.
--
-- handle-trade-changes is verify_jwt=false (a DB webhook can't present a JWT), so
-- without a secret it is an unauthenticated, internet-reachable, service-role
-- endpoint. This makes notify_trade_changes() send a shared secret
-- (`trade_webhook_secret`, stored in Vault) as the `X-Trade-Webhook-Secret`
-- header; the edge function rejects requests that don't match. Mirrors the
-- dispatch_reminders_call / paddle-webhook pattern.
--
-- The old `Authorization: Bearer <service_role_key>` header is dropped: it read
-- `app.settings.service_role_key`, which is NULL on this project (it fell back to
-- the request JWT sub), so it never authenticated anything.
--
-- SAFETY: if the Vault secret is missing this RAISES WARNING and skips the webhook
-- (returns normally) rather than RAISE EXCEPTION — a trigger that errors would
-- block the trade write itself. A skipped recompute is backstopped by the
-- year-stats reconciliation sweep, so stats still converge.
--
-- Provision the Vault secret BEFORE applying this migration:
--   select vault.create_secret('<value>', 'trade_webhook_secret');
-- and set the matching edge env: supabase secrets set TRADE_WEBHOOK_SECRET=<value>

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
  -- They are responsible for triggering one explicit recompute after their work.
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
