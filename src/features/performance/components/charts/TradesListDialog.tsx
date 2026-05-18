/**
 * TradesListDialog
 *
 * Drill-in viewer used by performance charts and calendar grid affordances
 * to show a filtered list of trades + their day-of-week stats.
 *
 * Follows the tag-dialog viewer style:
 *   BaseDialog chrome (header avatar + subtitle + close)
 *   sticky summary card just below the header
 *   scrollable body — optional day-of-week chart card + trade list
 *   close-only footer (Gallery action surfaced via `actions` when available)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Typography,
  Box,
  Button,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ViewCarousel as GalleryIcon,
  FormatListBulleted as TradesIcon,
  TrendingUp as PnLIcon,
  Percent as WinRateIcon,
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';

import { Trade } from 'features/calendar/types/dualWrite';
import TradeList from 'features/calendar/components/trades/TradeList';
import { startOfNextDay } from 'features/calendar/components/trades/TradeFormDialog';
import { calculateCumulativePnLToDateAsync } from 'features/calendar/utils/dynamicRiskUtils';
import { logger } from 'utils/logger';
import { formatCurrency, formatCount } from 'utils/formatters';
import { getTagDayOfWeekChartData } from 'features/performance/utils/chartDataUtils';
import { TradeOperationsProps } from 'features/calendar/types/tradeOperations';
import { BaseDialog } from 'components/common';
import { useDialogTokens } from 'styles/dialogTokens';

interface TradesDialogProps {
  open: boolean;
  trades: Trade[];
  title: string;
  subtitle?: string;
  expandedTradeId: string | null;
  showChartInfo?: boolean;
  onClose: () => void;
  onTradeExpand: (tradeId: string) => void;
  account_balance: number;
  tradeOperations: TradeOperationsProps;
}

const TNUM = "'tnum' on, 'lnum' on";

const TradesListDialog: React.FC<TradesDialogProps> = ({
  open,
  trades,
  title,
  subtitle,
  showChartInfo,
  expandedTradeId,
  onClose,
  onTradeExpand,
  account_balance,
  tradeOperations,
}) => {
  const {
    onEditTrade,
    onDeleteTrade,
    onDeleteMultipleTrades,
    onOpenGalleryMode,
    calendar,
  } = tradeOperations;

  const theme = useTheme();

  // ── design tokens ────────────────────────────────────────────────────────
  const {
    violet,
    violetSoft,
    violetBorder,
    surfaceInset,
    hairline,
    monoLabelSx,
  } = useDialogTokens();

  // ── Cumulative P&L for the most-recent trade date ────────────────────────
  const [cumulativePnL, setCumulativePnL] = useState(0);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCumulativePnL = async () => {
      if (!open || !calendar || !trades || trades.length === 0) return;
      setIsBalanceLoading(true);
      try {
        const mostRecentTrade = trades.reduce((latest, trade) =>
          new Date(trade.trade_date) > new Date(latest.trade_date) ? trade : latest,
        );
        const targetDate = startOfNextDay(mostRecentTrade.trade_date);
        if (isNaN(targetDate.getTime())) {
          logger.warn('Invalid trade date, skipping cumulative P&L calculation');
          if (!cancelled) setCumulativePnL(0);
          return;
        }
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
    return () => {
      cancelled = true;
    };
  }, [open, trades, calendar]);

  // ── Day-of-week breakdown chart ──────────────────────────────────────────
  const [selectedMetric, setSelectedMetric] = useState<'winRate' | 'pnl'>('winRate');
  const [chartData, setChartData] = useState<any[] | undefined>(undefined);

  const tradeStats = useMemo(() => {
    let containWins = false;
    let containLosses = false;
    (trades || []).forEach((trade) => {
      if (trade.trade_type === 'win') containWins = true;
      else if (trade.trade_type === 'loss') containLosses = true;
    });
    return {
      containWins,
      containLosses,
      containBoth: containWins && containLosses,
    };
  }, [trades]);

  useEffect(() => {
    let isMounted = true;
    const fetchChartData = async () => {
      if (!trades || trades.length === 0) {
        if (isMounted) setChartData(undefined);
        return;
      }
      const result = await Promise.resolve(
        getTagDayOfWeekChartData(
          trades,
          theme,
          selectedMetric === 'winRate' && tradeStats.containBoth,
        ),
      );
      if (isMounted) {
        const totalTradesSum = Array.isArray(result)
          ? result.reduce((sum, item) => sum + (item.total_trades > 0 ? 1 : 0), 0)
          : 0;
        setChartData(totalTradesSum > 1 ? result : undefined);
      }
    };
    fetchChartData();
    return () => {
      isMounted = false;
    };
  }, [selectedMetric, showChartInfo, trades, theme, tradeStats.containBoth]);

  // ── Total P&L across this view ───────────────────────────────────────────
  const totalPnL = useMemo(
    () => (trades || []).reduce((acc, trade) => acc + trade.amount, 0),
    [trades],
  );
  const totalPnLColor =
    totalPnL > 0
      ? theme.palette.success.main
      : totalPnL < 0
        ? theme.palette.error.main
        : theme.palette.text.secondary;

  const tradesLength = trades?.length || 0;
  const accountBalanceForDisplay = account_balance + cumulativePnL;

  // ── Best day insight (when chart present) ────────────────────────────────
  const bestDayInsight = useMemo(() => {
    if (!chartData || !chartData.some((d) => d.total_trades > 0)) return null;
    if (tradeStats.containBoth && selectedMetric === 'winRate') {
      const best = chartData.reduce(
        (best, day) =>
          day.total_trades > 0 && day.win_rate > best.win_rate ? day : best,
        { win_rate: 0, fullDay: 'None' as string },
      );
      return `Best day for selected strategies: ${best.fullDay}`;
    }
    const best = chartData.reduce(
      (best, day) =>
        day.total_trades > 0 && day.pnl > best.pnl ? day : best,
      { pnl: -Infinity, fullDay: 'None' as string },
    );
    return `Most profitable / unprofitable day: ${best.fullDay}`;
  }, [chartData, selectedMetric, tradeStats.containBoth]);

  // ── Gallery handler ──────────────────────────────────────────────────────
  const handleGalleryModeClick = () => {
    if (onOpenGalleryMode && trades && trades.length > 0) {
      onOpenGalleryMode(
        trades,
        expandedTradeId || trades[0].id,
        `${title} - ${formatCount(tradesLength)} Trade${tradesLength > 1 ? 's' : ''}`,
      );
      onClose();
    }
  };

  // ── Header / subtitle copy ───────────────────────────────────────────────
  const headerTitle = `${formatCount(tradesLength)} ${tradesLength === 1 ? 'Trade' : 'Trades'}`;
  const headerSubtitle = title
    ? `${title}${subtitle ? ` · ${subtitle}` : ''}`
    : subtitle || '';

  // ── Footer actions — Gallery surfaced only when a handler + trades exist
  const galleryAction =
    onOpenGalleryMode && tradesLength > 0 ? (
      <Tooltip title="Open every trade in the gallery viewer" arrow>
        <Button
          onClick={handleGalleryModeClick}
          variant="contained"
          startIcon={<GalleryIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            backgroundColor: violet,
            color: '#fff',
            borderRadius: 1.25,
            px: 1.75,
            py: 0.75,
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
              boxShadow: 'none',
            },
          }}
        >
          Gallery view
        </Button>
      </Tooltip>
    ) : null;

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title={headerTitle}
      subtitle={headerSubtitle || undefined}
      headerIcon={<TradesIcon sx={{ fontSize: 18 }} />}
      maxWidth="md"
      fullWidth
      cancelButtonText="Close"
      actions={galleryAction}
      contentSx={{ px: 0, py: 0, display: 'flex', flexDirection: 'column' }}
    >
      {/* ── Sticky summary bar ─────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          px: 2.5,
          py: 1.5,
          borderBottom: `1px solid ${hairline}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            bgcolor: surfaceInset,
            border: `1px solid ${hairline}`,
            borderRadius: 1.5,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 1.5 }}>
            <Typography sx={{ ...monoLabelSx, fontSize: '0.62rem' }}>
              Account balance
            </Typography>
            <Typography
              sx={{
                mt: 0.5,
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'text.primary',
                fontFeatureSettings: TNUM,
                letterSpacing: '-0.01em',
                opacity: isBalanceLoading ? 0.5 : 1,
              }}
            >
              {formatCurrency(accountBalanceForDisplay)}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderLeft: `1px solid ${hairline}`,
              textAlign: 'right',
            }}
          >
            <Typography
              sx={{ ...monoLabelSx, fontSize: '0.62rem', justifyContent: 'flex-end' }}
            >
              Total P&L
            </Typography>
            <Typography
              sx={{
                mt: 0.5,
                fontSize: '1.05rem',
                fontWeight: 700,
                color: totalPnLColor,
                fontFeatureSettings: TNUM,
                letterSpacing: '-0.01em',
              }}
            >
              {totalPnL >= 0 ? '+' : '−'}
              {formatCurrency(Math.abs(totalPnL))}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Scrollable list region ─────────────────────────────────────── */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {/* Day-of-week chart card */}
        {chartData && (
          <Box
            sx={{
              border: `1px solid ${hairline}`,
              borderRadius: 1.5,
              backgroundColor: surfaceInset,
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={monoLabelSx}>Day of week</Typography>

              {tradeStats.containBoth && (
                <Box
                  sx={{
                    display: 'flex',
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${hairline}`,
                    borderRadius: 1.5,
                    padding: '3px',
                    gap: '3px',
                  }}
                >
                  {(
                    [
                      { value: 'winRate', label: 'Win rate', Icon: WinRateIcon },
                      { value: 'pnl', label: 'P&L', Icon: PnLIcon },
                    ] as const
                  ).map((opt) => {
                    const selected = selectedMetric === opt.value;
                    return (
                      <Box
                        key={opt.value}
                        component="button"
                        onClick={() => setSelectedMetric(opt.value)}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1,
                          py: 0.5,
                          backgroundColor: selected ? violetSoft : 'transparent',
                          border: `1px solid ${
                            selected ? violetBorder : 'transparent'
                          }`,
                          borderRadius: 1.25,
                          color: selected ? violet : theme.palette.text.secondary,
                          font: 'inherit',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 120ms ease',
                          '&:hover': {
                            color: selected ? violet : theme.palette.text.primary,
                          },
                        }}
                      >
                        <opt.Icon sx={{ fontSize: 12 }} />
                        {opt.label}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {bestDayInsight && (
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  color: 'primary.main',
                  fontWeight: 600,
                }}
              >
                {bestDayInsight}
              </Typography>
            )}

            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                maxBarSize={42}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={hairline}
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                  domain={tradeStats.containBoth ? [0, 100] : ['auto', 'auto']}
                  tickFormatter={
                    tradeStats.containBoth && selectedMetric === 'winRate'
                      ? (value) => `${value}%`
                      : (value) => formatCurrency(value).replace('$', '')
                  }
                />
                <RechartsTooltip
                  cursor={{ fill: alpha(theme.palette.text.primary, 0.04) }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <Box
                        sx={{
                          p: 1.25,
                          bgcolor: 'background.paper',
                          border: `1px solid ${hairline}`,
                          borderRadius: 1.25,
                          boxShadow: theme.shadows[6],
                          minWidth: 140,
                        }}
                      >
                        <Typography
                          sx={{ fontWeight: 700, fontSize: '0.82rem', mb: 0.5 }}
                        >
                          {data.fullDay}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <TooltipRow
                            label="Trades"
                            value={formatCount(data.total_trades)}
                          />
                          {tradeStats.containWins && (
                            <TooltipRow
                              label="Wins"
                              value={formatCount(data.winTrades)}
                              color={theme.palette.success.main}
                            />
                          )}
                          {tradeStats.containLosses && (
                            <TooltipRow
                              label="Losses"
                              value={formatCount(data.lossTrades)}
                              color={theme.palette.error.main}
                            />
                          )}
                          {tradeStats.containBoth && (
                            <TooltipRow
                              label="Win rate"
                              value={`${data.win_rate.toFixed(1)}%`}
                            />
                          )}
                          <TooltipRow label="P&L" value={formatCurrency(data.pnl)} />
                        </Box>
                      </Box>
                    );
                  }}
                />
                <Bar
                  dataKey="value"
                  name={
                    tradeStats.containBoth && selectedMetric === 'winRate'
                      ? 'Win rate'
                      : 'P&L'
                  }
                  fill={theme.palette.primary.main}
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: 'pointer' }}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Trade list section */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={monoLabelSx}>Trades</Typography>
          {tradesLength === 0 ? (
            <Box
              sx={{
                border: `1px dashed ${hairline}`,
                borderRadius: 1.5,
                backgroundColor: surfaceInset,
                px: 2,
                py: 3,
                textAlign: 'center',
              }}
            >
              <Typography
                sx={{
                  ...monoLabelSx,
                  fontSize: '0.66rem',
                  color: theme.palette.text.secondary,
                  justifyContent: 'center',
                }}
              >
                No trades in this view
              </Typography>
            </Box>
          ) : (
            <TradeList
              sx={{ mt: 0 }}
              trades={trades}
              expandedTradeId={expandedTradeId}
              onTradeClick={onTradeExpand}
              hideActions={!onEditTrade && !onDeleteTrade}
              enableBulkSelection={tradesLength > 1 && !!onDeleteMultipleTrades}
              tradeOperations={tradeOperations}
            />
          )}
        </Box>
      </Box>
    </BaseDialog>
  );
};

// ─── TooltipRow ──────────────────────────────────────────────────────────
// Compact key:value row used inside the recharts tooltip.

const TooltipRow: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 1.5,
      fontSize: '0.75rem',
    }}
  >
    <Box component="span" sx={{ color: 'text.secondary' }}>
      {label}
    </Box>
    <Box
      component="span"
      sx={{
        color: color ?? 'text.primary',
        fontWeight: 600,
        fontFeatureSettings: TNUM,
      }}
    >
      {value}
    </Box>
  </Box>
);

export default TradesListDialog;
