/**
 * useSubscription
 *
 * Reads the current user's billing tier + status from `public.subscriptions`.
 * Mirrors the same "is paid" semantics used server-side in
 * `supabase/functions/_shared/tierEnforcement.ts` and client-side in
 * `services/supabaseStorageService.ts`:
 *
 *  - tier is one of `lite | pro | elite`
 *  - status is `active | trialing | past_due`, OR status is `cancelled`
 *    with a `current_period_end` still in the future (grace period).
 *
 * Returns `tier === 'free'` and `isPaid === false` for signed-out users so
 * tier-gated UI defaults to the most restrictive case until auth resolves.
 *
 * Used by tier-gated UI (image upload, calendar create, future paywalls)
 * to disable affordances + show upgrade nudges for free users without
 * hitting the server-side guard for a generic error.
 */

import { useEffect, useState } from 'react';
import { supabase } from 'config/supabase';
import { useAuth } from 'contexts/SupabaseAuthContext';
import type { Tier } from 'features/billing/pricing/tierData';

export interface SubscriptionState {
  tier: Tier;
  status: string;
  /** Computed paid-tier flag — true iff the user can use paid features now. */
  isPaid: boolean;
  /** False until the initial fetch resolves (auth + DB roundtrip). */
  loaded: boolean;
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    tier: 'free',
    status: 'active',
    isPaid: false,
    loaded: false,
  });

  useEffect(() => {
    if (!user) {
      setState({ tier: 'free', status: 'active', isPaid: false, loaded: true });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('tier, status, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const tier = (data?.tier as Tier) ?? 'free';
      const status = (data?.status as string) ?? 'active';
      const hasGrace =
        status === 'cancelled' &&
        !!data?.current_period_end &&
        new Date(data.current_period_end as unknown as string).getTime() > Date.now();
      const isPaid =
        (['lite', 'pro', 'elite'] as Tier[]).includes(tier) &&
        (['active', 'trialing', 'past_due'].includes(status) || hasGrace);
      setState({ tier, status, isPaid, loaded: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}

export default useSubscription;
