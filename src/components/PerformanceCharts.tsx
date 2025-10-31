import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Box, Typography, useTheme, Paper, CircularProgress, LinearProgress, Alert, Button } from '@mui/material';
import { Trade, Calendar } from '../types/dualWrite';
import ImageZoomDialog, { ImageZoomProp } from './ImageZoomDialog';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import ScoreSection from './ScoreSection';
import RoundedTabs from './common/RoundedTabs';
import { logger } from '../utils/logger';
import {
  PnLChartsWrapper,
  WinLossDistribution,
  WinLossStats,
  TagPerformanceAnalysis,
  TagDayOfWeekAnalysis,
  DailySummaryTable,
  SessionPerformanceAnalysis,
  TradesListDialog,
  RiskRewardChart,
  EconomicEventCorrelationAnalysis
} from './charts';
import { getFilteredTrades } from '../utils/chartDataUtils';
import {
  performanceCalculationService,
  PerformanceCalculationResult,
  CalculationProgress
} from '../services/performanceCalculationService';
import ShimmerLoader from './common/ShimmerLoader';
import { supabase } from '../config/supabase';

interface PerformanceChartsProps {
  trades: Trade[];
  selectedDate: Date;
  monthlyTarget?: number;
  accountBalance: number;
  maxDailyDrawdown: number;
  calendarId: string;
  scoreSettings?: import('../types/score').ScoreSettings;
  onTimePeriodChange?: (period: TimePeriod) => void;
  onPrimaryTagsChange?: (tags: string[]) => void;
  onSecondaryTagsChange?: (tags: string[]) => void;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  // Dynamic risk settings
  dynamicRiskSettings?: DynamicRiskSettings;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  // Calendar data for economic events filtering
  calendar?: Calendar;
}

type TimePeriod = 'month' | 'year' | 'all';

const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  trades,
  selectedDate,
  monthlyTarget,
  accountBalance,
  maxDailyDrawdown,
  calendarId,
  scoreSettings,
  onTimePeriodChange,
  onPrimaryTagsChange = () => { },
  onSecondaryTagsChange = () => { },
  onEditTrade,
  onDeleteTrade,
  onUpdateTradeProperty,
  onUpdateCalendarProperty,
  dynamicRiskSettings,
  onOpenGalleryMode,
  calendar
}) => {
  const theme = useTheme();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [tagAnalysisTab, setTagAnalysisTab] = useState<number>(0);
  const [primaryTags, setPrimaryTags] = useState<string[]>([]);
  const [secondaryTags, setSecondaryTags] = useState<string[]>([]);
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

  // Keep multipleTradesDialog.trades in sync with the main trades array
  useEffect(() => {
    if (multipleTradesDialog.open && multipleTradesDialog.trades.length > 0) {
      // Filter out deleted trades and update remaining ones
      const updatedDialogTrades = multipleTradesDialog.trades
        .filter(dialogTrade => {
          // Keep the trade only if it still exists in the main trades array
          const stillExists = trades.some(t => t.id === dialogTrade.id);
          return stillExists;
        })
        .map(dialogTrade => {
          // Find the corresponding trade in the main trades array
          const updatedTrade = trades.find(t => t.id === dialogTrade.id);
          // Return the updated trade if found, otherwise return the original dialog trade
          return updatedTrade || dialogTrade;
        });

      // If all trades were deleted, close the dialog
      if (updatedDialogTrades.length === 0) {
        setMultipleTradesDialog(prev => ({
          ...prev,
          open: false
        }));
        return;
      }

      // Only update if there are actual changes
      if (JSON.stringify(updatedDialogTrades) !== JSON.stringify(multipleTradesDialog.trades)) {
        setMultipleTradesDialog(prev => ({
          ...prev,
          trades: updatedDialogTrades
        }));
      }
    }
  }, [trades, multipleTradesDialog.open, multipleTradesDialog.trades]);



  const [zoomedImages, setZoomedImages] = useState<ImageZoomProp | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isCalculatingChartData, setIsCalculatingChartData] = useState(false);

  // Performance calculation states
  const [performanceData, setPerformanceData] = useState<PerformanceCalculationResult | null>(null);
  const [isCalculatingPerformance, setIsCalculatingPerformance] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState<CalculationProgress | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);


  // Calculate chart data using PostgreSQL RPC function
  useEffect(() => {
    const calculateChartDataAsync = async () => {
      setIsCalculatingChartData(true);
      try {
        const { data, error } = await supabase.rpc('calculate_chart_data', {
          p_calendar_id: calendarId,
          p_time_period: timePeriod,
          p_selected_date: selectedDate.toISOString()
        });

        if (error) {
          logger.error('Error calling calculate_chart_data RPC:', error);
          throw error;
        }

        // Transform RPC data to match chart component expectations
        const transformedData = (data || []).map((item: any, index: number, array: any[]) => {
          const prevCumulativePnl = index > 0 ? array[index - 1].cumulativePnl : 0;
          const dailyChange = item.cumulativePnl - prevCumulativePnl;

          return {
            date: format(new Date(item.date), timePeriod === 'month' ? 'MM/dd' : 'MM/dd/yyyy'),
            pnl: item.pnl,
            cumulativePnL: item.cumulativePnl, // Match camelCase expected by chart
            isIncreasing: item.cumulativePnl > prevCumulativePnl,
            isDecreasing: item.cumulativePnl < prevCumulativePnl,
            dailyChange: dailyChange,
            isWin: item.pnl > 0,
            isLoss: item.pnl < 0,
            isBreakEven: item.pnl === 0,
            trades: trades.filter(trade => {
              const tradeDate = new Date(trade.trade_date);
              const itemDate = new Date(item.date);
              return tradeDate.toDateString() === itemDate.toDateString();
            }),
            fullDate: new Date(item.date)
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
  }, [calendarId, selectedDate, timePeriod]);

  // Calculate performance metrics asynchronously using RPC function
  useEffect(() => {
    const calculatePerformanceAsync = async () => {
      setIsCalculatingPerformance(true);
      setCalculationProgress(null);
      setCalculationError(null);
      try {
        const data = await performanceCalculationService.calculatePerformanceMetrics(
          calendarId,
          selectedDate,
          timePeriod,
          accountBalance,
          comparisonTags,
          setCalculationProgress
        );
        setPerformanceData(data);
      } catch (error) {
        logger.error('Error calculating performance metrics:', error);
        setCalculationError(error instanceof Error ? error.message : 'Failed to calculate performance metrics');
        setPerformanceData(null);
      } finally {
        setIsCalculatingPerformance(false);
        setCalculationProgress(null);
      }
    };

    calculatePerformanceAsync();
  }, [calendarId, selectedDate, timePeriod, accountBalance, comparisonTags]);

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
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      {/* Image Zoom Dialog */}
      {zoomedImages && (
        <ImageZoomDialog
          open={!!zoomedImages}
          onClose={() => setZoomedImages(null)}
          imageProp={zoomedImages}
        />
      )}

      {/* Trades Dialog */}
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
        calendarId={calendarId}
        calendar={calendar ? { economic_calendar_filters: calendar.economic_calendar_filters } : undefined}
      />

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
          size="small"
          sx={{
            alignSelf: { xs: 'center', sm: 'auto' }
          }}
        />
      </Box>

      {/* Loading State */}
      {(isCalculatingPerformance || isCalculatingChartData) && (
        <>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={40} />
              <Typography variant="h6" color="text.secondary">
                {isCalculatingChartData ? 'Calculating chart data...' : 'Calculating performance metrics...'}
              </Typography>
              {calculationProgress && (
                <Box sx={{ width: '100%', maxWidth: 400 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {calculationProgress.step} ({calculationProgress.progress}/{calculationProgress.total})
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(calculationProgress.progress / calculationProgress.total) * 100}
                  />
                </Box>
              )}
            </Box>
          </Paper>

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
          <RiskRewardChart riskRewardStats={riskRewardStats} />

          {/* Winners and Losers Statistics */}
          <WinLossStats
            winLossStats={winLossStats}
            trades={filteredTrades}
            onTradeClick={handleTradeExpand}
          />

          {/* P&L Charts with Tabs */}
          <PnLChartsWrapper
            chartData={chartData}
            targetValue={targetValue}
            monthly_target={monthlyTarget}
            drawdownViolationValue={drawdownViolationValue}
            setMultipleTradesDialog={setMultipleTradesDialog}
            timePeriod={timePeriod}
          />

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
              <WinLossDistribution
                winLossData={winLossData}
                comparisonWinLossData={comparisonWinLossData}
                allTags={allTags}
                comparisonTags={comparisonTags}
                setComparisonTags={setComparisonTags}
                onPieClick={handlePieClick}
                tagStats={tagStats}
              />
            </Box>
            <Box sx={{
              flex: 1,
              width: { xs: '100%', md: '50%' },
              height: { xs: '400px', md: '100%' }
            }}>
              {/* Daily Summary Table */}
              <DailySummaryTable
                dailySummaryData={dailySummaryData}
                trades={trades}
                setMultipleTradesDialog={setMultipleTradesDialog}
              />
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

            {/* Tab Panel 1: Tag Performance Analysis */}
            <Box sx={{ display: tagAnalysisTab === 0 ? 'block' : 'none' }}>
              <TagPerformanceAnalysis
                calendarId={calendarId}
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
            </Box>

            {/* Tab Panel 2: Tag Performance by Day of Week Analysis */}
            <Box sx={{ display: tagAnalysisTab === 1 ? 'block' : 'none' }}>
              <TagDayOfWeekAnalysis
                calendarId={calendarId}
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
            </Box>
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Session Performance Analysis */}
            <SessionPerformanceAnalysis
              sessionStats={sessionStats}
              trades={trades}
              selectedDate={selectedDate}
              timePeriod={timePeriod}
              setMultipleTradesDialog={setMultipleTradesDialog}
            />



            {/* Trading Score Section */}
            <ScoreSection
              trades={trades}
              selectedDate={selectedDate}
              calendarId={calendarId}
              scoreSettings={scoreSettings}
              onUpdateCalendarProperty={onUpdateCalendarProperty}
              accountBalance={accountBalance}
              dynamicRiskSettings={dynamicRiskSettings}
            />

            {/* Economic Event Correlation Analysis */}
            <EconomicEventCorrelationAnalysis
              calendarId={calendarId}
              trades={filteredTrades}
              calendar={calendar!}
              timePeriod={timePeriod}
              selectedDate={selectedDate}
              setMultipleTradesDialog={setMultipleTradesDialog}
            />
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
