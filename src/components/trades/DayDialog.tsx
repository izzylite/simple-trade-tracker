import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Button,
  Tooltip
} from '@mui/material';
import { ViewCarousel as GalleryIcon, Event as EventIcon } from '@mui/icons-material';
import { format, isAfter, startOfDay } from 'date-fns';
import { Trade } from '../../types/dualWrite';
import { BaseDialog } from '../common';
import { DayHeader, TradeList, ProgressSection } from './';
import { startOfNextDay } from './TradeFormDialog';
import { calculateCumulativePnLToDateAsync } from '../../utils/dynamicRiskUtils';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { TradeRepository } from '../../services/repository/repositories/TradeRepository';
import { logger } from '../../utils/logger';
import EconomicCalendarDrawer from '../economicCalendar/EconomicCalendarDrawer';

interface DayDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  trades: Trade[];
  account_balance: number;
  onDateChange: (date: Date) => void;
  // Form handler - DayDialog-specific, not part of tradeOperations
  showAddForm: (editTrade?: Trade | null) => void;
  // Unified trade operations from parent
  tradeOperations: TradeOperationsProps;
  // AI chat mode opener - needs trades context from DayDialog
  onOpenAIChatMode?: (trades: Trade[], tradeId: string, title?: string) => void;
  // Optional pre-fetched trades for the week (avoids redundant DB query in ProgressSection)
  weekTrades?: Trade[];
}



  

const DayDialog: React.FC<DayDialogProps> = ({
  open,
  onClose,
  date,
  trades,
  account_balance,
  showAddForm,
  onDateChange,
  tradeOperations,
  onOpenAIChatMode,
  weekTrades
}) => {
  // Destructure from tradeOperations
  const {
    calendarId,
    calendar,
    onOpenGalleryMode,
    isReadOnly = false
  } = tradeOperations;

  // State
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [dayTotalPnL, setDayTotalPnL] = useState<number>(0);
  const [cumulativePnL, setCumulativePnL] = useState<number>(0);
  const [eventsDrawerOpen, setEventsDrawerOpen] = useState(false);

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

  const handleOpenEventsDrawer = useCallback(() => {
    setEventsDrawerOpen(true);
  }, []);

  const tradesLength = trades?.length || 0;

  // Merge parent's tradeOperations with DayDialog-specific overrides
  const mergedTradeOperations: TradeOperationsProps = useMemo(() => ({
    ...tradeOperations,
    // Override onEditTrade to use DayDialog's form handler
    onEditTrade: isReadOnly ? undefined : handleEditClick,
    // Override onOpenAIChat to include trades context from DayDialog
    onOpenAIChat: onOpenAIChatMode ? handleOpenAIChat : undefined
  }), [tradeOperations, isReadOnly, handleEditClick, onOpenAIChatMode, handleOpenAIChat]);

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
          <>
            {calendar && (
              <Tooltip title="View economic events for this day">
                <Button
                  variant="outlined"
                  startIcon={<EventIcon />}
                  onClick={handleOpenEventsDrawer}
                  sx={{ mr: 1 }}
                >
                  Events
                </Button>
              </Tooltip>
            )}
            {onOpenGalleryMode && tradesLength > 0 && (
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
            )}
          </>
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

          {calendarId && calendar && (
            <ProgressSection
              calendarId={calendarId}
              currentBalance={account_balance + cumulativePnL}
              currentDate={date}
              calendar={calendar}
              weekTrades={weekTrades}
            />
          )}

          <TradeList
            trades={trades}
            expandedTradeId={expandedTradeId}
            onTradeClick={handleTradeClick}
            tradeOperations={mergedTradeOperations}
            hideActions={isReadOnly} // Hide edit/delete actions in read-only mode
            enableBulkSelection={isReadOnly ? false : tradesLength > 1} // Disable bulk selection in read-only mode
          />
        </Box>
      </BaseDialog>

      {calendar && (
        <EconomicCalendarDrawer
          open={eventsDrawerOpen}
          onClose={() => setEventsDrawerOpen(false)}
          calendar={calendar}
          tradeOperations={tradeOperations}
          isReadOnly={isReadOnly}
          initialDate={date}
        />
      )}
    </>
  );
};

export default DayDialog;


