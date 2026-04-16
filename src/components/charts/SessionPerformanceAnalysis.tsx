import React, { useState } from 'react';
import {
  Box, Paper, Typography, useTheme, Stack, alpha,
  Button, Tooltip,
} from '@mui/material';
import { Assessment as PerformanceIcon } from '@mui/icons-material';
import { isSameMonth } from 'date-fns';
import { Trade } from '../../types/dualWrite';
import { formatValue } from '../../utils/formatters';
import { SESSION_COLORS } from '../../utils/sessionTimeUtils';
import RoundedTabs, { TabPanel } from '../common/RoundedTabs';
import CumulativePnLChart from './CumulativePnLChart';

interface SessionPerformanceAnalysisProps {
  sessionStats: any[];
  trades: Trade[];
  selectedDate: Date;
  timePeriod: 'month' | 'year' | 'all';
  setMultipleTradesDialog: (dialogState: any) => void;
  chartData?: any[];
  targetValue?: number | null;
  monthly_target?: number;
  onOpenPerformanceDetail?: () => void;
}

const TABS = [
  { label: 'Session' },
  { label: 'Cumulative P&L' },
];

const SessionPerformanceAnalysis: React.FC<SessionPerformanceAnalysisProps> = ({
  sessionStats,
  trades,
  selectedDate,
  timePeriod,
  setMultipleTradesDialog,
  chartData,
  targetValue,
  monthly_target,
  onOpenPerformanceDetail,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  // Define colors
  const COLORS = {
    win: '#22c55e',
    loss: '#ef4444',
    zero: '#94a3b8',
    breakEven: '#64748b'
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
      {/* Header: tabs + Performance Detail button */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
      }}>
        <RoundedTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(_, idx) => setActiveTab(idx)}
          size="small"
        />
        {onOpenPerformanceDetail && (
          <Tooltip title="Full performance analytics" arrow>
            <Button
              size="small"
              startIcon={
                <PerformanceIcon sx={{ fontSize: 18 }} />
              }
              onClick={onOpenPerformanceDetail}
              variant="outlined"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                color: 'text.secondary',
                borderColor: alpha(
                  theme.palette.text.secondary, 0.3
                ),
                '&:hover': {
                  color: 'primary.main',
                  borderColor: 'primary.main',
                  bgcolor: alpha(
                    theme.palette.primary.main, 0.08
                  ),
                },
              }}
            >
              Performance Analytics
            </Button>
          </Tooltip>
        )}
      </Box>

      {/* Session Tab */}
      <TabPanel value={activeTab} index={0}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(2, 1fr)' },
          gap: 2,
          gridAutoRows: 'minmax(min-content, max-content)'
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
                opacity: session.total_trades === 0 ? 0.5 : 1,
                cursor: session.total_trades > 0 ? 'pointer' : 'default',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: session.total_trades > 0 ? theme.shadows[2] : 'none',
                  bgcolor: session.total_trades > 0 ? alpha(theme.palette.primary.main, 0.05) : theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)'
                }
              }}
              onClick={() => {
                if (session.total_trades > 0) {
                  const sessionTrades = trades.filter(trade =>
                    trade.session?.toLowerCase() === session.session?.toLowerCase() &&
                    (timePeriod === 'month' ? isSameMonth(new Date(trade.trade_date), selectedDate) :
                     timePeriod === 'year' ? new Date(trade.trade_date).getFullYear() === selectedDate.getFullYear() :
                     true)
                  );
                  setMultipleTradesDialog({
                    open: true,
                    trades: sessionTrades,
                    tradeIds: sessionTrades.map(t => t.id),
                    title: `${session.session} Session Trades`,
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
                    {session.total_trades}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Win Rate
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: (session.win_rate ?? 0) >= 50 ? theme.palette.success.main : theme.palette.error.main
                    }}
                  >
                    {(session.win_rate ?? 0).toFixed(1)}%
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    P&L
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: session.total_pnl > 0 ? theme.palette.success.main : theme.palette.error.main,
                      fontWeight: 500
                    }}
                  >
                    {formatValue(session.total_pnl)}
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
                      color: (session.pnlPercentage ?? 0) > 0 ? theme.palette.success.main : theme.palette.error.main
                    }}
                  >
                    {(session.pnlPercentage ?? 0).toFixed(2)}%
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
        {sessionStats.some(session => session.total_trades > 0) && (
          <Box
            sx={{
              p: 2,
              bgcolor: alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.1 : 0.05),
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
                const sessionsWithTrades = sessionStats.filter(session => session.total_trades > 0);
                if (sessionsWithTrades.length === 0) return "No trading data available for analysis.";

                // Find most profitable session by total P&L
                const mostProfitable = sessionsWithTrades.reduce((prev, current) =>
                  current.total_pnl > prev.total_pnl ? current : prev
                );

                // Find session with highest win rate
                const highestWinRate = sessionsWithTrades.reduce((prev, current) =>
                  current.win_rate > prev.win_rate ? current : prev
                );

                // Find session with best average P&L per trade
                const bestAverage = sessionsWithTrades.reduce((prev, current) =>
                  current.averagePnL > prev.averagePnL ? current : prev
                );

                if (mostProfitable.total_pnl > 0) {
                  if (mostProfitable.session === highestWinRate.session && mostProfitable.session === bestAverage.session) {
                    return `${mostProfitable.session} session is your strongest performer with the highest total P&L (${formatValue(mostProfitable.total_pnl)}), best win rate (${(mostProfitable.win_rate ?? 0).toFixed(1)}%), and highest average per trade (${formatValue(mostProfitable.averagePnL)}). Consider focusing more trades during this session.`;
                  } else if (mostProfitable.session === highestWinRate.session) {
                    return `${mostProfitable.session} session has both the highest total P&L (${formatValue(mostProfitable.total_pnl)}) and best win rate (${(mostProfitable.win_rate ?? 0).toFixed(1)}%). ${bestAverage.session} session has the best average per trade (${formatValue(bestAverage.averagePnL)}).`;
                  } else {
                    return `${mostProfitable.session} session is most profitable overall (${formatValue(mostProfitable.total_pnl)}), while ${highestWinRate.session} session has the highest win rate (${(highestWinRate.win_rate ?? 0).toFixed(1)}%). Consider analyzing what makes each session successful.`;
                  }
                } else {
                  const leastLosing = sessionsWithTrades.reduce((prev, current) =>
                    current.total_pnl > prev.total_pnl ? current : prev
                  );
                  return `All sessions are currently showing losses. ${leastLosing.session} session has the smallest loss (${formatValue(leastLosing.total_pnl)}). Consider reviewing your strategy and risk management.`;
                }
              })()}
            </Typography>
          </Box>
        )}

      </Box>
      </TabPanel>

      {/* Cumulative P&L Tab */}
      <TabPanel value={activeTab} index={1}>
        {chartData && chartData.length > 0 ? (
          <CumulativePnLChart
            chartData={chartData}
            targetValue={targetValue ?? null}
            monthly_target={monthly_target}
            setMultipleTradesDialog={setMultipleTradesDialog}
            timePeriod={timePeriod}
          />
        ) : (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 300,
            color: 'text.secondary',
          }}>
            <Typography>No chart data available</Typography>
          </Box>
        )}
      </TabPanel>
    </Paper>
  );
};

export default SessionPerformanceAnalysis;
