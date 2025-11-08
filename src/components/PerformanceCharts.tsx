import React, { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { format } from 'date-fns';
import { Box, Typography, useTheme, Paper, CircularProgress, LinearProgress, Alert, Button, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { Trade, Calendar } from '../types/dualWrite';
import ImageZoomDialog, { ImageZoomProp } from './ImageZoomDialog';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import ScoreSection from './ScoreSection';
import RoundedTabs from './common/RoundedTabs';
import { logger } from '../utils/logger';
import { getFilteredTrades } from '../utils/chartDataUtils';
import {
  performanceCalculationService,
  PerformanceCalculationResult,
  CalculationProgress
} from '../services/performanceCalculationService';
import ShimmerLoader from './common/ShimmerLoader';
import { supabase } from '../config/supabase';
import { EconomicCalendarFilterSettings, DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from './economicCalendar/EconomicCalendarDrawer';

// Lazy load chart components for better performance
const PnLChartsWrapper = lazy(() => import('./charts/PnLChartsWrapper'));
const WinLossDistribution = lazy(() => import('./charts/WinLossDistribution'));
const WinLossStats = lazy(() => import('./charts/WinLossStats'));
const TagPerformanceAnalysis = lazy(() => import('./charts/TagPerformanceAnalysis'));
const TagDayOfWeekAnalysis = lazy(() => import('./charts/TagDayOfWeekAnalysis'));
const DailySummaryTable = lazy(() => import('./charts/DailySummaryTable'));
const SessionPerformanceAnalysis = lazy(() => import('./charts/SessionPerformanceAnalysis'));
const TradesListDialog = lazy(() => import('./charts/TradesListDialog'));
const RiskRewardChart = lazy(() => import('./charts/RiskRewardChart'));
const EconomicEventCorrelationAnalysis = lazy(() => import('./charts/EconomicEventCorrelationAnalysis'));

interface PerformanceChartsProps {
  trades?: Trade[]; // Optional - will be fetched internally if not provided
  calendars?: Calendar[]; // Optional - if provided, will use these calendars instead of fetching
  selectedDate?: Date;
  monthlyTarget?: number;
  accountBalance?: number;
  maxDailyDrawdown?: number;
  tabSize?: 'large' | 'small';
  calendarIds?: string[]; // Optional - if empty, will fetch all calendars and show selector
  scoreSettings?: import('../types/score').ScoreSettings;
  onTimePeriodChange?: (period: TimePeriod) => void;
  onPrimaryTagsChange?: (tags: string[]) => void;
  onSecondaryTagsChange?: (tags: string[]) => void;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  economicFilter?: (calendarId: string) => EconomicCalendarFilterSettings;
  // Dynamic risk settings
  dynamicRiskSettings?: DynamicRiskSettings;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  // Calendar data for economic events filtering
  calendar?: Calendar;
  // Show calendar selector
  showCalendarSelector?: boolean;
}

type TimePeriod = 'month' | 'year' | 'all';

const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  trades: tradesProp,
  calendars: calendarsProp,
  selectedDate: selectedDateProp,
  monthlyTarget: monthlyTargetProp,
  accountBalance: accountBalanceProp,
  maxDailyDrawdown: maxDailyDrawdownProp,
  calendarIds: calendarIdsProp = [],
  scoreSettings: scoreSettingsProp,
  tabSize,
  onTimePeriodChange,
  onPrimaryTagsChange = () => { },
  onSecondaryTagsChange = () => { },
  onEditTrade,
  onDeleteTrade,
  onUpdateTradeProperty,
  onUpdateCalendarProperty,
  dynamicRiskSettings: dynamicRiskSettingsProp,
  onOpenGalleryMode,
  economicFilter,
  showCalendarSelector = false
}) => {
  const theme = useTheme();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [tagAnalysisTab, setTagAnalysisTab] = useState<number>(0);

  // Internal state
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('all');
  const [primaryTags, setPrimaryTags] = useState<string[]>([]);
  const [secondaryTags, setSecondaryTags] = useState<string[]>([]);

  // Use props directly - no internal fetching
  const trades = tradesProp || [];
  const calendars = calendarsProp || [];

  // Create a stable selectedDate - only create new Date() once on mount
  const [defaultDate] = useState(() => new Date());
  const selectedDate = useMemo(() => selectedDateProp || defaultDate, [selectedDateProp, defaultDate]);

  // Create stable calendar IDs array to prevent infinite loops
  // Only recalculate when the actual IDs change, not when the calendar objects change
  const allCalendarIds = useMemo(() => calendars.map(c => c.id), [calendars.map(c => c.id).join(',')]);

  // Determine which calendar IDs to use
  const calendarIds = useMemo(() => {
    if (calendarIdsProp.length > 0) {
      return calendarIdsProp;
    }
    if (selectedCalendarId === 'all') {
      return allCalendarIds;
    }
    return [selectedCalendarId];
  }, [calendarIdsProp.join(','), selectedCalendarId, allCalendarIds.join(',')]);

  // Get selected calendar for settings
  const selectedCalendar = useMemo(() => {
    if (selectedCalendarId === 'all') return null;
    return calendars.find(c => c.id === selectedCalendarId);
  }, [selectedCalendarId, calendars]);

  // Compute aggregated values for "All Calendars" mode
  const aggregatedValues = useMemo(() => {
    if (selectedCalendarId !== 'all' || calendars.length === 0) return null;

    return {
      accountBalance: calendars.reduce((sum, cal) => sum + (cal.account_balance || 0), 0) / calendars.length,
      maxDailyDrawdown: calendars.reduce((sum, cal) => sum + (cal.max_daily_drawdown || 0), 0) / calendars.length,
      monthlyTarget: calendars.reduce((sum, cal) => sum + (cal.monthly_target || 0), 0)
    };
  }, [selectedCalendarId, calendars]);

  // Compute final values with stable references
  const accountBalance = useMemo(() =>
    accountBalanceProp ?? selectedCalendar?.account_balance ?? aggregatedValues?.accountBalance ?? 0,
    [accountBalanceProp, selectedCalendar?.account_balance, aggregatedValues?.accountBalance]
  );

  const maxDailyDrawdown = useMemo(() =>
    maxDailyDrawdownProp ?? selectedCalendar?.max_daily_drawdown ?? aggregatedValues?.maxDailyDrawdown ?? 0,
    [maxDailyDrawdownProp, selectedCalendar?.max_daily_drawdown, aggregatedValues?.maxDailyDrawdown]
  );

  const monthlyTarget = useMemo(() =>
    monthlyTargetProp ?? selectedCalendar?.monthly_target ?? aggregatedValues?.monthlyTarget,
    [monthlyTargetProp, selectedCalendar?.monthly_target, aggregatedValues?.monthlyTarget]
  );

  const scoreSettings = useMemo(() =>
    scoreSettingsProp ?? selectedCalendar?.score_settings,
    [scoreSettingsProp, selectedCalendar?.score_settings]
  );

  // Build dynamic risk settings from calendar fields
  const dynamicRiskSettings = useMemo(() => {
    if (dynamicRiskSettingsProp) return dynamicRiskSettingsProp;
    if (!selectedCalendar) return undefined;

    return {
      account_balance: selectedCalendar.account_balance,
      risk_per_trade: selectedCalendar.risk_per_trade,
      dynamic_risk_enabled: selectedCalendar.dynamic_risk_enabled,
      increased_risk_percentage: selectedCalendar.increased_risk_percentage,
      profit_threshold_percentage: selectedCalendar.profit_threshold_percentage
    };
  }, [dynamicRiskSettingsProp, selectedCalendar]);

  // Economic filter function
  const economicFilterFn = economicFilter || ((calendarId: string) => {
    const calendar = calendars.find(c => c.id === calendarId);
    return calendar?.economic_calendar_filters || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS;
  });
  const [comparisonTags, setComparisonTags] = useState<string[]>([]);
  const [multipleTradesDialog, setMultipleTradesDialog] = useState<{
    open: boolean;
    trades: Trade[];
    showChartInfo?: boolean,
    date: string,
    title?: string,
    subtitle?: string,
    expandedTradeId: string | null;
  }>({
    open: false,
    trades: [],
    showChartInfo: true,
    date: '',
    title: '',
    subtitle: '',
    expandedTradeId: null
  });

  // Create stable trade IDs string for dependency tracking
  const tradeIdsString = useMemo(() => trades.map(t => t.id).join(','), [trades.map(t => t.id).join(',')]);

  // Keep multipleTradesDialog.trades in sync with the main trades array
  // Only run when trades array changes (by ID), not when dialog trades change
  useEffect(() => {
    if (multipleTradesDialog.open && multipleTradesDialog.trades.length > 0) {
      // Create a Map for O(1) lookup instead of O(n) with .find()
      const tradesMap = new Map(trades.map(t => [t.id, t]));

      // Filter out deleted trades and update remaining ones
      const updatedDialogTrades = multipleTradesDialog.trades
        .filter(dialogTrade => tradesMap.has(dialogTrade.id))
        .map(dialogTrade => tradesMap.get(dialogTrade.id)!);

      // If all trades were deleted, close the dialog
      if (updatedDialogTrades.length === 0) {
        setMultipleTradesDialog(prev => ({
          ...prev,
          open: false
        }));
        return;
      }

      // Only update if the number of trades changed or IDs changed
      const dialogTradeIds = multipleTradesDialog.trades.map(t => t.id).join(',');
      const updatedTradeIds = updatedDialogTrades.map(t => t.id).join(',');

      if (dialogTradeIds !== updatedTradeIds) {
        setMultipleTradesDialog(prev => ({
          ...prev,
          trades: updatedDialogTrades
        }));
      }
    }
  }, [tradeIdsString, multipleTradesDialog.open]);



  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isCalculatingChartData, setIsCalculatingChartData] = useState(false);

  // Performance calculation states
  const [performanceData, setPerformanceData] = useState<PerformanceCalculationResult | null>(null);
  const [isCalculatingPerformance, setIsCalculatingPerformance] = useState(false); 
  const [calculationError, setCalculationError] = useState<string | null>(null);


  // Calculate chart data using PostgreSQL RPC function
  useEffect(() => {
    // Don't calculate if no calendars are selected
    if (calendarIds.length === 0) {
      setChartData([]);
      setIsCalculatingChartData(false);
      return;
    }

    const calculateChartDataAsync = async () => {
      setIsCalculatingChartData(true);
      try {
        // Call appropriate RPC function based on number of calendars
        const { data, error } = calendarIds.length === 1
          ? await supabase.rpc('calculate_chart_data', {
            p_calendar_id: calendarIds[0],
            p_time_period: timePeriod,
            p_selected_date: selectedDate.toISOString()
          })
          : await supabase.rpc('calculate_chart_data_multi', {
            p_calendar_ids: calendarIds,
            p_time_period: timePeriod,
            p_selected_date: selectedDate.toISOString()
          });

        if (error) {
          logger.error('Error calling calculate_chart_data RPC:', error);
          throw error;
        }

        // Pre-process trades by date for O(1) lookup instead of O(n) filtering
        const tradesByDate = new Map<string, Trade[]>();
        trades.forEach(trade => {
          const dateKey = new Date(trade.trade_date).toDateString();
          if (!tradesByDate.has(dateKey)) {
            tradesByDate.set(dateKey, []);
          }
          tradesByDate.get(dateKey)!.push(trade);
        });

        // Transform RPC data to match chart component expectations
        const transformedData = (data || []).map((item: any, index: number, array: any[]) => {
          const prevCumulativePnl = index > 0 ? array[index - 1].cumulativePnl : 0;
          const dailyChange = item.cumulativePnl - prevCumulativePnl;
          const itemDate = new Date(item.date);
          const dateKey = itemDate.toDateString();

          return {
            date: format(itemDate, timePeriod === 'month' ? 'MM/dd' : 'MM/dd/yyyy'),
            pnl: item.pnl,
            cumulativePnL: item.cumulativePnl, // Match camelCase expected by chart
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


        setChartData(transformedData);
      } catch (error) {
        logger.error('Error calculating chart data:', error);
        setChartData([]);
      } finally {
        setIsCalculatingChartData(false);
      }
    };

    calculateChartDataAsync();
  }, [calendarIds, selectedDate, timePeriod, trades]);

  // Calculate performance metrics asynchronously using RPC function
  useEffect(() => {
    // Don't calculate if no calendars are selected
    if (calendarIds.length === 0) {
      setPerformanceData(null);
      setIsCalculatingPerformance(false);
      return;
    }

    const calculatePerformanceAsync = async () => {
      setIsCalculatingPerformance(true);
      setCalculationError(null);
      try {
        const data = await performanceCalculationService.calculatePerformanceMetrics(
          calendarIds,
          selectedDate,
          timePeriod,
          accountBalance,
          comparisonTags
        );
        setPerformanceData(data);
      } catch (error) {
        logger.error('Error calculating performance metrics:', error);
        setCalculationError(error instanceof Error ? error.message : 'Failed to calculate performance metrics');
        setPerformanceData(null);
      } finally {
        setIsCalculatingPerformance(false);
      }
    };


    calculatePerformanceAsync();
  }, [calendarIds, selectedDate, timePeriod, accountBalance, comparisonTags]);

  const handleTimePeriodChange = (newValue: TimePeriod) => {
    setTimePeriod(newValue);
    onTimePeriodChange?.(newValue);
  };

  // Define tabs for time period selection
  const timePeriodTabs = [
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
    { label: 'All Time', value: 'all' }
  ];

  // Convert string value to tab index for RoundedTabs
  const getTimePeriodTabIndex = (period: TimePeriod): number => {
    return timePeriodTabs.findIndex(tab => tab.value === period);
  };

  // Handle tab change for time period
  const handleTimePeriodTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    const newPeriod = timePeriodTabs[newIndex]?.value as TimePeriod;
    if (newPeriod) {
      handleTimePeriodChange(newPeriod);
    }
  };

  // Define tabs for tag analysis
  const tagAnalysisTabs = [
    { label: 'Tag Performance' },
    { label: 'Day of Week' }
  ];

  const filteredTrades = useMemo(() => {
    return getFilteredTrades(trades, selectedDate, timePeriod);
  }, [trades, selectedDate, timePeriod]);

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

  // Get win/loss distribution data from async calculations
  const winLossData = performanceData?.winLossData || [];

  // Get comparison win/loss data from async calculations
  const comparisonWinLossData = performanceData?.comparisonWinLossData || null;

  // Get daily summary data from async calculations
  const dailySummaryData = performanceData?.dailySummaryData || [];

  // Get tag statistics from async calculations
  const tagStats = performanceData?.tagStats || [];

  // Get session statistics from async calculations
  const sessionStats = performanceData?.sessionStats || [];

  // Get all unique tags from async calculations
  const allTags = performanceData?.allTags || [];




  // Calculate target value for monthly target
  const targetValue = useMemo(() => {
    if (monthlyTarget === undefined || accountBalance <= 0) return null;
    return (monthlyTarget / 100) * accountBalance;
  }, [monthlyTarget, accountBalance]);

  // Calculate drawdown violation value
  const drawdownViolationValue = useMemo(() => {
    return -(maxDailyDrawdown / 100) * accountBalance;
  }, [maxDailyDrawdown, accountBalance]);

  // These handlers are now used directly in the chart overlays

  const handleTradeExpand = (tradeId: string) => {
    setMultipleTradesDialog(prev => ({
      ...prev,
      expandedTradeId: prev.expandedTradeId === tradeId ? null : tradeId
    }));
  };

  const handleZoomImage = (imageUrl: string, allImages?: string[], initialIndex?: number) => {
    setZoomedImages({ selectetdImageIndex: initialIndex || 0, allImages: allImages || [imageUrl] });
  };

  const handleTagAnalysisTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTagAnalysisTab(newValue);
  };



  // Handle pie chart click to show trades
  const handlePieClick = (category: string) => {

    let categoryTrades: Trade[] = [];
    let dialogTitle = '';

    // Check if we're clicking on a win/loss category or a tag
    if (category === 'Wins' || category === 'Losses') {
      // Filter trades based on the clicked category (Wins or Losses)
      categoryTrades = filteredTrades.filter(trade =>
        (category === 'Wins' && trade.trade_type === 'win') ||
        (category === 'Losses' && trade.trade_type === 'loss')
      );

      // Format the date range for the dialog title
      let dateText;
      if (timePeriod === 'month') {
        dateText = format(selectedDate, 'MMMM yyyy');
      } else if (timePeriod === 'year') {
        dateText = format(selectedDate, 'yyyy');
      } else {
        dateText = 'All Time';
      }

      dialogTitle = `${category} for ${dateText}`;
    } else {
      // We're clicking on a tag in the tag distribution chart
      // Filter trades that have this tag
      categoryTrades = filteredTrades.filter(trade =>
        trade.tags?.includes(category)
      );

      dialogTitle = `Trades with tag: ${category}`;
    }

    if (categoryTrades.length > 0) {
      // Open the dialog with the filtered trades
      setMultipleTradesDialog({
        open: true,
        trades: categoryTrades,
        title: dialogTitle,
        date: selectedDate.toDateString(),
        expandedTradeId: categoryTrades.length === 1 ? categoryTrades[0].id : null
      });
    }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, minHeight: 500 }}>
      {/* Calendar Selector - Only shown in standalone mode */}
      {showCalendarSelector && calendars.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel id="calendar-select-label">Calendar</InputLabel>
            <Select
              labelId="calendar-select-label"
              value={selectedCalendarId}
              label="Calendar"
              onChange={(e) => setSelectedCalendarId(e.target.value)}
            >
              <MenuItem value="all">All Calendars</MenuItem>
              {calendars.map((calendar) => (
                <MenuItem key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}



      {/* Image Zoom Dialog */}
      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={() => setZoomedImages(null)}
          imageProp={zoomedImages}
        />
      )}

      {/* Trades Dialog - Only render when open */}
      {multipleTradesDialog.open && (
        <Suspense fallback={null}>
          <TradesListDialog
            open={multipleTradesDialog.open}
            trades={multipleTradesDialog.trades}
            title={multipleTradesDialog.title}
            date={multipleTradesDialog.date}
            expandedTradeId={multipleTradesDialog.expandedTradeId}
            showChartInfo={multipleTradesDialog.showChartInfo || true}
            onUpdateTradeProperty={onUpdateTradeProperty}
            onClose={() => setMultipleTradesDialog(prev => ({ ...prev, open: false }))}
            onTradeExpand={handleTradeExpand}
            onZoomImage={handleZoomImage}
            account_balance={accountBalance}
            allTrades={trades}
            onEditClick={onEditTrade}
            onDeleteClick={onDeleteTrade}
            onOpenGalleryMode={onOpenGalleryMode}
            calendarId={calendarIds[0] || ''}
            economicFilter={economicFilterFn}
          />
        </Suspense>
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
        <Typography
          variant="h6"
          sx={{
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            textAlign: { xs: 'center', sm: 'left' }
          }}
        >
          Performance Charts for {timePeriod === 'month'
            ? format(selectedDate, 'MMMM yyyy')
            : timePeriod === 'year'
              ? format(selectedDate, 'yyyy')
              : 'All Time'
          }
        </Typography>
        <RoundedTabs
          tabs={timePeriodTabs}
          activeTab={getTimePeriodTabIndex(timePeriod)}
          onTabChange={handleTimePeriodTabChange}
          size={tabSize || 'small'}
          sx={{
            alignSelf: { xs: 'center', sm: 'auto' }
          }}
        />
      </Box>

      {/* Loading State */}
      {(isCalculatingChartData) && (
        <> 
          {/* Shimmer loaders for different sections */} 
          <ShimmerLoader variant="chart" height={400} />

        </>
      )}

      {/* Error State */}
      {calculationError && !isCalculatingPerformance && (
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
      {!isCalculatingPerformance && !isCalculatingChartData && (chartData.some(data => data.pnl !== 0) || winLossData.some(data => data.value > 0)) ? (
        <>
          {/* Risk to Reward Statistics Card */}
          <Suspense fallback={<ShimmerLoader variant="chart" height={200} />}>
            <RiskRewardChart riskRewardStats={riskRewardStats} />
          </Suspense>

          {/* Winners and Losers Statistics */}
          <Suspense fallback={<ShimmerLoader variant="chart" height={200} />}>
            <WinLossStats
              winLossStats={winLossStats}
              trades={filteredTrades}
              onTradeClick={handleTradeExpand}
            />
          </Suspense>

          {/* P&L Charts with Tabs */}
          <Suspense fallback={<ShimmerLoader variant="chart" height={400} />}>
            <PnLChartsWrapper
              chartData={chartData}
              targetValue={targetValue}
              monthly_target={monthlyTarget}
              drawdownViolationValue={drawdownViolationValue}
              setMultipleTradesDialog={setMultipleTradesDialog}
              timePeriod={timePeriod}
            />
          </Suspense>

          {/* Win/Loss Distribution and Daily Summary - Stack on mobile */}
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 2, md: 3 },
            mb: 3,
            height: { xs: 'auto', md: '500px' }
          }}>
            <Box sx={{
              flex: 1,
              width: { xs: '100%', md: '50%' },
              height: { xs: '400px', md: '100%' }
            }}>
              {/* Win/Loss Distribution */}
              <Suspense fallback={<ShimmerLoader variant="chart" height={400} />}>
                <WinLossDistribution
                  winLossData={winLossData}
                  comparisonWinLossData={comparisonWinLossData}
                  allTags={allTags}
                  comparisonTags={comparisonTags}
                  setComparisonTags={setComparisonTags}
                  onPieClick={handlePieClick}
                  tagStats={tagStats}
                />
              </Suspense>
            </Box>
            <Box sx={{
              flex: 1,
              width: { xs: '100%', md: '50%' },
              height: { xs: '400px', md: '100%' }
            }}>
              {/* Daily Summary Table */}
              <Suspense fallback={<ShimmerLoader variant="chart" height={400} />}>
                <DailySummaryTable
                  dailySummaryData={dailySummaryData}
                  trades={trades}
                  setMultipleTradesDialog={setMultipleTradesDialog}
                />
              </Suspense>
            </Box>
          </Box>

          {/* Tag Performance Analysis with Tabs */}
          <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}>
            <Box sx={{
              display: 'flex',
              justifyContent: { xs: 'center', sm: 'space-between' },
              alignItems: 'center',
              mb: 2
            }}>
              <RoundedTabs
                tabs={tagAnalysisTabs}
                activeTab={tagAnalysisTab}
                onTabChange={handleTagAnalysisTabChange}
                size="small"
                sx={{
                  maxWidth: { xs: '100%', sm: 'none' }
                }}
              />
            </Box>

            {/* Tab Panel 1: Tag Performance Analysis - Only render when active */}
            {tagAnalysisTab === 0 && (
              <Suspense fallback={<ShimmerLoader variant="chart" height={300} />}>
                <TagPerformanceAnalysis
                  calendarIds={calendarIds}
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
                  setMultipleTradesDialog={setMultipleTradesDialog}
                />
              </Suspense>
            )}

            {/* Tab Panel 2: Tag Performance by Day of Week Analysis - Only render when active */}
            {tagAnalysisTab === 1 && (
              <Suspense fallback={<ShimmerLoader variant="chart" height={300} />}>
                <TagDayOfWeekAnalysis
                  calendarIds={calendarIds}
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
                  setMultipleTradesDialog={setMultipleTradesDialog}
                />
              </Suspense>
            )}
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Session Performance Analysis */}
            <Suspense fallback={<ShimmerLoader variant="chart" height={300} />}>
              <SessionPerformanceAnalysis
                sessionStats={sessionStats}
                trades={trades}
                selectedDate={selectedDate}
                timePeriod={timePeriod}
                setMultipleTradesDialog={setMultipleTradesDialog}
              />
            </Suspense>

            {/* Trading Score Section */}
            <ScoreSection
              trades={trades}
              selectedDate={selectedDate}
              calendarId={calendarIds[0] || ''}
              scoreSettings={scoreSettings}
              onUpdateCalendarProperty={onUpdateCalendarProperty}
              accountBalance={accountBalance}
              dynamicRiskSettings={dynamicRiskSettings}
            />

            {/* Economic Event Correlation Analysis */}
            <Suspense fallback={<ShimmerLoader variant="chart" height={300} />}>
              <EconomicEventCorrelationAnalysis
                calendarIds={calendarIds}
                trades={filteredTrades}
                timePeriod={timePeriod}
                selectedDate={selectedDate}
                setMultipleTradesDialog={setMultipleTradesDialog}
              />
            </Suspense>
          </Box>
        </>
      ) : !isCalculatingPerformance && !isCalculatingChartData ? (
        <Box
          sx={{
            height: 300,
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

export default PerformanceCharts;
