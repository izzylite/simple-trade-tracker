import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Tooltip
} from '@mui/material';
import { ViewCarousel as GalleryIcon } from '@mui/icons-material';
import { format, isAfter, startOfDay } from 'date-fns';
import { Trade, Calendar } from '../../types/dualWrite';
import { BaseDialog } from '../common';
import { DayHeader, TradeList, ProgressSection } from './';
import { startOfNextDay } from './TradeFormDialog';
import { calculateCumulativePnLToDateAsync } from '../../utils/dynamicRiskUtils';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { TradeRepository } from '../../services/repository/repositories/TradeRepository';
import { logger } from '../../utils/logger';
interface DayDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  trades: Trade[];
  account_balance: number;
  onDateChange: (date: Date) => void;
  showAddForm: (ediTrade?: Trade | null) => void;
  onDeleteTrade: (tradeId: string) => void;
  onDeleteMultipleTrades?: (tradeIds: string[]) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  setZoomedImage: (url: string, allImages?: string[], initialIndex?: number) => void;
  calendarId: string;
  deletingTradeIds?: string[];
  // isTradeUpdating now comes from TradeSyncContext
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  // Open AI chat mode for a specific trade
  onOpenAIChatMode?: (trades: Trade[], tradeId: string, title?: string) => void;
  // Calendar data for economic events filtering and progress tracking
  calendar: Calendar;
  // Update calendar properties (for pinning events, etc.)
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
}



  

const DayDialog: React.FC<DayDialogProps> = ({
  open,
  onClose,
  date,
  trades,
  account_balance,
  onDeleteTrade,
  onDeleteMultipleTrades,
  showAddForm,
  onDateChange,
  onUpdateTradeProperty,
  setZoomedImage,
  calendarId,
  deletingTradeIds,
  onOpenGalleryMode,
  onOpenAIChatMode,
  calendar,
  onUpdateCalendarProperty,
  isReadOnly = false
}) => {

  // State
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [dayTotalPnL, setDayTotalPnL] = useState<number>(0);
  const [cumulativePnL, setCumulativePnL] = useState<number>(0);

  // Use stable primitives for useEffect dependencies to prevent infinite re-renders
  const dateTime = date.getTime();
  const calendarIdForEffect = calendar?.id;

  // Fetch cumulative P&L when dialog opens or date changes
  useEffect(() => {
    const fetchCumulativePnL = async () => {
      if (!open || !calendar) return;

      try {
        const targetDate = startOfNextDay(date);
        const pnl = await calculateCumulativePnLToDateAsync(targetDate, calendar);
        setCumulativePnL(pnl);
      } catch (error) {
        logger.error('Error fetching cumulative P&L:', error);
        setCumulativePnL(0);
      }
    };

    fetchCumulativePnL();
  }, [open, dateTime, calendarIdForEffect]);

  // Fetch day's total P&L when dialog opens or date changes
  useEffect(() => {
    const fetchDayTotalPnL = async () => {
      if (!open || !calendarId) return;

      try {
        const tradeRepo = new TradeRepository();
        const dayTrades = await tradeRepo.getTradesByDay(calendarId, date, ['amount']);
        const total = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);
        setDayTotalPnL(total);
      } catch (error) {
        logger.error('Error fetching day total P&L:', error);
        setDayTotalPnL(0);
      }
    };

    fetchDayTotalPnL();
  }, [open, dateTime, calendarId]);
  
 

  // Handlers - wrapped in useCallback to prevent child re-renders
  const handlePrevDay = useCallback(() => {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    onDateChange(prevDay);
  }, [date, onDateChange]);

  const handleNextDay = useCallback(() => {
    const nextDay = startOfNextDay(date);
    // Don't allow navigating to future dates
    if (!isAfter(nextDay, startOfDay(new Date()))) {
      onDateChange(nextDay);
    }
  }, [date, onDateChange]);

  const handleTradeClick = useCallback((tradeId: string) => {
    setExpandedTradeId(prev => prev === tradeId ? null : tradeId);
  }, []);

  const handleAddClick = useCallback(async () => {
    showAddForm(null);
  }, [showAddForm]);



  const handleEditClick = useCallback((trade: Trade) => {
    showAddForm(trade);
  }, [showAddForm]);

  const handleGalleryModeClick = useCallback(() => {
    if (onOpenGalleryMode && trades && trades.length > 0) {
      const title = `${format(date, 'EEEE, MMMM d, yyyy')} - ${trades.length} Trade${trades.length > 1 ? 's' : ''}`;
      onOpenGalleryMode(trades, expandedTradeId || trades[0].id, title);
      onClose(); // Close the day dialog when opening gallery mode
    }
  }, [onOpenGalleryMode, trades, date, expandedTradeId, onClose]);

  const handleOpenAIChat = useCallback((trade: Trade) => {
    if (onOpenAIChatMode) {
      const title = `AI Analysis - ${trade.name || format(date, 'MMM d, yyyy')}`;
      setExpandedTradeId(null); // Collapse trade so TradeGalleryDialog fully overlaps
      onOpenAIChatMode(trades, trade.id, title);
      // Don't close DayDialog - only close when opening gallery mode
    }
  }, [onOpenAIChatMode, trades, date]);

  const tradesLength = trades?.length || 0;

  // Create tradeOperations object for TradeList (isTradeUpdating now comes from TradeSyncContext)
  const tradeOperations: TradeOperationsProps = useMemo(() => ({
    onEditTrade: handleEditClick,
    onDeleteTrade,
    onDeleteMultipleTrades,
    onZoomImage: setZoomedImage,
    onUpdateTradeProperty: isReadOnly ? undefined : onUpdateTradeProperty,
    deletingTradeIds: deletingTradeIds || [],
    calendarId,
    onOpenGalleryMode,
    onOpenAIChat: onOpenAIChatMode ? handleOpenAIChat : undefined,
    economicFilter: undefined,
    calendar,
    onUpdateCalendarProperty: isReadOnly ? undefined : onUpdateCalendarProperty
  }), [onDeleteTrade, onDeleteMultipleTrades, setZoomedImage, isReadOnly, onUpdateTradeProperty, deletingTradeIds, calendarId, onOpenGalleryMode, onOpenAIChatMode, calendar, onUpdateCalendarProperty]);

  return (
    <>
      <BaseDialog
        open={open}
        onClose={() => {
          // Only allow closing if we're not in the process of creating an empty trade
          onClose();
        }}
        title="Daily Trades"
        maxWidth="md"
        fullWidth
        hideCloseButton={false}
        primaryButtonText={isReadOnly ? undefined : 'Add Trade'}
        primaryButtonAction={isReadOnly ? undefined : () => handleAddClick()}
        hideFooterCancelButton={false}
        actions={
          onOpenGalleryMode && tradesLength > 0 ? (
            <Tooltip title="View trades in gallery mode">
              <Button
                variant="outlined"
                startIcon={<GalleryIcon />}
                onClick={handleGalleryModeClick}
                sx={{ mr: 1 }}
              >
                Gallery View
              </Button>
            </Tooltip>
          ) : undefined
        }
      >
        <Box sx={{ p: 3 }}>

          <DayHeader
            title={format(date, 'EEEE, MMMM d, yyyy')}
            account_balance={account_balance + cumulativePnL}
            formInputVisible={false}
            total_pnl={dayTotalPnL}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
          />

          <ProgressSection
            calendarId={calendarId}
            currentBalance={account_balance + cumulativePnL}
            currentDate={date}
            calendar={calendar}
          />

          <TradeList
            trades={trades}
            expandedTradeId={expandedTradeId}
            onTradeClick={handleTradeClick}
            tradeOperations={tradeOperations}
            hideActions={isReadOnly} // Hide edit/delete actions in read-only mode
            enableBulkSelection={isReadOnly ? false : tradesLength > 1} // Disable bulk selection in read-only mode
          />
        </Box>
      </BaseDialog>

     
    </>

  );
};

export default DayDialog;


