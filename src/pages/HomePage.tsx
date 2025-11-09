import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  alpha,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Toolbar
} from '@mui/material';
import {
  Add as AddIcon,
  TrendingUp,
  TrendingDown,
  CalendarToday,
  Event as EventIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  SmartToy as AIIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { CalendarWithUIState, Calendar } from '../types/calendar';
import { Trade } from '../types/dualWrite';
import { EconomicEvent } from '../types/economicCalendar';
import { formatCurrency } from '../utils/formatters';
import { economicCalendarService } from '../services/economicCalendarService';
import { TradeRepository } from '../services/repository/repositories/TradeRepository';

import Shimmer from '../components/Shimmer';
import CalendarCard from '../components/CalendarCard';
import CalendarCardShimmer from '../components/CalendarCardShimmer';
import { logger } from '../utils/logger';
import { useAuth } from '../contexts/SupabaseAuthContext';
import LoginDialog from '../components/auth/LoginDialog';
import TradeCard from '../components/aiChat/TradeCard';
import EconomicCalendarDrawer from '../components/economicCalendar/EconomicCalendarDrawer';
import EconomicEventListItem from '../components/economicCalendar/EconomicEventListItem';
import EconomicEventShimmer from '../components/economicCalendar/EconomicEventShimmer';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { dialogProps } from '../styles/dialogStyles';
import CalendarFormDialog, { CalendarFormData } from '../components/CalendarFormDialog';
import TradeFormDialog from '../components/trades/TradeFormDialog';
import { NewTradeForm } from '../components/trades/TradeForm';
import { createNewTradeData } from './TradeCalendarPage';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import { v4 as uuidv4 } from 'uuid';
import { DuplicateCalendarDialog } from '../components/dialogs/DuplicateCalendarDialog';
import PerformanceCharts from '../components/PerformanceCharts';
import { Close as CloseIcon } from '@mui/icons-material';
import AIChatDrawer from '../components/aiChat/AIChatDrawer';

interface HomeProps {
  calendars: CalendarWithUIState[];
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  onMenuClick: () => void;
  isLoading?: boolean;
  onCreateCalendar: (name: string, account_balance: number, max_daily_drawdown: number, weeklyTarget?: number, monthlyTarget?: number, yearlyTarget?: number, riskPerTrade?: number, dynamic_risk_enabled?: boolean, increased_risk_percentage?: number, profit_threshold_percentage?: number, heroImageUrl?: string, heroImageAttribution?: any, heroImagePosition?: string) => void;
  onDuplicateCalendar: (sourceCalendarId: string, newName: string, includeContent?: boolean) => void;
  onDeleteCalendar: (id: string) => void;
  onUpdateCalendar: (id: string, updates: Partial<Calendar>) => void;
  onUpdateStateCalendar: (id: string, updates: Partial<CalendarWithUIState>) => void;
  loadAllTrades?: (calendarId: string) => Promise<void>;

  // Trade handlers from App.tsx
  onAddTrade: (calendarId: string, trade: Trade) => Promise<void>;
  onUpdateTradeProperty: (calendarId: string, tradeId: string, updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade) => Promise<Trade | undefined>;
  onDeleteTrades: (calendarId: string, tradeIds: string[]) => Promise<void>;
  onTagUpdated: (calendarId: string, oldTag: string, newTag: string) => Promise<void>;
}

const Home: React.FC<HomeProps> = ({
  calendars,
  isLoading = false,
  onCreateCalendar,
  onDuplicateCalendar,
  onDeleteCalendar,
  onUpdateCalendar,
  onUpdateStateCalendar,
  loadAllTrades,
  onAddTrade,
  onUpdateTradeProperty,
  onDeleteTrades,
  onTagUpdated
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [economicCalendarOpen, setEconomicCalendarOpen] = useState(false);
  const [isCreateCalendarDialogOpen, setIsCreateCalendarDialogOpen] = useState(false);
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [performanceTrades, setPerformanceTrades] = useState<Trade[]>([]);
  const [loadingPerformanceTrades, setLoadingPerformanceTrades] = useState(false);

  // AI Chat drawer state
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Trade form state
  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);
  const [tradesForDate, setTradesForDate] = useState<Trade[]>([]);
  const [zoomedImage, setZoomedImage] = useState<string>('');

  // Calendar dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDuplicateOptionsDialogOpen, setIsDuplicateOptionsDialogOpen] = useState(false);
  const [calendarToDelete, setCalendarToDelete] = useState<string | null>(null);
  const [calendarToEdit, setCalendarToEdit] = useState<CalendarWithUIState | null>(null);
  const [calendarToDuplicate, setCalendarToDuplicate] = useState<CalendarWithUIState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Check if screen is large (xl breakpoint = 1536px+)
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('xl'));

  // Get recently updated calendars (top 2 for large screens, top 1 for smaller screens)
  const recentCalendars = useMemo(() => {
    const limit = isLargeScreen ? 2 : 1;
    return [...calendars]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  }, [calendars, isLargeScreen]);

  // Fetch trades when performance dialog opens
  useEffect(() => {
    const fetchTrades = async () => {
      if (!showPerformanceDialog || !user?.uid) return;

      setLoadingPerformanceTrades(true);
      try {
        const tradeRepository = new TradeRepository();
        const trades = await tradeRepository.findByUserId(user.uid);
        setPerformanceTrades(trades);
      } catch (error) {
        logger.error('Error fetching trades for performance dialog:', error);
        setPerformanceTrades([]);
      } finally {
        setLoadingPerformanceTrades(false);
      }
    };

    fetchTrades();
  }, [showPerformanceDialog, user?.uid]);

  // Calendar action handlers - open dialogs for edit/duplicate/delete
  const handleEditCalendar = (calendar: CalendarWithUIState) => {
    setCalendarToEdit(calendar);
    setIsEditDialogOpen(true);
  };

  const handleDuplicateCalendar = (calendar: CalendarWithUIState) => {
    setCalendarToDuplicate(calendar);
    setIsDuplicateOptionsDialogOpen(true);
  };

  const handleDeleteCalendar = (calendarId: string) => {
    setCalendarToDelete(calendarId);
    setIsDeleteDialogOpen(true);
  };

  // Update calendar property handler for share button
  const handleUpdateCalendarProperty = async (
    calendarId: string,
    updateCallback: (calendar: CalendarWithUIState) => Calendar
  ): Promise<Calendar | undefined> => {
    const targetCalendar = calendars.find(c => c.id === calendarId);
    if (!targetCalendar) {
      console.error(`Calendar with ID ${calendarId} not found`);
      return undefined;
    }

    const updatedCalendar = updateCallback(targetCalendar);
    onUpdateCalendar(calendarId, updatedCalendar);
    return updatedCalendar;
  };

  // Dialog submit handlers
  const handleEditCalendarSubmit = async (data: CalendarFormData) => {
    if (!calendarToEdit) return;

    setIsEditing(true);
    try {
      await onUpdateCalendar(calendarToEdit.id, {
        name: data.name,
        account_balance: data.account_balance,
        max_daily_drawdown: data.max_daily_drawdown,
        weekly_target: data.weekly_target,
        monthly_target: data.monthly_target,
        yearly_target: data.yearly_target,
        risk_per_trade: data.risk_per_trade,
        dynamic_risk_enabled: data.dynamic_risk_enabled,
        increased_risk_percentage: data.increased_risk_percentage,
        profit_threshold_percentage: data.profit_threshold_percentage,
        hero_image_url: data.hero_image_url,
        hero_image_attribution: data.hero_image_attribution
      });
      setIsEditDialogOpen(false);
      setCalendarToEdit(null);
    } catch (error) {
      logger.error('Error updating calendar:', error);
    } finally {
      setIsEditing(false);
    }
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
      logger.error('Error duplicating calendar:', error);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (calendarToDelete) {
      await onDeleteCalendar(calendarToDelete);
      setCalendarToDelete(null);
    }
    setIsDeleteDialogOpen(false);
  };

  // Calculate dashboard statistics from calendars
  const dashboardStats = useMemo(() => {
    const totalCalendars = calendars.length;
    const activeCalendars = calendars.filter(c => (c.total_trades ?? 0) > 0).length;
    const totalTrades = calendars.reduce((sum, cal) => sum + (cal.total_trades ?? 0), 0);
    const totalWins = calendars.reduce((sum, cal) => sum + (cal.win_count ?? 0), 0);
    const totalLosses = calendars.reduce((sum, cal) => sum + (cal.loss_count ?? 0), 0);
    const totalPnL = calendars.reduce((sum, cal) => sum + (cal.total_pnl ?? 0), 0);

    // Calculate win rate from total wins and losses
    const winRate = (totalWins + totalLosses) > 0
      ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)
      : '0.0';

    return {
      totalCalendars,
      activeCalendars,
      totalTrades,
      totalWins,
      totalLosses,
      winRate,
      totalPnL
    };
  }, [calendars]);

  // State for recent trades
  const [recentTrades, setRecentTrades] = useState<(Trade & { calendarName: string })[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  // Fetch recent trades from Supabase
  useEffect(() => {
    const fetchRecentTrades = async () => {
      if (!user?.uid) return;
        if (recentTrades.length > 0) return;

      setLoadingTrades(true);
      try {
        const tradeRepository = new TradeRepository();
        // Fetch trades ordered by trade_date (descending) with limit of 6
        const allTrades = await tradeRepository.findByUserId(user.uid, {
          limit: 5,
          orderBy: 'trade_date',
          ascending: false
        });

        // Map trades with calendar names
        const tradesWithCalendarNames = allTrades.map(trade => {
          const calendar = calendars.find(cal => cal.id === trade.calendar_id);
          return {
            ...trade,
            calendarName: calendar?.name || 'Unknown Calendar'
          };
        });
        
        setRecentTrades(tradesWithCalendarNames);
      } catch (error) {
        logger.error('Error fetching recent trades:', error);
      } finally {
        setLoadingTrades(false);
      }
    };

    fetchRecentTrades();
  }, [user?.uid, calendars]);

  // Fetch economic events for current month
  useEffect(() => {
    const fetchEconomicEvents = async () => {
      setLoadingEvents(true);
      try {
        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');

        const events = await economicCalendarService.fetchEvents(
          {
            start: today,
            end: today
          },
          {
            impacts: ['High', 'Medium']
          }
        );

        // Filter to show only unreleased events (future events that haven't happened yet)
        const currentTime = now.getTime();
        const upcomingEvents = events.filter(event =>
          new Date(event.time_utc).getTime() > currentTime
        );

        // Sort in ascending order (soonest unreleased event first)
        const sortedEvents = upcomingEvents.sort((a, b) =>
          new Date(a.time_utc).getTime() - new Date(b.time_utc).getTime()
        );

        setEconomicEvents(sortedEvents);
      } catch (error) {
        logger.error('Error fetching economic events:', error);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEconomicEvents();
  }, []);

  const handleCalendarClick = (calendarId: string) => {
    navigate(`/calendar/${calendarId}`);
  };

  const handleTradeClick = (trade: Trade & { calendarName: string }) => {
    navigate(`/calendar/${trade.calendar_id}`);
  };

  const handleCreateCalendar = () => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }
    setIsCreateCalendarDialogOpen(true);
  };

  const handleCreateCalendarSubmit = async (data: CalendarFormData) => {
    setIsCreatingCalendar(true);
    try {
      await onCreateCalendar(
        data.name,
        data.account_balance,
        data.max_daily_drawdown,
        data.weekly_target,
        data.monthly_target,
        data.yearly_target,
        data.risk_per_trade,
        data.dynamic_risk_enabled,
        data.increased_risk_percentage,
        data.profit_threshold_percentage,
        data.hero_image_url,
        data.hero_image_attribution
      );

      setIsCreateCalendarDialogOpen(false);

      // Wait a brief moment for the calendar to be added to the calendars array
      setTimeout(() => {
        // Find the most recently created calendar (highest updated_at timestamp)
        const mostRecentCalendar = [...calendars]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (mostRecentCalendar) {
          navigate(`/calendar/${mostRecentCalendar.id}`);
        }
      }, 100);
    } catch (error) {
      logger.error('Error creating calendar:', error);
    } finally {
      setIsCreatingCalendar(false);
    }
  };

  const handleCreateTrade = () => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }
    if (calendars.length === 0) {
      return; // Button should be disabled, but just in case
    }
    setNewTrade(createNewTradeData());
    setIsTradeFormOpen(true);
  };

  // Get selected calendar data
  const selectedCalendar = useMemo(() => {
    return calendars.find(c => c.id === selectedCalendarId);
  }, [calendars, selectedCalendarId]);

  // Update trades for selected date when calendar changes
  useEffect(() => {
    if (selectedCalendarId && selectedCalendar) {
      const today = new Date();
      const todayTrades = selectedCalendar.cachedTrades.filter(trade =>
        isSameDay(new Date(trade.trade_date), today)
      );
      setTradesForDate(todayTrades);
    }
  }, [selectedCalendarId, selectedCalendar]);

  // Trade handlers - wrapper functions that call the handlers from App.tsx
  const handleAddTrade = async (trade: Trade) => {
    if (!selectedCalendar) return;

    const newTradeWithId = trade.id ? trade : { ...trade, id: uuidv4() };
    await onAddTrade(selectedCalendar.id, newTradeWithId);

    // Update recent trades for the dashboard
    setRecentTrades(prev => [{...newTradeWithId, calendarName: selectedCalendar.name}, ...prev.slice(0, 4)]);
  };

  const handleUpdateTradeProperty = async (
    tradeId: string,
    updateCallback: (trade: Trade) => Trade,
    createIfNotExists?: (tradeId: string) => Trade
  ): Promise<Trade | undefined> => {
    if (!selectedCalendar) return undefined;
    return onUpdateTradeProperty(selectedCalendar.id, tradeId, updateCallback, createIfNotExists);
  };

  const handleDeleteTrades = async (tradeIds: string[]): Promise<void> => {
    if (!selectedCalendar) return;
    return onDeleteTrades(selectedCalendar.id, tradeIds);
  };

  const handleTagUpdated = async (oldTag: string, newTag: string) => {
    if (!selectedCalendar) return;
    return onTagUpdated(selectedCalendar.id, oldTag, newTag);
  };

  const handleCalendarChange = (calendarId: string) => {
    setSelectedCalendarId(calendarId);
  };

  const handleTradeFormClose = () => {
    setIsTradeFormOpen(false);
    setSelectedCalendarId('');
    setNewTrade(null);
    setTradesForDate([]);
  };

  const handleQuickActionClick = (path: string) => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }

    // Handle performance action with dialog instead of navigation
    if (path === '/performance') {
      setShowPerformanceDialog(true);
      return;
    }

    navigate(path);
  };

  const handleLoginDialogClose = () => {
    setShowLoginDialog(false);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'custom.pageBackground',
      pl: { xs: 2, sm: 3, md: 4 }
    }}>


      <Box sx={{
        pt: { xs: 2, sm: 3, md: 4 },
        pb: { xs: 2, sm: 3, md: 4 },
        pl: 0,
        pr: { xs: 2, sm: 3, md: 4 }
      }}>
        {/* Header Section */}
        <Box sx={{ mb: { xs: 3, sm: 4 } }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              mb: 1,
              fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' }
            }}
          >
            Dashboard
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Welcome back! Here's what's happening.
          </Typography>
        </Box>

        {/* Statistics Cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: { xs: 2, sm: 2.5, md: 3 },
            mb: { xs: 3, sm: 4 }
          }}
        >
          {/* Total Calendars */}
          <Card sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Total Calendars
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      mb: 0.5,
                      fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' }
                    }}
                  >
                    {dashboardStats.totalCalendars}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
                  >
                    {dashboardStats.activeCalendars} active
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: { xs: 1, sm: 1.25, md: 1.5 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.1)
                  }}
                >
                  <CalendarToday sx={{
                    color: theme.palette.primary.main,
                    fontSize: { xs: 24, sm: 26, md: 28 }
                  }} />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Total Trades */}
          <Card sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Total Trades
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      mb: 0.5,
                      fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' }
                    }}
                  >
                    {dashboardStats.totalTrades}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
                  >
                    Across all calendars
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: { xs: 1, sm: 1.25, md: 1.5 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.info.main, 0.1)
                  }}
                >
                  <TrendingUp sx={{
                    color: theme.palette.info.main,
                    fontSize: { xs: 24, sm: 26, md: 28 }
                  }} />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Win Rate */}
          <Card sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Win Rate
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      mb: 0.5,
                      fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' }
                    }}
                  >
                    {dashboardStats.winRate}%
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
                  >
                    Overall performance
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: { xs: 1, sm: 1.25, md: 1.5 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.1)
                  }}
                >
                  <TrendingUp sx={{
                    color: theme.palette.success.main,
                    fontSize: { xs: 24, sm: 26, md: 28 }
                  }} />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Total P&L */}
          <Card sx={{ borderRadius: 2, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                    sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                  >
                    Total P&L
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      mb: 0.5,
                      fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.125rem' }
                    }}
                  >
                    {formatCurrency(dashboardStats.totalPnL)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={dashboardStats.totalPnL >= 0 ? 'success.main' : 'error.main'}
                    sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
                  >
                    {dashboardStats.totalPnL >= 0 ? '↑' : '↓'} All time
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: { xs: 1, sm: 1.25, md: 1.5 },
                    borderRadius: 2,
                    bgcolor: alpha(
                      dashboardStats.totalPnL >= 0 ? theme.palette.success.main : theme.palette.error.main,
                      0.1
                    )
                  }}
                >
                  {dashboardStats.totalPnL >= 0 ? (
                    <TrendingUp sx={{
                      color: theme.palette.success.main,
                      fontSize: { xs: 24, sm: 26, md: 28 }
                    }} />
                  ) : (
                    <TrendingDown sx={{
                      color: theme.palette.error.main,
                      fontSize: { xs: 24, sm: 26, md: 28 }
                    }} />
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Quick Actions Section */}
        <Box sx={{ mb: { xs: 3, sm: 4 } }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: { xs: 2, sm: 3 },
              fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
            }}
          >
            Quick Actions
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: { xs: 1.5, sm: 2 }
            }}
          >
            {/* Create Calendar */}
            <Card
              sx={{
                borderRadius: 2,
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                bgcolor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  transform: 'translateY(-2px)'
                }
              }}
              onClick={handleCreateCalendar}
            >
              <CardContent sx={{
                textAlign: 'center',
                py: { xs: 2.5, sm: 3, md: 4 },
                px: { xs: 1.5, sm: 2 }
              }}>
                <Box
                  sx={{
                    width: { xs: 40, sm: 48, md: 56 },
                    height: { xs: 40, sm: 48, md: 56 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: { xs: 1.5, sm: 2 }
                  }}
                >
                  <AddIcon sx={{
                    fontSize: { xs: 24, sm: 28, md: 32 },
                    color: theme.palette.primary.main
                  }} />
                </Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    fontSize: { xs: '0.875rem', sm: '0.9375rem', md: '1rem' }
                  }}
                >
                  Create Calendar
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
                >
                  Start a new trading journal
                </Typography>
              </CardContent>
            </Card>

            {/* Create Trade */}
            <Card
              sx={{
                borderRadius: 2,
                border: `2px dashed ${alpha(theme.palette.info.main, 0.3)}`,
                bgcolor: 'transparent',
                cursor: calendars.length > 0 ? 'pointer' : 'not-allowed',
                opacity: calendars.length > 0 ? 1 : 0.6,
                transition: 'all 0.2s',
                '&:hover': calendars.length > 0 ? {
                  borderColor: theme.palette.info.main,
                  bgcolor: alpha(theme.palette.info.main, 0.05),
                  transform: 'translateY(-2px)'
                } : {}
              }}
              onClick={handleCreateTrade}
            >
              <CardContent sx={{
                textAlign: 'center',
                py: { xs: 2.5, sm: 3, md: 4 },
                px: { xs: 1.5, sm: 2 }
              }}>
                <Box
                  sx={{
                    width: { xs: 40, sm: 48, md: 56 },
                    height: { xs: 40, sm: 48, md: 56 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: { xs: 1.5, sm: 2 }
                  }}
                >
                  <TrendingUp sx={{
                    fontSize: { xs: 24, sm: 28, md: 32 },
                    color: theme.palette.info.main
                  }} />
                </Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    fontSize: { xs: '0.875rem', sm: '0.9375rem', md: '1rem' }
                  }}
                >
                  Create Trade
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
                >
                  Log a new trade entry
                </Typography>
              </CardContent>
            </Card>

            {/* Check Performance */}
            <Card
              sx={{
                borderRadius: 2,
                border: `2px dashed ${alpha(theme.palette.success.main, 0.3)}`,
                bgcolor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: theme.palette.success.main,
                  bgcolor: alpha(theme.palette.success.main, 0.05),
                  transform: 'translateY(-2px)'
                }
              }}
              onClick={() => handleQuickActionClick('/performance')}
            >
              <CardContent sx={{
                textAlign: 'center',
                py: { xs: 2.5, sm: 3, md: 4 },
                px: { xs: 1.5, sm: 2 }
              }}>
                <Box
                  sx={{
                    width: { xs: 40, sm: 48, md: 56 },
                    height: { xs: 40, sm: 48, md: 56 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: { xs: 1.5, sm: 2 }
                  }}
                >
                  <TrendingUp sx={{
                    fontSize: { xs: 24, sm: 28, md: 32 },
                    color: theme.palette.success.main
                  }} />
                </Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    fontSize: { xs: '0.875rem', sm: '0.9375rem', md: '1rem' }
                  }}
                >
                  Performance
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
                >
                  View analytics & charts
                </Typography>
              </CardContent>
            </Card>

            {/* Chat with AI */}
            <Card
              sx={{
                borderRadius: 2,
                border: `2px dashed ${alpha(theme.palette.secondary.main, 0.3)}`,
                bgcolor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: theme.palette.secondary.main,
                  bgcolor: alpha(theme.palette.secondary.main, 0.05),
                  transform: 'translateY(-2px)'
                }
              }}
              onClick={() => {
                if (!user) {
                  setShowLoginDialog(true);
                  return;
                }
                setIsAIChatOpen(true);
              }}
            >
              <CardContent sx={{
                textAlign: 'center',
                py: { xs: 2.5, sm: 3, md: 4 },
                px: { xs: 1.5, sm: 2 }
              }}>
                <Box
                  sx={{
                    width: { xs: 40, sm: 48, md: 56 },
                    height: { xs: 40, sm: 48, md: 56 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: { xs: 1.5, sm: 2 }
                  }}
                >
                  <AIIcon sx={{
                    fontSize: { xs: 24, sm: 28, md: 32 },
                    color: theme.palette.secondary.main
                  }} />
                </Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    fontSize: { xs: '0.875rem', sm: '0.9375rem', md: '1rem' }
                  }}
                >
                  Chat with AI
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
                >
                  Get trading insights
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Recent Calendars and Trades Side by Side */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 2, sm: 2.5, md: 2 },
            mb: { xs: 3, sm: 4 }
          }}
        >
          {/* Recent Calendars Card */}
          <Card
            sx={{
              flex: 1,
              borderRadius: 1,
              height: { xs: 'auto', md: '620px' },
              minHeight: { xs: '400px', md: '620px' },
              maxWidth: recentCalendars.length <= 1 ? { xs: 'none', md: '500px' } : 'none',
              p: { xs: 0.5, sm: 1 },
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                mb: { xs: 2, sm: 3 },
                px: { xs: 1.5, sm: 2 },
                pt: { xs: 1.5, sm: 2 }
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
                }}
              >
                Recent Calendars
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'primary.main',
                  cursor: 'pointer',
                  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                  '&:hover': { textDecoration: 'underline' }
                }}
                onClick={() => navigate('/calendars')}
              >
                View all
              </Typography>
            </Stack>

            {isLoading ? (
              <Box sx={{ px: 2, pb: 2, flex: 1, display: 'flex', flexDirection: 'row', gap: 2 }}>
                <Box sx={{ minWidth: '450px', flex: '0 0 auto' }}>
                  <CalendarCardShimmer />
                </Box>
              </Box>
            ) : recentCalendars.length === 0 ? (
              <Box sx={{
                textAlign: 'center',
                py: 6,
                px: 2,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <CalendarToday sx={{ fontSize: 48, color: 'text.secondary', mb: 2, mx: 'auto' }} />
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 1, fontWeight: 600 }}>
                  No calendars yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 300 }}>
                  Create your first trading calendar to start tracking your trades and analyzing performance
                </Typography>
               
              </Box>
            ) : (
              <Box sx={{
                px: 2,
                pb: 2,
                flex: 1,
                display: 'flex',
                flexDirection: 'row',
                gap: 2
              }}>
                {recentCalendars.map((calendar) => {
                  // Extract stats from calendar object (stats are auto-calculated by Supabase)
                  const stats = {
                    total_pnl: calendar.total_pnl || 0,
                    win_rate: calendar.win_rate || 0,
                    total_trades: calendar.total_trades || 0,
                    growth_percentage: calendar.pnl_performance || 0,
                    avg_win: calendar.avg_win || 0,
                    avg_loss: calendar.avg_loss || 0,
                    profit_factor: calendar.profit_factor || 0,
                    max_drawdown: calendar.max_drawdown || 0,
                    drawdown_recovery_needed: calendar.drawdown_recovery_needed || 0,
                    drawdown_duration: calendar.drawdown_duration || 0,
                    drawdown_start_date: calendar.drawdown_start_date || null,
                    drawdown_end_date: calendar.drawdown_end_date || null,
                    target_progress: calendar.target_progress || 0,
                    pnl_performance: calendar.pnl_performance || 0,
                    win_count: calendar.win_count || 0,
                    loss_count: calendar.loss_count || 0,
                    current_balance: calendar.current_balance || calendar.account_balance,
                    initial_balance: calendar.account_balance,
                    weekly_pnl: calendar.weekly_pnl,
                    monthly_pnl: calendar.monthly_pnl,
                    yearly_pnl: calendar.yearly_pnl,
                    weekly_pnl_percentage: calendar.weekly_pnl_percentage,
                    monthly_pnl_percentage: calendar.monthly_pnl_percentage,
                    yearly_pnl_percentage: calendar.yearly_pnl_percentage,
                    weekly_progress: calendar.weekly_progress,
                    monthly_progress: calendar.monthly_progress
                  };
                  return (
                     <CalendarCard
                      key={calendar.id}
                        calendar={calendar}
                        stats={stats}
                        onCalendarClick={handleCalendarClick}
                        onViewCharts={(e) => {
                          e.stopPropagation();
                          navigate(`/calendar/${calendar.id}`);
                        }}
                        onEditCalendar={handleEditCalendar}
                        onDuplicateCalendar={handleDuplicateCalendar}
                        onDeleteCalendar={handleDeleteCalendar}
                        onUpdateCalendarProperty={handleUpdateCalendarProperty}
                        formatCurrency={formatCurrency}
                      />
                  );
                })}
              </Box>
            )}
          </Card>

  {/* Economic Events Section */}
          <Card
            sx={{
              flex: 1,
              borderRadius: 1,
              height: { xs: 'auto', md: '620px' },
              minHeight: { xs: '400px', md: '620px' },
              p: { xs: 0.5, sm: 1 },
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{
                mb: { xs: 2, sm: 3 },
                px: { xs: 1.5, sm: 2 },
                pt: { xs: 1.5, sm: 2 }
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
                }}
              >
                Economic Events Today
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'primary.main',
                  cursor: 'pointer',
                  fontSize: { xs: '0.8125rem', sm: '0.875rem' },
                  '&:hover': { textDecoration: 'underline' }
                }}
                onClick={() => setEconomicCalendarOpen(true)}
              >
                View all
              </Typography>
            </Stack>

            {loadingEvents ? (
              <Box sx={{ px: 2, pb: 2, flex: 1, overflowY: 'auto', ...scrollbarStyles(theme) }}>
                <EconomicEventShimmer count={5} />
              </Box>
            ) : economicEvents.length === 0 ? (
              <Box sx={{
                textAlign: 'center',
                py: 6,
                px: 2,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <EventIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2, mx: 'auto' }} />
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 1, fontWeight: 600 }}>
                  No economic events today
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                  There are no high or medium impact economic events scheduled for today
                </Typography>
              </Box>
            ) : (
              <Box sx={{
                px: 2,
                pb: 2,
                flex: 1,
                overflowY: 'auto',
                ...scrollbarStyles(theme)
              }}>
                {economicEvents.map((event) => (
                  <Card
                    key={event.id}
                    sx={{
                      mb: 2,
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 2,
                        transform: 'translateY(-2px)'
                      },
                      '&:last-child': {
                        mb: 0
                      }
                    }}
                    onClick={() => setEconomicCalendarOpen(true)}
                  >
                    <EconomicEventListItem
                      event={event}
                      px={2.5}
                      py={2}
                      showDivider={false}
                      onClick={() => setEconomicCalendarOpen(true)}
                    />
                  </Card>
                ))}
              </Box>
            )}
          </Card>
        
        </Box>

        {/* Recent Trades Card */}
          <Card
            sx={{
              flex: 1,
              borderRadius: 1,
              p: { xs: 2, sm: 2.5, md: 3 },
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: { xs: 2, sm: 3 } }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
                }}
              >
                Recent Trades
              </Typography>

            </Stack>

            {loadingTrades ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fill, minmax(280px, 1fr))'
                  },
                  gap: { xs: 1.5, sm: 2 }
                }}
              >
                {Array.from({ length: 5 }).map((_, index) => (
                  <Card
                    key={index}
                    sx={{
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                      backgroundColor: alpha(theme.palette.primary.main, 0.05)
                    }}
                  >
                    <CardContent sx={{ p: 2, pt: 2, '&:last-child': { pb: 2 } }}>
                      <Stack spacing={1.5}>
                        {/* Header shimmer */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Shimmer width="60%" height={20} sx={{ borderRadius: 1 }} />
                          <Shimmer width="30%" height={24} sx={{ borderRadius: 1 }} />
                        </Box>

                        {/* Icons row shimmer */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Shimmer width={16} height={16} sx={{ borderRadius: '50%' }} />
                          <Shimmer width={80} height={14} sx={{ borderRadius: 1 }} />
                          <Shimmer width={16} height={16} sx={{ borderRadius: '50%' }} />
                          <Shimmer width={60} height={14} sx={{ borderRadius: 1 }} />
                        </Box>

                        {/* Tags shimmer */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          <Shimmer width={80} height={20} sx={{ borderRadius: 10 }} />
                          <Shimmer width={100} height={20} sx={{ borderRadius: 10 }} />
                          <Shimmer width={70} height={20} sx={{ borderRadius: 10 }} />
                          <Shimmer width={90} height={20} sx={{ borderRadius: 10 }} />
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : recentTrades.length === 0 ? (
              <Box sx={{
                textAlign: 'center',
                py: 6,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <TrendingUp sx={{ fontSize: 48, color: 'text.secondary', mb: 2, mx: 'auto' }} />
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 1, fontWeight: 600 }}>
                  No recent trades
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                  Start logging your trades to see them here and track your trading performance over time
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fill, minmax(280px, 1fr))'
                  },
                  gap: { xs: 1.5, sm: 2 }
                }}
              >
                {recentTrades.map((trade) => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    showTags={true}
                    onClick={() => handleTradeClick(trade)}
                  />
                ))}
              </Box>
            )}
          </Card>
      </Box>

      {/* Economic Calendar Drawer */}
      {calendars.length > 0 && (
        <EconomicCalendarDrawer
          open={economicCalendarOpen}
          onClose={() => setEconomicCalendarOpen(false)}
          calendar={calendars[0]}
        />
      )}

      {/* AI Chat Drawer */}
      {calendars.length > 0 && (
        <AIChatDrawer
          open={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
          trades={performanceTrades}
          calendar={calendars[0]}
          onOpenGalleryMode={() => {}}
          onUpdateTradeProperty={(tradeId, updateCallback) =>
            onUpdateTradeProperty(calendars[0].id, tradeId, updateCallback)
          }
          onEditTrade={() => {}}
          onDeleteTrade={() => {}}
          onDeleteMultipleTrades={() => {}}
          onZoomImage={setZoomedImage}
          onUpdateCalendarProperty={handleUpdateCalendarProperty}
          isReadOnly={false}
        />
      )}

      {/* Create Calendar Dialog */}
      <CalendarFormDialog
        open={isCreateCalendarDialogOpen}
        onClose={() => setIsCreateCalendarDialogOpen(false)}
        onSubmit={handleCreateCalendarSubmit}
        isSubmitting={isCreatingCalendar}
        mode="create"
        title="Create New Calendar"
        submitButtonText="Create"
      />

      {/* Trade Form Dialog */}
      <TradeFormDialog
        open={isTradeFormOpen}
        onClose={handleTradeFormClose}
        onCancel={handleTradeFormClose}
        newMainTrade={newTrade}
        setNewMainTrade={(prev) => setNewTrade(prev(newTrade!))}
        trade_date={new Date()}
        trades={tradesForDate}
        account_balance={selectedCalendar?.account_balance || 0}
        showForm={{ open: isTradeFormOpen, editTrade: null, createTempTrade: false }}
        onAddTrade={handleAddTrade}
        onTagUpdated={handleTagUpdated}
        onUpdateTradeProperty={handleUpdateTradeProperty}
        onDeleteTrades={handleDeleteTrades}
        setZoomedImage={(url) => setZoomedImage(url)}
        allTrades={selectedCalendar?.cachedTrades || []}
        dynamicRiskSettings={{
          account_balance: selectedCalendar?.account_balance || 0,
          risk_per_trade: selectedCalendar?.risk_per_trade || 0,
          dynamic_risk_enabled: selectedCalendar?.dynamic_risk_enabled || false,
          increased_risk_percentage: selectedCalendar?.increased_risk_percentage || 0,
          profit_threshold_percentage: selectedCalendar?.profit_threshold_percentage || 0
        }}
        tags={selectedCalendar?.tags || []}
        requiredTagGroups={selectedCalendar?.required_tag_groups || []}
        calendars={calendars}
        onCalendarChange={handleCalendarChange}
        selectedCalendarId={selectedCalendarId}
      />

      {/* Edit Calendar Dialog */}
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

      {/* Duplicate Calendar Options Dialog */}
      <DuplicateCalendarDialog
        open={isDuplicateOptionsDialogOpen}
        calendar={calendarToDuplicate}
        isDuplicating={isDuplicating}
        onClose={() => {
          setIsDuplicateOptionsDialogOpen(false);
          setCalendarToDuplicate(null);
        }}
        onDuplicate={handleDuplicateOptionSelect}
      />

      {/* Delete Calendar Dialog */}
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

      {/* Performance Dialog */}
      <Dialog
        {...dialogProps}
        open={showPerformanceDialog}
        onClose={() => setShowPerformanceDialog(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            background: theme.palette.background.paper,
            borderRadius: 2
          }
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pb: 1
          }}
        >
          Performance Analytics
          <IconButton
            onClick={() => setShowPerformanceDialog(false)}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'text.primary',
                backgroundColor: alpha(theme.palette.primary.main, 0.1)
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 0,
            overflow: 'auto',
            ...scrollbarStyles(theme)
          }}
        >
          <PerformanceCharts
            showCalendarSelector={true}
            trades={performanceTrades}
            calendars={calendars}
          />
        </DialogContent>
      </Dialog>

      {/* Login Dialog */}
      <LoginDialog
        open={showLoginDialog}
        onClose={handleLoginDialogClose}
        title="TradeJourno"
        subtitle="Please sign in to access this feature"
        showFeatures={true}
      />
    </Box>
  );
};

export default Home;

