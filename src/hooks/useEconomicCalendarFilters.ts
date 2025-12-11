/**
 * useEconomicCalendarFilters Hook
 * Manages filter state for the economic calendar with optimized updates
 * and persistence to calendar settings.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Currency, ImpactLevel } from '../types/economicCalendar';
import { Calendar } from '../types/calendar';
import { logger } from '../utils/logger';

export type ViewType = 'day' | 'week' | 'month';

export interface EconomicCalendarFilterSettings {
  currencies: Currency[];
  impacts: ImpactLevel[];
  viewType: ViewType;
  notificationsEnabled: boolean;
  onlyUpcomingEvents: boolean;
}

export const DEFAULT_FILTER_SETTINGS: EconomicCalendarFilterSettings = {
  currencies: ['USD', 'EUR', 'GBP'],
  impacts: ['High', 'Medium', 'Low'],
  viewType: 'day',
  notificationsEnabled: true,
  onlyUpcomingEvents: false,
};

interface UseEconomicCalendarFiltersOptions {
  calendar: Calendar | null;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updater: (cal: Calendar) => Calendar
  ) => Promise<Calendar | undefined | void>;
}

interface UseEconomicCalendarFiltersResult {
  // Applied filters (used for queries)
  appliedFilters: {
    currencies: Currency[];
    impacts: ImpactLevel[];
    onlyUpcoming: boolean;
  };
  // Pending filters (before applying)
  pendingFilters: {
    currencies: Currency[];
    impacts: ImpactLevel[];
    onlyUpcoming: boolean;
  };
  // View state
  viewType: ViewType;
  notificationsEnabled: boolean;
  filtersModified: boolean;
  // Actions
  toggleCurrency: (currency: Currency) => void;
  toggleImpact: (impact: ImpactLevel) => void;
  setOnlyUpcoming: (value: boolean) => void;
  setViewType: (viewType: ViewType) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  applyFilters: () => Promise<void>;
  resetFilters: () => void;
}

/**
 * Hook for managing economic calendar filter state with persistence
 */
export function useEconomicCalendarFilters(
  options: UseEconomicCalendarFiltersOptions
): UseEconomicCalendarFiltersResult {
  const { calendar, onUpdateCalendarProperty } = options;

  // Get saved settings from calendar or use defaults
  const savedSettings = useMemo(
    () => calendar?.economic_calendar_filters || DEFAULT_FILTER_SETTINGS,
    [calendar?.economic_calendar_filters]
  );

  // Applied filters (used for actual queries)
  const [appliedCurrencies, setAppliedCurrencies] = useState<Currency[]>(savedSettings.currencies);
  const [appliedImpacts, setAppliedImpacts] = useState<ImpactLevel[]>(savedSettings.impacts);
  const [appliedOnlyUpcoming, setAppliedOnlyUpcoming] = useState(savedSettings.onlyUpcomingEvents);

  // Pending filters (temporary state before applying)
  const [pendingCurrencies, setPendingCurrencies] = useState<Currency[]>(savedSettings.currencies);
  const [pendingImpacts, setPendingImpacts] = useState<ImpactLevel[]>(savedSettings.impacts);
  const [pendingOnlyUpcoming, setPendingOnlyUpcoming] = useState(savedSettings.onlyUpcomingEvents);

  // View settings
  const [viewType, setViewTypeState] = useState<ViewType>(savedSettings.viewType);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(savedSettings.notificationsEnabled);

  // Track if we're saving to prevent duplicate saves
  const isSavingRef = useRef(false);

  // Check if filters have been modified
  const filtersModified = useMemo(() => {
    const currenciesChanged = JSON.stringify([...pendingCurrencies].sort()) !==
                              JSON.stringify([...appliedCurrencies].sort());
    const impactsChanged = JSON.stringify([...pendingImpacts].sort()) !==
                           JSON.stringify([...appliedImpacts].sort());
    const upcomingChanged = pendingOnlyUpcoming !== appliedOnlyUpcoming;

    return currenciesChanged || impactsChanged || upcomingChanged;
  }, [pendingCurrencies, appliedCurrencies, pendingImpacts, appliedImpacts, pendingOnlyUpcoming, appliedOnlyUpcoming]);

  /**
   * Save filter settings to calendar
   */
  const saveSettings = useCallback(
    async (settings: EconomicCalendarFilterSettings) => {
      if (!calendar?.id || !onUpdateCalendarProperty || isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;
      try {
        await onUpdateCalendarProperty(calendar.id, (cal) => ({
          ...cal,
          economic_calendar_filters: settings,
        }));
        logger.log('Economic calendar filter settings saved:', settings);
      } catch (error) {
        logger.error('Failed to save economic calendar filter settings:', error);
      } finally {
        isSavingRef.current = false;
      }
    },
    [calendar?.id, onUpdateCalendarProperty]
  );

  /**
   * Toggle a currency in pending filters
   */
  const toggleCurrency = useCallback((currency: Currency) => {
    setPendingCurrencies(prev =>
      prev.includes(currency)
        ? prev.filter(c => c !== currency)
        : [...prev, currency]
    );
  }, []);

  /**
   * Toggle an impact level in pending filters
   */
  const toggleImpact = useCallback((impact: ImpactLevel) => {
    setPendingImpacts(prev =>
      prev.includes(impact)
        ? prev.filter(i => i !== impact)
        : [...prev, impact]
    );
  }, []);

  /**
   * Set only upcoming events filter
   */
  const setOnlyUpcoming = useCallback((value: boolean) => {
    setPendingOnlyUpcoming(value);
  }, []);

  /**
   * Set view type and save immediately
   */
  const setViewType = useCallback(
    async (newViewType: ViewType) => {
      setViewTypeState(newViewType);
      await saveSettings({
        currencies: appliedCurrencies,
        impacts: appliedImpacts,
        viewType: newViewType,
        notificationsEnabled,
        onlyUpcomingEvents: appliedOnlyUpcoming,
      });
    },
    [appliedCurrencies, appliedImpacts, notificationsEnabled, appliedOnlyUpcoming, saveSettings]
  );

  /**
   * Set notifications enabled and save immediately
   */
  const setNotificationsEnabled = useCallback(
    async (enabled: boolean) => {
      setNotificationsEnabledState(enabled);
      await saveSettings({
        currencies: appliedCurrencies,
        impacts: appliedImpacts,
        viewType,
        notificationsEnabled: enabled,
        onlyUpcomingEvents: appliedOnlyUpcoming,
      });
    },
    [appliedCurrencies, appliedImpacts, viewType, appliedOnlyUpcoming, saveSettings]
  );

  /**
   * Apply pending filters
   */
  const applyFilters = useCallback(async () => {
    setAppliedCurrencies(pendingCurrencies);
    setAppliedImpacts(pendingImpacts);
    setAppliedOnlyUpcoming(pendingOnlyUpcoming);

    await saveSettings({
      currencies: pendingCurrencies,
      impacts: pendingImpacts,
      viewType,
      notificationsEnabled,
      onlyUpcomingEvents: pendingOnlyUpcoming,
    });
  }, [pendingCurrencies, pendingImpacts, pendingOnlyUpcoming, viewType, notificationsEnabled, saveSettings]);

  /**
   * Reset filters to defaults
   */
  const resetFilters = useCallback(() => {
    const defaultCurrencies: Currency[] = ['USD', 'EUR', 'GBP'];
    const defaultImpacts: ImpactLevel[] = ['High', 'Medium', 'Low'];

    setPendingCurrencies(defaultCurrencies);
    setPendingImpacts(defaultImpacts);
    setPendingOnlyUpcoming(false);
    setAppliedCurrencies(defaultCurrencies);
    setAppliedImpacts(defaultImpacts);
    setAppliedOnlyUpcoming(false);
  }, []);

  // Sync with calendar settings when they change
  useEffect(() => {
    if (savedSettings) {
      setAppliedCurrencies(savedSettings.currencies);
      setAppliedImpacts(savedSettings.impacts);
      setAppliedOnlyUpcoming(savedSettings.onlyUpcomingEvents);
      setPendingCurrencies(savedSettings.currencies);
      setPendingImpacts(savedSettings.impacts);
      setPendingOnlyUpcoming(savedSettings.onlyUpcomingEvents);
      setViewTypeState(savedSettings.viewType);
      setNotificationsEnabledState(savedSettings.notificationsEnabled);
    }
  }, [savedSettings]);

  return {
    appliedFilters: {
      currencies: appliedCurrencies,
      impacts: appliedImpacts,
      onlyUpcoming: appliedOnlyUpcoming,
    },
    pendingFilters: {
      currencies: pendingCurrencies,
      impacts: pendingImpacts,
      onlyUpcoming: pendingOnlyUpcoming,
    },
    viewType,
    notificationsEnabled,
    filtersModified,
    toggleCurrency,
    toggleImpact,
    setOnlyUpcoming,
    setViewType,
    setNotificationsEnabled,
    applyFilters,
    resetFilters,
  };
}

export default useEconomicCalendarFilters;
