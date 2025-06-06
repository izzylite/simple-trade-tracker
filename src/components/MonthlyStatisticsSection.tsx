import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useTheme
} from '@mui/material';
import { Close as CloseIcon, Analytics as AnalyticsIcon } from '@mui/icons-material';
import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import { PnLChartsWrapper, SessionPerformanceAnalysis, TradesListDialog, WinLossDistribution } from './charts';
import ScoreSection from './ScoreSection';
import PerformanceCharts from './PerformanceCharts';
import {
  calculateChartData,
  calculateSessionStats,
  calculateTargetValue,
  calculateDrawdownViolationValue,
  TimePeriod,
  getFilteredTrades
} from '../utils/chartDataUtils';

interface MonthlyStatisticsSectionProps {
  trades: Trade[];
  selectedDate: Date;
  accountBalance: number;
  maxDailyDrawdown: number;
  monthlyTarget?: number;
  calendarId: string;
  scoreSettings?: import('../types/score').ScoreSettings;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<void>;
  dynamicRiskSettings?: DynamicRiskSettings;
  // Optional handlers for trade interactions
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onZoomImage?: (imageUrl: string, allImages?: string[], initialIndex?: number) => void;
}

interface MultipleTradesDialog {
  open: boolean;
  trades: Trade[];
  date: string;
  expandedTradeId: string | null;
}

const MonthlyStatisticsSection: React.FC<MonthlyStatisticsSectionProps> = ({
  trades,
  selectedDate,
  accountBalance,
  maxDailyDrawdown,
  monthlyTarget,
  calendarId,
  scoreSettings,
  onUpdateCalendarProperty,
  dynamicRiskSettings,
  onEditTrade,
  onDeleteTrade,
  onZoomImage
}) => {
  const theme = useTheme();
  const [multipleTradesDialog, setMultipleTradesDialog] = useState<MultipleTradesDialog>({
    open: false,
    trades: [],
    date: '',
    expandedTradeId: null
  });
  const [isPerformanceDialogOpen, setIsPerformanceDialogOpen] = useState(false);
  const [comparisonTags, setComparisonTags] = useState<string[]>([]);

  const timePeriod: TimePeriod = 'month';

  // Calculate chart data using the utility function
  const chartData = useMemo(() => {
    return calculateChartData(trades, selectedDate, timePeriod);
  }, [trades, selectedDate, timePeriod]);

  // Calculate session statistics using the utility function
  const sessionStats = useMemo(() => {
    return calculateSessionStats(trades, selectedDate, timePeriod, accountBalance);
  }, [trades, selectedDate, timePeriod, accountBalance]);

  // Calculate target value using the utility function
  const targetValue = useMemo(() => {
    return calculateTargetValue(monthlyTarget, accountBalance);
  }, [monthlyTarget, accountBalance]);

  // Calculate drawdown violation value using the utility function
  const drawdownViolationValue = useMemo(() => {
    return calculateDrawdownViolationValue(maxDailyDrawdown, accountBalance);
  }, [maxDailyDrawdown, accountBalance]);

  // Calculate win/loss distribution data
  const winLossData = useMemo(() => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);
    const winners = filteredTrades.filter(trade => trade.type === 'win').length;
    const losers = filteredTrades.filter(trade => trade.type === 'loss').length;
    const breakevens = filteredTrades.filter(trade => trade.type === 'breakeven').length;

    return [
      { name: 'Wins', value: winners },
      { name: 'Losses', value: losers },
      { name: 'Breakeven', value: breakevens }
    ].filter(item => item.value > 0);
  }, [trades, selectedDate, timePeriod]);

  // Get all unique tags for comparison
  const allTags = useMemo(() => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);
    const tagSet = new Set<string>();
    filteredTrades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [trades, selectedDate, timePeriod]);

  // Calculate tag stats for distribution
  const tagStats = useMemo(() => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);
    const tagCounts = new Map<string, number>();

    filteredTrades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    return Array.from(tagCounts.entries()).map(([tag, count]) => ({
      tag,
      totalTrades: count
    }));
  }, [trades, selectedDate, timePeriod]);

  // Handle pie click to show trades
  const handlePieClick = (category: string) => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);
    let categoryTrades: Trade[] = [];

    if (category === 'Wins') {
      categoryTrades = filteredTrades.filter(trade => trade.type === 'win');
    } else if (category === 'Losses') {
      categoryTrades = filteredTrades.filter(trade => trade.type === 'loss');
    } else if (category === 'Breakeven') {
      categoryTrades = filteredTrades.filter(trade => trade.type === 'breakeven');
    } else {
      // It's a tag
      categoryTrades = filteredTrades.filter(trade =>
        trade.tags && trade.tags.includes(category)
      );
    }

    if (categoryTrades.length > 0) {
      setMultipleTradesDialog({
        open: true,
        trades: categoryTrades,
        date: `${category} Trades`,
        expandedTradeId: null
      });
    }
  };

  return (
    <>
      {/* View Details Stats Button */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<AnalyticsIcon />}
          onClick={() => setIsPerformanceDialogOpen(true)}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600
          }}
        >
          View Details Stats
        </Button>
      </Box>

 {/* Score Section */}
      <ScoreSection
        trades={trades}
        selectedDate={selectedDate}
        calendarId={calendarId}
        scoreSettings={scoreSettings}
        onUpdateCalendarProperty={onUpdateCalendarProperty}
        accountBalance={accountBalance}
        dynamicRiskSettings={dynamicRiskSettings}
      />
      {/* P&L Charts Section */}
      <PnLChartsWrapper
        chartData={chartData}
        targetValue={targetValue}
        monthlyTarget={monthlyTarget}
        drawdownViolationValue={drawdownViolationValue}
        setMultipleTradesDialog={setMultipleTradesDialog}
        timePeriod={timePeriod}
      />

      {/* Session Performance and Win Distribution side by side */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
        <Box sx={{ flex: 1, width: { xs: '100%', md: '50%' } }}>
          <SessionPerformanceAnalysis
            sessionStats={sessionStats}
            trades={trades}
            selectedDate={selectedDate}
            timePeriod={timePeriod}
            setMultipleTradesDialog={setMultipleTradesDialog}
          />
        </Box>
        <Box sx={{ flex: 1, width: { xs: '100%', md: '50%' } }}>
          <WinLossDistribution
            winLossData={winLossData}
            comparisonWinLossData={null}
            allTags={allTags}
            comparisonTags={comparisonTags}
            setComparisonTags={setComparisonTags}
            onPieClick={handlePieClick}
            tagStats={tagStats}
          />
        </Box>
      </Box>

     

      {/* Trades List Dialog */}
      <TradesListDialog
        open={multipleTradesDialog.open}
        onClose={() => setMultipleTradesDialog(prev => ({ ...prev, open: false }))}
        trades={multipleTradesDialog.trades}
        date={multipleTradesDialog.date}
        expandedTradeId={multipleTradesDialog.expandedTradeId}
        onTradeExpand={(tradeId) =>
          setMultipleTradesDialog(prev => ({
            ...prev,
            expandedTradeId: prev.expandedTradeId === tradeId ? null : tradeId
          }))
        }
        onZoomImage={onZoomImage || (() => {})}
        accountBalance={accountBalance}
        allTrades={trades}
        onEditClick={onEditTrade}
        onDeleteClick={onDeleteTrade}
      />

      {/* Performance Details Dialog */}
      <Dialog
        open={isPerformanceDialogOpen}
        onClose={() => setIsPerformanceDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: 2,
            boxShadow: 'none',
            border: `1px solid ${theme.palette.divider}`,
            maxHeight: '90vh',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Typography variant="h6">
              Performance Analytics
            </Typography>
            <IconButton onClick={() => setIsPerformanceDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <PerformanceCharts
            trades={trades}
            selectedDate={selectedDate}
            accountBalance={accountBalance}
            maxDailyDrawdown={maxDailyDrawdown}
            monthlyTarget={monthlyTarget}
            calendarId={calendarId}
            scoreSettings={scoreSettings}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
            dynamicRiskSettings={dynamicRiskSettings}
            onEditTrade={onEditTrade}
            onDeleteTrade={onDeleteTrade}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MonthlyStatisticsSection;
