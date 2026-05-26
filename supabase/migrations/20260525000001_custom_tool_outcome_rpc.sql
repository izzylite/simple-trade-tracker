-- Phase 3b of the custom-tools-via-webhook feature.
--
-- Atomic outcome accounting: a single RPC updates the custom_tools row
-- counters AND triggers auto-disable + notification when consecutive
-- failures cross the threshold. Atomic because Gemini parallel-fires
-- tools within a single turn — two failing calls racing on a non-atomic
-- read-modify-write would under-count or skip the disable threshold.
--
-- Caller signature:
--   select * from bump_custom_tool_counters(
--     p_tool_id  := <uuid>,
--     p_success  := <bool>,
--     p_failure_reason := <text|null>
--   );
--
-- Returns one row: (is_enabled, consecutive_failures, was_just_disabled).
-- was_just_disabled = true only on the transition turn so the caller
-- can choose to surface the auto-disable inline to Orion.

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
declare
  v_user_id uuid;
  v_tool_name text;
  v_prev_failures int;
  v_new_failures int;
  v_prev_enabled boolean;
  v_just_disabled boolean := false;
begin
  -- Lock the row for the duration of the txn so parallel dispatchers
  -- serialize on the increment.
  select user_id, name, consecutive_failures, is_enabled
    into v_user_id, v_tool_name, v_prev_failures, v_prev_enabled
    from public.custom_tools
    where id = p_tool_id
    for update;

  if v_user_id is null then
    -- Tool was deleted between dispatch + outcome. Return a stub row;
    -- the caller logs the discrepancy via custom_tool_call_log.
    return query select false::boolean, 0::int, false::boolean;
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

  -- Failure path. Increment, stamp, and check the auto-disable threshold.
  v_new_failures := v_prev_failures + 1;

  if v_new_failures >= 10 and v_prev_enabled then
    update public.custom_tools
       set consecutive_failures = v_new_failures,
           last_failure_at = now(),
           last_failure_reason = left(coalesce(p_failure_reason, 'unknown'), 1024),
           is_enabled = false,
           disabled_at = now(),
           disabled_reason = 'auto_disabled_consecutive_failures'
     where id = p_tool_id;

    v_just_disabled := true;

    -- Notification row — surfaces in the user's notifications panel.
    -- Capped trigger on the notifications table keeps total bounded.
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
