import React from 'react';
import { Box, Paper, Typography, Tooltip, useTheme, Stack, alpha } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';
import { Trade } from '../../types/trade';

interface WinLossStatsProps {
  winLossStats: {
    totalTrades: number;
    winRate: number;
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
}

const WinLossStats: React.FC<WinLossStatsProps> = ({ winLossStats, trades, onTradeClick }) => {
  const theme = useTheme();

  // Find the best win (trade with highest amount)
  const bestWin = React.useMemo(() => {
    const winTrades = trades.filter(trade => trade.type === 'win');
    if (winTrades.length === 0) return null;
    return winTrades.reduce((best, current) =>
      current.amount > best.amount ? current : best, winTrades[0]);
  }, [trades]);

  // Find the worst loss (trade with lowest/most negative amount)
  const worstLoss = React.useMemo(() => {
    const lossTrades = trades.filter(trade => trade.type === 'loss');
    if (lossTrades.length === 0) return null;
    return lossTrades.reduce((worst, current) =>
      current.amount < worst.amount ? current : worst, lossTrades[0]);
  }, [trades]);

  return (
    <Box>
      {/* Winners and Losers Section */}
      {(winLossStats.winners.total > 0 || winLossStats.losers.total > 0) && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {/* Winners Card */}
          <Paper sx={{ 
            flex: 1, 
            p: 2, 
            border: `4px solid ${alpha(theme.palette.success.main, 0.1)}`,
            borderRadius: 2
          }}>
            <Typography variant="subtitle1" sx={{ color: theme.palette.success.main, mb: 2 }}>
              Winners
            </Typography>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total winners
                  </Typography>
                  <Tooltip title="Total number of winning trades in the selected period" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">{winLossStats.winners.total}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Best win
                  </Typography>
                  <Tooltip title="Your largest winning trade as a percentage of your account" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">
                  {bestWin ? formatCurrency(bestWin.amount) : '0'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average win
                  </Typography>
                  <Tooltip title="The average size of your winning trades as a percentage of your account" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">{formatCurrency(winLossStats.winners.avgAmount)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Max consecutive wins
                  </Typography>
                  <Tooltip title="Your longest streak of consecutive winning trades" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">{winLossStats.winners.maxConsecutive}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Avg consecutive wins
                  </Typography>
                  <Tooltip title="The average number of wins you achieve in a row before a loss" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">{winLossStats.winners.avgConsecutive.toFixed(1)}</Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Losers Card */}
          <Paper sx={{ 
            flex: 1, 
            p: 2, 
            border: `4px solid ${alpha(theme.palette.error.main, 0.1)}`,
            borderRadius: 2
          }}>
            <Typography variant="subtitle1" sx={{ color: theme.palette.error.main, mb: 2 }}>
              Losers
            </Typography>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total losers
                  </Typography>
                  <Tooltip title="Total number of losing trades in the selected period" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">{winLossStats.losers.total}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Worst loss
                  </Typography>
                  <Tooltip title="Your largest losing trade as a percentage of your account" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">
                  {worstLoss ? formatCurrency(Math.abs(worstLoss.amount)) : '0'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average loss
                  </Typography>
                  <Tooltip title="The average size of your losing trades as a percentage of your account" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">{formatCurrency(Math.abs(winLossStats.losers.avgAmount))}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Max consecutive losses
                  </Typography>
                  <Tooltip title="Your longest streak of consecutive losing trades" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">{winLossStats.losers.maxConsecutive}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Avg consecutive losses
                  </Typography>
                  <Tooltip title="The average number of losses you have in a row before a win" arrow>
                    <InfoOutlined sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2">{winLossStats.losers.avgConsecutive.toFixed(1)}</Typography>
              </Box>
            </Stack>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default WinLossStats;
