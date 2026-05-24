/**
 * useOrionUsage
 *
 * Reads the current user's Orion token usage for the active billing period
 * from `public.orion_usage_periods` (Plan A). Used to drive the circular
 * usage progress ring in the AI chat header.
 *
 * Returns `usage = null` when:
 *  - the user is signed out
 *  - the user is on the free tier (no row created)
 *  - the user is on a paid tier but hasn't sent their first Orion message
 *    this billing period yet (row created lazily)
 *  - the row's `tokens_budget` is 0 (treat as "no budget to show")
 *
 * Caller is responsible for hiding the UI in those cases — this hook does
 * not differentiate "loaded with no row" from "still loading", so consumers
 * should check `usage` alone for visibility and `loaded` only when they
 * need to distinguish the initial-fetch state (e.g. shimmer).
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

export function useOrionUsage(): UseOrionUsageReturn {
  const { user } = useAuth();
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
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('orion_usage_periods')
        .select('tokens_consumed, tokens_budget, period_end')
        .eq('user_id', user.uid)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data && Number(data.tokens_budget) > 0) {
        setUsage({
          consumed: Number(data.tokens_consumed),
          budget: Number(data.tokens_budget),
          periodEnd: data.period_end as string,
        });
      } else {
        setUsage(null);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshTick]);

  return { usage, loaded, refresh };
}
