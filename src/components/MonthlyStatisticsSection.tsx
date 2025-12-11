import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useTheme,
  useMediaQuery
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
import { EconomicCalendarFilterSettings } from './economicCalendar/EconomicCalendarDrawer';
import { TradeOperationsProps } from '../types/tradeOperations';

interface MonthlyStatisticsSectionProps {
  trades: Trade[];
  selectedDate: Date;
  accountBalance: number;
  maxDailyDrawdown: number;
  monthly_target?: number;
  calendarId: string;
  scoreSettings?: import('../types/score').ScoreSettings;
  dynamicRiskSettings?: DynamicRiskSettings;
  allTags?: string[];
  isReadOnly?: boolean;

  // Trade operations - can be passed as object or individual props
  tradeOperations?: TradeOperationsProps;

  // Individual props (for backward compatibility)
  onUpdateTradeProperty?: TradeOperationsProps['onUpdateTradeProperty'];
  onUpdateCalendarProperty?: TradeOperationsProps['onUpdateCalendarProperty'];
  onEditTrade?: TradeOperationsProps['onEditTrade'];
  onDeleteTrade?: TradeOperationsProps['onDeleteTrade'];
  onDeleteMultipleTrades?: TradeOperationsProps['onDeleteMultipleTrades'];
  onZoomImage?: TradeOperationsProps['onZoomImage'];
  onOpenGalleryMode?: TradeOperationsProps['onOpenGalleryMode'];
  economicFilter?: TradeOperationsProps['economicFilter'];
  isTradeUpdating?: TradeOperationsProps['isTradeUpdating'];
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
  dynamicRiskSettings,
  allTags: propAllTags,
  isReadOnly = false,
  tradeOperations,
  // Individual props (fallback if tradeOperations not provided)
  onUpdateTradeProperty: onUpdateTradePropertyProp,
  onUpdateCalendarProperty: onUpdateCalendarPropertyProp,
  onEditTrade: onEditTradeProp,
  onDeleteTrade: onDeleteTradeProp,
  onDeleteMultipleTrades: onDeleteMultipleTradesProp,
  onZoomImage: onZoomImageProp,
  onOpenGalleryMode: onOpenGalleryModeProp,
  economicFilter: economicFilterProp,
  isTradeUpdating: isTradeUpdatingProp
}) => {
  // Extract from tradeOperations or use individual props
  const onUpdateTradeProperty = tradeOperations?.onUpdateTradeProperty || onUpdateTradePropertyProp;
  const onUpdateCalendarProperty = tradeOperations?.onUpdateCalendarProperty || onUpdateCalendarPropertyProp;
  const onEditTrade = tradeOperations?.onEditTrade || onEditTradeProp;
  const onDeleteTrade = tradeOperations?.onDeleteTrade || onDeleteTradeProp;
  const onDeleteMultipleTrades = tradeOperations?.onDeleteMultipleTrades || onDeleteMultipleTradesProp;
  const onZoomImage = tradeOperations?.onZoomImage || onZoomImageProp;
  const onOpenGalleryMode = tradeOperations?.onOpenGalleryMode || onOpenGalleryModeProp;
  const economicFilter = tradeOperations?.economicFilter || economicFilterProp;
  const isTradeUpdating = tradeOperations?.isTradeUpdating || isTradeUpdatingProp;
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
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

  // Use tags from props, fallback to extracting from trades if not available
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
      <Box sx={{ mb: { xs: 1.5, sm: 2 }, display: 'flex', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
        <Button
          variant="outlined"
          size={isXs ? 'small' : 'medium'}
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
        {!isXs && (
          <SessionPerformanceAnalysis
            sessionStats={sessionStats}
            trades={trades}
            selectedDate={selectedDate}
            timePeriod={timePeriod}
            setMultipleTradesDialog={setMultipleTradesDialog}
          />
        )}
        

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
        account_balance={accountBalance}
        allTrades={trades}
        tradeOperations={tradeOperations}
        onUpdateTradeProperty={onUpdateTradeProperty}
        onEditClick={onEditTrade}
        onDeleteClick={onDeleteTrade}
        onDeleteMultiple={onDeleteMultipleTrades}
        onZoomImage={onZoomImage}
        onOpenGalleryMode={onOpenGalleryMode}
        economicFilter={economicFilter}
        isTradeUpdating={isTradeUpdating}
        calendarId={calendarId}
      />

      {/* Performance Details Dialog */}
      <Dialog
        open={isPerformanceDialogOpen}
        onClose={() => setIsPerformanceDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={isXs}
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
            calendarIds={[calendarId]}
            scoreSettings={scoreSettings}
            onUpdateTradeProperty={onUpdateTradeProperty}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
            dynamicRiskSettings={dynamicRiskSettings}
            onEditTrade={onEditTrade}
            onDeleteTrade={onDeleteTrade}
            onOpenGalleryMode={onOpenGalleryMode}
            economicFilter={economicFilter}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MonthlyStatisticsSection;
