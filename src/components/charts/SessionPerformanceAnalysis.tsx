import React from 'react';
import { Box, Paper, Typography, useTheme, Stack, alpha } from '@mui/material';
import { isSameMonth } from 'date-fns';
import { Trade } from '../../types/trade';
import { formatValue } from '../../utils/formatters';

interface SessionPerformanceAnalysisProps {
  sessionStats: any[];
  trades: Trade[];
  selectedDate: Date;
  timePeriod: 'month' | 'year' | 'all';
  setMultipleTradesDialog: (dialogState: any) => void;
}

const SessionPerformanceAnalysis: React.FC<SessionPerformanceAnalysisProps> = ({
  sessionStats,
  trades,
  selectedDate,
  timePeriod,
  setMultipleTradesDialog
}) => {
  const theme = useTheme();

  // Define colors
  const COLORS = {
    win: '#4caf50',
    loss: '#f44336',
    zero: '#9e9e9e',
    breakEven: '#ff9800'
  };

  // Define session-specific colors
  const SESSION_COLORS = {
    'Asia': '#2962ff',
    'London': '#388e3c',
    'NY AM': '#f57c00',
    'NY PM': '#9c27b0'
  };

  return (
    <Paper
      elevation={theme.palette.mode === 'dark' ? 2 : 1}
      sx={{
        p: 3,
        borderRadius: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.paper,
      }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Session Performance
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minHeight: 300 }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(2, 1fr)' },
          gap: 2,
          minHeight: '400px'
        }}>
          {sessionStats.map(session => (
            <Paper
              key={session.session}
              sx={{
                p: 2,
                border: `1px solid ${alpha(
                  SESSION_COLORS[session.session as keyof typeof SESSION_COLORS],
                  0.3
                )}`,
                borderRadius: 2,
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
                opacity: session.totalTrades === 0 ? 0.5 : 1,
                cursor: session.totalTrades > 0 ? 'pointer' : 'default',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: session.totalTrades > 0 ? theme.shadows[2] : 'none',
                  bgcolor: session.totalTrades > 0 ? alpha(theme.palette.primary.main, 0.05) : theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)'
                }
              }}
              onClick={() => {
                if (session.totalTrades > 0) {
                  const sessionTrades = trades.filter(trade =>
                    trade.session === session.session &&
                    (timePeriod === 'month' ? isSameMonth(new Date(trade.date), selectedDate) :
                     timePeriod === 'year' ? new Date(trade.date).getFullYear() === selectedDate.getFullYear() :
                     true)
                  );
                  setMultipleTradesDialog({
                    open: true,
                    trades: sessionTrades,
                    date: `${session.session} Session Trades`,
                    expandedTradeId: sessionTrades.length === 1 ? sessionTrades[0].id : null
                  });
                }
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ color: SESSION_COLORS[session.session as keyof typeof SESSION_COLORS] }}
              >
                {session.session}
              </Typography>

              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Trades
                  </Typography>
                  <Typography variant="body2">
                    {session.totalTrades}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Win Rate
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: session.winRate >= 50 ? theme.palette.success.main : theme.palette.error.main
                    }}
                  >
                    {session.winRate.toFixed(1)}%
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    P&L
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: session.totalPnL > 0 ? theme.palette.success.main : theme.palette.error.main,
                      fontWeight: 500
                    }}
                  >
                    {formatValue(session.totalPnL)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Avg P&L per Trade
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      ml: 1,
                      color: session.averagePnL > 0 ? theme.palette.success.main : theme.palette.error.main
                    }}
                  >
                    {formatValue(session.averagePnL)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Account %
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: session.pnlPercentage > 0 ? theme.palette.success.main : theme.palette.error.main
                    }}
                  >
                    {session.pnlPercentage.toFixed(2)}%
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Box
                    sx={{
                      flex: session.winners,
                      height: 6,
                      bgcolor: COLORS.win,
                      borderRadius: 1
                    }}
                  />
                  <Box
                    sx={{
                      flex: session.losers,
                      height: 6,
                      bgcolor: COLORS.loss,
                      borderRadius: 1
                    }}
                  />
                </Box>
                <Box
                  sx={{
                    height: 3,
                    bgcolor: alpha(SESSION_COLORS[session.session as keyof typeof SESSION_COLORS], 0.2),
                    borderRadius: 1,
                    mt: 1
                  }}
                />
              </Stack>
            </Paper>
          ))}
        </Box>

        {/* Pro Tip Section */}
        {sessionStats.some(session => session.totalTrades > 0) && (
          <Box
            sx={{
              p: 2,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.05)',
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
              borderRadius: 2,
              mt: 1
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                color: theme.palette.info.main,
                fontWeight: 600,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              💡 Pro Tip
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(() => {
                const sessionsWithTrades = sessionStats.filter(session => session.totalTrades > 0);
                if (sessionsWithTrades.length === 0) return "No trading data available for analysis.";

                // Find most profitable session by total P&L
                const mostProfitable = sessionsWithTrades.reduce((prev, current) =>
                  current.totalPnL > prev.totalPnL ? current : prev
                );

                // Find session with highest win rate
                const highestWinRate = sessionsWithTrades.reduce((prev, current) =>
                  current.winRate > prev.winRate ? current : prev
                );

                // Find session with best average P&L per trade
                const bestAverage = sessionsWithTrades.reduce((prev, current) =>
                  current.averagePnL > prev.averagePnL ? current : prev
                );

                if (mostProfitable.totalPnL > 0) {
                  if (mostProfitable.session === highestWinRate.session && mostProfitable.session === bestAverage.session) {
                    return `${mostProfitable.session} session is your strongest performer with the highest total P&L (${formatValue(mostProfitable.totalPnL)}), best win rate (${mostProfitable.winRate.toFixed(1)}%), and highest average per trade (${formatValue(mostProfitable.averagePnL)}). Consider focusing more trades during this session.`;
                  } else if (mostProfitable.session === highestWinRate.session) {
                    return `${mostProfitable.session} session has both the highest total P&L (${formatValue(mostProfitable.totalPnL)}) and best win rate (${mostProfitable.winRate.toFixed(1)}%). ${bestAverage.session} session has the best average per trade (${formatValue(bestAverage.averagePnL)}).`;
                  } else {
                    return `${mostProfitable.session} session is most profitable overall (${formatValue(mostProfitable.totalPnL)}), while ${highestWinRate.session} session has the highest win rate (${highestWinRate.winRate.toFixed(1)}%). Consider analyzing what makes each session successful.`;
                  }
                } else {
                  const leastLosing = sessionsWithTrades.reduce((prev, current) =>
                    current.totalPnL > prev.totalPnL ? current : prev
                  );
                  return `All sessions are currently showing losses. ${leastLosing.session} session has the smallest loss (${formatValue(leastLosing.totalPnL)}). Consider reviewing your strategy and risk management.`;
                }
              })()}
            </Typography>
          </Box>
        )}

      </Box>
    </Paper>
  );
};

export default SessionPerformanceAnalysis;
