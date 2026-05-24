/**
 * useOrionUsage
 *
 * Reads the current user's Orion token usage for the active billing period.
 * Prefers the live `public.orion_usage_periods` row when present; otherwise
 * derives the budget from the subscription tier so paid users see a 0%-filled
 * ring before their first Orion message of the period (the usage row is only
 * created lazily on first increment).
 *
 * Tier → budget is read from the `public.tier_budgets` table — same row set
 * the `increment_orion_tokens` SQL RPC consumes (single source of truth).
 * Current values:
 *  - free  → 0      (hide ring)
 *  - lite  → 500K
 *  - pro   → 2.5M
 *  - elite → 12.5M
 *
 * Returns `usage = null` when:
 *  - the user is signed out
 *  - the user is on the free tier (no budget to show)
 *  - the user's subscription status isn't paid (active/trialing/past_due, or
 *    cancelled-within-grace) — matches `_shared/tierEnforcement.ts` semantics
 *  - the resolved budget is 0
 *
 * Caller is responsible for hiding the UI in those cases. Consumers should
 * check `usage` alone for visibility and `loaded` only when they need to
 * distinguish the initial-fetch state (e.g. shimmer).
 *
 * Subscription read: piggybacks on `SubscriptionContext` so the
 * `subscriptions` row is fetched once per session (not once per Orion-aware
 * surface). Realtime updates from Paddle webhooks also propagate through
 * the context — when tier flips mid-session, the next refresh tick reads
 * the new tier without re-querying.
 *
 * Refetch model: `refresh()` increments an internal tick that re-runs the
 * effect. Callers re-fetch after each Orion message round completes so the
 * ring ticks down in near-real-time (the edge function increments
 * `tokens_consumed` via `EdgeRuntime.waitUntil` a beat after the response
 * stream ends).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from 'config/supabase';
import { useAuth } from 'contexts/SupabaseAuthContext';
import { useSubscription } from 'features/billing/contexts/SubscriptionContext';

export interface OrionUsage {
  consumed: number;
  budget: number;
  periodEnd: string; // ISO timestamp
}

export interface UseOrionUsageReturn {
  usage: OrionUsage | null;
  loaded: boolean;
  refresh: () => void;
}

// Tier → budget is sourced from the `public.tier_budgets` table (same row set
// the `increment_orion_tokens` RPC reads). Cached at module scope so the
// 4-row lookup is fetched at most once per app lifetime.
let tierBudgetsCache: Record<string, number> | null = null;
let tierBudgetsInFlight: Promise<Record<string, number>> | null = null;

async function getTierBudgets(): Promise<Record<string, number>> {
  if (tierBudgetsCache) return tierBudgetsCache;
  if (tierBudgetsInFlight) return tierBudgetsInFlight;
  tierBudgetsInFlight = (async () => {
    const { data, error } = await supabase
      .from('tier_budgets')
      .select('tier, tokens_budget');
    if (error || !data) {
      tierBudgetsInFlight = null;
      return {};
    }
    const map = Object.fromEntries(
      data.map((r) => [r.tier as string, Number(r.tokens_budget)])
    );
    tierBudgetsCache = map;
    tierBudgetsInFlight = null;
    return map;
  })();
  return tierBudgetsInFlight;
}

export function useOrionUsage(): UseOrionUsageReturn {
  const { user } = useAuth();
  // Read tier + paid status from the lifted subscription context — no
  // duplicate `subscriptions` query, and Paddle webhook → realtime keeps
  // both this and any sibling consumer in sync.
  const {
    tier,
    currentPeriodEnd,
    isPaid,
    loaded: subscriptionLoaded,
  } = useSubscription();
  const [usage, setUsage] = useState<OrionUsage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    if (!user) {
      setUsage(null);
      setLoaded(true);
      return;
    }
    // Wait for the subscription context's first fetch so we don't render
    // the "free → hide" branch for a frame on paid users.
    if (!subscriptionLoaded) {
      return;
    }
    if (!isPaid) {
      setUsage(null);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    // Race protection: on refresh-triggered fetches (refreshTick > 0), wait
    // ~1500ms so the server's `EdgeRuntime.waitUntil(incrementOrionTokens(...))`
    // has time to commit before we re-query. Without this delay the ring
    // re-reads stale `tokens_consumed` ~500ms after the stream ends and
    // appears to "ignore" the just-finished message. First-mount fetch is
    // immediate so the initial render is not throttled.
    const delayMs = refreshTick === 0 ? 0 : 1500;
    const timer = setTimeout(() => { (async () => {
      // Read the most-recent usage row (may not exist yet — lazy-created
      // on first Orion message increment).
      const { data: row } = await supabase
        .from('orion_usage_periods')
        .select('tokens_consumed, tokens_budget, period_end')
        .eq('user_id', user.id)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (row && Number(row.tokens_budget) > 0) {
        setUsage({
          consumed: Number(row.tokens_consumed),
          budget: Number(row.tokens_budget),
          periodEnd: row.period_end as string,
        });
        setLoaded(true);
        return;
      }

      // No row yet: derive budget from tier, consumed=0, periodEnd from
      // subscription.current_period_end (fallback +30d hedge if missing).
      const budgets = await getTierBudgets();
      if (cancelled) return;
      const tierBudget = budgets[tier] ?? 0;
      if (tierBudget <= 0) {
        setUsage(null);
        setLoaded(true);
        return;
      }

      const fallbackPeriodEnd =
        currentPeriodEnd ??
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      setUsage({
        consumed: 0,
        budget: tierBudget,
        periodEnd: fallbackPeriodEnd,
      });
      setLoaded(true);
    })(); }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, refreshTick, tier, currentPeriodEnd, isPaid, subscriptionLoaded]);

  return { usage, loaded, refresh };
}
