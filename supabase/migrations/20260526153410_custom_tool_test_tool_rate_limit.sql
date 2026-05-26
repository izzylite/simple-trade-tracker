-- Per-user rate limit for the `test_tool` action.
--
-- The in-process rate counter in runtime.ts is per-isolate. Supabase
-- Edge Functions spread requests across isolates, so the 20/conv cap can
-- be bypassed by a scripted attacker spamming test_tool — each call
-- runs a vault read + counter bump RPC + outbound 5s fetch. At elite
-- scale this is a six-figure-RPC/min self-DoS amplifier. This table +
-- function gives us a durable per-user sliding-window cap.
--
-- Window: 60s. Max: 5 fires/window. Suggested HTTP response: 429 with
-- Retry-After.

create table if not exists public.custom_tool_test_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count int not null default 0
);

alter table public.custom_tool_test_rate_limits enable row level security;
-- Service-role-only writes; no policy = denied for non-service callers.

create or replace function public.check_and_bump_test_tool_limit(
  p_user_id uuid
)
returns table (
  allowed boolean,
  retry_after_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_window_seconds int := 60;
  v_max int := 5;
  v_window_start timestamptz;
  v_count int;
begin
  -- Atomic upsert: roll the window if expired, else increment in place.
  insert into public.custom_tool_test_rate_limits (user_id, window_start, count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
  set
    window_start = case
      when custom_tool_test_rate_limits.window_start
           < now() - make_interval(secs => v_window_seconds)
        then excluded.window_start
      else custom_tool_test_rate_limits.window_start
    end,
    count = case
      when custom_tool_test_rate_limits.window_start
           < now() - make_interval(secs => v_window_seconds)
        then 1
      else custom_tool_test_rate_limits.count + 1
    end
  returning window_start, count into v_window_start, v_count;

  if v_count > v_max then
    return query select
      false::boolean,
      greatest(
        1,
        v_window_seconds - extract(epoch from (now() - v_window_start))::int
      )::int;
    return;
  end if;

  return query select true::boolean, 0;
end;
$$;

revoke all on function public.check_and_bump_test_tool_limit(uuid) from public;
grant execute on function public.check_and_bump_test_tool_limit(uuid) to service_role;
