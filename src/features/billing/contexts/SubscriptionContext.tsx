/**
 * SubscriptionContext
 *
 * Lifts the per-user `public.subscriptions` row read out of every
 * tier-gated component (was: useSubscription hook re-running on each
 * mount → 4+ round-trips per session). One read at provider mount,
 * then a Supabase realtime channel filtered by `user_id` keeps the
 * row fresh — so a Paddle webhook upsert (e.g. upgrade from Checkout)
 * is reflected in the UI without a reload.
 *
 * The exposed shape is a SUPERSET of the prior `useSubscription()`
 * hook's return value, so existing call sites that destructure
 * `{ tier, loaded }` or `{ isPaid, loaded }` continue to work.
 *
 * "Paid" semantics mirror `supabase/functions/_shared/tierEnforcement.ts`:
 *   - tier in {lite, pro, elite}
 *   - AND status in {active, trialing, past_due}
 *     OR status === 'cancelled' with current_period_end still in the future
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { supabase } from 'config/supabase';
import { useAuth } from 'contexts/SupabaseAuthContext';
import type { Tier } from 'features/billing/pricing/tierData';

const PAID_TIERS = new Set<Tier>(['lite', 'pro', 'elite']);

export interface SubscriptionState {
  tier: Tier;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingCycle: string | null;
  /** True iff the user has paid access right now (includes cancel-in-grace). */
  isPaid: boolean;
  /** True after the first fetch completes — used to gate flash-of-unstyled-UI. */
  loaded: boolean;
  /** Force a manual refetch. Rarely needed — realtime keeps the row fresh. */
  refresh: () => void;
}

const DEFAULT_STATE: SubscriptionState = {
  tier: 'free',
  status: 'active',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  billingCycle: null,
  isPaid: false,
  loaded: false,
  refresh: () => {},
};

const SubscriptionContext = createContext<SubscriptionState>(DEFAULT_STATE);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>(DEFAULT_STATE);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  // Initial fetch + refetch on user change or manual refresh.
  useEffect(() => {
    const uid = (user as any)?.id ?? (user as any)?.uid;
    if (!uid) {
      setState({ ...DEFAULT_STATE, loaded: true, refresh });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('tier, status, current_period_end, cancel_at_period_end, billing_cycle')
        .eq('user_id', uid)
        .maybeSingle();
      if (cancelled) return;

      const tier = ((data?.tier as Tier | undefined) ?? 'free');
      const status = (data?.status as string | undefined) ?? 'active';
      const currentPeriodEnd = (data?.current_period_end as string | null) ?? null;
      const cancelAtPeriodEnd = !!data?.cancel_at_period_end;
      const billingCycle = (data?.billing_cycle as string | null) ?? null;

      const isWithinGrace =
        status === 'cancelled' &&
        !!currentPeriodEnd &&
        new Date(currentPeriodEnd).getTime() > Date.now();
      const isPaid =
        PAID_TIERS.has(tier) &&
        (['active', 'trialing', 'past_due'].includes(status) || isWithinGrace);

      setState({
        tier,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        billingCycle,
        isPaid,
        loaded: true,
        refresh,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshTick, refresh]);

  // Realtime channel — Paddle webhook upserts the row → Postgres CDC →
  // here → setRefreshTick → effect above refetches authoritative row.
  // (We refetch rather than splice the payload because computing isPaid
  // requires evaluating the grace window against `now`, and `data` may
  // arrive as a partial UPDATE payload depending on Postgres settings.)
  useEffect(() => {
    const uid = (user as any)?.id ?? (user as any)?.uid;
    if (!uid) return;

    const channel = supabase
      .channel(`subscriptions:${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${uid}`,
        },
        () => {
          setRefreshTick((n) => n + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  );
};

/**
 * Reads the current subscription state. Returns DEFAULT_STATE outside the
 * provider (graceful, no throw) so components mounted before the provider
 * on initial render (e.g. landing-page surfaces) degrade to "free" rather
 * than crashing.
 */
export function useSubscription(): SubscriptionState {
  return useContext(SubscriptionContext);
}

export default useSubscription;
