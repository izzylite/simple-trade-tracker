import React, { useMemo, useState, useEffect } from 'react';
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
import { logger } from '../utils/logger';
import { Close as CloseIcon, Analytics as AnalyticsIcon } from '@mui/icons-material';
import { Trade, Calendar } from '../types/dualWrite';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import { scrollbarStyles } from '../styles/scrollbarStyles';
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
  monthly_target?: number;
  calendarId: string;
  scoreSettings?: import('../types/score').ScoreSettings;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<Calendar | undefined>;
  dynamicRiskSettings?: DynamicRiskSettings;
  allTags?: string[]; // Add allTags prop to receive calendar.tags
  // Optional handlers for trade interactions
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onDeleteMultipleTrades?: (tradeIds: string[]) => void;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
  onZoomImage?: (imageUrl: string, allImages?: string[], initialIndex?: number) => void;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  calendar?: Calendar
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
  monthly_target,
  calendarId,
  scoreSettings,
  onUpdateTradeProperty,
  onUpdateCalendarProperty,
  dynamicRiskSettings,
  allTags: propAllTags,
  onEditTrade,
  onDeleteTrade,
  onDeleteMultipleTrades,
  onZoomImage,
  onOpenGalleryMode,
  calendar,
  isReadOnly = false
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
  const [chartData, setChartData] = useState<any[]>([]);
  const [isCalculatingChartData, setIsCalculatingChartData] = useState(false);

  const timePeriod: TimePeriod = 'month';

  // Calculate chart data using the async utility function
  useEffect(() => {
    const calculateChartDataAsync = async () => {
      setIsCalculatingChartData(true);
      try {
        const data = await calculateChartData(trades, selectedDate, timePeriod);
        setChartData(data);
      } catch (error) {
        logger.error('Error calculating chart data:', error);
        setChartData([]);
      } finally {
        setIsCalculatingChartData(false);
      }
    };

    calculateChartDataAsync();
  }, [trades, selectedDate, timePeriod]);

  // Calculate session statistics using the utility function
  const sessionStats = useMemo(() => {
    return calculateSessionStats(trades, selectedDate, timePeriod, accountBalance);
  }, [trades, selectedDate, timePeriod, accountBalance]);

  // Calculate target value using the utility function
  const targetValue = useMemo(() => {
    return calculateTargetValue(monthly_target, accountBalance);
  }, [monthly_target, accountBalance]);

  // Calculate drawdown violation value using the utility function
  const drawdownViolationValue = useMemo(() => {
    return calculateDrawdownViolationValue(maxDailyDrawdown, accountBalance);
  }, [maxDailyDrawdown, accountBalance]);

  // Calculate win/loss distribution data
  const winLossData = useMemo(() => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);
    const winners = filteredTrades.filter(trade => trade.trade_type === 'win').length;
    const losers = filteredTrades.filter(trade => trade.trade_type === 'loss').length;
    const breakevens = filteredTrades.filter(trade => trade.trade_type === 'breakeven').length;

    return [
      { name: 'Wins', value: winners },
      { name: 'Losses', value: losers },
      { name: 'Breakeven', value: breakevens }
    ].filter(item => item.value > 0);
  }, [trades, selectedDate, timePeriod]);

  // Use calendar.tags from props, fallback to extracting from trades if not available
  const allTags = useMemo(() => {
    if (propAllTags && propAllTags.length > 0) {
      return propAllTags;
    }

    // Fallback: extract from trades (for backwards compatibility)
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);
    const tagSet = new Set<string>();
    filteredTrades.forEach(trade => {
      if (trade.tags) {
        trade.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [propAllTags, trades, selectedDate, timePeriod]);

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
      total_trades: count
    }));
  }, [trades, selectedDate, timePeriod]);

  // Handle pie click to show trades
  const handlePieClick = (category: string) => {
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);
    let categoryTrades: Trade[] = [];

    if (category === 'Wins') {
      categoryTrades = filteredTrades.filter(trade => trade.trade_type === 'win');
    } else if (category === 'Losses') {
      categoryTrades = filteredTrades.filter(trade => trade.trade_type === 'loss');
    } else if (category === 'Breakeven') {
      categoryTrades = filteredTrades.filter(trade => trade.trade_type === 'breakeven');
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

        {/* Session Performance*/}
        <SessionPerformanceAnalysis
            sessionStats={sessionStats}
            trades={trades}
            selectedDate={selectedDate}
            timePeriod={timePeriod}
            setMultipleTradesDialog={setMultipleTradesDialog}
          />
        

      {/* Score Section */}
      <ScoreSection
        trades={trades}
        selectedDate={selectedDate}
        calendarId={calendarId}
        scoreSettings={scoreSettings}
        onUpdateCalendarProperty={onUpdateCalendarProperty}
        accountBalance={accountBalance}
        dynamicRiskSettings={dynamicRiskSettings}
        allTags={allTags}
      />
     

    



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
        onUpdateTradeProperty={onUpdateTradeProperty}
        onZoomImage={onZoomImage || (() => { })}
        account_balance={accountBalance}
        allTrades={trades}
        onEditClick={onEditTrade}
        onDeleteClick={onDeleteTrade}
        onDeleteMultiple={onDeleteMultipleTrades}
        onOpenGalleryMode={onOpenGalleryMode}
        calendar={calendar ? { economic_calendar_filters: calendar.economic_calendar_filters } : undefined}
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
          },
          '& .MuiDialogContent-root': {
            ...scrollbarStyles(theme)
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
            monthlyTarget={monthly_target}
            calendarId={calendarId}
            scoreSettings={scoreSettings}
            onUpdateTradeProperty={onUpdateTradeProperty}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
            dynamicRiskSettings={dynamicRiskSettings}
            onEditTrade={onEditTrade}
            onDeleteTrade={onDeleteTrade}
            onOpenGalleryMode={onOpenGalleryMode}
            calendar={calendar}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MonthlyStatisticsSection;
