-- Trigger: when inserting a calendar, reject if the user is free-tier and
-- already owns one. Service-role inserts (e.g. data migrations) bypass via
-- session variable.
create or replace function public.enforce_calendar_count_by_tier()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_tier text;
  v_count int;
begin
  -- Bypass for service-role data ops (set the GUC before the insert).
  if current_setting('app.skip_calendar_tier_gate', true) = 'true' then
    return new;
  end if;

  select tier into v_tier
    from public.subscriptions
    where user_id::text = new.user_id;

  -- Default to free if the user has no row yet (shouldn't happen after Task 2).
  v_tier := coalesce(v_tier, 'free');
  if v_tier != 'free' then
    return new;
  end if;

  select count(*) into v_count
    from public.calendars
    where user_id = new.user_id
      and deleted_at is null;
  if v_count >= 1 then
    raise exception 'tier_limit_calendars' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Defense in depth: this is a trigger function (no client need execute it).
revoke all on function public.enforce_calendar_count_by_tier() from public, anon, authenticated;

create trigger trg_enforce_calendar_count
  before insert on public.calendars
  for each row execute function public.enforce_calendar_count_by_tier();
