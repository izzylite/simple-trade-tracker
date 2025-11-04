import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Stack,
  useTheme,
  alpha,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  CalendarToday
} from '@mui/icons-material';
import AppHeader from './common/AppHeader';
import { Calendar, Trade } from '../types/dualWrite';
import { CalendarWithUIState } from '../types/calendar';
import { TradeRepository } from '../services/repository/repositories/TradeRepository';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { logger } from '../utils/logger';
import Shimmer from './Shimmer';
import { format } from 'date-fns';

interface PerformancePageProps {
  calendars: CalendarWithUIState[];
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  onMenuClick?: () => void;
}

const PerformancePage: React.FC<PerformancePageProps> = ({ calendars, onToggleTheme, mode, onMenuClick }) => {
  const theme = useTheme();
  const { user } = useAuth();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('all');
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  // Fetch all trades
  useEffect(() => {
    const fetchAllTrades = async () => {
      if (!user?.uid) return;

      setLoadingTrades(true);
      try {
        const tradeRepository = new TradeRepository();
        const trades = await tradeRepository.findByUserId(user.uid);
        setAllTrades(trades);
      } catch (error) {
        logger.error('Error fetching trades:', error);
      } finally {
        setLoadingTrades(false);
      }
    };

    fetchAllTrades();
  }, [user?.uid]);

  // Filter trades based on selected calendar
  const filteredTrades = useMemo(() => {
    if (selectedCalendarId === 'all') {
      return allTrades;
    }
    return allTrades.filter(trade => trade.calendar_id === selectedCalendarId);
  }, [allTrades, selectedCalendarId]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalTrades = filteredTrades.length;
    const winningTrades = filteredTrades.filter(t => t.trade_type === 'win').length;
    const losingTrades = filteredTrades.filter(t => t.trade_type === 'loss').length;
    const totalPnL = filteredTrades.reduce((sum, t) => sum + (t.amount || 0), 0);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const avgWin = winningTrades > 0
      ? filteredTrades.filter(t => t.trade_type === 'win').reduce((sum, t) => sum + (t.amount || 0), 0) / winningTrades
      : 0;
    const avgLoss = losingTrades > 0
      ? Math.abs(filteredTrades.filter(t => t.trade_type === 'loss').reduce((sum, t) => sum + (t.amount || 0), 0) / losingTrades)
      : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnL,
      winRate,
      avgWin,
      avgLoss,
      profitFactor
    };
  }, [filteredTrades]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'custom.pageBackground' }}>
      <AppHeader onToggleTheme={onToggleTheme} mode={mode} onMenuClick={onMenuClick} />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Performance Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive performance metrics across all your trading calendars
          </Typography>
        </Box>

        {/* Calendar Filter */}
        <Box sx={{ mb: 4 }}>
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Calendar</InputLabel>
            <Select
              value={selectedCalendarId}
              onChange={(e) => setSelectedCalendarId(e.target.value)}
              label="Calendar"
            >
              <MenuItem value="all">All Calendars</MenuItem>
              {calendars.map((calendar) => (
                <MenuItem key={calendar.id} value={calendar.id}>
                  {calendar.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Statistics Cards */}
        {loadingTrades ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} sx={{ borderRadius: 2 }}>
                <Shimmer height={120} />
              </Card>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3, mb: 4 }}>
            {/* Total Trades */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total Trades
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats.totalTrades}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {stats.winningTrades}W / {stats.losingTrades}L
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.info.main, 0.1)
                    }}
                  >
                    <CalendarToday sx={{ color: theme.palette.info.main, fontSize: 28 }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Win Rate */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Win Rate
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stats.winRate.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Success rate
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.success.main, 0.1)
                    }}
                  >
                    <TrendingUp sx={{ color: theme.palette.success.main, fontSize: 28 }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Total P&L */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total P&L
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 700,
                        color: stats.totalPnL >= 0 ? 'success.main' : 'error.main'
                      }}
                    >
                      {formatCurrency(stats.totalPnL)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: stats.totalPnL >= 0 ? 'success.main' : 'error.main' }}
                    >
                      {stats.totalPnL >= 0 ? '↑' : '↓'} All time
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(
                        stats.totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main,
                        0.1
                      )
                    }}
                  >
                    {stats.totalPnL >= 0 ? (
                      <TrendingUp sx={{ color: theme.palette.success.main, fontSize: 28 }} />
                    ) : (
                      <TrendingDown sx={{ color: theme.palette.error.main, fontSize: 28 }} />
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Average Win */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Average Win
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {formatCurrency(stats.avgWin)}
                </Typography>
              </CardContent>
            </Card>

            {/* Average Loss */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Average Loss
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
                  {formatCurrency(stats.avgLoss)}
                </Typography>
              </CardContent>
            </Card>

            {/* Profit Factor */}
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Profit Factor
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: stats.profitFactor >= 1 ? 'success.main' : 'error.main'
                  }}
                >
                  {stats.profitFactor.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Placeholder for Charts */}
        <Card sx={{ borderRadius: 2, p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Advanced Charts Coming Soon
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Detailed performance charts and analytics will be available here, including:
          </Typography>
          <Stack spacing={1} sx={{ mt: 2, maxWidth: 600, mx: 'auto' }}>
            <Typography variant="body2" color="text.secondary">
              • Cumulative P&L Chart
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Win/Loss Distribution
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Tag Performance Analysis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Day of Week Analysis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Risk/Reward Analysis
            </Typography>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
};

export default PerformancePage;

