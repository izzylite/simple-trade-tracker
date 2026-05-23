import { createServiceClient } from './supabase.ts';

export type Tier = 'free' | 'lite' | 'pro' | 'elite';

export interface TierGateResult {
  allowed: boolean;
  tier: Tier;
  reason?: 'orion_paid_only' | 'orion_budget_exhausted';
  resetAt?: string;
  tokensConsumed?: number;
  tokensBudget?: number;
}

const PAID_TIERS: ReadonlySet<Tier> = new Set(['lite', 'pro', 'elite']);

/**
 * Check whether a user is allowed to consume Orion. Does NOT increment;
 * the caller increments after each Gemini round via incrementOrionTokens().
 */
export async function checkOrionAccess(userId: string): Promise<TierGateResult> {
  const client = createServiceClient();

  const { data: sub, error: subErr } = await client
    .from('subscriptions')
    .select('tier, status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (subErr) {
    // Fail closed — if we can't read the row, treat as free.
    return { allowed: false, tier: 'free', reason: 'orion_paid_only' };
  }

  const tier = ((sub?.tier as Tier | undefined) ?? 'free');
  const status = sub?.status ?? 'active';

  // Treat past_due and paused like paid — they still have access until period_end
  // per the spec; Paddle handles dunning. Cancelled is the only revoke state,
  // and only if past period_end (cancel_at_period_end keeps access until then).
  const isPaid = PAID_TIERS.has(tier) && (status === 'active' || status === 'trialing' || status === 'past_due');

  if (!isPaid) {
    return { allowed: false, tier, reason: 'orion_paid_only' };
  }

  // Budget check — read current period row.
  const { data: usage, error: usageErr } = await client
    .from('orion_usage_periods')
    .select('tokens_consumed, tokens_budget, period_end')
    .eq('user_id', userId)
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (usageErr) {
    return { allowed: true, tier }; // accounting row will be created on first increment
  }

  if (usage && usage.tokens_consumed >= usage.tokens_budget) {
    return {
      allowed: false,
      tier,
      reason: 'orion_budget_exhausted',
      resetAt: usage.period_end,
      tokensConsumed: usage.tokens_consumed,
      tokensBudget: usage.tokens_budget,
    };
  }

  return {
    allowed: true,
    tier,
    tokensConsumed: usage?.tokens_consumed,
    tokensBudget: usage?.tokens_budget,
  };
}

/**
 * Atomic token increment via SQL RPC. Returns the post-increment consumed/budget.
 */
export async function incrementOrionTokens(
  userId: string,
  tokens: number
): Promise<{ consumed: number; budget: number; periodEnd: string } | null> {
  if (tokens <= 0) return null;
  const client = createServiceClient();
  const { data, error } = await client.rpc('increment_orion_tokens', {
    p_user_id: userId,
    p_tokens: tokens,
  });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as { consumed: number; budget: number; period_end: string };
  return { consumed: row.consumed, budget: row.budget, periodEnd: row.period_end };
}
