import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Box, Typography, useTheme, useMediaQuery, Paper, Alert, Button, CircularProgress } from '@mui/material';
import { Trade, Calendar } from 'features/calendar/types/dualWrite';
import ImageZoomDialog, { ImageZoomProp } from 'features/calendar/components/ImageZoomDialog';
import { DynamicRiskSettings } from 'features/calendar/utils/dynamicRiskUtils';
import TagPatternAnalysis from 'features/performance/components/TagPatternAnalysis';
import RoundedTabs from 'components/common/RoundedTabs';
import KpiStrip from 'features/performance/components/KpiStrip';
import WeekdayWinRate from 'features/performance/components/WeekdayWinRate';
import { logger } from 'utils/logger';
import { getFilteredTrades, getNormalizedDate } from 'features/performance/utils/chartDataUtils';
import {
  PerformanceCalculationResult
} from 'features/performance/services/performanceCalculationService';
import { supabase } from 'config/supabase';
import { EconomicCalendarFilterSettings, DEFAULT_FILTER_SETTINGS as DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from 'features/events/hooks/useEconomicCalendarFilters';
import { TradeOperationsProps } from 'features/calendar/types/tradeOperations';
import PnLChartsWrapper from 'features/performance/components/charts/PnLChartsWrapper';
import WinLossStats from 'features/performance/components/charts/WinLossStats';
import WinLossDistribution from 'features/performance/components/charts/WinLossDistribution';
import DailySummaryTable from 'features/performance/components/charts/DailySummaryTable';
import TagPerformanceAnalysis from 'features/performance/components/charts/TagPerformanceAnalysis';
import TagDayOfWeekAnalysis from 'features/performance/components/charts/TagDayOfWeekAnalysis';
import SessionPerformanceAnalysis from 'features/performance/components/charts/SessionPerformanceAnalysis';
import TradesListDialog from 'features/performance/components/charts/TradesListDialog';
import RiskRewardChart from 'features/performance/components/charts/RiskRewardChart';
import EconomicEventCorrelationAnalysis from 'features/events/components/charts/EconomicEventCorrelationAnalysis';
import { useTradeSyncContextOptional } from 'features/calendar/contexts/TradeSyncContext';
import { normalizeTradeDates } from 'features/calendar/utils/tradeUtils';

// Type definition needed for module-level constants
export type TimePeriod = 'month' | 'quarter' | 'ytd' | 'year' | 'all';

// Module-level static arrays to prevent recreation on every render
export const TIME_PERIOD_TABS = [
  { label: 'Month', value: 'month' as TimePeriod },
  { label: 'Quarter', value: 'quarter' as TimePeriod },
  { label: 'YTD', value: 'ytd' as TimePeriod },
  { label: 'Year', value: 'year' as TimePeriod },
  { label: 'All', value: 'all' as TimePeriod }
];

const TAG_ANALYSIS_TABS = [
  { label: 'Pattern Insights' },
  { label: 'Tag Performance' },
  { label: 'Day of Week' }
];

interface PerformanceChartsProps {
  selectedDate?: Date;
  monthlyTarget?: number;
  accountBalance?: number;
  maxDailyDrawdown?: number;
  tabSize?: 'large' | 'small';
  calendarId: string;
  timePeriod?: TimePeriod;
  onTimePeriodChange?: (period: TimePeriod) => void;
  hideTimePeriodTabs?: boolean;
  onPrimaryTagsChange?: (tags: string[]) => void;
  onSecondaryTagsChange?: (tags: string[]) => void;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  economicFilter?: (calendarId: string) => EconomicCalendarFilterSettings;
  dynamicRiskSettings?: DynamicRiskSettings;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  calendar?: Calendar;
  isReadOnly?: boolean;
  /** When true, hide the Basic/Advanced toggle and render only the Basic tab.
   *  Used by the Stats panel which has limited width and shows a focused view. */
  basicOnly?: boolean;
}

const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  selectedDate: selectedDateProp,
  monthlyTarget: monthlyTargetProp,
  accountBalance: accountBalanceProp,
  maxDailyDrawdown: maxDailyDrawdownProp,
  calendarId,
  tabSize,
  timePeriod: timePeriodProp,
  onTimePeriodChange,
  hideTimePeriodTabs = false,
  onPrimaryTagsChange = () => { },
  onSecondaryTagsChange = () => { },
  onEditTrade,
  onDeleteTrade,
  onUpdateTradeProperty,
  onUpdateCalendarProperty,
  dynamicRiskSettings: dynamicRiskSettingsProp,
  onOpenGalleryMode,
  economicFilter,
  calendar,
  isReadOnly = false,
  basicOnly = false
}) => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const chartHeights = useMemo(() => ({
    large: isXs ? 240 : 400,
    medium: isXs ? 180 : 260,
    pair: isXs ? 280 : 500
  }), [isXs]);

  // Subscribe to trade sync context for updates from other components
  const tradeSync = useTradeSyncContextOptional();
  const lastProcessedTimestamp = useRef<number>(0);

  // Support both controlled and uncontrolled time period
  const [internalTimePeriod, setInternalTimePeriod] = useState<TimePeriod>('month');
  const timePeriod = timePeriodProp ?? internalTimePeriod;
  const setTimePeriod = useCallback((period: TimePeriod) => {
    if (timePeriodProp === undefined) {
      setInternalTimePeriod(period);
    }
    onTimePeriodChange?.(period);
  }, [timePeriodProp, onTimePeriodChange]);
  const [tagAnalysisTab, setTagAnalysisTab] = useState<number>(0);
  const [primaryTags, setPrimaryTags] = useState<string[]>([]);
  const [secondaryTags, setSecondaryTags] = useState<string[]>([]);
  const [internalTrades, setInternalTrades] = useState<Trade[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Use internal trades
  const trades = internalTrades;

  // Create a stable selectedDate
  const [defaultDate] = useState(() => new Date());
  const selectedDate = useMemo(() => selectedDateProp || defaultDate, [selectedDateProp, defaultDate]);


  // Use props or calendar values
  const accountBalance = accountBalanceProp ?? calendar?.account_balance ?? 0;
  const maxDailyDrawdown = maxDailyDrawdownProp ?? calendar?.max_daily_drawdown ?? 0;
  const monthlyTarget = monthlyTargetProp ?? calendar?.monthly_target;
  const excludedPatternTags = useMemo(
    () => calendar?.excluded_tags_from_patterns ?? [],
    [calendar?.excluded_tags_from_patterns],
  );
  const handleExcludedPatternTagsChange = useCallback((tags: string[]) => {
    onUpdateCalendarProperty?.(calendarId, (cal) => ({
      ...cal,
      excluded_tags_from_patterns: tags,
    }));
  }, [calendarId, onUpdateCalendarProperty]);

  // Economic filter function
  const economicFilterFn = economicFilter || (() => calendar?.economic_calendar_filters || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS);

  const [tradesDialog, setTradesDialog] = useState<{
    open: boolean;
    trades: Trade[];
    showChartInfo?: boolean,
    title: string,
    subtitle?: string,
    expandedTradeId: string | null;
  }>({
    open: false,
    trades: [],
    showChartInfo: true,
    title: '',
    subtitle: '',
    expandedTradeId: null
  });

  // Create stable trade IDs string for dependency tracking
  const tradeIdsString = useMemo(() => trades.map(t => t.id).join(','), [trades.map(t => t.id).join(',')]);

  // Keep multipleTradesDialog.trades in sync with the main trades array
  // Only run when trades array changes (by ID), not when dialog trades change
  useEffect(() => {
    if (tradesDialog.open && tradesDialog.trades && tradesDialog.trades.length > 0) {
      // Create a Map for O(1) lookup instead of O(n) with .find()
      const tradesMap = new Map(trades.map(t => [t.id, t]));

      // Filter out deleted trades and update remaining ones
      const updatedDialogTrades = tradesDialog.trades
        .filter(dialogTrade => tradesMap.has(dialogTrade.id))
        .map(dialogTrade => tradesMap.get(dialogTrade.id)!);

      // If all trades were deleted, close the dialog
      if (updatedDialogTrades.length === 0) {
        setTradesDialog(prev => ({
          ...prev,
          open: false
        }));
        return;
      }

      // Only update if the number of trades changed or IDs changed
      const dialogTradeIds = tradesDialog.trades.map(t => t.id).join(',');
      const updatedTradeIds = updatedDialogTrades.map(t => t.id).join(',');

      if (dialogTradeIds !== updatedTradeIds) {
        setTradesDialog(prev => ({
          ...prev,
          trades: updatedDialogTrades
        }));
      }
    }
  }, [tradeIdsString, tradesDialog.open]);



  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceCalculationResult | null>(null);
  const [economicCorrelations, setEconomicCorrelations] = useState<any>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  // Consolidated data loading - fetch trades and calculate all metrics
  useEffect(() => {
    if (!calendarId) {
      logger.warn('PerformanceCharts - No calendar ID provided');
      setInternalTrades([]);
      setChartData([]);
      setPerformanceData(null);
      setIsLoadingData(false);
      return;
    }

    const ac = new AbortController();

    const loadAllData = async () => {
      setIsLoadingData(true);
      setCalculationError(null);

      try {
        // 1. Fetch chart data AND trades in single RPC call
        const dateAtNoonUTC = getNormalizedDate(selectedDate);
        const { data: rpcResult, error: chartError } = await supabase
          .rpc('calculate_chart_data', {
            p_calendar_id: calendarId,
            p_time_period: timePeriod,
            p_selected_date: dateAtNoonUTC.toISOString()
          })
          .abortSignal(ac.signal);

        if (ac.signal.aborted) return;

        if (chartError) {
          // Aborted RPC surfaces as PostgrestError with name 'AbortError'
          // or message containing 'aborted' depending on supabase-js version.
          if (chartError.name === 'AbortError' || /abort/i.test(chartError.message || '')) {
            return;
          }
          logger.error('Error calling calculate_chart_data RPC:', chartError);
          throw chartError;
        }

        // Extract ALL pre-calculated data from comprehensive RPC result
        // Transform trades to restore Date objects (RPC returns ISO strings)
        const fetchedTrades = (rpcResult?.trades || []).map((trade: any) => ({
          ...trade,
          trade_date: trade.trade_date ? new Date(trade.trade_date) : trade.trade_date,
          created_at: trade.created_at ? new Date(trade.created_at) : trade.created_at,
          updated_at: trade.updated_at ? new Date(trade.updated_at) : trade.updated_at
        }));
        const chartRpcData = rpcResult?.chartData || [];
        const economicCorrelations = rpcResult?.economicCorrelations || { high: null, medium: null };
        const performanceMetrics = rpcResult?.performanceMetrics || {
          winLossStats: {},
          tagStats: [],
          dailySummaryData: [],
          riskRewardStats: { average: 0, max: 0, data: [] },
          sessionStats: [],
          allTags: [],
          winLossData: []
        };

        if (ac.signal.aborted) return;

        setInternalTrades(fetchedTrades);

        // Pre-process trades by date for O(1) lookup (used for chart interactivity)
        const tradesByDate = new Map<string, Trade[]>();
        fetchedTrades.forEach((trade: Trade) => {
          const dateKey = new Date(trade.trade_date).toDateString();
          if (!tradesByDate.has(dateKey)) {
            tradesByDate.set(dateKey, []);
          }
          tradesByDate.get(dateKey)!.push(trade);
        });

        // Transform chart data (lightweight client-side formatting only)
        const transformedChartData = (chartRpcData || []).map((item: any, index: number, array: any[]) => {
          const prevCumulativePnl = index > 0 ? array[index - 1].cumulativePnl : 0;
          const dailyChange = item.cumulativePnl - prevCumulativePnl;
          const itemDate = new Date(item.date);
          const dateKey = itemDate.toDateString();

          return {
            date: format(itemDate, (timePeriod === 'month' || timePeriod === 'quarter' || timePeriod === 'ytd') ? 'MM/dd' : 'MM/dd/yyyy'),
            pnl: item.pnl,
            cumulativePnL: item.cumulativePnl,
            isIncreasing: item.cumulativePnl > prevCumulativePnl,
            isDecreasing: item.cumulativePnl < prevCumulativePnl,
            dailyChange: dailyChange,
            isWin: item.pnl > 0,
            isLoss: item.pnl < 0,
            isBreakEven: item.pnl === 0,
            trades: tradesByDate.get(dateKey) || [],
            fullDate: itemDate
          };
        });
        setChartData(transformedChartData);

        // Use pre-calculated performance metrics from server (no client-side calculation!)
        setPerformanceData(performanceMetrics);

        // Store pre-calculated economic correlations (both High and Medium impact)
        setEconomicCorrelations(economicCorrelations);

      } catch (error) {
        if (ac.signal.aborted) return;
        const name = (error as any)?.name;
        const msg = (error as any)?.message;
        if (name === 'AbortError' || (typeof msg === 'string' && /abort/i.test(msg))) {
          return;
        }
        logger.error('Error loading data:', error);
        setCalculationError(error instanceof Error ? error.message : 'Failed to load data');
        setInternalTrades([]);
        setChartData([]);
        setPerformanceData(null);
        setEconomicCorrelations(null);
      } finally {
        if (!ac.signal.aborted) {
          setIsLoadingData(false);
        }
      }
    };

    loadAllData();

    return () => {
      ac.abort();
    };
  }, [calendarId, selectedDate, timePeriod, accountBalance]);

  // Handle trade sync events from other components (e.g., useCalendarTrades)
  useEffect(() => {
    if (!tradeSync?.lastSyncEvent) return;

    const { type, trade, timestamp } = tradeSync.lastSyncEvent;

    // Avoid processing the same event twice
    if (timestamp <= lastProcessedTimestamp.current) return;
    lastProcessedTimestamp.current = timestamp;

    // Only process events for trades in our calendar
    if (trade.calendar_id !== calendarId) return;

    const normalizedTrade = normalizeTradeDates(trade);

    // Update internalTrades
    setInternalTrades(prevTrades => {
      switch (type) {
        case 'update': {
          const tradeIndex = prevTrades.findIndex(t => t.id === trade.id);
          if (tradeIndex === -1) return prevTrades;

          const updatedTrades = [...prevTrades];
          updatedTrades[tradeIndex] = normalizedTrade;
          logger.log(`📡 PerformanceCharts: Synced trade update for ${trade.id}`);
          return updatedTrades;
        }
        case 'insert': {
          if (prevTrades.some(t => t.id === trade.id)) return prevTrades;
          logger.log(`📡 PerformanceCharts: Synced trade insert for ${trade.id}`);
          return [...prevTrades, normalizedTrade];
        }
        case 'delete': {
          const filteredTrades = prevTrades.filter(t => t.id !== trade.id);
          if (filteredTrades.length === prevTrades.length) return prevTrades;
          logger.log(`📡 PerformanceCharts: Synced trade delete for ${trade.id}`);
          return filteredTrades;
        }
        default:
          return prevTrades;
      }
    });

    // Also update multipleTradesDialog.trades if the dialog is open
    setTradesDialog(prev => {
      if (!prev.open) return prev;

      switch (type) {
        case 'update': {
          const tradeIndex = prev.trades.findIndex(t => t.id === trade.id);
          if (tradeIndex === -1) return prev;

          const updatedTrades = [...prev.trades];
          updatedTrades[tradeIndex] = normalizedTrade;
          return { ...prev, trades: updatedTrades };
        }
        case 'insert': {
          // Don't add to dialog - it was opened with specific trades
          return prev;
        }
        case 'delete': {
          const filteredTrades = prev.trades.filter(t => t.id !== trade.id);
          if (filteredTrades.length === prev.trades.length) return prev;
          // Close dialog if all trades were deleted
          if (filteredTrades.length === 0) {
            return { ...prev, open: false, trades: [] };
          }
          return { ...prev, trades: filteredTrades };
        }
        default:
          return prev;
      }
    });
  }, [tradeSync?.lastSyncEvent, calendarId]);

  const handleTimePeriodChange = (newValue: TimePeriod) => {
    setTimePeriod(newValue);
    onTimePeriodChange?.(newValue);
  };

  // Convert string value to tab index for RoundedTabs
  const getTimePeriodTabIndex = (period: TimePeriod): number => {
    return TIME_PERIOD_TABS.findIndex(tab => tab.value === period);
  };

  // Handle tab change for time period
  const handleTimePeriodTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    const newPeriod = TIME_PERIOD_TABS[newIndex]?.value as TimePeriod;
    if (newPeriod) {
      handleTimePeriodChange(newPeriod);
    }
  };

  const filteredTrades = useMemo(() => {
    const filtered = getFilteredTrades(trades, selectedDate, timePeriod);
    logger.debug('PerformanceCharts - Filtered trades:', {
      totalTrades: trades.length,
      filteredCount: filtered.length,
      selectedDate: selectedDate.toISOString(),
      timePeriod,
      calendarId
    });
    return filtered;
  }, [trades, selectedDate, timePeriod, calendarId]);

  // Get performance data from async calculations
  const riskRewardStats = performanceData?.riskRewardStats || { average: 0, max: 0, data: [] };

  // Chart data is now calculated asynchronously in useEffect above

  // Get win/loss statistics from async calculations
  const winLossStats = performanceData?.winLossStats || {
    total_trades: 0,
    win_rate: 0,
    winners: { total: 0, avgAmount: 0, maxConsecutive: 0, avgConsecutive: 0 },
    losers: { total: 0, avgAmount: 0, maxConsecutive: 0, avgConsecutive: 0 },
    breakevens: { total: 0, avgAmount: 0 }
  };

  // Get tag statistics from async calculations
  const tagStats = performanceData?.tagStats || [];

  // Get session statistics from async calculations
  const sessionStats = performanceData?.sessionStats || [];

  // Get all unique tags from async calculations
  const allTags = performanceData?.allTags || [];

  // Win/loss pie data and daily summary table data
  const winLossData = performanceData?.winLossData || [];
  const dailySummaryData = performanceData?.dailySummaryData || [];

  // Open the trades dialog filtered by win/loss/breakeven when a pie segment is clicked
  const handleWinLossPieClick = useCallback((category: string) => {
    const matchers: Record<string, (t: Trade) => boolean> = {
      Wins: (t) => t.amount > 0,
      Losses: (t) => t.amount < 0,
      Breakeven: (t) => t.amount === 0,
    };
    const predicate = matchers[category];
    if (!predicate) return;

    const matchingTrades = filteredTrades.filter(predicate);
    if (matchingTrades.length === 0) return;

    setTradesDialog({
      open: true,
      trades: matchingTrades,
      showChartInfo: true,
      title: `${category} (${matchingTrades.length})`,
      expandedTradeId: matchingTrades.length === 1 ? matchingTrades[0].id : null,
    });
  }, [filteredTrades]);

  // Calculate target value for monthly target
  const targetValue = useMemo(() => {
    if (monthlyTarget === undefined || accountBalance <= 0) return null;
    return (monthlyTarget / 100) * accountBalance;
  }, [monthlyTarget, accountBalance]);

  // Calculate drawdown violation value
  const drawdownViolationValue = useMemo(() => {
    return -(maxDailyDrawdown / 100) * accountBalance;
  }, [maxDailyDrawdown, accountBalance]);

  // These handlers are now used directly in the chart overlays - wrapped in useCallback

  const handleTradeExpand = useCallback((tradeId: string) => {
    setTradesDialog(prev => ({
      ...prev,
      expandedTradeId: prev.expandedTradeId === tradeId ? null : tradeId
    }));
  }, []);

  const handleZoomImage = useCallback((imageUrl: string, allImages?: string[], initialIndex?: number) => {
    setZoomedImages({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [imageUrl] });
  }, []);

  const handleTagAnalysisTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setTagAnalysisTab(newValue);
  }, []);

  // Construct tradeOperations object - hide edit/delete in read-only mode
  const tradeOperations: TradeOperationsProps = useMemo(() => ({
    onEditTrade: isReadOnly ? undefined : onEditTrade,
    onDeleteTrade: isReadOnly ? undefined : onDeleteTrade,
    onDeleteMultipleTrades: undefined,
    onUpdateTradeProperty: isReadOnly ? undefined : onUpdateTradeProperty,
    onZoomImage: handleZoomImage,
    onOpenGalleryMode: onOpenGalleryMode,
    economicFilter: economicFilterFn,
    calendarId: calendarId,
    calendar: calendar,
    isTradeUpdating: undefined,
    isReadOnly: isReadOnly
  }), [onEditTrade, onDeleteTrade, onUpdateTradeProperty, onOpenGalleryMode, economicFilterFn, calendarId, calendar, isReadOnly]);




  return (
    <Box
      sx={{
        px: 0,
        py: { xs: 1, sm: 2 },
        minHeight: { xs: 'auto', sm: 500 },
        '& .MuiPaper-root': {
          backgroundColor: theme.palette.background.paper,
          backgroundImage: 'none',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: `${theme.palette.custom.radius.xl}px`,
          boxShadow: 'none',
        },
      }}
    >
      {/* Image Zoom Dialog */}
      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={() => setZoomedImages(null)}
          imageProp={zoomedImages}
        />
      )}

      {/* Trades Dialog - Only render when open */}
      {tradesDialog.open && (
        <TradesListDialog
          open={tradesDialog.open}
          trades={tradesDialog.trades}
          title={tradesDialog.title}
          expandedTradeId={tradesDialog.expandedTradeId}
          showChartInfo={tradesDialog.showChartInfo || true}
          onClose={() => setTradesDialog(prev => ({ ...prev, open: false }))}
          onTradeExpand={handleTradeExpand}
          account_balance={accountBalance}
          tradeOperations={tradeOperations}
        />
      )}

      {/* Header Section - Stack on mobile */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 2, sm: 0 },
        mb: 2
      }}>
       
        {!hideTimePeriodTabs && (
          <RoundedTabs
            tabs={TIME_PERIOD_TABS}
            activeTab={getTimePeriodTabIndex(timePeriod)}
            onTabChange={handleTimePeriodTabChange}
            size={tabSize || 'small'}
            sx={{
              alignSelf: { xs: 'center', sm: 'auto' }
            }}
          />
        )}
      </Box>

      {/* KPI summary strip — hidden in narrow side-panel mode */}
      {!basicOnly && !isLoadingData && performanceData && (
        <KpiStrip performanceData={performanceData} />
      )}

      {/* Weekday win-rate breakdown */}
      {!basicOnly && !isLoadingData && filteredTrades.length > 0 && (
        <WeekdayWinRate trades={filteredTrades} />
      )}

      {/* Loading State */}
      {isLoadingData && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: chartHeights.large,
          }}
        >
          <CircularProgress size={28} />
        </Box>
      )}

      {/* Error State */}
      {calculationError && !isLoadingData && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setCalculationError(null);
                // Trigger recalculation by updating a dependency
                setPerformanceData(null);
              }}
            >
              Retry
            </Button>
          }
        >
          <Typography variant="body2">
            Failed to calculate performance metrics: {calculationError}
          </Typography>
        </Alert>
      )}

      {/* Main content */}
      {!isLoadingData && filteredTrades.length > 0 ? (
        <>
              {/* Risk to Reward Statistics Card */}
              <RiskRewardChart riskRewardStats={riskRewardStats} />

              {/* Winners and Losers Statistics */}
              <WinLossStats
                winLossStats={winLossStats}
                trades={filteredTrades}
                onTradeClick={handleTradeExpand}
                compact={basicOnly}
              />

              {/* Win/Loss Distribution + Daily Summary — side by side on desktop, stacked on mobile.
                  In basicOnly (narrow side-panel) only the pie is shown. */}
              {(winLossData.length > 0 || (!basicOnly && dailySummaryData.length > 0)) && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      md: basicOnly ? '1fr' : '1fr 1fr',
                    },
                    gap: 2,
                    mb: 3,
                    alignItems: 'stretch',
                  }}
                >
                  {winLossData.length > 0 && (
                    <WinLossDistribution
                      winLossData={winLossData}
                      onPieClick={handleWinLossPieClick}
                    />
                  )}
                  {!basicOnly && dailySummaryData.length > 0 && (
                    <DailySummaryTable
                      dailySummaryData={dailySummaryData}
                      trades={trades}
                      setMultipleTradesDialog={setTradesDialog}
                    />
                  )}
                </Box>
              )}

              {/* P&L Charts with Tabs (Heatmap, Cumulative, Daily) */}
              <PnLChartsWrapper
                chartData={chartData}
                targetValue={targetValue}
                monthly_target={monthlyTarget}
                drawdownViolationValue={drawdownViolationValue}
                setMultipleTradesDialog={setTradesDialog}
                timePeriod={timePeriod}
                trades={filteredTrades}
                selectedDate={selectedDate}
              />

              {/* Session Performance Analysis */}
              <Box sx={{ mb: 3 }}>
                <SessionPerformanceAnalysis
                  sessionStats={sessionStats}
                  trades={trades}
                  selectedDate={selectedDate}
                  timePeriod={timePeriod}
                  setMultipleTradesDialog={setTradesDialog}
                  chartData={chartData}
                  targetValue={targetValue}
                  monthly_target={monthlyTarget}
                />
              </Box>

          {/* Tag & economic analysis — hidden in narrow side-panel mode */}
          {!basicOnly && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

               {/* Tag Performance Analysis with Tabs */}
          <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
            <Box sx={{
              display: 'flex',
              justifyContent: { xs: 'center', sm: 'space-between' },
              alignItems: 'center',
              mb: 2
            }}>
              <RoundedTabs
                tabs={TAG_ANALYSIS_TABS}
                activeTab={tagAnalysisTab}
                onTabChange={handleTagAnalysisTabChange}
                size="small"
                sx={{
                  maxWidth: { xs: '100%', sm: 'none' }
                }}
              />
            </Box>

            {/* Tab Panel 0: Tag Pattern Insights — default tab (works on all tagged trades) */}
            {tagAnalysisTab === 0 && (
              <TagPatternAnalysis
                trades={filteredTrades}
                selectedDate={selectedDate}
                allTags={allTags}
                excludedTags={excludedPatternTags}
                onExcludedTagsChange={onUpdateCalendarProperty ? handleExcludedPatternTagsChange : undefined}
              />
            )}

            {/* Tab Panel 1: Tag Performance Analysis - Only render when active */}
            {tagAnalysisTab === 1 && (
              <TagPerformanceAnalysis
                trades={trades}
                selectedDate={selectedDate}
                timePeriod={timePeriod}
                allTags={allTags}
                primaryTags={primaryTags}
                secondaryTags={secondaryTags}
                setPrimaryTags={(tags) => {
                  setPrimaryTags(tags);
                  onPrimaryTagsChange(tags);
                }}
                setSecondaryTags={(tags) => {
                  setSecondaryTags(tags);
                  onSecondaryTagsChange(tags);
                }}
                setMultipleTradesDialog={setTradesDialog}
              />
            )}

            {/* Tab Panel 2: Tag Performance by Day of Week Analysis - Only render when active */}
            {tagAnalysisTab === 2 && (
              <TagDayOfWeekAnalysis
                trades={trades}
                selectedDate={selectedDate}
                timePeriod={timePeriod}
                allTags={allTags}
                primaryTags={primaryTags}
                secondaryTags={secondaryTags}
                setPrimaryTags={(tags) => {
                  setPrimaryTags(tags);
                  onPrimaryTagsChange(tags);
                }}
                setSecondaryTags={(tags) => {
                  setSecondaryTags(tags);
                  onSecondaryTagsChange(tags);
                }}
                setMultipleTradesDialog={setTradesDialog}
              />
            )}
          </Paper>

            {/* Economic Event Correlation Analysis */}
            <EconomicEventCorrelationAnalysis
              calendarId={calendarId}
              trades={filteredTrades}
              timePeriod={timePeriod}
              selectedDate={selectedDate}
              setMultipleTradesDialog={setTradesDialog}
              economicCorrelations={economicCorrelations}
            />
          </Box>
          )}
        </>
      ) : !isLoadingData ? (
        <Box
          sx={{
            height: { xs: chartHeights.medium, sm: 300 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          <Typography color="text.secondary">
            No trading data available for {timePeriod === 'month'
              ? format(selectedDate, 'MMMM yyyy')
              : timePeriod === 'year'
                ? format(selectedDate, 'yyyy')
                : 'All Time'
            }
          </Typography>
        </Box>
      ) : null}

    </Box>
  );
};

export default React.memo(PerformanceCharts);
