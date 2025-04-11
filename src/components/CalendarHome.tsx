import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Container,
  Stack,
  Divider,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  AppBar,
  Toolbar,
  Avatar
} from '@mui/material';
import CalendarFormDialog, { CalendarFormData } from './CalendarFormDialog';
import {
  Add as AddIcon,
  CalendarToday as CalendarIcon,
  Delete as DeleteIcon,
  TrendingUp,
  CalendarMonth,
  Edit as EditIcon,
  TrendingDown,
  InfoOutlined,
  BarChart as ChartIcon,
  Google as GoogleIcon,
  Logout as LogoutIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '../types/calendar';
import { formatCurrency } from '../utils/tradeUtils';
import { dialogProps } from '../styles/dialogStyles';
import PerformanceCharts from './PerformanceCharts';
import SelectDateDialog from './SelectDateDialog';
import { useAuth } from '../contexts/AuthContext';
import { keyframes } from '@mui/system';
import { getCalendarStats } from '../services/calendarService';
// TradeDetailDialog has been removed

interface CalendarHomeProps {
  calendars: Calendar[];
  onCreateCalendar: (name: string, accountBalance: number, maxDailyDrawdown: number, weeklyTarget?: number, monthlyTarget?: number, yearlyTarget?: number, riskPerTrade?: number, dynamicRiskEnabled?: boolean, increasedRiskPercentage?: number, profitThresholdPercentage?: number) => void;
  onDeleteCalendar: (id: string) => void;
  onUpdateCalendar: (id: string, updates: Partial<Calendar>) => void;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  isLoading?: boolean;
  loadAllTrades?: (calendarId: string) => Promise<void>;
}

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const CalendarSkeleton = () => {
  const theme = useTheme();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ mb: 2.5 }}>
          {/* Title shimmer */}
          <Box
            sx={{
              height: 28,
              width: '60%',
              borderRadius: 1,
              mb: 1,
              background: `linear-gradient(90deg,
                ${alpha(theme.palette.background.paper, 0.1)} 25%,
                ${alpha(theme.palette.background.paper, 0.2)} 50%,
                ${alpha(theme.palette.background.paper, 0.1)} 75%)`,
              backgroundSize: '200% 100%',
              animation: `${shimmer} 1.5s infinite linear`
            }}
          />
          {/* Date shimmer */}
          <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
            <Box
              sx={{
                height: 20,
                width: '30%',
                borderRadius: 0.5,
                background: `linear-gradient(90deg,
                  ${alpha(theme.palette.background.paper, 0.1)} 25%,
                  ${alpha(theme.palette.background.paper, 0.2)} 50%,
                  ${alpha(theme.palette.background.paper, 0.1)} 75%)`,
                backgroundSize: '200% 100%',
                animation: `${shimmer} 1.5s infinite linear`
              }}
            />
            <Box
              sx={{
                height: 20,
                width: '30%',
                borderRadius: 0.5,
                background: `linear-gradient(90deg,
                  ${alpha(theme.palette.background.paper, 0.1)} 25%,
                  ${alpha(theme.palette.background.paper, 0.2)} 50%,
                  ${alpha(theme.palette.background.paper, 0.1)} 75%)`,
                backgroundSize: '200% 100%',
                animation: `${shimmer} 1.5s infinite linear`
              }}
            />
          </Stack>
        </Box>
        <Divider sx={{ my: 2, opacity: 0.6 }} />
        {/* Stats shimmer */}
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Box key={i}
              sx={{
                height: 24,
                width: i === 2 ? '70%' : '85%',
                borderRadius: 0.5,
                background: `linear-gradient(90deg,
                  ${alpha(theme.palette.background.paper, 0.1)} 25%,
                  ${alpha(theme.palette.background.paper, 0.2)} 50%,
                  ${alpha(theme.palette.background.paper, 0.1)} 75%)`,
                backgroundSize: '200% 100%',
                animation: `${shimmer} 1.5s infinite linear`
              }}
            />
          ))}
        </Stack>
      </CardContent>
      <CardActions sx={{
        justifyContent: 'flex-end',
        p: 2,
        pt: 1,
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
      }}>
        {/* Action buttons shimmer */}
        <Stack direction="row" spacing={1}>
          {[1, 2, 3].map((i) => (
            <Box key={i}
              sx={{
                height: 32,
                width: 80,
                borderRadius: 1,
                background: `linear-gradient(90deg,
                  ${alpha(theme.palette.background.paper, 0.1)} 25%,
                  ${alpha(theme.palette.background.paper, 0.2)} 50%,
                  ${alpha(theme.palette.background.paper, 0.1)} 75%)`,
                backgroundSize: '200% 100%',
                animation: `${shimmer} 1.5s infinite linear`
              }}
            />
          ))}
        </Stack>
      </CardActions>
    </Card>
  );
};

export const CalendarHome: React.FC<CalendarHomeProps> = ({
  calendars,
  onCreateCalendar,
  onDeleteCalendar,
  onUpdateCalendar,
  onToggleTheme,
  mode,
  isLoading: externalLoading,
  loadAllTrades
}) => {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [calendarToDelete, setCalendarToDelete] = useState<string | null>(null);
  const [calendarToEdit, setCalendarToEdit] = useState<Calendar | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const theme = useTheme();
  const navigate = useNavigate();
  const [selectedCalendarForCharts, setSelectedCalendarForCharts] = useState<Calendar | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [currentTimePeriod, setCurrentTimePeriod] = useState<'month' | 'year' | 'all'>('month');
  // Track which calendars we've attempted to load trades for
  const [loadAttempted, setLoadAttempted] = useState<{[key: string]: boolean}>({});
  // We no longer need selectedTrade state since TradeDetailDialog has been removed

  // Use external loading state if provided, otherwise use internal loading state
  const isLoading = externalLoading !== undefined ? externalLoading : false;

  const handleCreateCalendarSubmit = async (data: CalendarFormData) => {
    setIsCreating(true);
    try {
      await onCreateCalendar(
        data.name,
        data.accountBalance,
        data.maxDailyDrawdown,
        data.weeklyTarget,
        data.monthlyTarget,
        data.yearlyTarget,
        data.riskPerTrade,
        data.dynamicRiskEnabled,
        data.increasedRiskPercentage,
        data.profitThresholdPercentage
      );
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating calendar:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditCalendarSubmit = async (data: CalendarFormData) => {
    if (!calendarToEdit) return;

    setIsEditing(true);
    try {
      const updates: Partial<Calendar> = {
        name: data.name,
        accountBalance: data.accountBalance,
        maxDailyDrawdown: data.maxDailyDrawdown,
        weeklyTarget: data.weeklyTarget,
        monthlyTarget: data.monthlyTarget,
        yearlyTarget: data.yearlyTarget,
        riskPerTrade: data.riskPerTrade,
        dynamicRiskEnabled: data.dynamicRiskEnabled,
        increasedRiskPercentage: data.increasedRiskPercentage,
        profitThresholdPercentage: data.profitThresholdPercentage
      };

      await onUpdateCalendar(calendarToEdit.id, updates);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating calendar:', error);
    } finally {
      setIsEditing(false);
    }
  };



  const handleCalendarClick = async (calendarId: string) => {
    // Load all trades for the calendar if loadAllTrades is provided
    if (loadAllTrades) {
      const calendar = calendars.find(c => c.id === calendarId);
      if (calendar && calendar.loadedYears.length === 0 && !loadAttempted[calendarId]) {
        // Mark that we've attempted to load trades for this calendar
        setLoadAttempted(prev => ({ ...prev, [calendarId]: true }));
        await loadAllTrades(calendarId);
      }
    }

    navigate(`/calendar/${calendarId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, calendarId: string) => {
    e.stopPropagation();
    setCalendarToDelete(calendarId);
    setIsDeleteDialogOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, calendar: Calendar) => {
    e.stopPropagation();
    setCalendarToEdit(calendar);
    setIsEditDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (calendarToDelete) {
      onDeleteCalendar(calendarToDelete);
      setCalendarToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const handleViewCharts = async (e: React.MouseEvent, calendar: Calendar) => {
    e.stopPropagation();

    // Load all trades for the calendar if loadAllTrades is provided
    if (loadAllTrades && calendar.loadedYears.length === 0 && !loadAttempted[calendar.id]) {
      // Mark that we've attempted to load trades for this calendar
      setLoadAttempted(prev => ({ ...prev, [calendar.id]: true }));
      await loadAllTrades(calendar.id);

      // Find the updated calendar with loaded trades
      const updatedCalendar = calendars.find(c => c.id === calendar.id);
      if (updatedCalendar) {
        setSelectedCalendarForCharts(updatedCalendar);
      } else {
        setSelectedCalendarForCharts(calendar);
      }
    } else {
      setSelectedCalendarForCharts(calendar);
    }
  };

  const handleCloseCharts = () => {
    setSelectedCalendarForCharts(null);
  };

  const handleMonthChange = (event: any) => {
    setSelectedMonth(new Date(event.target.value));
  };

  const handleTimePeriodChange = (period: 'month' | 'year' | 'all') => {
    setCurrentTimePeriod(period);
  };

  const handleYearChange = (year: number) => {
    const newDate = new Date(year, selectedMonth.getMonth(), 1);
    setSelectedMonth(newDate);
  };

  // Get available months for the selected calendar
  const availableMonths = useMemo(() => {
    if (!selectedCalendarForCharts) return [];

    const trades = selectedCalendarForCharts.cachedTrades || [];
    if (trades.length === 0) return [new Date()];

    const dates = trades.map(trade => new Date(trade.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Create an array of months between min and max date
    const months: Date[] = [];
    let currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const endDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

    while (currentDate <= endDate) {
      months.push(new Date(currentDate));
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    return months;
  }, [selectedCalendarForCharts]);



  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Failed to sign in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };


  return (
    <Box>

      <AppBar position="static" color="transparent"
        elevation={1}
        sx={{
          backdropFilter: 'blur(8px)',
          backgroundColor:  alpha(mode === 'light' ? '#ffffff' : theme.palette.background.default, 0.9),
          borderBottom: `1px solid ${theme.palette.divider}`
        }}>
        <Toolbar>
          <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
            Trade Tracker
          </Typography>
          {user ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton
                onClick={onToggleTheme}
                color="inherit"
                size="small"
                sx={{
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
                <Avatar
                  src={user.photoURL || undefined}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: theme.palette.primary.main,
                    fontSize: '0.875rem'
                  }}
                >
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </Avatar>
              </Stack>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={handleSignOut}
                size="small"
              >
                Sign Out
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center">
              <IconButton
                onClick={onToggleTheme}
                color="inherit"
                size="small"
                sx={{
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
              <Button
                variant="contained"
                startIcon={<GoogleIcon />}
                onClick={handleSignIn}
                sx={{
                  bgcolor: '#4285F4',
                  '&:hover': {
                    bgcolor: '#3367D6'
                  }
                }}
              >
                Sign in with Google
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {user ? (
          <>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h4" component="h2">
                Your Calendars
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setIsCreateDialogOpen(true)}
              >
                Create Calendar
              </Button>
            </Box>

            {calendars.length === 0 && !isLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 8,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  boxShadow: 1
                }}
              >
                <CalendarIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No calendars yet
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                  Create your first trading calendar to start tracking your trades
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  Create Calendar
                </Button>
              </Box>
            ) : (
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(3, 1fr)'
                },
                gap: 2
              }}>
                {isLoading ? (
                  // Show shimmer skeletons while loading
                  Array.from({ length: 3 }).map((_, index) => (
                    <CalendarSkeleton key={index} />
                  ))
                ) : (
                  // Show actual calendars
                  calendars.map(calendar => {
                    // Use the imported getCalendarStats function from calendarService
                    const stats = getCalendarStats(calendar);
                    return (
                      <Card
                        key={calendar.id}
                        sx={{
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: theme.shadows[8],
                            '& .calendar-gradient': {
                              opacity: 1
                            }
                          },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '4px',
                          }
                        }}
                        onClick={() => handleCalendarClick(calendar.id)}
                      >
                        <Box
                          className="calendar-gradient"
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.primary.light, 0.02)})`,
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                            pointerEvents: 'none'
                          }}
                        />
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ mb: 2.5 }}>
                            <Typography
                              variant="h6"
                              gutterBottom
                              sx={{
                                fontWeight: 600,
                                color: 'text.primary',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                              }}
                            >
                              {calendar.name}
                              {stats.totalPnL > 0 && (
                                <TrendingUp sx={{ fontSize: '1.2rem', color: 'success.main' }} />
                              )}
                              {stats.totalPnL < 0 && (
                                <TrendingDown sx={{ fontSize: '1.2rem', color: 'error.main' }} />
                              )}
                            </Typography>
                            <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <CalendarIcon sx={{ fontSize: '1rem' }} />
                                {format(calendar.createdAt, 'MMM d, yyyy')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <EditIcon sx={{ fontSize: '1rem' }} />
                                {format(calendar.lastModified, 'MMM d, yyyy')}
                              </Typography>
                            </Stack>
                          </Box>
                          <Divider sx={{ my: 2, opacity: 0.6 }} />

                          <Stack spacing={2}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.background.default, 0.6)
                              }}
                            >
                              <Box
                                sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  bgcolor: stats.totalPnL > 0
                                    ? alpha(theme.palette.success.main, 0.1)
                                    : stats.totalPnL < 0
                                    ? alpha(theme.palette.error.main, 0.1)
                                    : alpha(theme.palette.grey[500], 0.1)
                                }}
                              >
                                <TrendingUp sx={{
                                  fontSize: '1.2rem',
                                  color: stats.totalPnL > 0
                                    ? theme.palette.success.main
                                    : stats.totalPnL < 0
                                    ? theme.palette.error.main
                                    : theme.palette.grey[500]
                                }} />
                              </Box>
                              <Box>
                                <Typography variant="h6" sx={{
                                  color: stats.totalPnL > 0
                                    ? 'success.main'
                                    : stats.totalPnL < 0
                                    ? 'error.main'
                                    : 'text.secondary',
                                  fontWeight: 600
                                }}>
                                  {formatCurrency(stats.totalPnL)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Growth: {stats.growthPercentage.toFixed(2)}%
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gap: 2
                            }}>
                              <Box sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.background.default, 0.6)
                              }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Initial Balance
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                  {formatCurrency(stats.initialBalance)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Current: {formatCurrency(stats.initialBalance + stats.totalPnL)}
                                </Typography>
                              </Box>

                              <Box sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.background.default, 0.6)
                              }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Win Rate
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                  {stats.winRate.toFixed(1)}%
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {stats.winCount}W - {stats.lossCount}L
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gap: 2
                            }}>
                              <Box sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.background.default, 0.6)
                              }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Profit Factor
                                </Typography>
                                <Tooltip
                                  title={
                                    <Box sx={{ p: 1, maxWidth: 300 }}>
                                      <Typography variant="body2" gutterBottom>
                                        Profit Factor is the ratio of gross profit to gross loss. A value greater than 1 indicates profitable trading.
                                      </Typography>
                                      <Typography variant="body2" sx={{ mt: 1 }}>
                                        • Value &gt; 3: Excellent
                                      </Typography>
                                      <Typography variant="body2">
                                        • Value 2-3: Very Good
                                      </Typography>
                                      <Typography variant="body2">
                                        • Value 1.5-2: Good
                                      </Typography>
                                      <Typography variant="body2">
                                        • Value 1-1.5: Marginal
                                      </Typography>
                                      <Typography variant="body2">
                                        • Value &lt; 1: Unprofitable
                                      </Typography>
                                    </Box>
                                  }
                                  arrow
                                  placement="top"
                                >
                                  <Typography variant="h6" sx={{ fontWeight: 600, cursor: 'help' }}>
                                  <InfoOutlined sx={{ fontSize: '1rem', mr: 0.5 }} />
                                    {stats.profitFactor.toFixed(2)}
                                  </Typography>
                                </Tooltip>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                  Avg Win: {formatCurrency(stats.avgWin)}
                                </Typography>

                              </Box>

                              <Box sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.background.default, 0.6)
                              }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Max Drawdown
                                </Typography>


                                <Tooltip
                                  title={
                                    <Box sx={{ p: 1, maxWidth: 300 }}>
                                      <Typography variant="body2" gutterBottom>
                                        Maximum drawdown represents the largest peak-to-trough decline in your account balance.
                                      </Typography>
                                      {stats.maxDrawdown > 0 && (
                                        <>
                                          <Typography variant="body2" sx={{ mt: 1 }}>
                                            Recovery needed: {stats.drawdownRecoveryNeeded.toFixed(1)}%
                                          </Typography>
                                          <Typography variant="body2" sx={{ mt: 1 }}>
                                            Duration: {stats.drawdownDuration} days
                                          </Typography>
                                          {stats.drawdownStartDate && stats.drawdownEndDate && (
                                            <Typography variant="body2" sx={{ mt: 1 }}>
                                              Period: {format(stats.drawdownStartDate, 'MMM d')} - {format(stats.drawdownEndDate, 'MMM d')}
                                            </Typography>
                                          )}
                                        </>
                                      )}
                                    </Box>
                                  }
                                  arrow
                                  placement="top"
                                >
                                 <Typography variant="h6" sx={{ fontWeight: 600, cursor: 'help' }}>
                                 <InfoOutlined sx={{ fontSize: '1rem', mr: 0.5 }} />
                                  {stats.maxDrawdown.toFixed(1)}%
                                </Typography>
                                </Tooltip>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                                  Avg Loss: {formatCurrency(stats.avgLoss)}
                                </Typography>

                              </Box>
                            </Box>

                            {(calendar.weeklyTarget || calendar.monthlyTarget || calendar.yearlyTarget) && (
                              <Box sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.background.default, 0.6)
                              }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Target Progress
                                </Typography>
                                <Box sx={{
                                  display: 'grid',
                                  gridTemplateColumns: calendar.weeklyTarget && calendar.monthlyTarget && calendar.yearlyTarget
                                    ? 'repeat(3, 1fr)'
                                    : calendar.weeklyTarget && calendar.monthlyTarget || calendar.weeklyTarget && calendar.yearlyTarget || calendar.monthlyTarget && calendar.yearlyTarget
                                      ? 'repeat(2, 1fr)'
                                      : '1fr',
                                  gap: 2
                                }}>
                                  {calendar.weeklyTarget && (
                                    <Box>
                                      <Typography variant="body2" color="text.secondary">
                                        Weekly
                                      </Typography>
                                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        {stats.weeklyProgress.toFixed(1)}%
                                      </Typography>
                                    </Box>
                                  )}
                                  {calendar.monthlyTarget && (
                                    <Box>
                                      <Typography variant="body2" color="text.secondary">
                                        Monthly
                                      </Typography>
                                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        {stats.monthlyProgress.toFixed(1)}%
                                      </Typography>
                                    </Box>
                                  )}
                                  {calendar.yearlyTarget && (
                                    <Box>
                                      <Typography variant="body2" color="text.secondary">
                                        Yearly
                                      </Typography>
                                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        {stats.yearlyProgress.toFixed(1)}%
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            )}

                            <Box sx={{
                              p: 1.5,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.background.default, 0.6)
                            }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                PnL Performance
                              </Typography>
                              <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 2
                              }}>
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    Weekly
                                  </Typography>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      fontWeight: 600,
                                      color: parseFloat(String(stats.weeklyPnLPercentage)) > 0
                                        ? 'success.main'
                                        : parseFloat(String(stats.weeklyPnLPercentage)) < 0
                                        ? 'error.main'
                                        : 'text.primary'
                                    }}
                                  >
                                    {parseFloat(String(stats.weeklyPnLPercentage)) > 0 ? '+' : ''}{parseFloat(String(stats.weeklyPnLPercentage)).toFixed(1)}%
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    Monthly
                                  </Typography>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      fontWeight: 600,
                                      color: parseFloat(String(stats.monthlyPnLPercentage)) > 0
                                        ? 'success.main'
                                        : parseFloat(String(stats.monthlyPnLPercentage)) < 0
                                        ? 'error.main'
                                        : 'text.primary'
                                    }}
                                  >
                                    {parseFloat(String(stats.monthlyPnLPercentage)) > 0 ? '+' : ''}{parseFloat(String(stats.monthlyPnLPercentage)).toFixed(1)}%
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    Yearly
                                  </Typography>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      fontWeight: 600,
                                      color: parseFloat(String(stats.yearlyPnLPercentage)) > 0
                                        ? 'success.main'
                                        : parseFloat(String(stats.yearlyPnLPercentage)) < 0
                                        ? 'error.main'
                                        : 'text.primary'
                                    }}
                                  >
                                    {parseFloat(String(stats.yearlyPnLPercentage)) > 0 ? '+' : ''}{parseFloat(String(stats.yearlyPnLPercentage)).toFixed(1)}%
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          </Stack>
                        </CardContent>
                        <CardActions sx={{
                          justifyContent: 'flex-end',
                          p: 2,
                          pt: 1,
                          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                        }}>
                          <Button
                            size="small"
                            startIcon={<ChartIcon />}
                            onClick={(e) => handleViewCharts(e, calendar)}
                            sx={{
                              color: 'primary.main',
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1)
                              }
                            }}
                          >
                            View Charts
                          </Button>
                          <Button
                            size="small"
                            onClick={(e) => handleEditClick(e, calendar)}
                            sx={{
                              color: 'primary.main',
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1)
                              }
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            onClick={(e) => handleDeleteClick(e, calendar.id)}
                            sx={{
                              color: 'error.main',
                              '&:hover': {
                                bgcolor: alpha(theme.palette.error.main, 0.1)
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </CardActions>
                      </Card>
                    );
                  })
                )}
              </Box>
            )}

            <CalendarFormDialog
              open={isCreateDialogOpen}
              onClose={() => setIsCreateDialogOpen(false)}
              onSubmit={handleCreateCalendarSubmit}
              isSubmitting={isCreating}
              mode="create"
              title="Create New Calendar"
              submitButtonText="Create"
            />

            <CalendarFormDialog
              open={isEditDialogOpen}
              onClose={() => setIsEditDialogOpen(false)}
              onSubmit={handleEditCalendarSubmit}
              initialData={calendarToEdit || undefined}
              isSubmitting={isEditing}
              mode="edit"
              title="Edit Calendar"
              submitButtonText="Save Changes"
            />

            <Dialog
              open={isDeleteDialogOpen}
              onClose={() => setIsDeleteDialogOpen(false)}
              maxWidth="xs"
              fullWidth
              {...dialogProps}
            >
              <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: 'error.main'
              }}>
                <DeleteIcon fontSize="small" />
                Delete Calendar
              </DialogTitle>
              <DialogContent>
                <Typography>
                  Are you sure you want to delete this calendar? This action cannot be undone.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setIsDeleteDialogOpen(false)}
                  sx={{ color: 'text.secondary' }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteConfirm}
                  sx={{
                    color: 'error.main',
                  }}
                >
                  Delete
                </Button>
              </DialogActions>
            </Dialog>

            {/* Performance Charts Dialog */}
            <Dialog
              open={selectedCalendarForCharts !== null}
              onClose={handleCloseCharts}
              maxWidth="lg"
              fullWidth
              {...dialogProps}
              PaperProps={{
                sx: {
                  minHeight: '80vh',
                  maxHeight: '90vh',
                  bgcolor: 'background.paper',
                  backgroundImage: 'none'
                }
              }}
            >
              <DialogTitle sx={{
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                pb: 2,
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ChartIcon color="primary" />
                  <Typography variant="h6">
                    Performance Charts - {selectedCalendarForCharts?.name}
                  </Typography>
                </Box>
                {currentTimePeriod === 'month' ? (
                  <Button
                    onClick={() => setIsDateDialogOpen(true)}
                    startIcon={<CalendarMonth />}
                    variant="outlined"
                    size="small"
                  >
                    {format(selectedMonth, 'MMMM yyyy')}
                  </Button>
                ) : currentTimePeriod === 'year' ? (
                  <FormControl size="small" variant="outlined">
                    <Select
                      value={selectedMonth.getFullYear()}
                      onChange={(e) => handleYearChange(e.target.value as number)}
                      sx={{ minWidth: 120 }}
                    >
                      {Array.from(
                        { length: 10 },
                        (_, i) => new Date().getFullYear() - i
                      ).map((year) => (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null}
              </DialogTitle>
              <DialogContent sx={{
                p: 3,
                backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.6) : '#f0f0f0',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: alpha(theme.palette.background.default, 0.5),
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: alpha(theme.palette.primary.main, 0.2),
                  borderRadius: '4px',
                  '&:hover': {
                    background: alpha(theme.palette.primary.main, 0.3),
                  },
                },
              }}>
                {selectedCalendarForCharts && (
                  <PerformanceCharts
                    trades={selectedCalendarForCharts.cachedTrades || []}
                    selectedDate={selectedMonth}
                    accountBalance={selectedCalendarForCharts.accountBalance}
                    monthlyTarget={selectedCalendarForCharts.monthlyTarget ?? undefined}
                    maxDailyDrawdown={selectedCalendarForCharts.maxDailyDrawdown}
                    onTimePeriodChange={handleTimePeriodChange}
                  />
                )}

                 {/* TradeDetailDialog has been removed */}
              </DialogContent>
              <DialogActions sx={{
                p: 2,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                gap: 1
              }}>
                <Button
                  onClick={handleCloseCharts}
                  variant="outlined"
                  size="small"
                >
                  Close
                </Button>
              </DialogActions>
            </Dialog>

            {/* Date Selection Dialog */}
            {selectedCalendarForCharts && currentTimePeriod === 'month' && (
              <SelectDateDialog
                open={isDateDialogOpen}
                onClose={() => setIsDateDialogOpen(false)}
                onDateSelect={(date) => {
                  setSelectedMonth(date);
                  setIsDateDialogOpen(false);
                }}
                initialDate={selectedMonth}
                trades={selectedCalendarForCharts.cachedTrades || []}
                accountBalance={selectedCalendarForCharts.accountBalance}
                monthlyTarget={selectedCalendarForCharts.monthlyTarget ?? undefined}
                yearlyTarget={selectedCalendarForCharts.yearlyTarget}
              />
            )}


          </>
        ) : (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h5" gutterBottom>
              Welcome to Trade Tracker
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Sign in to start managing your trades
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default CalendarHome;