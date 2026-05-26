-- Simplify custom-tools observability.
--
-- Drop the per-call log table — at scale it's mostly noise (an elite user
-- with a chatty Orion produces thousands of rows/week) and the only
-- consumer (Recent Activity panel) was overkill for trader-facing UX. The
-- counters we actually need (last_success_at, last_failure_at, last
-- failure reason, consecutive_failures) already live on the row.
--
-- Add two aggregate counters (success_count, failure_count) for the
-- "fired N times, M failed" view shown on the tool card. Wire the counters
-- into bump_custom_tool_counters so every dispatch keeps them current.

drop table if exists public.custom_tool_call_log cascade;

alter table public.custom_tools
  add column if not exists success_count int not null default 0,
  add column if not exists failure_count int not null default 0;

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
  v_recent_disable_notification_exists boolean := false;
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

  if not v_prev_enabled then
    return query select false::boolean, v_prev_failures, false::boolean;
    return;
  end if;

  if p_success then
    update public.custom_tools
       set consecutive_failures = 0,
           last_success_at = now(),
           success_count = success_count + 1
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
           failure_count = failure_count + 1,
           is_enabled = false,
           disabled_at = now(),
           disabled_reason = 'auto_disabled_consecutive_failures'
     where id = p_tool_id;

    v_just_disabled := true;

    select exists (
      select 1 from public.notifications
      where user_id = v_user_id
        and type = 'orion_custom_tool_disabled'
        and (payload->>'tool_id')::uuid = p_tool_id
        and created_at > now() - interval '24 hours'
    ) into v_recent_disable_notification_exists;

    if not v_recent_disable_notification_exists then
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
    end if;
  else
    update public.custom_tools
       set consecutive_failures = v_new_failures,
           last_failure_at = now(),
           last_failure_reason = left(coalesce(p_failure_reason, 'unknown'), 1024),
           failure_count = failure_count + 1
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

-- Update the updated_at trigger guard so the new counters DON'T bump
-- updated_at (same rule as the existing internal counters — bumping it
-- would invalidate the read-only response cache on every success).
create or replace function public.custom_tools_set_updated_at()
returns trigger language plpgsql as $$
begin
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
