/**
 * Economic Event Detail Dialog
 * Displays detailed information about an economic event including:
 * - Event details (name, impact, currency, time, etc.)
 * - All trades that occurred during the event
 * - Statistics (win rate, total wins/losses, average win/loss, etc.)
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  useTheme,
  alpha,
  Divider,
  Paper
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as NeutralIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ShowChart as ShowChartIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { EconomicEvent } from '../../types/economicCalendar';
import { Trade } from '../../types/dualWrite';
import { BaseDialog } from '../common';
import TradeList from '../trades/TradeList';
import { calculateTotalPnL, calculateWinRate, calculateAverages } from '../../utils/statsUtils';

interface EconomicEventDetailDialogProps {
  open: boolean;
  onClose: () => void;
  event: EconomicEvent;
  trades: Trade[]; // All trades from the calendar
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onDeleteMultipleTrades?: (tradeIds: string[]) => void;
  onZoomImage?: (imageUrl: string, allImages?: string[], initialIndex?: number) => void;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  calendarId?: string;
  calendar?: {
    economicCalendarFilters?: {
      currencies: string[];
      impacts: string[];
      viewType: 'day' | 'week' | 'month';
    };
  };
}

const EconomicEventDetailDialog: React.FC<EconomicEventDetailDialogProps> = ({
  open,
  onClose,
  event,
  trades,
  onUpdateTradeProperty,
  onEditTrade,
  onDeleteTrade,
  onDeleteMultipleTrades,
  onZoomImage,
  onOpenGalleryMode,
  calendarId,
  calendar
}) => {
  const theme = useTheme();
  const [expandedTradeId, setExpandedTradeId] = React.useState<string | null>(null);

  // Filter trades that occurred during this event
  // Match trades by checking if the event is in the trade's economic_events array
  const eventTrades = useMemo(() => {
    return trades.filter(trade => {
      if (!trade.economic_events || trade.economic_events.length === 0) {
        return false;
      }
      
      // Check if any of the trade's economic events match this event
      return trade.economic_events.some(tradeEvent => 
        tradeEvent.name === event.event_name &&
        tradeEvent.currency === event.currency &&
        tradeEvent.time_utc === event.time_utc
      );
    });
  }, [trades, event]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalPnL = calculateTotalPnL(eventTrades);
    const winRate = calculateWinRate(eventTrades);
    const { avg_win, avg_loss } = calculateAverages(eventTrades);
    
    const wins = eventTrades.filter(t => t.trade_type === 'win');
    const losses = eventTrades.filter(t => t.trade_type === 'loss');
    const breakevens = eventTrades.filter(t => t.trade_type === 'breakeven');

    return {
      totalTrades: eventTrades.length,
      totalPnL,
      winRate,
      totalWins: wins.length,
      totalLosses: losses.length,
      totalBreakevens: breakevens.length,
      avgWin: avg_win,
      avgLoss: avg_loss,
      profitFactor: avg_loss > 0 ? avg_win / avg_loss : 0
    };
  }, [eventTrades]);

  // Get impact color
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'High':
        return theme.palette.error.main;
      case 'Medium':
        return theme.palette.warning.main;
      case 'Low':
        return theme.palette.success.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  // Get result type icon and color
  const getResultTypeDisplay = () => {
    if (!event.actual_result_type) {
      return null;
    }

    switch (event.actual_result_type) {
      case 'good':
        return {
          icon: <TrendingUpIcon sx={{ fontSize: 16 }} />,
          color: theme.palette.success.main,
          label: 'Better than expected'
        };
      case 'bad':
        return {
          icon: <TrendingDownIcon sx={{ fontSize: 16 }} />,
          color: theme.palette.error.main,
          label: 'Worse than expected'
        };
      case 'neutral':
        return {
          icon: <NeutralIcon sx={{ fontSize: 16 }} />,
          color: theme.palette.text.secondary,
          label: 'As expected'
        };
      default:
        return null;
    }
  };

  const resultDisplay = getResultTypeDisplay();

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {event.flag_url && (
            <img
              src={event.flag_url}
              alt={event.country}
              style={{
                width: 28,
                height: 21,
                borderRadius: 4,
                objectFit: 'cover',
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
              }}
            />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {event.event_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {format(parseISO(event.event_time), 'EEEE, MMMM d, yyyy • h:mm a')}
            </Typography>
          </Box>
        </Box>
      }
      maxWidth="lg"
      fullWidth
      hideFooterCancelButton
    >
      <Box>
        {/* Event Details Section */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: alpha(theme.palette.background.paper, 0.5),
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {/* Currency and Impact */}
            <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 150 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Currency
              </Typography>
              <Chip
                label={event.currency}
                size="small"
                sx={{
                  fontWeight: 700,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main'
                }}
              />
            </Box>

            <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 150 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Impact
              </Typography>
              <Chip
                label={event.impact}
                size="small"
                sx={{
                  fontWeight: 700,
                  backgroundColor: alpha(getImpactColor(event.impact), 0.1),
                  color: getImpactColor(event.impact)
                }}
              />
            </Box>

            {/* Actual Value */}
            {event.actual_value && (
              <Box sx={{ flex: '1 1 calc(33.333% - 11px)', minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Actual
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {event.actual_value}
                </Typography>
              </Box>
            )}

            {/* Forecast Value */}
            {event.forecast_value && (
              <Box sx={{ flex: '1 1 calc(33.333% - 11px)', minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Forecast
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {event.forecast_value}
                </Typography>
              </Box>
            )}

            {/* Previous Value */}
            {event.previous_value && (
              <Box sx={{ flex: '1 1 calc(33.333% - 11px)', minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Previous
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {event.previous_value}
                </Typography>
              </Box>
            )}

            {/* Result Type */}
            {resultDisplay && (
              <Box sx={{ flex: '1 1 100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Box sx={{ color: resultDisplay.color }}>
                    {resultDisplay.icon}
                  </Box>
                  <Typography variant="body2" sx={{ color: resultDisplay.color, fontWeight: 600 }}>
                    {resultDisplay.label}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Statistics Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShowChartIcon sx={{ fontSize: 20 }} />
            Trading Performance During Event
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {/* Total Trades */}
            <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 140 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {stats.totalTrades}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Trades
                </Typography>
              </Paper>
            </Box>

            {/* Win Rate */}
            <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 140 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.success.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {stats.winRate.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Win Rate
                </Typography>
              </Paper>
            </Box>

            {/* Total PnL */}
            <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 140 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  backgroundColor: alpha(
                    stats.totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main,
                    0.05
                  ),
                  border: `1px solid ${alpha(
                    stats.totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main,
                    0.1
                  )}`
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: stats.totalPnL >= 0 ? 'success.main' : 'error.main'
                  }}
                >
                  ${stats.totalPnL.toFixed(2)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total PnL
                </Typography>
              </Paper>
            </Box>

            {/* Wins */}
            <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 140 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.success.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                  <CheckIcon sx={{ fontSize: 20, color: 'success.main' }} />
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                    {stats.totalWins}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Wins
                </Typography>
              </Paper>
            </Box>

            {/* Losses */}
            <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 140 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.error.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.1)}`
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                  <CloseIcon sx={{ fontSize: 20, color: 'error.main' }} />
                  <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                    {stats.totalLosses}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Losses
                </Typography>
              </Paper>
            </Box>

            {/* Profit Factor */}
            <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 140 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.info.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
                  {stats.profitFactor.toFixed(2)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Profit Factor
                </Typography>
              </Paper>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Trades List */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Trades During Event ({eventTrades.length})
          </Typography>

          {eventTrades.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No trades were made during this economic event
              </Typography>
            </Box>
          ) : (
            <TradeList
              trades={eventTrades}
              expandedTradeId={expandedTradeId}
              onTradeClick={(tradeId) => setExpandedTradeId(expandedTradeId === tradeId ? null : tradeId)}
              onEditClick={onEditTrade || (() => {})}
              onDeleteClick={onDeleteTrade || (() => {})}
              onDeleteMultiple={onDeleteMultipleTrades}
              onZoomedImage={onZoomImage || (() => {})}
              onUpdateTradeProperty={onUpdateTradeProperty}
              hideActions={!onEditTrade && !onDeleteTrade}
              enableBulkSelection={eventTrades.length > 1 && !!onDeleteMultipleTrades}
              calendarId={calendarId}
              onOpenGalleryMode={onOpenGalleryMode}
              calendar={calendar}
            />
          )}
        </Box>
      </Box>
    </BaseDialog>
  );
};

export default EconomicEventDetailDialog;

