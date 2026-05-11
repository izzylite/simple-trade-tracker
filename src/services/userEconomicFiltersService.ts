/**
 * User-level economic filter settings.
 *
 * Persists Events page filter preferences (impact, currencies, upcoming only)
 * on `users.economic_filter_settings`. Mirrors the storage pattern used by
 * userPinnedEventsService.
 */

import { supabase } from '../config/supabase';
import { Currency } from '../types/economicCalendar';
import { logger } from '../utils/logger';

export type ImpactFilter = 'High' | 'Medium' | 'Low' | 'all';

export interface UserEconomicFilterSettings {
  impactFilter: ImpactFilter;
  currencies: Currency[];
  onlyUpcoming: boolean;
}

export const DEFAULT_USER_ECONOMIC_FILTERS: UserEconomicFilterSettings = {
  impactFilter: 'High',
  currencies: [],
  onlyUpcoming: false,
};

export async function getUserEconomicFilters(
  userId: string
): Promise<UserEconomicFilterSettings> {
  const { data, error } = await supabase
    .from('users')
    .select('economic_filter_settings')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    logger.error('getUserEconomicFilters failed', error);
    throw error;
  }
  const raw = (data as { economic_filter_settings?: unknown } | null)
    ?.economic_filter_settings;
  return mergeWithDefaults(raw);
}

export async function setUserEconomicFilters(
  userId: string,
  settings: UserEconomicFilterSettings
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      economic_filter_settings: settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) {
    logger.error('setUserEconomicFilters failed', error);
    throw error;
  }
}

export function subscribeToUserEconomicFilters(
  userId: string,
  callback: (settings: UserEconomicFilterSettings) => void
): () => void {
  const channel = supabase
    .channel(`user_economic_filters_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const raw = (payload.new as { economic_filter_settings?: unknown } | null)
          ?.economic_filter_settings;
        callback(mergeWithDefaults(raw));
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

function mergeWithDefaults(raw: unknown): UserEconomicFilterSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_USER_ECONOMIC_FILTERS };
  const r = raw as Partial<UserEconomicFilterSettings>;
  return {
    impactFilter: isImpactFilter(r.impactFilter)
      ? r.impactFilter
      : DEFAULT_USER_ECONOMIC_FILTERS.impactFilter,
    currencies: Array.isArray(r.currencies)
      ? (r.currencies.filter((c) => typeof c === 'string') as Currency[])
      : DEFAULT_USER_ECONOMIC_FILTERS.currencies,
    onlyUpcoming:
      typeof r.onlyUpcoming === 'boolean'
        ? r.onlyUpcoming
        : DEFAULT_USER_ECONOMIC_FILTERS.onlyUpcoming,
  };
}

function isImpactFilter(v: unknown): v is ImpactFilter {
  return v === 'High' || v === 'Medium' || v === 'Low' || v === 'all';
}
