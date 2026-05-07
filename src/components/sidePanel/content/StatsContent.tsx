import React from 'react';
import { Box, Stack } from '@mui/material';
import AccountStats from '../../AccountStats';
import MonthlyStats from '../../MonthlyStats';
import PerformanceCharts from '../../PerformanceCharts';
import { Trade, Calendar } from '../../../types/dualWrite';
import { DynamicRiskSettings } from '../../../utils/dynamicRiskUtils';
import { EconomicCalendarFilterSettings } from '../../economicCalendar/EconomicCalendarDrawer';
import { scrollbarStyles } from '../../../styles/scrollbarStyles';
import { useTheme } from '@mui/material/styles';

export interface StatsContentProps {
  // Account stats
  balance: number;
  totalProfit: number;
  trades: Trade[];
  filteredTrades: Trade[];
  riskPerTrade?: number;
  dynamicRiskSettings?: DynamicRiskSettings;
  onToggleDynamicRisk?: (useActualAmounts: boolean) => void;
  isDynamicRiskToggled?: boolean;
  isReadOnly?: boolean;
  maxDailyDrawdown?: number;

  // Monthly stats
  currentDate?: Date;
  monthlyTarget?: number;
  calendarId?: string;
  scoreSettings?: import('../../../types/score').ScoreSettings;
  calendar?: Calendar;
  pnlBeforeMonth?: number;
  isPnlLoading?: boolean;

  // Handlers
  onDeleteTrade?: (id: string) => void;
  onOpenGalleryMode?: (
    trades: Trade[],
    initialTradeId?: string,
    title?: string
  ) => void;
  onUpdateTradeProperty?: (
    tradeId: string,
    updateCallback: (trade: Trade) => Trade
  ) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
  ) => Promise<Calendar | undefined>;
  onEditTrade?: (trade: Trade) => void;
  economicFilter?: (calendarId: string) => EconomicCalendarFilterSettings;
}

/**
 * Side-panel + drawer content that hosts AccountStats and MonthlyStats stacked
 * vertically. Replaces the inline stats row that used to sit between the
 * calendar header and the calendar grid on TradeCalendarPage. Surfacing this
 * data on demand keeps the main calendar surface focused on the grid.
 */
const StatsContent: React.FC<StatsContentProps> = ({
  balance,
  totalProfit,
  trades,
  filteredTrades,
  riskPerTrade,
  dynamicRiskSettings,
  onToggleDynamicRisk,
  isDynamicRiskToggled,
  isReadOnly,
  maxDailyDrawdown,
  currentDate,
  monthlyTarget,
  calendarId,
  scoreSettings,
  calendar,
  pnlBeforeMonth,
  isPnlLoading,
  onDeleteTrade,
  onOpenGalleryMode,
  onUpdateTradeProperty,
  onUpdateCalendarProperty,
  onEditTrade,
  economicFilter,
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flex: 1,
        overflowY: 'auto',
        px: 2,
        py: 2,
        ...scrollbarStyles(theme),
      }}
    >
      <Stack spacing={2.5}>
        <AccountStats
          balance={balance}
          totalProfit={totalProfit}
          trades={filteredTrades}
          risk_per_trade={riskPerTrade}
          dynamicRiskSettings={dynamicRiskSettings}
          onToggleDynamicRisk={onToggleDynamicRisk}
          isDynamicRiskToggled={isDynamicRiskToggled}
          isReadOnly={isReadOnly}
          max_daily_drawdown={maxDailyDrawdown}
        />

        {calendarId && (
          <MonthlyStats
            trades={filteredTrades}
            accountBalance={balance}
            onDeleteTrade={onDeleteTrade}
            currentDate={currentDate}
            monthlyTarget={monthlyTarget}
            isReadOnly={isReadOnly}
            onOpenGalleryMode={onOpenGalleryMode}
            calendarId={calendarId}
            scoreSettings={scoreSettings}
            dynamicRiskSettings={dynamicRiskSettings}
            onUpdateTradeProperty={onUpdateTradeProperty}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
            onEditTrade={onEditTrade}
            economicFilter={economicFilter}
            maxDailyDrawdown={maxDailyDrawdown}
            pnlBeforeMonth={pnlBeforeMonth}
            isPnlLoading={isPnlLoading}
            calendar={calendar}
          />
        )}

        {calendarId && (
          <PerformanceCharts
            calendarId={calendarId}
            selectedDate={currentDate}
            accountBalance={balance}
            maxDailyDrawdown={maxDailyDrawdown}
            monthlyTarget={monthlyTarget}
            scoreSettings={scoreSettings}
            calendar={calendar}
            dynamicRiskSettings={dynamicRiskSettings}
            onEditTrade={onEditTrade}
            onDeleteTrade={onDeleteTrade}
            onUpdateTradeProperty={onUpdateTradeProperty}
            onUpdateCalendarProperty={onUpdateCalendarProperty}
            economicFilter={economicFilter}
            onOpenGalleryMode={onOpenGalleryMode}
            isReadOnly={isReadOnly}
            tabSize="small"
            basicOnly
          />
        )}
      </Stack>
    </Box>
  );
};

export default StatsContent;
