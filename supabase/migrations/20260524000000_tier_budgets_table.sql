-- Single source of truth for the per-tier monthly Orion token budgets.
-- Previously hardcoded in increment_orion_tokens (SQL) AND useOrionUsage (TS).
-- Both now read from this table.

create table public.tier_budgets (
  tier text primary key check (tier in ('free', 'lite', 'pro', 'elite')),
  tokens_budget bigint not null
);

insert into public.tier_budgets (tier, tokens_budget) values
  ('free', 0),
  ('lite', 500000),
  ('pro', 2500000),
  ('elite', 12500000);

comment on table public.tier_budgets is
  'Per-tier monthly Orion token budgets. Adjust server-side based on COGS without changing the pricing page (multipliers stay implicit). Read by increment_orion_tokens RPC and the client useOrionUsage hook.';

-- RLS: authenticated users can read (used by the client to render usage rings).
-- No INSERT/UPDATE/DELETE policies — writes happen via migrations only.
alter table public.tier_budgets enable row level security;
create policy tier_budgets_read on public.tier_budgets
  for select to authenticated using (true);

-- Rewrite increment_orion_tokens to read from tier_budgets instead of CASE.
create or replace function public.increment_orion_tokens(
  p_user_id uuid,
  p_tokens bigint
)
returns table (consumed bigint, budget bigint, period_end timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_budget bigint;
  v_tier text;
  v_consumed bigint;
begin
  select s.current_period_start, s.current_period_end, s.tier
    into v_period_start, v_period_end, v_tier
    from public.subscriptions s
    where s.user_id = p_user_id and s.status = 'active';

  if v_period_start is null or v_period_end is null then
    v_period_start := date_trunc('month', v_now);
    v_period_end := v_period_start + interval '1 month';
    v_tier := coalesce(v_tier, 'free');
  end if;

  -- Single source: read budget from tier_budgets lookup table.
  select tokens_budget into v_budget
    from public.tier_budgets
    where tier = v_tier;
  v_budget := coalesce(v_budget, 0);

  insert into public.orion_usage_periods
    (user_id, period_start, period_end, tokens_consumed, tokens_budget, tier_at_period_start)
  values
    (p_user_id, v_period_start, v_period_end, p_tokens, v_budget, v_tier)
  on conflict (user_id, period_start) do update
    set tokens_consumed = orion_usage_periods.tokens_consumed + excluded.tokens_consumed
  returning orion_usage_periods.tokens_consumed, orion_usage_periods.tokens_budget, orion_usage_periods.period_end
    into v_consumed, v_budget, v_period_end;

  return query select v_consumed, v_budget, v_period_end;
end;
$$;

-- Re-apply the revoke-from-anon-authenticated lockdown (Supabase default-grant quirk;
-- create or replace resets the ACL to defaults).
revoke all on function public.increment_orion_tokens(uuid, bigint) from public, anon, authenticated;
grant execute on function public.increment_orion_tokens(uuid, bigint) to service_role;
