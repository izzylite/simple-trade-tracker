import React, { useMemo, useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Box, Typography, useTheme, Tabs, Tab, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar';
import ImageZoomDialog, { ImageZoomProp } from './ImageZoomDialog';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import ScoreSection from './ScoreSection';
import {
  PnLChartsWrapper,
  WinLossDistribution,
  WinLossStats,
  TagPerformanceAnalysis,
  TagDayOfWeekAnalysis,
  DailySummaryTable,
  SessionPerformanceAnalysis,
  TradesListDialog,
  RiskRewardChart
} from './charts';
import {
  calculateChartData,
  calculateSessionStats,
  calculateTargetValue,
  calculateDrawdownViolationValue,
  getFilteredTrades as utilGetFilteredTrades
} from '../utils/chartDataUtils';

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
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<void>;
  // Dynamic risk settings
  dynamicRiskSettings?: DynamicRiskSettings;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  // Calendar data for economic events filtering
  calendar?: {
    economicCalendarFilters?: {
      currencies: string[];
      impacts: string[];
      viewType: 'day' | 'week' | 'month';
    };
  };
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
    date: string;
    expandedTradeId: string | null;
  }>({
    open: false,
    trades: [],
    showChartInfo: true,
    date: '',
    expandedTradeId: null
  });

  // Keep multipleTradesDialog.trades in sync with the main trades array
  useEffect(() => {
    if (multipleTradesDialog.open && multipleTradesDialog.trades.length > 0) {
      // Filter out deleted trades and update remaining ones
      const updatedDialogTrades = multipleTradesDialog.trades
        .filter(dialogTrade => {
          // Keep the trade only if it still exists in the main trades array
          // or if it doesn't have isDeleted flag set to true
          const stillExists = trades.some(t => t.id === dialogTrade.id);
          return stillExists && !dialogTrade.isDeleted;
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


  // Calculate chart data using the async utility function
  useEffect(() => {
    const calculateChartDataAsync = async () => {
      setIsCalculatingChartData(true);
      try {
        const data = await calculateChartData(trades, selectedDate, timePeriod);
        setChartData(data);
      } catch (error) {
        console.error('Error calculating chart data:', error);
        setChartData([]);
      } finally {
        setIsCalculatingChartData(false);
      }
    };

    calculateChartDataAsync();
  }, [trades, selectedDate, timePeriod]);

  const handleTimePeriodChange = (newValue: TimePeriod) => {
    setTimePeriod(newValue);
    onTimePeriodChange?.(newValue);
  };

  // Use the utility function for filtering trades
  const getFilteredTrades = utilGetFilteredTrades;

  // Calculate Risk to Reward statistics
  const riskRewardStats = useMemo(() => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod)
      .filter(trade => trade.riskToReward !== undefined)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (filteredTrades.length === 0) return { average: 0, max: 0, data: [] };

    const riskRewardValues = filteredTrades.map(trade => trade.riskToReward!);
    const average = riskRewardValues.reduce((sum, value) => sum + value, 0) / riskRewardValues.length;
    const max = Math.max(...riskRewardValues);

    // Create data points for the line graph
    const data = filteredTrades.map(trade => ({
      date: format(new Date(trade.date), timePeriod === 'month' ? 'MM/dd' : 'MM/dd/yyyy'),
      rr: trade.riskToReward || 0
    }));

    return { average, max, data };
  }, [trades, selectedDate, timePeriod, getFilteredTrades]);

  // Chart data is now calculated asynchronously in useEffect above

  // Calculate win/loss statistics
  const winLossStats = useMemo(() => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);

    const wins = filteredTrades.filter(trade => trade.type === 'win');
    const losses = filteredTrades.filter(trade => trade.type === 'loss');
    const breakevens = filteredTrades.filter(trade => trade.type === 'breakeven');

    const totalWins = wins.length;
    const totalLosses = losses.length;
    const totalBreakevens = breakevens.length;
    const totalTrades = totalWins + totalLosses + totalBreakevens;

    // Calculate win rate excluding breakevens from the denominator
    const winRateDenominator = totalWins + totalLosses;
    const winRate = winRateDenominator > 0 ? (totalWins / winRateDenominator) * 100 : 0;

    const totalWinAmount = wins.reduce((sum, trade) => sum + trade.amount, 0);
    const totalLossAmount = losses.reduce((sum, trade) => sum + trade.amount, 0);
    const totalBreakevenAmount = breakevens.reduce((sum, trade) => sum + trade.amount, 0);

    const avgWin = totalWins > 0 ? totalWinAmount / totalWins : 0;
    const avgLoss = totalLosses > 0 ? totalLossAmount / totalLosses : 0;
    const avgBreakeven = totalBreakevens > 0 ? totalBreakevenAmount / totalBreakevens : 0;

    // Calculate consecutive wins and losses
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let totalWinStreaks = 0;
    let winStreakCount = 0;

    let currentLossStreak = 0;
    let maxLossStreak = 0;
    let totalLossStreaks = 0;
    let lossStreakCount = 0;

    // Sort trades by date
    const sortedTrades = [...filteredTrades].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedTrades.forEach(trade => {
      if (trade.type === 'win') {
        currentWinStreak++;
        currentLossStreak = 0;

        if (currentWinStreak > maxWinStreak) {
          maxWinStreak = currentWinStreak;
        }
      } else if (trade.type === 'loss') {
        if (currentWinStreak > 0) {
          totalWinStreaks += currentWinStreak;
          winStreakCount++;
        }
        currentWinStreak = 0;
        currentLossStreak++;

        if (currentLossStreak > maxLossStreak) {
          maxLossStreak = currentLossStreak;
        }
      } else if (trade.type === 'breakeven') {
        // For breakeven trades, we don't reset the streaks
        // This allows a breakeven trade to maintain an existing streak
      }
    });

    // Handle the last streak
    if (currentWinStreak > 0) {
      totalWinStreaks += currentWinStreak;
      winStreakCount++;
    } else if (currentLossStreak > 0) {
      totalLossStreaks += currentLossStreak;
      lossStreakCount++;
    }

    const avgWinStreak = winStreakCount > 0 ? totalWinStreaks / winStreakCount : 0;
    const avgLossStreak = lossStreakCount > 0 ? totalLossStreaks / lossStreakCount : 0;

    return {
      totalTrades,
      winRate,
      winners: {
        total: totalWins,
        avgAmount: avgWin,
        maxConsecutive: maxWinStreak,
        avgConsecutive: avgWinStreak
      },
      losers: {
        total: totalLosses,
        avgAmount: avgLoss,
        maxConsecutive: maxLossStreak,
        avgConsecutive: avgLossStreak
      },
      breakevens: {
        total: totalBreakevens,
        avgAmount: avgBreakeven
      }
    };
  }, [trades, selectedDate, timePeriod, getFilteredTrades]);

  // Calculate win/loss distribution data for pie chart
  const winLossData = useMemo(() => {
    const { winners, losers, breakevens } = winLossStats;

    return [
      { name: 'Wins', value: winners.total },
      { name: 'Losses', value: losers.total },
      { name: 'Breakeven', value: breakevens?.total || 0 }
    ].filter(item => item.value > 0); // Only include categories with values > 0
  }, [winLossStats]);

  // Calculate comparison win/loss data for selected tags
  const comparisonWinLossData = useMemo(() => {
    if (comparisonTags.length === 0) return null;

    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod)
      .filter(trade => {
        if (!trade.tags) return false;
        return comparisonTags.some(tag => trade.tags!.includes(tag));
      });

    const wins = filteredTrades.filter(trade => trade.type === 'win');
    const losses = filteredTrades.filter(trade => trade.type === 'loss');
    const breakevens = filteredTrades.filter(trade => trade.type === 'breakeven');

    return [
      { name: 'Wins', value: wins.length },
      { name: 'Losses', value: losses.length },
      { name: 'Breakeven', value: breakevens.length }
    ].filter(item => item.value > 0); // Only include categories with values > 0
  }, [trades, selectedDate, timePeriod, comparisonTags, getFilteredTrades]);

  // Calculate daily summary data
  const dailySummaryData = useMemo(() => {
    // Get trades filtered by the selected time period
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);

    // Group trades by date
    const tradesByDate = filteredTrades.reduce((acc, trade) => {
      const dateKey = format(new Date(trade.date), 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(trade);
      return acc;
    }, {} as { [key: string]: Trade[] });

    // Calculate daily statistics
    return Object.entries(tradesByDate)
      .map(([date, dayTrades]) => {
        const totalPnL = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);

        // Get the most common session for the day
        const sessionCounts = dayTrades.reduce((acc, trade) => {
          if (trade.session) {
            acc[trade.session] = (acc[trade.session] || 0) + 1;
          }
          return acc;
        }, {} as { [key: string]: number });

        // Find the session with the highest count
        let mostCommonSession = '';
        let highestCount = 0;

        Object.entries(sessionCounts).forEach(([session, count]) => {
          if (count > highestCount) {
            mostCommonSession = session;
            highestCount = count;
          }
        });

        return {
          date: parseISO(date),
          trades: dayTrades.length,
          session: mostCommonSession,
          pnl: totalPnL
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort by date descending
  }, [trades, selectedDate, timePeriod, getFilteredTrades]);

  // Add new useMemo for tag statistics
  const tagStats = useMemo(() => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);

    // Create a map to store stats for each tag
    const tagMap = new Map<string, { wins: number; losses: number; breakevens: number; totalPnL: number }>();

    filteredTrades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => {
          const stats = tagMap.get(tag) || { wins: 0, losses: 0, breakevens: 0, totalPnL: 0 };
          if (trade.type === 'win') {
            stats.wins++;
          } else if (trade.type === 'loss') {
            stats.losses++;
          } else if (trade.type === 'breakeven') {
            stats.breakevens++;
          }
          stats.totalPnL += trade.amount;
          tagMap.set(tag, stats);
        });
      }
    });

    // Convert map to array and calculate win rates
    return Array.from(tagMap.entries()).map(([tag, stats]) => {
      // Calculate win rate excluding breakevens from the denominator
      const totalTradesForWinRate = stats.wins + stats.losses;
      const winRate = totalTradesForWinRate > 0 ? Math.round((stats.wins / totalTradesForWinRate) * 100) : 0;
      const totalTrades = stats.wins + stats.losses + stats.breakevens;

      return {
        tag,
        wins: stats.wins,
        losses: stats.losses,
        breakevens: stats.breakevens,
        totalTrades,
        winRate,
        totalPnL: stats.totalPnL
      };
    }).sort((a, b) => b.totalTrades - a.totalTrades); // Sort by total trades descending
  }, [trades, selectedDate, timePeriod, getFilteredTrades]);

  // Calculate session performance statistics
  const sessionStats = useMemo(() => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod).filter(trade => trade.session !== undefined);

    const sessions = ['Asia', 'London', 'NY AM', 'NY PM'];


    return sessions.map(sessionName => {
      const sessionTrades = filteredTrades.filter(trade => trade.session === sessionName);
      const totalTrades = sessionTrades.length;
      const winners = sessionTrades.filter(trade => trade.type === 'win').length;
      const losers = sessionTrades.filter(trade => trade.type === 'loss').length;
      const breakevens = sessionTrades.filter(trade => trade.type === 'breakeven').length;

      // Calculate win rate excluding breakevens from the denominator
      const totalTradesForWinRate = winners + losers;
      const winRate = totalTradesForWinRate > 0 ? (winners / totalTradesForWinRate) * 100 : 0;

      const totalPnL = sessionTrades.reduce((sum, trade) => sum + trade.amount, 0);
      const averagePnL = totalTrades > 0 ? totalPnL / totalTrades : 0;
      const pnlPercentage = accountBalance > 0 ? (totalPnL / accountBalance) * 100 : 0;

      return {
        session: sessionName,
        totalTrades,
        winners,
        losers,
        breakevens,
        winRate,
        totalPnL,
        averagePnL,
        pnlPercentage
      };
    });
  }, [trades, selectedDate, timePeriod, accountBalance, getFilteredTrades]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    trades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [trades]);

   
  

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
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);
    let categoryTrades: Trade[] = [];
    let dialogTitle = '';

    // Check if we're clicking on a win/loss category or a tag
    if (category === 'Wins' || category === 'Losses') {
      // Filter trades based on the clicked category (Wins or Losses)
      categoryTrades = filteredTrades.filter(trade =>
        (category === 'Wins' && trade.type === 'win') ||
        (category === 'Losses' && trade.type === 'loss')
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
        date: dialogTitle,
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
        date={multipleTradesDialog.date}
        expandedTradeId={multipleTradesDialog.expandedTradeId}
        showChartInfo={multipleTradesDialog.showChartInfo || true}
        onUpdateTradeProperty={onUpdateTradeProperty}
        onClose={() => setMultipleTradesDialog(prev => ({ ...prev, open: false }))}
        onTradeExpand={handleTradeExpand}
        onZoomImage={handleZoomImage}
        accountBalance={accountBalance}
        allTrades={trades}
        onEditClick={onEditTrade}
        onDeleteClick={onDeleteTrade}
        onOpenGalleryMode={onOpenGalleryMode}
        calendarId={calendarId}
        calendar={calendar}
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
        <Tabs
          value={timePeriod}
          onChange={(_, newValue: TimePeriod) => handleTimePeriodChange(newValue)}
          sx={{
            minHeight: { xs: 36, sm: 40 },
            backgroundColor: theme.palette.mode === 'light' ? '#f0f0f0' : alpha(theme.palette.background.paper, 0.4),
            borderRadius: '20px',
            padding: '4px',
            alignSelf: { xs: 'center', sm: 'auto' },
            '& .MuiTabs-flexContainer': {
              gap: '4px'
            },
            '& .MuiTabs-indicator': {
              display: 'none'
            }
          }}
        >
          <Tab
            label="Month"
            value="month"
            sx={{
              minHeight: { xs: 28, sm: 32 },
              my: 0.2,
              textTransform: 'none',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              fontWeight: 500,
              color: 'text.secondary',
              borderRadius: '16px',
              padding: { xs: '4px 12px', sm: '6px 18px' },
              minWidth: { xs: 'auto', sm: 'auto' },
              '&.Mui-selected': {
                color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                backgroundColor: 'primary.main',
                boxShadow: theme.shadows[1]
              },
              '&:hover:not(.Mui-selected)': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                color: 'primary.main'
              }
            }}
          />
          <Tab
            label="Year"
            value="year"
            sx={{
              minHeight: { xs: 28, sm: 32 },
              my: 0.2,
              textTransform: 'none',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              fontWeight: 500,
              color: 'text.secondary',
              borderRadius: '16px',
              padding: { xs: '4px 12px', sm: '6px 18px' },
              minWidth: { xs: 'auto', sm: 'auto' },
              '&.Mui-selected': {
                color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                backgroundColor: 'primary.main',
                boxShadow: theme.shadows[1]
              },
              '&:hover:not(.Mui-selected)': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                color: 'primary.main'
              }
            }}
          />
          <Tab
            label="All Time"
            value="all"
            sx={{
              minHeight: { xs: 28, sm: 32 },
              my: 0.2,
              textTransform: 'none',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              fontWeight: 500,
              color: 'text.secondary',
              borderRadius: '16px',
              padding: { xs: '4px 12px', sm: '6px 18px' },
              minWidth: { xs: 'auto', sm: 'auto' },
              '&.Mui-selected': {
                color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                backgroundColor: 'primary.main',
                boxShadow: theme.shadows[1]
              },
              '&:hover:not(.Mui-selected)': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                color: 'primary.main'
              }
            }}
          />
        </Tabs>
      </Box>

      {/* Main content */}
      {chartData.some(data => data.pnl !== 0) || winLossData.some(data => data.value > 0) ? (
        <>
          {/* Risk to Reward Statistics Card */}
          <RiskRewardChart riskRewardStats={riskRewardStats} />

          {/* Winners and Losers Statistics */}
          <WinLossStats
            winLossStats={winLossStats}
            trades={getFilteredTrades(trades, selectedDate, timePeriod)}
            onTradeClick={handleTradeExpand}
          />

          {/* P&L Charts with Tabs */}
          <PnLChartsWrapper
            chartData={chartData}
            targetValue={targetValue}
            monthlyTarget={monthlyTarget}
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
              <Tabs
                value={tagAnalysisTab}
                onChange={handleTagAnalysisTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  minHeight: { xs: 36, sm: 40 },
                  backgroundColor: theme.palette.mode === 'light' ? '#f0f0f0' : alpha(theme.palette.background.paper, 0.4),
                  borderRadius: '20px',
                  padding: '4px',
                  maxWidth: { xs: '100%', sm: 'none' },
                  '& .MuiTabs-flexContainer': {
                    gap: '4px'
                  },
                  '& .MuiTabs-indicator': {
                    display: 'none'
                  },
                  '& .MuiTabs-scrollButtons': {
                    color: 'text.secondary'
                  }
                }}
              >
                <Tab
                  label="Tag Performance"
                  sx={{
                    minHeight: { xs: 28, sm: 32 },
                    my: 0.2,
                    textTransform: 'none',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    fontWeight: 500,
                    color: 'text.secondary',
                    borderRadius: '16px',
                    padding: { xs: '4px 8px', sm: '6px 18px' },
                    minWidth: { xs: 'auto', sm: 'auto' },
                    '&.Mui-selected': {
                      color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                      backgroundColor: 'primary.main',
                      boxShadow: theme.shadows[1]
                    },
                    '&:hover:not(.Mui-selected)': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      color: 'primary.main'
                    }
                  }}
                />
                <Tab
                  label="Day of Week"
                  sx={{
                    minHeight: { xs: 28, sm: 32 },
                    my: 0.2,
                    textTransform: 'none',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    fontWeight: 500,
                    color: 'text.secondary',
                    borderRadius: '16px',
                    padding: { xs: '4px 8px', sm: '6px 18px' },
                    minWidth: { xs: 'auto', sm: 'auto' },
                    '&.Mui-selected': {
                      color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                      backgroundColor: 'primary.main',
                      boxShadow: theme.shadows[1]
                    },
                    '&:hover:not(.Mui-selected)': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      color: 'primary.main'
                    }
                  }}
                />
              </Tabs>
            </Box>

            {/* Tab Panel 1: Tag Performance Analysis */}
            <Box sx={{ display: tagAnalysisTab === 0 ? 'block' : 'none' }}>
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
                setMultipleTradesDialog={setMultipleTradesDialog}
              />
            </Box>

            {/* Tab Panel 2: Tag Performance by Day of Week Analysis */}
            <Box sx={{ display: tagAnalysisTab === 1 ? 'block' : 'none' }}>
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
          </Box>
        </>
      ) : (
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
      )}
    </Box>
  );
};

export default PerformanceCharts;
