-- Single-flight coordination for fetch-mql5-event
-- See docs/superpowers/specs/2026-04-16-single-flight-mql5-sync-design.md

create table if not exists public.mql5_sync_locks (
  event_key   text        primary key,
  locked_at   timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.mql5_sync_locks enable row level security;
-- No policies: service_role bypasses RLS; everyone else is denied.

comment on table public.mql5_sync_locks is
  'Lease-based locks serializing fetch-mql5-event invocations per event. Rows self-expire via expires_at; no GC needed.';

-- Runs as `security invoker` (default). Only `service_role` is granted
-- execute below; if that ever changes, the RLS-with-no-policies design
-- will block the function — revisit then.
-- Acquire: returns true iff this caller took the lock.
create or replace function public.try_acquire_mql5_sync_lock(
  p_event_name    text,
  p_country       text,
  p_lease_seconds int default 30
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_key    text;
  v_got_it boolean;
begin
  v_key := lower(p_event_name) || '|' || lower(p_country);

  with ins as (
    insert into public.mql5_sync_locks (event_key, locked_at, expires_at)
    values (v_key, now(), now() + make_interval(secs => p_lease_seconds))
    on conflict (event_key) do update
      set locked_at  = excluded.locked_at,
          expires_at = excluded.expires_at
      where mql5_sync_locks.expires_at < now()
    returning 1
  )
  select exists(select 1 from ins) into v_got_it;

  return v_got_it;
end;
$$;

-- Release: idempotent delete.
create or replace function public.release_mql5_sync_lock(
  p_event_name text,
  p_country    text
) returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.mql5_sync_locks
  where event_key = lower(p_event_name) || '|' || lower(p_country);
end;
$$;

grant execute on function public.try_acquire_mql5_sync_lock(text, text, int) to service_role;
grant execute on function public.release_mql5_sync_lock(text, text)          to service_role;
