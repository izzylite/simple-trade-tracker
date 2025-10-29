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
    economic_calendar_filters?: {
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

  // Helper function to extract base event name (remove date suffix)
  // E.g., "Initial Jobless Claims Oct25" -> "Initial Jobless Claims"
  // E.g., "Consumer Confidence (May)" -> "Consumer Confidence"
  // E.g., "Durable Goods Orders MoM Sep" -> "Durable Goods Orders MoM"
  const getBaseEventName = (eventName: string): string => {
    // Remove common date patterns:
    // - Dates in parentheses: (May), (Jan), (2024), etc.
    // - Month abbreviations at the end: Sep, Oct, Jan, etc. (with or without year)
    // - Dates at the end: Oct25, Feb25, 2024, etc.
    return eventName
      .replace(/\s*\((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\)/gi, '')
      .replace(/\s*\(\d{4}\)/g, '')
      .replace(/\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2}$/i, '')
      .replace(/\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i, '')
      .replace(/\s+\d{4}$/, '')
      .replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}$/, '')
      .trim();
  };

  // Filter trades that occurred during this event
  // Match trades by checking if the event is in the trade's economic_events array
  // We match by base event name (without date suffix), currency, and impact
  const eventTrades = useMemo(() => {
    const baseEventName = getBaseEventName(event.event_name);

    return trades.filter(trade => {
      if (!trade.economic_events || trade.economic_events.length === 0) {
        return false;
      }

      // Check if any of the trade's economic events match this event
      // Match by base name, currency, and impact
      return trade.economic_events.some(tradeEvent => {
        const tradeBaseEventName = getBaseEventName(tradeEvent.name);
        return tradeBaseEventName === baseEventName &&
               tradeEvent.currency === event.currency &&
               tradeEvent.impact === event.impact;
      });
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {event.flag_url && (
            <img
              src={event.flag_url}
              alt={event.country}
              style={{
                width: 24,
                height: 18,
                borderRadius: 3,
                objectFit: 'cover'
              }}
            />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
              {event.event_name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              {format(parseISO(event.event_time), 'MMM d, yyyy • h:mm a')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label={event.currency}
              size="small"
              sx={{
                height: 24,
                fontWeight: 600,
                fontSize: '0.75rem',
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main'
              }}
            />
            <Chip
              label={event.impact}
              size="small"
              sx={{
                height: 24,
                fontWeight: 600,
                fontSize: '0.75rem',
                backgroundColor: alpha(getImpactColor(event.impact), 0.1),
                color: getImpactColor(event.impact)
              }}
            />
          </Box>
        </Box>
      }
      maxWidth="md"
      fullWidth
      hideFooterCancelButton
    >
      <Box>
        {/* Event Values - Compact Row */}
        {(event.actual_value || event.forecast_value || event.previous_value || resultDisplay) && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 2,
              mb: 2,
              p: 1.5,
              backgroundColor: alpha(theme.palette.background.paper, 0.5),
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
            }}
          >

            {event.previous_value && (
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Previous
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {event.previous_value}
                </Typography>
              </Box>
            )}

            {event.forecast_value && (
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Forecast
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {event.forecast_value}
                </Typography>
              </Box>
            )}

            {event.actual_value && (
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Actual
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {event.actual_value}
                </Typography>
              </Box>
            )}
            {resultDisplay && (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ color: resultDisplay.color }}>
                  {resultDisplay.icon}
                </Box>
                <Typography variant="caption" sx={{ color: resultDisplay.color, fontWeight: 600, fontSize: '0.75rem' }}>
                  {resultDisplay.label}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Statistics Section - Compact Grid */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem' }}>
            <ShowChartIcon sx={{ fontSize: 18 }} />
            Performance Stats
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {/* Total Trades */}
            <Box sx={{ flex: '1 1 calc(33.333% - 8px)', minWidth: 100 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '1.5rem' }}>
                  {stats.totalTrades}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Trades
                </Typography>
              </Paper>
            </Box>

            {/* Win Rate */}
            <Box sx={{ flex: '1 1 calc(33.333% - 8px)', minWidth: 100 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.success.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main', fontSize: '1.5rem' }}>
                  {stats.winRate.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Win Rate
                </Typography>
              </Paper>
            </Box>

            {/* Total PnL */}
            <Box sx={{ flex: '1 1 calc(33.333% - 8px)', minWidth: 100 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  textAlign: 'center',
                  backgroundColor: alpha(
                    stats.totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main,
                    0.05
                  ),
                  border: `1px solid ${alpha(
                    stats.totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main,
                    0.1
                  )}`,
                  borderRadius: 1
                }}
              >
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: stats.totalPnL >= 0 ? 'success.main' : 'error.main',
                    fontSize: '1.5rem'
                  }}
                >
                  ${stats.totalPnL.toFixed(2)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Total PnL
                </Typography>
              </Paper>
            </Box>

            {/* Wins/Losses/Profit Factor - Compact Row */}
            <Box sx={{ flex: '1 1 100%', display: 'flex', gap: 1.5 }}>
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  p: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  backgroundColor: alpha(theme.palette.success.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                  borderRadius: 1
                }}
              >
                <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main', fontSize: '0.875rem' }}>
                  {stats.totalWins}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Wins
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  p: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  backgroundColor: alpha(theme.palette.error.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.1)}`,
                  borderRadius: 1
                }}
              >
                <CloseIcon sx={{ fontSize: 16, color: 'error.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main', fontSize: '0.875rem' }}>
                  {stats.totalLosses}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Losses
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  p: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  backgroundColor: alpha(theme.palette.info.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                  borderRadius: 1
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'info.main', fontSize: '0.875rem' }}>
                  {stats.profitFactor.toFixed(2)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  PF
                </Typography>
              </Paper>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Trades List */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.875rem' }}>
            Trades ({eventTrades.length})
          </Typography>

          {eventTrades.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 3,
                backgroundColor: alpha(theme.palette.background.paper, 0.3),
                borderRadius: 1,
                border: `1px dashed ${alpha(theme.palette.divider, 0.2)}`
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                No trades during this event
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

