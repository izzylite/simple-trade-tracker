/**
 * User-level economic filter preferences provider.
 *
 * Centralizes read + mutate of `users.economic_filter_settings` so the
 * Events page filter pill, currency chips, and "upcoming only" toggle all
 * read the same set and persist their changes through to the user row.
 * Optimistic local state + write-through, with rollback on failure.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuthState } from './AuthStateContext';
import {
  DEFAULT_USER_ECONOMIC_FILTERS,
  ImpactFilter,
  UserEconomicFilterSettings,
  getUserEconomicFilters,
  setUserEconomicFilters,
  subscribeToUserEconomicFilters,
} from '../services/userEconomicFiltersService';
import { Currency } from '../types/economicCalendar';
import { logger } from '../utils/logger';

interface UserEconomicFiltersValue extends UserEconomicFilterSettings {
  loading: boolean;
  setImpactFilter: (v: ImpactFilter) => void;
  toggleCurrency: (c: Currency) => void;
  setCurrencies: (c: Currency[]) => void;
  setOnlyUpcoming: (v: boolean) => void;
}

const UserEconomicFiltersContext =
  createContext<UserEconomicFiltersValue | undefined>(undefined);

export const UserEconomicFiltersProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user } = useAuthState();
  const userId = user?.id ?? null;

  const [settings, setSettings] = useState<UserEconomicFilterSettings>(
    DEFAULT_USER_ECONOMIC_FILTERS
  );
  const [loading, setLoading] = useState(false);

  const settingsRef = useRef<UserEconomicFilterSettings>(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!userId) {
      setSettings(DEFAULT_USER_ECONOMIC_FILTERS);
      return;
    }
    let alive = true;
    setLoading(true);
    getUserEconomicFilters(userId)
      .then((s) => {
        if (alive) setSettings(s);
      })
      .catch((err) =>
        logger.error('Failed to load user economic filters', err)
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    const unsubscribe = subscribeToUserEconomicFilters(userId, (next) => {
      if (alive) setSettings(next);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [userId]);

  const writeThrough = useCallback(
    async (
      next: UserEconomicFilterSettings,
      previous: UserEconomicFilterSettings
    ) => {
      if (!userId) return;
      try {
        await setUserEconomicFilters(userId, next);
      } catch (err) {
        logger.error('User filter write failed; rolling back', err);
        setSettings(previous);
      }
    },
    [userId]
  );

  const updateField = useCallback(
    <K extends keyof UserEconomicFilterSettings>(
      key: K,
      value: UserEconomicFilterSettings[K]
    ) => {
      const previous = settingsRef.current;
      const next = { ...previous, [key]: value };
      setSettings(next);
      void writeThrough(next, previous);
    },
    [writeThrough]
  );

  const setImpactFilter = useCallback(
    (v: ImpactFilter) => updateField('impactFilter', v),
    [updateField]
  );
  const setCurrencies = useCallback(
    (c: Currency[]) => updateField('currencies', c),
    [updateField]
  );
  const toggleCurrency = useCallback(
    (c: Currency) => {
      const previous = settingsRef.current;
      const next = previous.currencies.includes(c)
        ? previous.currencies.filter((x) => x !== c)
        : [...previous.currencies, c];
      updateField('currencies', next);
    },
    [updateField]
  );
  const setOnlyUpcoming = useCallback(
    (v: boolean) => updateField('onlyUpcoming', v),
    [updateField]
  );

  const value = useMemo<UserEconomicFiltersValue>(
    () => ({
      ...settings,
      loading,
      setImpactFilter,
      toggleCurrency,
      setCurrencies,
      setOnlyUpcoming,
    }),
    [
      settings,
      loading,
      setImpactFilter,
      toggleCurrency,
      setCurrencies,
      setOnlyUpcoming,
    ]
  );

  return (
    <UserEconomicFiltersContext.Provider value={value}>
      {children}
    </UserEconomicFiltersContext.Provider>
  );
};

export function useUserEconomicFilters(): UserEconomicFiltersValue {
  const ctx = useContext(UserEconomicFiltersContext);
  if (ctx) return ctx;
  return EMPTY_VALUE;
}

const EMPTY_VALUE: UserEconomicFiltersValue = {
  ...DEFAULT_USER_ECONOMIC_FILTERS,
  loading: false,
  setImpactFilter: () => {},
  toggleCurrency: () => {},
  setCurrencies: () => {},
  setOnlyUpcoming: () => {},
};
