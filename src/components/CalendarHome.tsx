import React, { useState, useMemo, useEffect } from 'react';
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
  Avatar,
  CircularProgress,
  Menu,
  ListItemIcon,
  ListItemText
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
  Brightness7 as LightModeIcon,
  ExpandMore,
  ExpandLess,
  ContentCopy as CopyIcon,
  MoreVert as MoreVertIcon,
  Delete as TrashIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '../types/calendar';
import { formatCurrency } from '../utils/formatters';
import { dialogProps } from '../styles/dialogStyles';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import PerformanceCharts from './PerformanceCharts';
import SelectDateDialog from './SelectDateDialog';
import { useAuth } from '../contexts/AuthContext';
import { getCalendarStats } from '../services/calendarService';
import Shimmer from './Shimmer';
import AppHeader from './common/AppHeader';
// TradeDetailDialog has been removed

interface CalendarHomeProps {
  calendars: Calendar[];
  onCreateCalendar: (name: string, accountBalance: number, maxDailyDrawdown: number, weeklyTarget?: number, monthlyTarget?: number, yearlyTarget?: number, riskPerTrade?: number, dynamicRiskEnabled?: boolean, increasedRiskPercentage?: number, profitThresholdPercentage?: number) => void;
  onDuplicateCalendar: (sourceCalendarId: string, newName: string, includeContent?: boolean) => void;
  onDeleteCalendar: (id: string) => void;
  onUpdateCalendar: (id: string, updates: Partial<Calendar>) => void;
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  isLoading?: boolean;
  loadAllTrades?: (calendarId: string) => Promise<void>;
}

const CalendarSkeleton = () => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.3s ease-in-out',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: alpha(theme.palette.primary.main, 0.3),
          zIndex: 1
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ mb: 2.5 }}>
          {/* Title shimmer */}
          <Shimmer
            height={28}
            width="60%"
            borderRadius={8}
            variant="wave"
            intensity="medium"
            sx={{ mb: 1 }}
          />

          {/* Date shimmer */}
          <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
            <Shimmer
              height={20}
              width="30%"
              borderRadius={4}
              variant="default"
              intensity="low"
            />
            <Shimmer
              height={20}
              width="30%"
              borderRadius={4}
              variant="default"
              intensity="low"
            />
          </Stack>
        </Box>

        <Divider sx={{ my: 2, opacity: 0.6 }} />

        {/* Stats shimmer */}
        <Stack spacing={2}>
          {/* Main stats box with gradient */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.background.default, 0.6),
              mb: 1
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Shimmer
                height={40}
                width={40}
                borderRadius="50%"
                variant="pulse"
                intensity="medium"
              />
              <Box sx={{ width: '100%' }}>
                <Shimmer
                  height={24}
                  width="40%"
                  borderRadius={6}
                  variant="wave"
                  intensity="high"
                  sx={{ mb: 1 }}
                />
                <Shimmer
                  height={16}
                  width="30%"
                  borderRadius={4}
                  variant="default"
                  intensity="low"
                />
              </Box>
            </Box>
          </Box>

          {/* Grid stats */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.background.default, 0.6) }}>
              <Shimmer
                height={16}
                width="60%"
                borderRadius={4}
                variant="default"
                intensity="low"
                sx={{ mb: 1 }}
              />
              <Shimmer
                height={24}
                width="40%"
                borderRadius={6}
                variant="wave"
                intensity="medium"
              />
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.background.default, 0.6) }}>
              <Shimmer
                height={16}
                width="60%"
                borderRadius={4}
                variant="default"
                intensity="low"
                sx={{ mb: 1 }}
              />
              <Shimmer
                height={24}
                width="40%"
                borderRadius={6}
                variant="wave"
                intensity="medium"
              />
            </Box>
          </Box>

          {/* Additional stats */}
          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.background.default, 0.6) }}>
            <Shimmer
              height={16}
              width="40%"
              borderRadius={4}
              variant="default"
              intensity="low"
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {[1, 2, 3].map((i) => (
                <Box key={i}>
                  <Shimmer
                    height={14}
                    width="70%"
                    borderRadius={4}
                    variant="default"
                    intensity="low"
                    sx={{ mb: 0.5 }}
                  />
                  <Shimmer
                    height={20}
                    width="50%"
                    borderRadius={6}
                    variant={i === 2 ? "pulse" : "default"}
                    intensity="medium"
                  />
                </Box>
              ))}
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
        {/* Action buttons shimmer */}
        <Stack direction="row" spacing={1}>
          {[1, 2, 3].map((i) => (
            <Shimmer
              key={i}
              height={32}
              width={80}
              borderRadius={8}
              variant={i === 1 ? "pulse" : "default"}
              intensity={i === 1 ? "high" : "medium"}
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
  onDuplicateCalendar,
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
  const [isDuplicateOptionsDialogOpen, setIsDuplicateOptionsDialogOpen] = useState(false);
  const [calendarToDelete, setCalendarToDelete] = useState<string | null>(null);
  const [calendarToEdit, setCalendarToEdit] = useState<Calendar | null>(null);
  const [calendarToDuplicate, setCalendarToDuplicate] = useState<Calendar | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [expandedCalendars, setExpandedCalendars] = useState<{[key: string]: boolean}>({});
  const [menuAnchorEl, setMenuAnchorEl] = useState<{[key: string]: HTMLElement | null}>({});
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

  // Update selectedCalendarForCharts when calendars change and a calendar is selected
  useEffect(() => {
    if (selectedCalendarForCharts && calendars.length > 0) {
      const updatedCalendar = calendars.find(c => c.id === selectedCalendarForCharts.id);
      if (updatedCalendar && updatedCalendar.cachedTrades.length > 0) {
        setSelectedCalendarForCharts(updatedCalendar);
      }
    }
  }, [calendars, selectedCalendarForCharts]);

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



  // Menu item handlers that don't need event parameter
  const handleEditCalendar = (calendar: Calendar) => {
    setCalendarToEdit(calendar);
    setIsEditDialogOpen(true);
  };

  const handleDuplicateCalendar = (calendar: Calendar) => {
    setCalendarToDuplicate(calendar);
    setIsDuplicateOptionsDialogOpen(true);
  };

  const handleDeleteCalendar = (calendarId: string) => {
    setCalendarToDelete(calendarId);
    setIsDeleteDialogOpen(true);
  };

  const handleDuplicateOptionSelect = async (withContent: boolean) => {
    if (!calendarToDuplicate) return;

    setIsDuplicating(true);
    try {
      const newName = `${calendarToDuplicate.name} (Copy)`;
      await onDuplicateCalendar(calendarToDuplicate.id, newName, withContent);
      setIsDuplicateOptionsDialogOpen(false);
      setCalendarToDuplicate(null);
    } catch (error) {
      console.error('Error duplicating calendar:', error);
    } finally {
      setIsDuplicating(false);
    }
  };



  const handleDeleteConfirm = () => {
    if (calendarToDelete) {
      onDeleteCalendar(calendarToDelete);
      setCalendarToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  const handleToggleExpand = (e: React.MouseEvent, calendarId: string) => {
    e.stopPropagation(); // Prevent calendar click navigation
    setExpandedCalendars(prev => ({
      ...prev,
      [calendarId]: !prev[calendarId]
    }));
  };

  const handleMenuClick = (e: React.MouseEvent, calendarId: string) => {
    e.stopPropagation();
    setMenuAnchorEl(prev => ({
      ...prev,
      [calendarId]: e.currentTarget as HTMLElement
    }));
  };

  const handleMenuClose = (calendarId: string) => {
    setMenuAnchorEl(prev => ({
      ...prev,
      [calendarId]: null
    }));
  };

  const handleMenuItemClick = (calendarId: string, action: () => void) => {
    handleMenuClose(calendarId);
    action();
  };

  const handleViewCharts = async (e: React.MouseEvent, calendar: Calendar) => {
    e.stopPropagation();

    // First, set the calendar to show the dialog immediately
    setSelectedCalendarForCharts(calendar);

    // Then load all trades for the calendar if needed
    if (loadAllTrades && (calendar.loadedYears.length === 0 || calendar.cachedTrades.length === 0)) {
      // Mark that we've attempted to load trades for this calendar
      setLoadAttempted(prev => ({ ...prev, [calendar.id]: true }));

      // Load the trades
      await loadAllTrades(calendar.id);

      // After loading, update with the latest calendar data that includes the trades
      const updatedCalendar = calendars.find(c => c.id === calendar.id);
      if (updatedCalendar) {
        setSelectedCalendarForCharts(updatedCalendar);
      }
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

  // Create a wrapper function for calendar updates that matches the expected signature
  const handleUpdateCalendarProperty = async (calendarId: string, updateCallback: (calendar: Calendar) => Calendar): Promise<void> => {
    const calendar = calendars.find(c => c.id === calendarId);
    if (!calendar) return;

    const updatedCalendar = updateCallback(calendar);
    const updates: Partial<Calendar> = {
      scoreSettings: updatedCalendar.scoreSettings
    };

    await onUpdateCalendar(calendarId, updates);
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

      <AppHeader
        onToggleTheme={onToggleTheme}
        mode={mode}
      />
      <Toolbar />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {user ? (
          <>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h4" component="h2">
                  Your Calendars
                </Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<TrashIcon />}
                  onClick={() => navigate('/trash')}
                  sx={{ color: 'text.secondary' }}
                >
                  Trash
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  Create Calendar
                </Button>
              </Stack>
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
                          display: 'flex',
                          flexDirection: 'column',
                          height: expandedCalendars[calendar.id] ? 'auto' : '360px',
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
                        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flexGrow: 1, maxHeight: expandedCalendars[calendar.id] ? 'none' : 'calc(100% - 60px)' }}>
                          <Box sx={{ mb: 1.5 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 1,
                                cursor: 'pointer'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpand(e, calendar.id);
                              }}
                            >
                              <Typography
                                variant="h6"
                                gutterBottom
                                sx={{
                                  fontWeight: 600,
                                  color: 'text.primary',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  mb: 0
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
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleExpand(e, calendar.id);
                                }}
                                sx={{ color: 'text.secondary' }}
                              >
                                {expandedCalendars[calendar.id] ? <ExpandLess /> : <ExpandMore />}
                              </IconButton>
                            </Box>
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
                          <Divider sx={{ my: 1, opacity: 0.6 }} />

                          <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 1.5,
                            px: 0.5
                          }}>
                            {!expandedCalendars[calendar.id] && <Box>
                              <Typography variant="caption" color="text.secondary">
                                Initial Balance
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {formatCurrency(calendar.accountBalance)}
                              </Typography>
                            </Box>}
                            {!expandedCalendars[calendar.id] && <Box>
                              <Typography variant="caption" color="text.secondary">
                                Win Rate
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {stats.winRate.toFixed(1)}%
                              </Typography>
                            </Box>}
                          </Box>

                          <Stack spacing={2} sx={{
                            maxHeight: expandedCalendars[calendar.id] ? 'none' : '180px',
                            overflow: 'hidden',
                            transition: 'max-height 0.3s ease-in-out',
                            flexGrow: 0,
                            mb: 2
                          }}>
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
                                bgcolor: alpha(theme.palette.background.default, 0.6),
                                opacity: expandedCalendars[calendar.id] ? 1 : 0,
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
                                bgcolor: alpha(theme.palette.background.default, 0.6),
                                opacity: expandedCalendars[calendar.id] ? 1 : 0,
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
                          justifyContent: 'space-between',
                          p: 2,
                          pt: 1,
                          mt: 'auto',
                          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          position: 'relative',
                          zIndex: 2,
                          backgroundColor: theme.palette.background.paper
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

                          <Box>
                            <IconButton
                              size="small"
                              onClick={(e) => handleMenuClick(e, calendar.id)}
                              sx={{
                                color: 'text.secondary',
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.text.secondary, 0.1)
                                }
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>

                            <Menu
                              anchorEl={menuAnchorEl[calendar.id]}
                              open={Boolean(menuAnchorEl[calendar.id])}
                              onClose={() => handleMenuClose(calendar.id)}
                              onClick={(e) => e.stopPropagation()}
                              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                            >
                              <MenuItem
                                onClick={() => handleMenuItemClick(calendar.id, () => handleEditCalendar(calendar))}
                              >
                                <ListItemIcon>
                                  <EditIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>Edit</ListItemText>
                              </MenuItem>

                              <MenuItem
                                onClick={() => handleMenuItemClick(calendar.id, () => handleDuplicateCalendar(calendar))}
                              >
                                <ListItemIcon>
                                  <CopyIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>Duplicate</ListItemText>
                              </MenuItem>

                              <MenuItem
                                onClick={() => handleMenuItemClick(calendar.id, () => handleDeleteCalendar(calendar.id))}
                                sx={{ color: 'error.main' }}
                              >
                                <ListItemIcon>
                                  <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                                </ListItemIcon>
                                <ListItemText>Delete</ListItemText>
                              </MenuItem>
                            </Menu>
                          </Box>
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
              open={isDuplicateOptionsDialogOpen}
              onClose={() => {
                setIsDuplicateOptionsDialogOpen(false);
                setCalendarToDuplicate(null);
              }}
              maxWidth="sm"
              fullWidth
              {...dialogProps}
            >
              <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: 'primary.main'
              }}>
                <CopyIcon fontSize="small" />
                Duplicate Calendar Options
              </DialogTitle>
              <DialogContent>
                {isDuplicating ? (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    py: 4
                  }}>
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      Duplicating calendar...
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Typography variant="body1" sx={{ mb: 3 }}>
                      How would you like to duplicate "{calendarToDuplicate?.name}"?
                    </Typography>

                    <Stack spacing={2}>
                  <Button
                    variant="outlined"
                    onClick={() => handleDuplicateOptionSelect(false)}
                    disabled={isDuplicating}
                    sx={{
                      p: 2,
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      borderColor: 'primary.main',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        Settings Only
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Copy calendar settings, targets, and configuration without any trades
                      </Typography>
                    </Box>
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={() => handleDuplicateOptionSelect(true)}
                    disabled={isDuplicating}
                    sx={{
                      p: 2,
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      borderColor: 'info.main',
                      color: 'info.main',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.info.main, 0.1)
                      }
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        Settings + All Trades
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Copy everything including all trades and performance data
                      </Typography>
                    </Box>
                  </Button>
                    </Stack>
                  </>
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => {
                    setIsDuplicateOptionsDialogOpen(false);
                    setCalendarToDuplicate(null);
                  }}
                  sx={{ color: 'text.secondary' }}
                >
                  Cancel
                </Button>
              </DialogActions>
            </Dialog>



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
                ...scrollbarStyles(theme)
              }}>
                {selectedCalendarForCharts && (
                  isLoading || (loadAllTrades && selectedCalendarForCharts.cachedTrades.length === 0) ? (
                    <Box sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '300px'
                    }}>
                      <CircularProgress size={40} />
                      <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                        Loading chart data...
                      </Typography>
                    </Box>
                  ) : (
                    <PerformanceCharts
                      trades={selectedCalendarForCharts.cachedTrades || []}
                      selectedDate={selectedMonth}
                      accountBalance={selectedCalendarForCharts.accountBalance}
                      monthlyTarget={selectedCalendarForCharts.monthlyTarget ?? undefined}
                      maxDailyDrawdown={selectedCalendarForCharts.maxDailyDrawdown}
                      calendarId={selectedCalendarForCharts.id}
                      dynamicRiskSettings={{
                        accountBalance: selectedCalendarForCharts.accountBalance,
                        riskPerTrade: selectedCalendarForCharts.riskPerTrade,
                        dynamicRiskEnabled: selectedCalendarForCharts.dynamicRiskEnabled,
                        increasedRiskPercentage: selectedCalendarForCharts.increasedRiskPercentage,
                        profitThresholdPercentage: selectedCalendarForCharts.profitThresholdPercentage
                      }}
                      scoreSettings={selectedCalendarForCharts.scoreSettings}
                      onUpdateCalendarProperty={handleUpdateCalendarProperty}
                      onTimePeriodChange={handleTimePeriodChange}
                    />
                  )
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