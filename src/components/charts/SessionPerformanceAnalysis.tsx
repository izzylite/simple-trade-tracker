import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Box, Paper, Typography, useTheme, Stack, alpha } from '@mui/material';
import { format, isSameMonth } from 'date-fns';
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
    <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Session Performance
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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

        {/* Session Performance Chart */}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={sessionStats}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            maxBarSize={50}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="session"
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <Paper sx={{ p: 1.5, bgcolor: 'background.paper' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 'bold',
                          color: SESSION_COLORS[label as keyof typeof SESSION_COLORS]
                        }}
                      >
                        {label}
                      </Typography>
                      <Typography variant="body2" sx={{ color: COLORS.win }}>
                        Wins: {data.winners}
                      </Typography>
                      <Typography variant="body2" sx={{ color: COLORS.loss }}>
                        Losses: {data.losers}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Win Rate: {data.winRate.toFixed(1)}%
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: data.totalPnL > 0 ? COLORS.win : COLORS.loss,
                          fontWeight: 'bold',
                          mt: 0.5
                        }}
                      >
                        P&L: {formatValue(data.totalPnL)}
                      </Typography>
                    </Paper>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="winRate"
              name="Win Rate"
              fill={theme.palette.primary.main}
              radius={[4, 4, 0, 0]}
              onClick={(data) => {
                if (data && data.payload) {
                  const sessionName = data.payload.session;
                  const sessionTrades = trades.filter(trade =>
                    trade.session === sessionName &&
                    (timePeriod === 'month' ? isSameMonth(new Date(trade.date), selectedDate) :
                     timePeriod === 'year' ? new Date(trade.date).getFullYear() === selectedDate.getFullYear() :
                     true)
                  );
                  if (sessionTrades.length > 0) {
                    setMultipleTradesDialog({
                      open: true,
                      trades: sessionTrades,
                      date: `${sessionName} Session Trades`,
                      expandedTradeId: sessionTrades.length === 1 ? sessionTrades[0].id : null
                    });
                  }
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              {sessionStats.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={SESSION_COLORS[entry.session as keyof typeof SESSION_COLORS]}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default SessionPerformanceAnalysis;
