import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  alpha,
  Tooltip,
  useTheme,
  useMediaQuery,
  Skeleton
} from '@mui/material';
import {
  TrendingUp,
  EmojiEvents,
  CalendarMonth,
  Analytics,
  ViewCarousel as GalleryIcon,
} from '@mui/icons-material';
import { Trade, Calendar } from '../types/dualWrite';
import { formatCurrency } from '../utils/formatters';

import { calculateTargetProgress } from '../utils/statsUtils';
import { error } from '../utils/logger';



interface MonthlyStatsProps {
  trades: Trade[];
  accountBalance: number;
  onDeleteTrade?: (id: string) => void;
  currentDate?: Date;
  monthlyTarget?: number;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
  // Gallery mode handler
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  // Performance charts props
  calendarId?: string;
  scoreSettings?: import('../types/score').ScoreSettings;
  dynamicRiskSettings?: import('../utils/dynamicRiskUtils').DynamicRiskSettings;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: import('../types/dualWrite').Calendar) => import('../types/dualWrite').Calendar) => Promise<import('../types/dualWrite').Calendar | undefined>;
  onEditTrade?: (trade: Trade) => void;
  economicFilter?: (calendarId: string) => import('./economicCalendar/EconomicCalendarDrawer').EconomicCalendarFilterSettings;
  maxDailyDrawdown?: number;
  pnlBeforeMonth?: number;
  isPnlLoading?: boolean;
  calendar?: Calendar;
}


const MonthlyStats: React.FC<MonthlyStatsProps> = ({
  trades,
  accountBalance,
  onDeleteTrade,
  currentDate = new Date(),
  monthlyTarget,
  isReadOnly = false,
  onOpenGalleryMode,
  calendarId,
  scoreSettings,
  dynamicRiskSettings,
  onUpdateTradeProperty,
  onUpdateCalendarProperty,
  onEditTrade,
  economicFilter,
  maxDailyDrawdown,
  pnlBeforeMonth,
  isPnlLoading = false,
  calendar,
}) => {
  const navigate = useNavigate();

  const handleOpenPerformancePage = () => {
    if (calendarId) {
      try {
        localStorage.setItem('perf_selected_calendar_id', calendarId);
      } catch {
        // ignore quota / disabled storage
      }
    }
    navigate('/performance');
  };

  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  const monthTrades = trades.filter(trade =>
    new Date(trade.trade_date).getMonth() === currentDate.getMonth() &&
    new Date(trade.trade_date).getFullYear() === currentDate.getFullYear()
  );

  // Calculate monthly values from the filtered trades
  const netAmountForThisMonth = monthTrades.reduce((sum, trade) => sum + trade.amount, 0);
  const winCount = monthTrades.filter(trade => trade.trade_type === 'win').length;
  const lossCount = monthTrades.filter(trade => trade.trade_type === 'loss').length;
  const winRate = monthTrades.length > 0 ? (winCount / monthTrades.length * 100).toFixed(1) : '0';

  // Additional useful statistics
  const totalWinAmount = monthTrades.filter(trade => trade.trade_type === 'win').reduce((sum, trade) => sum + trade.amount, 0);
  const totalLossAmount = Math.abs(monthTrades.filter(trade => trade.trade_type === 'loss').reduce((sum, trade) => sum + trade.amount, 0));
  const profitFactor = totalLossAmount > 0 ? (totalWinAmount / totalLossAmount).toFixed(2) : totalWinAmount > 0 ? '∞' : '0';
  const averageTradeSize = monthTrades.length > 0 ? (Math.abs(netAmountForThisMonth) / monthTrades.length).toFixed(0) : '0';
  const averageWin = winCount > 0 ? (totalWinAmount / winCount).toFixed(0) : '0';
  const averageLoss = lossCount > 0 ? (totalLossAmount / lossCount).toFixed(0) : '0';

  // Best and worst day calculations
  const dailyPnL = new Map<string, number>();
  monthTrades.forEach(trade => {
    const dateKey = new Date(trade.trade_date).toDateString();
    dailyPnL.set(dateKey, (dailyPnL.get(dateKey) || 0) + trade.amount);
  });

  let bestDay = 0;
  let bestDayDate = '';
  let worstDay = 0;
  let worstDayDate = '';

  if (dailyPnL.size > 0) {
    const entries = Array.from(dailyPnL.entries());
    const bestEntry = entries.reduce((max, current) => current[1] > max[1] ? current : max);
    const worstEntry = entries.reduce((min, current) => current[1] < min[1] ? current : min);

    bestDay = bestEntry[1];
    bestDayDate = format(new Date(bestEntry[0]), 'EEE d');
    worstDay = worstEntry[1];
    worstDayDate = format(new Date(worstEntry[0]), 'EEE d');
  }

  // Calculate account value at start of month
  // pnlBeforeMonth here is the cumulative PnL before this month (pre-computed by caller)
  const startOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const accountValueAtStartOfMonth = pnlBeforeMonth !== undefined
    ? accountBalance + pnlBeforeMonth
    : (() => {
        const tradesBeforeMonth = trades.filter(
          trade => new Date(trade.trade_date) < startOfCurrentMonth
        );
        return accountBalance + tradesBeforeMonth.reduce(
          (sum, trade) => sum + trade.amount, 0
        );
      })();

  // Calculate growth percentage relative to start-of-month value
  const growthPercentage = accountValueAtStartOfMonth > 0
    ? ((netAmountForThisMonth / accountValueAtStartOfMonth) * 100).toFixed(1)
    : '0';


  // Calculate monthly target progress using start-of-month value as baseline
  const targetProgressValue = monthlyTarget && monthlyTarget > 0
    ? calculateTargetProgress(monthTrades, accountValueAtStartOfMonth, monthlyTarget)
    : 0;
  const targetProgress = targetProgressValue.toFixed(0);
  const isTargetMet = monthlyTarget ? parseFloat(growthPercentage) >= monthlyTarget : false;

  // Handle gallery mode
  const handleMonthlyGalleryMode = () => {
    if (monthTrades.length > 0 && onOpenGalleryMode) {
      const monthName = format(currentDate, 'MMMM yyyy');
      const title = `${monthName} - Monthly Trades (${monthTrades.length} trades)`;
      onOpenGalleryMode(monthTrades, monthTrades[0].id, title);
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: '12px',
          position: 'relative',
          width: '100%',
          pb: { xs: 4, sm: 2.5 },
          overflow: 'hidden',
          height: '100%', 
          bgcolor: 'background.paper',
          boxShadow: theme => theme.palette.mode === 'dark'
            ? '0 2px 8px rgba(0,0,0,0.3)'
            : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)'
        }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Typography sx={{ mb: { xs: 0.5, sm: 1 }, fontWeight: 600, pl: 0.5, fontSize: { xs: '0.875rem', sm: '0.9375rem' } }}>
            Monthly Performance
          </Typography>


          <Box sx={{
            position: 'static',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
            mb: 2,
            flex: 1,
            alignItems: 'center'
          }}>
            {/* View Details Stats Button */}
            {calendarId && (
              <Tooltip title="Open performance page" arrow>
                <IconButton
                  onClick={handleOpenPerformancePage}
                  size="small"
                  sx={{
                    color: 'primary.main',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  <Analytics />
                </IconButton>
              </Tooltip>
            )}
            {/* Gallery Button - Moved from TradeCalendarPage */}
            {monthTrades.length > 0 && onOpenGalleryMode && (
              <Tooltip title="View all trades for this month in gallery mode" arrow>
                <IconButton
                  onClick={handleMonthlyGalleryMode}
                  size="small"
                  sx={{
                    color: 'primary.main',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  <GalleryIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: { xs: 1, sm: 1.25, md: 1.5 },
        }}>
          {/* Monthly P&L Card */}
          <Box sx={{
            p: { xs: 1, sm: 1.25 },
            borderRadius: '8px',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              mb: 0.25
            }}>
              <TrendingUp sx={{ fontSize: '0.95rem', color: netAmountForThisMonth > 0 ? 'success.main' : netAmountForThisMonth < 0 ? 'error.main' : 'text.secondary' }} />
              <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Monthly P&L
              </Typography>
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '1.125rem',
                color: netAmountForThisMonth > 0 ? 'success.main' : netAmountForThisMonth < 0 ? 'error.main' : 'text.primary',
                display: 'flex',
                alignItems: 'baseline',
                gap: 0.5,
                fontFeatureSettings: "'tnum' on, 'lnum' on",
              }}
            >
              {formatCurrency(netAmountForThisMonth)}
              {isPnlLoading ? (
                <Skeleton variant="text" width={50} sx={{ fontSize: '0.75rem', display: 'inline-block', ml: 0.25 }} />
              ) : (
                <Tooltip
                  title={`Percentage based on account value at start of ${format(currentDate, 'MMMM')}: ${formatCurrency(accountValueAtStartOfMonth)}`}
                  placement="top"
                >
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '0.75rem',
                      color: netAmountForThisMonth > 0 ? 'success.main' : netAmountForThisMonth < 0 ? 'error.main' : 'text.primary',
                      fontWeight: 600,
                      cursor: 'help'
                    }}
                  >
                    ({growthPercentage}%)
                  </Typography>
                </Tooltip>
              )}
            </Typography>

            {monthlyTarget && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <Box sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.25
                }}>
                  <Typography sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.6875rem' }}>
                    Target Progress
                  </Typography>
                  <Typography sx={{
                    fontWeight: 600,
                    color: isTargetMet ? 'success.main' : 'primary.main',
                    fontSize: '0.6875rem'
                  }}>
                    {targetProgress}%
                  </Typography>
                </Box>
                <Box sx={{
                  width: '100%',
                  height: '5px',
                  bgcolor: theme => alpha(theme.palette.divider, 0.5),
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <Box sx={{
                    width: `${Math.max(Math.min(parseFloat(targetProgress), 100), 0)}%`,
                    height: '100%',
                    bgcolor: isTargetMet ? 'success.main' : 'primary.main',
                    transition: 'width 0.3s ease'
                  }} />
                </Box>
              </Box>
            )}
          </Box>

          {/* Win Rate Card */}
          <Box sx={{
            p: { xs: 1, sm: 1.25 },
            borderRadius: '8px',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              mb: 0.25
            }}>
              <EmojiEvents sx={{ fontSize: '0.95rem', color: parseFloat(winRate) > 50 ? 'success.main' : 'text.secondary' }} />
              <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Win Rate
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: parseFloat(winRate) > 50 ? 'success.main' : 'text.primary', fontFeatureSettings: "'tnum' on, 'lnum' on" }}>
              {winRate}%
            </Typography>
            <Typography sx={{ fontWeight: 500, color: 'text.secondary', mt: 0.25, fontSize: '0.75rem' }}>
              {winCount} Wins / {lossCount} Losses
            </Typography>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              mt: 0.75,
              gap: 0.5
            }}>
              <Box sx={{
                height: '5px',
                bgcolor: 'success.main',
                borderRadius: '3px',
                flex: winCount || 1
              }} />
              <Box sx={{
                height: '5px',
                bgcolor: 'error.main',
                borderRadius: '3px',
                flex: lossCount || 1
              }} />
            </Box>
          </Box>

          {/* Total Trades Card */}
          <Box sx={{
            p: { xs: 1, sm: 1.25 },
            borderRadius: '8px',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25
          }}>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              mb: 0.25
            }}>
              <CalendarMonth sx={{ fontSize: '0.95rem', color: 'text.secondary' }} />
              <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Trading Activity
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: 'text.primary', fontFeatureSettings: "'tnum' on, 'lnum' on" }}>
              {monthTrades.length} Trade{monthTrades.length === 1 ? '' : 's'}
            </Typography>
            <Typography sx={{ fontWeight: 500, color: 'text.secondary', mt: 0.25, fontSize: '0.75rem' }}>
              {monthTrades.length > 0 ? (monthTrades.length / 30 * 100).toFixed(0) : 0}% of Month Active
            </Typography>
          </Box>

          {/* Starting Capital Card */}
          <Box sx={{
            p: { xs: 0.875, sm: 1 },
            borderRadius: '8px',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.125
          }}>
            <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.6875rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Started With
            </Typography>
            {isPnlLoading ? (
              <Skeleton variant="text" width={100} sx={{ fontSize: '0.9375rem' }} />
            ) : (
              <Typography sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.9375rem', fontFeatureSettings: "'tnum' on, 'lnum' on" }}>
                {formatCurrency(accountValueAtStartOfMonth)}
              </Typography>
            )}
          </Box>

          {/* Best Day Card */}
          <Box sx={{
            p: { xs: 0.875, sm: 1 },
            borderRadius: '8px',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.125
          }}>
            <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.6875rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Best Day {bestDayDate && (
                <Typography component="span" sx={{ color: 'secondary.main', fontWeight: 700, fontSize: '0.625rem' }}>
                  {bestDayDate}
                </Typography>
              )}
            </Typography>
            <Typography sx={{ fontWeight: 700, color: 'success.main', fontSize: '0.9375rem', fontFeatureSettings: "'tnum' on, 'lnum' on" }}>
              {bestDay > 0 ? formatCurrency(bestDay) : 'No trades'}
            </Typography>
          </Box>

          {/* Profit Factor Card */}
          <Box sx={{
            p: { xs: 0.875, sm: 1 },
            borderRadius: '8px',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.125
          }}>
            <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.6875rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Profit Factor
            </Typography>
            <Typography sx={{ fontWeight: 700, color: parseFloat(profitFactor) > 1 ? 'success.main' : 'text.primary', fontSize: '0.9375rem', fontFeatureSettings: "'tnum' on, 'lnum' on" }}>
              {profitFactor}
            </Typography>
          </Box>
        </Box>

      </Paper>

    </>
  );
};

export default MonthlyStats;
