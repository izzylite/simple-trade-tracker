-- File: supabase/migrations/20260525000000_custom_tools.sql
--
-- Phase 1 of the custom-tools-via-webhook feature
-- (.planning/architecture/custom-tools-webhook.md).
--
-- Tables:
--   * public.custom_tools         — one row per user-registered tool
--   * public.custom_tool_call_log — per-invocation audit + drift detection
--
-- Webhook signing secrets are NOT stored in this table. They live in
-- vault.secrets under the name `custom_tool_secret_<id>` and are read
-- via vault.decrypted_secrets from the dispatch path (service role).
--
-- All writes (insert/update/delete) flow through the edge function with
-- service role — registration needs vault writes + tier enforcement +
-- test-fire orchestration, none of which the anon role can perform.
-- RLS therefore only grants SELECT to the owning user for the UI.

-- =====================================================
-- custom_tools
-- =====================================================
create table public.custom_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- user-visible name, e.g. "squeeze". Validated app-side against
  -- ^[a-z][a-z0-9_]*$, length <= 54 (Gemini cap 64 minus "user_tool_" prefix).
  name text not null check (char_length(name) between 1 and 54
    and name ~ '^[a-z][a-z0-9_]*$'),

  -- what Gemini sees in the tools array, e.g. "user_tool_squeeze".
  -- Materialized to make the unique-per-user constraint explicit.
  registered_name text not null
    check (registered_name = 'user_tool_' || name),

  description text not null check (char_length(description) between 1 and 1024),

  -- JSON Schema for args (the same shape Gemini accepts in function
  -- declarations). Validated app-side before insert.
  args_schema jsonb not null,

  webhook_url text not null check (char_length(webhook_url) between 8 and 2048),

  -- vault secret name. Always 'custom_tool_secret_' || id::text, but
  -- stored explicitly so future naming-scheme changes don't orphan rows.
  secret_vault_key text not null,

  is_read_only boolean not null default false,
  is_enabled boolean not null default true,

  -- Last successful test-fire response. Baseline for shape-drift detection.
  -- Replaced on every successful retest after edit.
  baseline_sample jsonb,

  -- Auto-disable accounting. Resets to 0 on the next successful call.
  consecutive_failures int not null default 0
    check (consecutive_failures >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_failure_reason text,
  disabled_at timestamptz,
  disabled_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, name),
  unique (user_id, registered_name)
);

-- Hot-path lookup: per-turn tool catalog injection reads enabled tools
-- for the authenticated user.
create index idx_custom_tools_user_enabled
  on public.custom_tools(user_id)
  where is_enabled = true;

-- =====================================================
-- custom_tool_call_log
-- =====================================================
-- Detailed per-invocation log. Separate from the general tool-usage
-- logger because custom tools need richer fields (latency, http status,
-- shape drift, redactable args/response) and a longer retention window
-- for user-facing debugging.
create table public.custom_tool_call_log (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.custom_tools(id) on delete cascade,
  user_id uuid not null,
  conversation_id uuid,
  called_at timestamptz not null default now(),

  args jsonb,
  response jsonb,

  status text not null check (status in (
    'success',
    'timeout',
    'http_error',
    'invalid_shape',
    'size_exceeded',
    'signature_failed',
    'ssrf_blocked'
  )),
  latency_ms int check (latency_ms >= 0),
  http_status int,
  shape_drift boolean not null default false,
  error_message text
);

create index idx_custom_tool_call_log_tool_called
  on public.custom_tool_call_log(tool_id, called_at desc);
create index idx_custom_tool_call_log_user_called
  on public.custom_tool_call_log(user_id, called_at desc);

-- =====================================================
-- RLS
-- =====================================================
alter table public.custom_tools enable row level security;
alter table public.custom_tool_call_log enable row level security;

-- Users see their own rows for the settings UI. Writes go through edge
-- functions with service role (registration needs vault + tier check).
create policy custom_tools_user_select on public.custom_tools
  for select using (auth.uid() = user_id);

create policy custom_tool_call_log_user_select on public.custom_tool_call_log
  for select using (auth.uid() = user_id);

-- =====================================================
-- updated_at trigger on custom_tools
-- =====================================================
create or replace function public.custom_tools_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_custom_tools_updated_at
  before update on public.custom_tools
  for each row execute function public.custom_tools_set_updated_at();

-- =====================================================
-- Vault helper RPCs (service_role only)
-- =====================================================
-- create_custom_tool_secret: stores a freshly generated HMAC signing
-- secret for a tool. Caller passes a hex-encoded secret; we wrap the
-- vault.create_secret call so the edge function never holds plaintext
-- in memory longer than needed (it generates → calls → discards).
create or replace function public.create_custom_tool_secret(
  p_tool_id uuid,
  p_secret text
)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_key text := 'custom_tool_secret_' || p_tool_id::text;
begin
  -- Burn any pre-existing entry under this name (idempotent re-register).
  delete from vault.secrets where name = v_key;

  perform vault.create_secret(
    p_secret,
    v_key,
    'HMAC-SHA256 signing secret for custom tool ' || p_tool_id::text
  );

  return v_key;
end;
$$;

revoke all on function public.create_custom_tool_secret(uuid, text) from public;
grant execute on function public.create_custom_tool_secret(uuid, text) to service_role;

-- read_custom_tool_secret: returns the decrypted secret for runtime
-- HMAC signing. Service-role only — the secret never crosses the
-- network unencrypted to non-service-role callers.
create or replace function public.read_custom_tool_secret(
  p_tool_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_key text := 'custom_tool_secret_' || p_tool_id::text;
  v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = v_key
    limit 1;

  return v_secret;
end;
$$;

revoke all on function public.read_custom_tool_secret(uuid) from public;
grant execute on function public.read_custom_tool_secret(uuid) to service_role;

-- delete_custom_tool_secret: called when a tool is deleted (the
-- on-delete-cascade clears the row, but vault entries don't cascade).
create or replace function public.delete_custom_tool_secret(
  p_tool_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_key text := 'custom_tool_secret_' || p_tool_id::text;
begin
  delete from vault.secrets where name = v_key;
end;
$$;

revoke all on function public.delete_custom_tool_secret(uuid) from public;
grant execute on function public.delete_custom_tool_secret(uuid) to service_role;

-- Cascade-clean vault secrets when a custom_tools row is deleted.
create or replace function public.custom_tools_delete_vault_secret()
returns trigger language plpgsql
security definer
set search_path = public, vault
as $$
begin
  delete from vault.secrets where name = 'custom_tool_secret_' || old.id::text;
  return old;
end;
$$;

create trigger trg_custom_tools_vault_cleanup
  before delete on public.custom_tools
  for each row execute function public.custom_tools_delete_vault_secret();
