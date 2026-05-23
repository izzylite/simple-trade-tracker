-- File: supabase/migrations/20260523120100_backfill_and_signup_subscription.sql

-- Backfill existing users with a default free-tier subscription row.
insert into public.subscriptions (user_id, tier, status)
select id, 'free', 'active' from auth.users
on conflict (user_id) do nothing;

-- Trigger: on new auth.users insert, create a free-tier subscription row.
create or replace function public.handle_new_user_subscription()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, tier, status)
    values (new.id, 'free', 'active')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Defense in depth: trigger functions don't need client EXECUTE.
revoke all on function public.handle_new_user_subscription() from public, anon, authenticated;

create trigger trg_create_subscription_on_signup
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();
