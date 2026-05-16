/**
 * OverviewPanelStateContext
 *
 * Owns the user-meaningful state that backs the Overview panel
 * (StatsContent / StatsDrawer) so it survives the lg↔︎drawer breakpoint
 * handoff. StatsContent is mounted inline at lg+ and inside StatsDrawer
 * at <lg; resizing across the breakpoint unmounts one host and mounts
 * the other, which would otherwise reset every selection the user made.
 *
 * Currently hoists the time-period selection that drives PerformanceCharts
 * (already supports controlled `timePeriod` / `onTimePeriodChange`). Other
 * PerformanceCharts internals (server-fetched chart data, modal flags,
 * tag/tab state) are intentionally left in the component because they are
 * shared with PerformancePage and either are transient UI or refetch on
 * mount; lifting them here would require refactoring an unrelated page.
 *
 * Mounted once inside TradeCalendarPage above both the inline panel slot
 * and the <lg drawer.
 */

import React, {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { TimePeriod } from '../components/PerformanceCharts';

interface OverviewPanelStateContextValue {
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
}

const OverviewPanelStateContext =
  createContext<OverviewPanelStateContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export const OverviewPanelStateProvider: React.FC<ProviderProps> = ({
  children,
}) => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');

  const value = useMemo<OverviewPanelStateContextValue>(
    () => ({ timePeriod, setTimePeriod }),
    [timePeriod],
  );

  return (
    <OverviewPanelStateContext.Provider value={value}>
      {children}
    </OverviewPanelStateContext.Provider>
  );
};

export const useOverviewPanelState = (): OverviewPanelStateContextValue => {
  const ctx = useContext(OverviewPanelStateContext);
  if (!ctx) {
    throw new Error(
      'useOverviewPanelState must be used within OverviewPanelStateProvider',
    );
  }
  return ctx;
};
