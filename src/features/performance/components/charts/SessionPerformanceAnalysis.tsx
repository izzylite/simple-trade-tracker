import React from 'react';
import {
  Box, Typography, useTheme, Stack, alpha,
  Button, Tooltip,
} from '@mui/material';
import {
  Assessment as PerformanceIcon,
  AccessTime,
  LightbulbOutlined,
} from '@mui/icons-material';
import { isSameMonth } from 'date-fns';
import { Trade } from 'features/calendar/types/dualWrite';
import { formatValue } from 'utils/formatters';
import { SESSION_COLORS } from 'utils/sessionTimeUtils';
import { EYEBROW_SX, TNUM } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';
import InfoStrip from 'components/common/InfoStrip';

interface SessionPerformanceAnalysisProps {
  sessionStats: any[];
  trades: Trade[];
  selectedDate: Date;
  timePeriod: 'month' | 'quarter' | 'ytd' | 'year' | 'all';
  setMultipleTradesDialog: (dialogState: any) => void;
  chartData?: any[];
  targetValue?: number | null;
  monthly_target?: number;
  onOpenPerformanceDetail?: () => void;
}

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
  const hairline = theme.palette.divider;

  // Win/loss bar colors
  const COLORS = {
    win: theme.palette.success.main,
    loss: theme.palette.error.main,
    zero: '#94a3b8',
    breakEven: '#64748b',
  };

  return (
    <CardShell
      elevation="md"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      head={{
        icon: <AccessTime sx={{ fontSize: 16 }} />,
        title: 'Session Performance',
        eyebrow: 'By trading session',
        right: onOpenPerformanceDetail && (
          <Tooltip title="Full performance analytics" arrow>
            <Button
              size="small"
              startIcon={<PerformanceIcon sx={{ fontSize: 18 }} />}
              onClick={onOpenPerformanceDetail}
              variant="outlined"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                color: 'text.secondary',
                borderColor: alpha(theme.palette.text.secondary, 0.3),
                '&:hover': {
                  color: 'primary.main',
                  borderColor: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              Performance Analytics
            </Button>
          </Tooltip>
        ),
      }}
    >
      {/* ── Body ───────────────────────────────────────────────────── */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          flex: 1,
        }}
      >
        {/* Session cards grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(2, 1fr)' },
            gap: 1.5,
            gridAutoRows: 'minmax(min-content, max-content)',
          }}
        >
          {sessionStats.map(session => {
            const sessionColor =
              SESSION_COLORS[session.session as keyof typeof SESSION_COLORS] ||
              theme.palette.primary.main;
            const isInteractive = session.total_trades > 0;
            return (
              <Box
                key={session.session}
                onClick={() => {
                  if (session.total_trades > 0) {
                    const sessionTrades = trades.filter(trade =>
                      trade.session?.toLowerCase() === session.session?.toLowerCase() &&
                      (timePeriod === 'month'
                        ? isSameMonth(new Date(trade.trade_date), selectedDate)
                        : timePeriod === 'year'
                          ? new Date(trade.trade_date).getFullYear() === selectedDate.getFullYear()
                          : true)
                    );
                    setMultipleTradesDialog({
                      open: true,
                      trades: sessionTrades,
                      tradeIds: sessionTrades.map(t => t.id),
                      title: `${session.session} Session Trades`,
                      expandedTradeId: sessionTrades.length === 1 ? sessionTrades[0].id : null,
                    });
                  }
                }}
                sx={{
                  p: 1.5,
                  border: `1px solid ${hairline}`,
                  borderRadius: '10px',
                  bgcolor: alpha(sessionColor, 0.08),
                  opacity: session.total_trades === 0 ? 0.5 : 1,
                  cursor: isInteractive ? 'pointer' : 'default',
                  transition: 'background-color 150ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  minWidth: 0,
                  '&:hover': isInteractive
                    ? { bgcolor: alpha(sessionColor, 0.14) }
                    : {},
                }}
              >
                {/* Accent dot + session name eyebrow */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: sessionColor,
                    }}
                  />
                  <Typography
                    sx={{
                      ...EYEBROW_SX,
                      color: sessionColor,
                    }}
                  >
                    {session.session}
                  </Typography>
                </Box>

                <Stack spacing={0.75}>
                  <Row label="Total trades">
                    <Typography
                      sx={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'text.primary',
                        fontFeatureSettings: TNUM,
                      }}
                    >
                      {session.total_trades}
                    </Typography>
                  </Row>

                  <Row label="Win rate">
                    <Typography
                      sx={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color:
                          (session.win_rate ?? 0) >= 50
                            ? theme.palette.success.main
                            : theme.palette.error.main,
                        fontFeatureSettings: TNUM,
                      }}
                    >
                      {(session.win_rate ?? 0).toFixed(1)}%
                    </Typography>
                  </Row>

                  <Row label="P&L">
                    <Typography
                      sx={{
                        fontSize: { xs: '0.78rem', sm: '0.85rem' },
                        fontWeight: 700,
                        color:
                          session.total_pnl > 0
                            ? theme.palette.success.main
                            : session.total_pnl < 0
                              ? theme.palette.error.main
                              : 'text.primary',
                        fontFeatureSettings: TNUM,
                        letterSpacing: '-0.01em',
                        textAlign: 'right',
                        wordBreak: 'break-word',
                      }}
                    >
                      {session.total_pnl > 0 ? '▲ ' : session.total_pnl < 0 ? '▼ ' : ''}
                      {formatValue(session.total_pnl)}
                    </Typography>
                  </Row>

                  <Row label="Avg P&L">
                    <Typography
                      sx={{
                        fontSize: { xs: '0.74rem', sm: '0.8rem' },
                        fontWeight: 600,
                        color:
                          session.averagePnL > 0
                            ? theme.palette.success.main
                            : session.averagePnL < 0
                              ? theme.palette.error.main
                              : 'text.primary',
                        fontFeatureSettings: TNUM,
                        textAlign: 'right',
                        wordBreak: 'break-word',
                      }}
                    >
                      {formatValue(session.averagePnL)}
                    </Typography>
                  </Row>

                  <Row label="Account %">
                    <Typography
                      sx={{
                        fontSize: { xs: '0.74rem', sm: '0.8rem' },
                        fontWeight: 600,
                        color:
                          (session.pnlPercentage ?? 0) > 0
                            ? theme.palette.success.main
                            : (session.pnlPercentage ?? 0) < 0
                              ? theme.palette.error.main
                              : 'text.primary',
                        fontFeatureSettings: TNUM,
                      }}
                    >
                      {(() => {
                        const pct = session.pnlPercentage ?? 0;
                        if (Math.abs(pct) >= 1000) {
                          return `${(pct / 100).toFixed(1)}×`;
                        }
                        return `${pct.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}%`;
                      })()}
                    </Typography>
                  </Row>
                </Stack>

                {/* Win/loss proportion bar */}
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                  <Box
                    sx={{
                      flex: session.winners || 0.01,
                      minWidth: session.winners ? 4 : 0,
                      height: 4,
                      bgcolor: COLORS.win,
                      borderRadius: 2,
                    }}
                  />
                  <Box
                    sx={{
                      flex: session.losers || 0.01,
                      minWidth: session.losers ? 4 : 0,
                      height: 4,
                      bgcolor: COLORS.loss,
                      borderRadius: 2,
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Pro tip — hairline-bordered violet-tinted strip */}
        {sessionStats.some(session => session.total_trades > 0) && (
          <InfoStrip
            tone="violet"
            icon={<LightbulbOutlined sx={{ fontSize: 16 }} />}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ ...EYEBROW_SX, color: 'primary.main', mb: 0.5 }}>
                Pro tip
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', lineHeight: 1.5 }}
              >
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
          </InfoStrip>
        )}
      </Box>
    </CardShell>
  );
};

// ── Internal row helper: label left, value slot right ───────────────────
const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 1,
    }}
  >
    <Typography
      sx={{
        fontSize: '0.72rem',
        color: 'text.secondary',
        fontWeight: 500,
      }}
    >
      {label}
    </Typography>
    {children}
  </Box>
);

export default SessionPerformanceAnalysis;
