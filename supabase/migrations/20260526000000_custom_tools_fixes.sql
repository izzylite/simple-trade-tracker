-- Custom-tools post-ship fixes (review punch-list 2026-05-26).
--
-- Three CRITICAL issues from the multi-angle review:
--
-- 1. updated_at trigger was unconditional — fired on EVERY UPDATE including
--    bump_custom_tool_counters' last_success_at writes. Runtime cache key
--    embeds updated_at, so the read-only cache invalidated on every
--    successful call (effectively dead). Scope the trigger to user-facing
--    field changes only.
--
-- 2. custom_tool_call_log.status CHECK constraint was missing 'cache_hit'
--    and 'rate_limited' even though runtime emits both. Every cache hit +
--    rate-limit insert hit 23514 and was silently swallowed by logCall's
--    catch — activity panel was missing the two most common "didn't fire"
--    outcomes.
--
-- 3. bump_custom_tool_counters had no early-return guard for already-
--    disabled tools. The failure branch happily kept incrementing
--    consecutive_failures + writing last_failure_at on disabled rows. The
--    disable-notification branch was gated by v_prev_enabled so no
--    notification spam, but counter pollution + needless writes are real.


-- =====================================================
-- 1. Scope updated_at trigger to user-facing fields only.
-- =====================================================
create or replace function public.custom_tools_set_updated_at()
returns trigger language plpgsql as $$
begin
  -- Only bump updated_at when a field the cache key actually depends on
  -- changes. Internal counter writes (last_success_at, last_failure_at,
  -- consecutive_failures, disabled_at, last_failure_reason) MUST NOT bump
  -- updated_at or runtime.ts's read-only response cache invalidates on
  -- every success.
  if (new.name is distinct from old.name)
     or (new.description is distinct from old.description)
     or (new.args_schema is distinct from old.args_schema)
     or (new.webhook_url is distinct from old.webhook_url)
     or (new.is_read_only is distinct from old.is_read_only)
     or (new.registered_name is distinct from old.registered_name)
     or (new.baseline_sample is distinct from old.baseline_sample) then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end;
$$;


-- =====================================================
-- 2. Extend status CHECK to cover cache_hit + rate_limited.
-- =====================================================
alter table public.custom_tool_call_log
  drop constraint if exists custom_tool_call_log_status_check;

alter table public.custom_tool_call_log
  add constraint custom_tool_call_log_status_check
  check (status in (
    'success',
    'timeout',
    'http_error',
    'invalid_shape',
    'size_exceeded',
    'signature_failed',
    'ssrf_blocked',
    'cache_hit',
    'rate_limited'
  ));


-- =====================================================
-- 3. Add early-return guard for already-disabled tools in
--    bump_custom_tool_counters.
-- =====================================================
create or replace function public.bump_custom_tool_counters(
  p_tool_id uuid,
  p_success boolean,
  p_failure_reason text default null
)
returns table (
  is_enabled boolean,
  consecutive_failures int,
  was_just_disabled boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid;
  v_tool_name text;
  v_prev_failures int;
  v_new_failures int;
  v_prev_enabled boolean;
  v_just_disabled boolean := false;
begin
  select user_id, name, consecutive_failures, is_enabled
    into v_user_id, v_tool_name, v_prev_failures, v_prev_enabled
    from public.custom_tools
    where id = p_tool_id
    for update;

  if v_user_id is null then
    return query select false::boolean, 0::int, false::boolean;
    return;
  end if;

  -- Early-return guard. If the tool is already disabled, do not touch the
  -- counters or stamps — caller already saw the disable state on a previous
  -- turn. Keeps counters bounded + avoids needless writes that would have
  -- triggered updated_at bumps before fix #1.
  if not v_prev_enabled then
    return query select false::boolean, v_prev_failures, false::boolean;
    return;
  end if;

  if p_success then
    update public.custom_tools
       set consecutive_failures = 0,
           last_success_at = now()
     where id = p_tool_id;
    return query select v_prev_enabled, 0, false::boolean;
    return;
  end if;

  v_new_failures := v_prev_failures + 1;

  if v_new_failures >= 10 then
    update public.custom_tools
       set consecutive_failures = v_new_failures,
           last_failure_at = now(),
           last_failure_reason = left(coalesce(p_failure_reason, 'unknown'), 1024),
           is_enabled = false,
           disabled_at = now(),
           disabled_reason = 'auto_disabled_consecutive_failures'
     where id = p_tool_id;

    v_just_disabled := true;

    insert into public.notifications (user_id, type, title, payload)
    values (
      v_user_id,
      'orion_custom_tool_disabled',
      'Custom tool disabled',
      jsonb_build_object(
        'preview', format(
          'Your custom tool "%s" was auto-disabled after 10 consecutive failures. Last error: %s. Re-enable in Orion settings once the webhook is fixed.',
          v_tool_name,
          left(coalesce(p_failure_reason, 'unknown'), 240)
        ),
        'tool_id', p_tool_id,
        'tool_name', v_tool_name,
        'reason', 'auto_disabled_consecutive_failures'
      )
    );
  else
    update public.custom_tools
       set consecutive_failures = v_new_failures,
           last_failure_at = now(),
           last_failure_reason = left(coalesce(p_failure_reason, 'unknown'), 1024)
     where id = p_tool_id;
  end if;

  return query
    select case when v_just_disabled then false else v_prev_enabled end,
           v_new_failures,
           v_just_disabled;
end;
$$;

revoke all on function public.bump_custom_tool_counters(uuid, boolean, text) from public;
grant execute on function public.bump_custom_tool_counters(uuid, boolean, text) to service_role;
