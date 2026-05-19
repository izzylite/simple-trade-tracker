import React from 'react';
import { Box, Typography, Tooltip, useTheme, alpha } from '@mui/material';
import { InfoOutlined, EmojiEvents, TrendingDown, TrendingUp } from '@mui/icons-material';
import { formatCurrency, formatCount } from 'utils/formatters';
import { Trade } from 'features/calendar/types/dualWrite';
import { EYEBROW_SX, TNUM, getInsetSurface } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';
import EyebrowRow from 'components/common/EyebrowRow';
import PnlValue from 'components/common/PnlValue';

interface WinLossStatsProps {
  winLossStats: {
    total_trades: number;
    win_rate: number;
    winners: {
      total: number;
      avgAmount: number;
      maxConsecutive: number;
      avgConsecutive: number;
      bestWin?: number;
      averageWin?: number;
    };
    losers: {
      total: number;
      avgAmount: number;
      maxConsecutive: number;
      avgConsecutive: number;
      worstLoss?: number;
      averageLoss?: number;
    };
    breakevens?: {
      total: number;
      avgAmount: number;
    };
  };
  trades: Trade[];
  onTradeClick?: (tradeId: string) => void;
  /** When true, stack Winners/Losers cards vertically (for narrow panels). */
  compact?: boolean;
}

interface StatRowSpec {
  label: string;
  tooltip: string;
  value: React.ReactNode;
  /** Optional click handler — used for best/worst trade rows */
  onClick?: () => void;
}

const StatRow: React.FC<{ row: StatRowSpec; accent: string }> = ({ row, accent }) => {
  const theme = useTheme();
  const interactive = !!row.onClick;
  return (
    <Box
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        interactive
          ? (e) => {
              e.stopPropagation();
              row.onClick!();
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                row.onClick!();
              }
            }
          : undefined
      }
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        px: 1.25,
        py: 1,
        borderRadius: '10px',
        bgcolor: getInsetSurface(theme),
        border: `1px solid ${theme.palette.divider}`,
        cursor: interactive ? 'pointer' : 'default',
        transition: interactive ? 'background-color 150ms ease' : 'none',
        '&:hover': interactive ? { bgcolor: alpha(accent, 0.08) } : {},
        '&:focus-visible': interactive
          ? { outline: 'none', boxShadow: `0 0 0 3px ${alpha(accent, 0.25)}` }
          : {},
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            fontSize: '0.8125rem',
            fontWeight: 500,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.label}
        </Typography>
        <Tooltip title={row.tooltip} arrow>
          <InfoOutlined
            sx={{ fontSize: 13, color: 'text.tertiary', opacity: 0.7, cursor: 'help' }}
          />
        </Tooltip>
      </Box>
      <Typography
        sx={{
          fontSize: '0.875rem',
          fontWeight: 700,
          color: 'text.primary',
          fontFeatureSettings: TNUM,
          letterSpacing: '-0.015em',
          flexShrink: 0,
        }}
      >
        {row.value}
      </Typography>
    </Box>
  );
};

const WinLossStats: React.FC<WinLossStatsProps> = ({
  winLossStats,
  trades,
  onTradeClick,
  compact = false,
}) => {
  const theme = useTheme();

  // Find the best win (trade with highest amount)
  const bestWin = React.useMemo(() => {
    const winTrades = trades.filter((trade) => trade.trade_type === 'win');
    if (winTrades.length === 0) return null;
    return winTrades.reduce(
      (best, current) => (current.amount > best.amount ? current : best),
      winTrades[0],
    );
  }, [trades]);

  // Find the worst loss (trade with lowest/most negative amount)
  const worstLoss = React.useMemo(() => {
    const lossTrades = trades.filter((trade) => trade.trade_type === 'loss');
    if (lossTrades.length === 0) return null;
    return lossTrades.reduce(
      (worst, current) => (current.amount < worst.amount ? current : worst),
      lossTrades[0],
    );
  }, [trades]);

  if (winLossStats.winners.total <= 0 && winLossStats.losers.total <= 0) {
    return null;
  }

  const winnersRows: StatRowSpec[] = [
    {
      label: 'Total winners',
      tooltip: 'Total number of winning trades in the selected period',
      value: formatCount(winLossStats.winners.total),
    },
    {
      label: 'Best win',
      tooltip: 'Your largest winning trade as a percentage of your account',
      value: bestWin ? (
        <PnlValue
          amount={bestWin.amount}
          format={formatCurrency}
          size="sm"
          bold
        />
      ) : (
        '0'
      ),
      onClick: bestWin && onTradeClick ? () => onTradeClick(bestWin.id) : undefined,
    },
    {
      label: 'Average win',
      tooltip:
        'The average size of your winning trades as a percentage of your account',
      value: (
        <PnlValue
          amount={winLossStats.winners.avgAmount}
          format={formatCurrency}
          size="sm"
          bold
        />
      ),
    },
    {
      label: 'Max consecutive wins',
      tooltip: 'Your longest streak of consecutive winning trades',
      value: formatCount(winLossStats.winners.maxConsecutive),
    },
    {
      label: 'Avg consecutive wins',
      tooltip: 'The average number of wins you achieve in a row before a loss',
      value: winLossStats.winners.avgConsecutive.toFixed(1),
    },
  ];

  const losersRows: StatRowSpec[] = [
    {
      label: 'Total losers',
      tooltip: 'Total number of losing trades in the selected period',
      value: formatCount(winLossStats.losers.total),
    },
    {
      label: 'Worst loss',
      tooltip: 'Your largest losing trade as a percentage of your account',
      value: worstLoss ? (
        <PnlValue
          amount={worstLoss.amount}
          format={formatCurrency}
          size="sm"
          bold
        />
      ) : (
        '0'
      ),
      onClick: worstLoss && onTradeClick ? () => onTradeClick(worstLoss.id) : undefined,
    },
    {
      label: 'Average loss',
      tooltip: 'The average size of your losing trades as a percentage of your account',
      value: (
        <PnlValue
          amount={winLossStats.losers.avgAmount}
          format={formatCurrency}
          size="sm"
          bold
        />
      ),
    },
    {
      label: 'Max consecutive losses',
      tooltip: 'Your longest streak of consecutive losing trades',
      value: formatCount(winLossStats.losers.maxConsecutive),
    },
    {
      label: 'Avg consecutive losses',
      tooltip: 'The average number of losses you have in a row before a win',
      value: winLossStats.losers.avgConsecutive.toFixed(1),
    },
  ];

  return (
    <CardShell
      sx={{ mb: 3 }}
      head={{
        icon: <EmojiEvents sx={{ fontSize: 16 }} />,
        title: 'Winners & Losers',
        eyebrow: `${formatCount(winLossStats.winners.total)} wins · ${formatCount(
          winLossStats.losers.total,
        )} losses`,
      }}
    >
      {/* ── Body: two-column grid (or stacked when compact) ────────── */}
      <Box
        sx={{
          p: 2.25,
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : { xs: '1fr', sm: '1fr 1fr' },
          gap: 2.25,
        }}
      >
        {/* Winners */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <EyebrowRow
            accent={theme.palette.success.main}
            label="Winners"
            rightLabel={
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <TrendingUp
                  sx={{ fontSize: 14, color: theme.palette.success.main, opacity: 0.8 }}
                />
                <Box component="span">Profitable</Box>
              </Box>
            }
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {winnersRows.map((row, i) => (
              <StatRow key={i} row={row} accent={theme.palette.success.main} />
            ))}
          </Box>
        </Box>

        {/* Losers */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <EyebrowRow
            accent={theme.palette.error.main}
            label="Losers"
            rightLabel={
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <TrendingDown
                  sx={{ fontSize: 14, color: theme.palette.error.main, opacity: 0.8 }}
                />
                <Box component="span">Drawdown</Box>
              </Box>
            }
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {losersRows.map((row, i) => (
              <StatRow key={i} row={row} accent={theme.palette.error.main} />
            ))}
          </Box>
        </Box>
      </Box>
    </CardShell>
  );
};

export default WinLossStats;
