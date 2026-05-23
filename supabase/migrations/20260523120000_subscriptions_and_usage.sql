-- File: supabase/migrations/20260523120000_subscriptions_and_usage.sql

-- =====================================================
-- subscriptions: source of truth for paid status, synced from Paddle webhook
-- =====================================================
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('free', 'lite', 'pro', 'elite')) default 'free',
  status text not null check (status in ('active', 'trialing', 'paused', 'past_due', 'cancelled')) default 'active',
  billing_cycle text check (billing_cycle in ('monthly', 'annual')),
  paddle_subscription_id text unique,
  paddle_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_paddle_sub on public.subscriptions(paddle_subscription_id)
  where paddle_subscription_id is not null;
create index idx_subscriptions_nonactive on public.subscriptions(status) where status != 'active';

-- =====================================================
-- orion_usage_periods: per-billing-period token accounting for Orion
-- =====================================================
create table public.orion_usage_periods (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  tokens_consumed bigint not null default 0,
  tokens_budget bigint not null,
  tier_at_period_start text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

create index idx_orion_usage_current on public.orion_usage_periods(user_id, period_end desc);

-- =====================================================
-- RLS
-- =====================================================
alter table public.subscriptions enable row level security;
alter table public.orion_usage_periods enable row level security;

create policy subscriptions_user_select on public.subscriptions
  for select using (auth.uid() = user_id);

create policy orion_usage_user_select on public.orion_usage_periods
  for select using (auth.uid() = user_id);

-- =====================================================
-- updated_at trigger on subscriptions
-- =====================================================
create or replace function public.subscriptions_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.subscriptions_set_updated_at();

-- =====================================================
-- RPC: atomic token increment (called from ai-trading-agent after each Gemini round)
-- Returns the new tokens_consumed value (caller compares against budget itself).
-- Creates a row for the current period if none exists.
-- =====================================================
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

  v_budget := case v_tier
    when 'lite' then 500000
    when 'pro' then 2500000
    when 'elite' then 12500000
    else 0
  end;

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

revoke all on function public.increment_orion_tokens(uuid, bigint) from public;
grant execute on function public.increment_orion_tokens(uuid, bigint) to service_role;
