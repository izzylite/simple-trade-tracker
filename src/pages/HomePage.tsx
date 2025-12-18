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
import { Calendar } from '../types/calendar';
import { Trade } from '../types/dualWrite';
import { EconomicEvent } from '../types/economicCalendar';
import { formatCurrency } from '../utils/formatters';
import { economicCalendarService } from '../services/economicCalendarService';
import { TradeWithCalendarName, useRecentTrades } from '../hooks/useRecentTrades';
import { useUpcomingEconomicEvents } from '../hooks/useUpcomingEconomicEvents';

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
import { DuplicateCalendarDialog } from '../components/dialogs/DuplicateCalendarDialog';
import AIChatDrawer from '../components/aiChat/AIChatDrawer';
import TradeFormDialog from '../components/trades/TradeFormDialog';
import { NewTradeForm } from '../components/trades';
import { createNewTradeData } from './TradeCalendarPage';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import * as calendarService from '../services/calendarService';
import { CalendarManagementProps } from '../App';
import NotesDrawer from '../components/notes/NotesDrawer';

interface HomeProps extends CalendarManagementProps {}

const Home: React.FC<HomeProps> = ({
  calendars,
  isLoading = false,
  onCreateCalendar,
  onDuplicateCalendar,
  onDeleteCalendar,
  onUpdateCalendar,
  onMenuClick
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Use custom hooks for data fetching with SWR caching
  const { economicEvents, isLoading: loadingEvents } = useUpcomingEconomicEvents({
    impacts: ['High', 'Medium'],
    refreshInterval: 300000, // Refresh every 5 minutes
  });
  const { recentTrades: recentTrades_, isLoading: loadingTrades } = useRecentTrades(user?.uid, calendars, {
    limit: 5,
  });

  const [economicCalendarOpen, setEconomicCalendarOpen] = useState(false);
  const [isCreateCalendarDialogOpen, setIsCreateCalendarDialogOpen] = useState(false);
  const [isCreatingCalendar, setIsCreatingCalendar] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // Trade creation dialog state
  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [newTrade, setNewTrade] = useState<NewTradeForm | null>(null);
  const [selectedTradeCalendarId, setSelectedTradeCalendarId] = useState<string>('');
  const [recentTrades, setRecentTrades] = useState< TradeWithCalendarName[] | undefined>([]);
  // AI Chat drawer state
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  // Notes drawer state
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);

  // Image zoom state
  const [zoomedImage, setZoomedImage] = useState<string>('');

  // Calendar dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDuplicateOptionsDialogOpen, setIsDuplicateOptionsDialogOpen] = useState(false);
  const [calendarToDelete, setCalendarToDelete] = useState<string | null>(null);
  const [calendarToEdit, setCalendarToEdit] = useState<Calendar | null>(null);
  const [calendarToDuplicate, setCalendarToDuplicate] = useState<Calendar | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Check if screen is large (xl breakpoint = 1536px+)
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('xl'));

  useEffect(()=> {
    setRecentTrades(recentTrades_)
  }, [recentTrades_])

  // Get recently updated calendars (top 2 for large screens, top 1 for smaller screens)
  const recentCalendars = useMemo(() => {
    const limit = isLargeScreen ? 2 : 1;
    return [...calendars]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  }, [calendars, isLargeScreen]);



  // Calendar action handlers - open dialogs for edit/duplicate/delete
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

  // Update calendar property handler for share button
  const handleUpdateCalendarProperty = async (
    calendarId: string,
    updateCallback: (calendar: Calendar) => Calendar
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

  const selectedTradeCalendar = useMemo(() => {
    if (!calendars.length || !selectedTradeCalendarId) return null;
    return calendars.find(c => c.id === selectedTradeCalendarId) || null;
  }, [calendars, selectedTradeCalendarId]);

  const tradesForTradeDialog = useMemo(() => {
    if (!selectedTradeCalendar) return [];
    return recentTrades?.filter(trade => trade.calendar_id === selectedTradeCalendar.id) || [];
  }, [recentTrades, selectedTradeCalendar]);

  const dynamicRiskSettingsForTrade: DynamicRiskSettings = useMemo(() => {
    if (!selectedTradeCalendar) {
      return { account_balance: 0 };
    }
    return {
      account_balance: selectedTradeCalendar.account_balance,
      risk_per_trade: selectedTradeCalendar.risk_per_trade,
      dynamic_risk_enabled: selectedTradeCalendar.dynamic_risk_enabled,
      increased_risk_percentage: selectedTradeCalendar.increased_risk_percentage,
      profit_threshold_percentage: selectedTradeCalendar.profit_threshold_percentage
    };
  }, [selectedTradeCalendar]);

  const tagsForTradeDialog = selectedTradeCalendar?.tags || [];
  const requiredTagGroupsForTradeDialog = selectedTradeCalendar?.required_tag_groups || [];
  const accountBalanceForTradeDialog = selectedTradeCalendar?.account_balance ?? 0;

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

  const handleTradeCalendarChange = (calendarId: string) => {
    setSelectedTradeCalendarId(calendarId);
  };

  const handleAddTradeFromHome = async (trade: Trade & { id?: string }) => {
    const calendarId = trade.calendar_id || selectedTradeCalendar?.id || selectedTradeCalendarId;
    if (!calendarId) {
      throw new Error('Calendar ID is required');
    }
    await calendarService.addTrade(calendarId, { ...trade, calendar_id: calendarId });
    const calendarName = selectedTradeCalendar?.name || '';
    const tradeWithCalendarName: TradeWithCalendarName = { ...trade, calendarName };
    setRecentTrades(prev => {
      return [tradeWithCalendarName, ...(prev || [])];
    });
  };

  const handleCreateTrade = () => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }
    if (calendars.length === 0) {
      return; // Button should be disabled, but just in case
    }
    // Do not preselect calendar; user must choose one in the dialog
    setSelectedTradeCalendarId('');
    setNewTrade(createNewTradeData());
    setIsTradeFormOpen(true);
  };

  const handleTradeFormClose = () => {
    if (newTrade && newTrade.pending_images) {
      newTrade.pending_images.forEach(image => {
        URL.revokeObjectURL(image.preview);
      });
      setNewTrade(null);
    }
    setIsTradeFormOpen(false);
  };

  const handleTradeFormCancel = () => {
    setIsTradeFormOpen(false);
  };

  const handleSetNewMainTrade = (updater: (trade: NewTradeForm) => NewTradeForm | null) => {
    setNewTrade(prev => {
      const base = prev ?? createNewTradeData();
      return updater(base);
    });
  };

  const handleLoginDialogClose = () => {
    setShowLoginDialog(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'custom.pageBackground',
      }}
    >


      <Box
        sx={{
          pt: { xs: 2, sm: 3, md: 4 },
          pb: { xs: 2, sm: 3, md: 4 },
          px: { xs: 2, sm: 3, md: 4 },
          maxWidth: '1400px',
          mx: 'auto',
        }}
      >
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

            {/* Notes */}
            <Card
              sx={{
                borderRadius: 2,
                border: `2px dashed ${alpha(theme.palette.warning.main, 0.3)}`,
                bgcolor: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: theme.palette.warning.main,
                  bgcolor: alpha(theme.palette.warning.main, 0.05),
                  transform: 'translateY(-2px)'
                }
              }}
              onClick={() => {
                if (!user) { setShowLoginDialog(true); return; }
                setIsNotesDrawerOpen(true);
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
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: { xs: 1.5, sm: 2 }
                  }}
                >
                  <EditIcon sx={{
                    fontSize: { xs: 24, sm: 28, md: 32 },
                    color: theme.palette.warning.main
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
                  Notes
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.6875rem', sm: '0.75rem' } }}
                >
                  Create and manage notes
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
              maxWidth: recentCalendars.length <= 1 ? { xs: 'none', md: '400px' } : 'none',
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
                px: 1,
                pb: 2,
                flex: 1,
                display: 'flex',
                flexDirection: 'row',
                gap: 1
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
                Economic Events
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
            ) : !economicEvents || economicEvents.length === 0 ? (
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
                      bgcolor: theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.black, 0.2)
                        : alpha(theme.palette.common.black, 0.03),
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      '&:hover': {
                        boxShadow: 2,
                        transform: 'translateY(-2px)',
                        bgcolor: theme.palette.mode === 'dark'
                          ? alpha(theme.palette.common.black, 0.3)
                          : alpha(theme.palette.common.black, 0.06),
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
            ) : !recentTrades || recentTrades.length === 0 ? (
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
          tradeOperations={{
            onOpenGalleryMode: () => {},
            onUpdateTradeProperty: () => Promise.resolve(undefined),
            onEditTrade: () => {},
            onDeleteTrade: () => Promise.resolve(),
            onDeleteMultipleTrades: () => {},
            onZoomImage: setZoomedImage,
            isTradeUpdating: () => false,
            calendarId: calendars[0].id,
            calendar: calendars[0],
            onUpdateCalendarProperty: () => Promise.resolve(undefined)
          }}
          isReadOnly
        />
      )}

      {/* AI Chat Drawer - works without calendar for general queries */}
      <AIChatDrawer
        open={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        tradeOperations={{
          onOpenGalleryMode: () => {},
          onUpdateTradeProperty: () => Promise.resolve(undefined),
          onEditTrade: () => {},
          onDeleteTrade: () => Promise.resolve(),
          onDeleteMultipleTrades: () => {},
          onZoomImage: setZoomedImage,
          isTradeUpdating: () => false,
          onUpdateCalendarProperty: () => Promise.resolve(undefined)
        }}
        isReadOnly={false}
      />

      {/* Notes Drawer - multi-calendar view with calendar picker */}
      <NotesDrawer
        open={isNotesDrawerOpen}
        onClose={() => setIsNotesDrawerOpen(false)}
        showCalendarPicker={true}
      />

      {/* Trade Form Dialog - calendar selection mode */}
      {calendars.length > 0 && (
        <TradeFormDialog
          open={isTradeFormOpen}
          onClose={handleTradeFormClose}
          newMainTrade={newTrade || undefined}
          trade_date={new Date()}
          showForm={{ open: isTradeFormOpen, editTrade: undefined, createTempTrade: false }}
          trades={tradesForTradeDialog}
          account_balance={accountBalanceForTradeDialog}
          onAddTrade={handleAddTradeFromHome}
          setZoomedImage={setZoomedImage}
          setNewMainTrade={handleSetNewMainTrade}
          onCancel={handleTradeFormCancel}
          allTrades={tradesForTradeDialog}
          dynamicRiskSettings={dynamicRiskSettingsForTrade}
          tags={tagsForTradeDialog}
          requiredTagGroups={requiredTagGroupsForTradeDialog}
          calendars={calendars}
          onCalendarChange={handleTradeCalendarChange}
          selectedCalendarId={selectedTradeCalendarId}
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



      {/* Login Dialog */}
      <LoginDialog
        open={showLoginDialog}
        onClose={handleLoginDialogClose}
        title="JournoTrades"
        subtitle="Please sign in to access this feature"
        showFeatures={true}
      />

      {/* Login Dialog */}
      <LoginDialog
        open={showLoginDialog}
        onClose={handleLoginDialogClose}
        title="JournoTrades"
        subtitle="Please sign in to access this feature"
        showFeatures={true}
      />
    </Box>
  );
};

export default Home;

