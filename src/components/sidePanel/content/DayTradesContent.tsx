/**
 * DayTradesContent Component
 * Inner content for daily trades view — usable inside a dialog (DayDialog) or side panel
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import { Event as EventIcon } from '@mui/icons-material';
import { format, isAfter, startOfDay } from 'date-fns';
import { Trade } from '../../../types/dualWrite';
import { DayHeader, TradeList, ProgressSection } from '../../trades';
import { startOfNextDay } from '../../trades/TradeFormDialog';
import { calculateCumulativePnLToDateAsync } from '../../../utils/dynamicRiskUtils';
import { TradeOperationsProps } from '../../../types/tradeOperations';
import { TradeRepository } from '../../../services/repository/repositories/TradeRepository';
import { logger } from '../../../utils/logger';
import EconomicCalendarDrawer from '../../economicCalendar/EconomicCalendarDrawer';

export interface DayTradesContentProps {
  date: Date;
  trades: Trade[];
  account_balance: number;
  onDateChange: (date: Date) => void;
  showAddForm: (editTrade?: Trade | null) => void;
  tradeOperations: TradeOperationsProps;
  onOpenAIChatMode?: (trades: Trade[], tradeId: string, title?: string) => void;
  weekTrades?: Trade[];
  isActive?: boolean;
  /** Optional: when provided, used for "View Events" button instead of opening internal drawer */
  onOpenEvents?: () => void;
}

const DayTradesContent: React.FC<DayTradesContentProps> = ({
  date,
  trades,
  account_balance,
  showAddForm,
  onDateChange,
  tradeOperations,
  onOpenAIChatMode,
  weekTrades,
  isActive = true,
  onOpenEvents,
}) => {
  const {
    calendarId,
    calendar,
    isReadOnly = false,
  } = tradeOperations;

  // State
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [dayTotalPnL, setDayTotalPnL] = useState<number>(0);
  const [cumulativePnL, setCumulativePnL] = useState<number>(0);
  const [eventsDrawerOpen, setEventsDrawerOpen] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  // Use stable primitives for useEffect dependencies to prevent infinite re-renders
  const dateTime = date.getTime();
  const calendarIdForEffect = calendar?.id;

  // Fetch cumulative P&L when active or date changes
  useEffect(() => {
    let cancelled = false;
    const fetchCumulativePnL = async () => {
      if (!isActive || !calendar) return;
      setIsBalanceLoading(true);

      try {
        const targetDate = startOfNextDay(date);
        const pnl = await calculateCumulativePnLToDateAsync(targetDate, calendar);
        if (!cancelled) setCumulativePnL(pnl);
      } catch (error) {
        logger.error('Error fetching cumulative P&L:', error);
        if (!cancelled) setCumulativePnL(0);
      } finally {
        if (!cancelled) setIsBalanceLoading(false);
      }
    };

    fetchCumulativePnL();
    return () => { cancelled = true; };
  }, [isActive, dateTime, calendarIdForEffect]);

  // Fetch day's total P&L when active or date changes
  useEffect(() => {
    let cancelled = false;
    const fetchDayTotalPnL = async () => {
      if (!isActive || !calendarId) return;

      try {
        const tradeRepo = new TradeRepository();
        const dayTrades = await tradeRepo.getTradesByDay(calendarId, date, ['amount']);
        const total = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);
        if (!cancelled) setDayTotalPnL(total);
      } catch (error) {
        logger.error('Error fetching day total P&L:', error);
        if (!cancelled) setDayTotalPnL(0);
      }
    };

    fetchDayTotalPnL();
    return () => { cancelled = true; };
  }, [isActive, dateTime, calendarId]);

  // Handlers
  const handlePrevDay = useCallback(() => {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    onDateChange(prevDay);
  }, [date, onDateChange]);

  const handleNextDay = useCallback(() => {
    const nextDay = startOfNextDay(date);
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

  const handleOpenAIChat = useCallback((trade: Trade) => {
    if (onOpenAIChatMode) {
      const title = `AI Analysis - ${trade.name || format(date, 'MMM d, yyyy')}`;
      setExpandedTradeId(null);
      onOpenAIChatMode(trades, trade.id, title);
    }
  }, [onOpenAIChatMode, trades, date]);

  const handleOpenEventsDrawer = useCallback(() => {
    if (onOpenEvents) {
      onOpenEvents();
    } else {
      setEventsDrawerOpen(true);
    }
  }, [onOpenEvents]);

  const tradesLength = trades?.length || 0;

  // Merge parent's tradeOperations with DayTradesContent-specific overrides
  const mergedTradeOperations: TradeOperationsProps = useMemo(() => ({
    ...tradeOperations,
    onEditTrade: isReadOnly ? undefined : handleEditClick,
    onOpenAIChat: onOpenAIChatMode ? handleOpenAIChat : undefined,
  }), [tradeOperations, isReadOnly, handleEditClick, onOpenAIChatMode, handleOpenAIChat]);

  return (
    <>
      <Box sx={{ p: 3 }}>
        <DayHeader
          title={format(date, 'EEEE, MMMM d, yyyy')}
          account_balance={account_balance + cumulativePnL}
          formInputVisible={false}
          total_pnl={dayTotalPnL}
          onPrevDay={handlePrevDay}
          onNextDay={handleNextDay}
          loading={isBalanceLoading}
        />

        {calendar && (
          <Box sx={{ mb: 2 }}>
            <Tooltip title="View economic events for this day">
              <Button
                variant="outlined"
                size="small"
                startIcon={<EventIcon />}
                onClick={handleOpenEventsDrawer}
              >
                Events
              </Button>
            </Tooltip>
          </Box>
        )}

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
          hideActions={isReadOnly}
          enableBulkSelection={isReadOnly ? false : tradesLength > 1}
        />
      </Box>

      {calendar && !onOpenEvents && (
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

export { DayTradesContent };
export default DayTradesContent;
