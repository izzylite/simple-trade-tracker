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
  ListItemText,
  Fab,
  Tabs,
  Tab,
  Alert,
  Chip,
  useMediaQuery
} from '@mui/material';

import CalendarFormDialog, { CalendarFormData } from '../components/CalendarFormDialog';
import { DuplicateCalendarDialog } from '../components/dialogs/DuplicateCalendarDialog';
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
  MoreVert as MoreVertIcon,
  Delete as TrashIcon,
  AutoAwesome as AIIcon,
  Restore as RestoreIcon,
  DeleteForever as DeleteForeverIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  SmartToy as SmartToyIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar } from '../types/calendar';
import { formatCurrency } from '../utils/formatters';
import { dialogProps } from '../styles/dialogStyles';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import PerformanceCharts from '../components/PerformanceCharts';
import SelectDateDialog from '../components/SelectDateDialog';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { getCalendarStats } from '../services/calendarService';
import Shimmer from '../components/Shimmer';

import CalendarCard from '../components/CalendarCard';
import CalendarCardShimmer from '../components/CalendarCardShimmer';
import { logger } from '../utils/logger';
import RoundedTabs from '../components/common/RoundedTabs';
import {
  getTrashCalendars,
  restoreCalendarFromTrash,
  permanentlyDeleteCalendar,
  getDaysUntilDeletion,
  TrashCalendar
} from '../services/trashService';
import AIChatDrawer from '../components/aiChat/AIChatDrawer';
import { Trade } from '../types/dualWrite';
import { TradeRepository } from '../services/repository/repositories/TradeRepository';
import { CalendarManagementProps } from '../App';

interface CalendarHomeProps extends CalendarManagementProps {}

export const CalendarHome: React.FC<CalendarHomeProps> = ({
  calendars,
  onCreateCalendar,
  onDuplicateCalendar,
  onDeleteCalendar,
  onUpdateCalendar,
  isLoading: externalLoading,
  onMenuClick
}) => {
  const { user, signInWithGoogle, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Tab state - 0 for Calendars, 1 for Trash
  const [activeTab, setActiveTab] = useState(0);

  // Calendar states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDuplicateOptionsDialogOpen, setIsDuplicateOptionsDialogOpen] = useState(false);
  const [calendarToDelete, setCalendarToDelete] = useState<string | null>(null);
  const [calendarToEdit, setCalendarToEdit] = useState<Calendar | null>(null);

  // Trash states
  const [trashCalendars, setTrashCalendars] = useState<TrashCalendar[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'restore' | 'delete';
    calendar: TrashCalendar | null;
  }>({
    open: false,
    action: 'restore',
    calendar: null
  });
  const [calendarToDuplicate, setCalendarToDuplicate] = useState<Calendar | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const [expandedCalendars, setExpandedCalendars] = useState<{[key: string]: boolean}>({});
  const [menuAnchorEl, setMenuAnchorEl] = useState<{[key: string]: HTMLElement | null}>({});
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  const [selectedCalendarForCharts, setSelectedCalendarForCharts] = useState<Calendar | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [currentTimePeriod, setCurrentTimePeriod] = useState<'month' | 'year' | 'all'>('month');
  // Trades for the selected calendar
  const [calendarTrades, setCalendarTrades] = useState<Trade[]>([]);

  // AI Chat drawer state
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [zoomedImage, setZoomedImage] = useState<string>('');

  // Use external loading state if provided, otherwise use internal loading state
  const isLoading = externalLoading !== undefined ? externalLoading : false;

  // Load all trades when AI chat opens
  useEffect(() => {
    const fetchAllTrades = async () => {
      if (!isAIChatOpen || !user?.uid) return;

      try {
        const tradeRepository = new TradeRepository();
        const trades = await tradeRepository.findByUserId(user.uid);
        setAllTrades(trades);
      } catch (error) {
        logger.error('Error fetching trades for AI chat:', error);
        setAllTrades([]);
      }
    };

    fetchAllTrades();
  }, [isAIChatOpen, user?.uid]);

  // Load trash calendars when trash tab is active
  useEffect(() => {
    if (activeTab === 1 && user) {
      loadTrashCalendars();
    }
  }, [activeTab, user]);

  const loadTrashCalendars = async () => {
    if (!user) return;

    try {
      setLoadingTrash(true);
      const calendars = await getTrashCalendars(user.uid);
      setTrashCalendars(calendars);
    } catch (error) {
      logger.error('Error loading trash calendars:', error);
    } finally {
      setLoadingTrash(false);
    }
  };

  const handleRestoreCalendar = async (calendar: TrashCalendar) => {
    try {
      setActionLoading(calendar.id);
      await restoreCalendarFromTrash(calendar.id);
      await loadTrashCalendars();
      setConfirmDialog({ open: false, action: 'restore', calendar: null });
    } catch (error) {
      logger.error('Error restoring calendar:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (calendar: TrashCalendar) => {
    try {
      setActionLoading(calendar.id);
      await permanentlyDeleteCalendar(calendar.id);
      await loadTrashCalendars();
      setConfirmDialog({ open: false, action: 'delete', calendar: null });
    } catch (error) {
      logger.error('Error permanently deleting calendar:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const getDeletionStatusColor = (daysLeft: number) => {
    if (daysLeft <= 3) return theme.palette.error.main;
    if (daysLeft <= 7) return theme.palette.warning.main;
    return theme.palette.info.main;
  };

  // Update selectedCalendarForCharts when calendars change and a calendar is selected
  useEffect(() => {
    if (selectedCalendarForCharts && calendars.length > 0) {
      const updatedCalendar = calendars.find(c => c.id === selectedCalendarForCharts.id);
      if (updatedCalendar) {
        setSelectedCalendarForCharts(updatedCalendar);
      }
    }
  }, [calendars, selectedCalendarForCharts]);

  const handleCreateCalendarSubmit = async (data: CalendarFormData) => {
    setIsCreating(true);
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
      setIsCreateDialogOpen(false);
    } catch (error) {
      logger.error('Error creating calendar:', error);
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
      };

      await onUpdateCalendar(calendarToEdit.id, updates);
      setIsEditDialogOpen(false);
    } catch (error) {
      logger.error('Error updating calendar:', error);
    } finally {
      setIsEditing(false);
    }
  };



  const handleCalendarClick = async (calendarId: string) => {
    // Simply navigate to the calendar page
    // The calendar page will handle loading trades via useCalendarTrades hook
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
      logger.error('Error duplicating calendar:', error);
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

    // Set the calendar to show the dialog
    setSelectedCalendarForCharts(calendar);

    // Fetch trades for the calendar
    try {
      const tradeRepository = new TradeRepository();
      const trades = await tradeRepository.findByCalendarId(calendar.id);
      setCalendarTrades(trades);
    } catch (error) {
      logger.error('Error fetching trades for calendar:', error);
      setCalendarTrades([]);
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
  const handleUpdateCalendarProperty = async (calendarId: string, updateCallback: (calendar: Calendar) => Calendar): Promise<Calendar | undefined> => {
    const calendar = calendars.find(c => c.id === calendarId);
    if (!calendar) return;

    const updatedCalendar = updateCallback(calendar);
    const updates: Partial<Calendar> = {
      ...updatedCalendar,
      score_settings: updatedCalendar.score_settings
    };

    await onUpdateCalendar(calendarId, updates);
  };

  // Create a wrapper function for sharing-related calendar updates
  const handleUpdateCalendarPropertyForSharing = async (calendarId: string, updateCallback: (calendar: Calendar) => Calendar): Promise<Calendar | undefined> => {
    const calendar = calendars.find(c => c.id === calendarId);
    if (!calendar) return undefined;

    const updatedCalendar = updateCallback(calendar);
    const updates: Partial<Calendar> = {
      share_link: updatedCalendar.share_link,
      share_id: updatedCalendar.share_id,
      is_shared: updatedCalendar.is_shared,
      shared_at: updatedCalendar.shared_at
    };

    await onUpdateCalendar(calendarId, updates);
    return updatedCalendar;
  };

  // Get available months for the selected calendar
  const availableMonths = useMemo(() => {
    if (!selectedCalendarForCharts) return [];

    const trades = calendarTrades || [];
    if (trades.length === 0) return [new Date()];

    const dates = trades.map(trade => new Date(trade.trade_date));
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
  }, [calendarTrades]);



  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      logger.error('Failed to sign in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      logger.error('Failed to sign out:', error);
    }
  };


  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: 'custom.pageBackground',
      pl: 0
    }}>



      <Box sx={{ pt: { xs: 2, sm: 4 }, pb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 4 } }}>
        {/* Header Section */}
        <Box sx={{ mb: { xs: 2, sm: 3, md: 4 }, mx: { xs: 0, sm: 4, md: 8 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mb: { xs: 1.5, sm: 1 } }}>
            <Box>
              <Typography variant={isXs ? 'h5' : 'h4'} sx={{ fontWeight: 700, mb: { xs: 0.5, sm: 1 } }}>
                My Calendars
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                Manage your trading journals and view performance
              </Typography>
            </Box>
            <RoundedTabs
              tabs={[
                { label: 'Calendars' },
                { label: 'Trash' }
              ]}
              activeTab={activeTab}
              onTabChange={(_, newValue) => setActiveTab(newValue)}
              size={isXs ? 'small' : 'large'}
            />
          </Stack>
        </Box>

        {/* Content */}
        <Box sx={{ pb: { xs: 4, sm: 6 } }}>
        {user ? (
          <>
            {/* Calendars Tab Content */}
            {activeTab === 0 && (
              <>
                {calendars.length === 0 && !isLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: { xs: 4, sm: 8 },
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
                  sm: 'repeat(auto-fill, minmax(300px, 400px))',
                },
                gap: 2,
                justifyContent: 'center'
              }}>
                {isLoading ? (
                  // Show shimmer skeletons while loading
                  Array.from({ length: 12 }).map((_, index) => (
                    <CalendarCardShimmer key={index} />
                  ))
                ) : (
                  // Show actual calendars
                  calendars.map(calendar => {
                    // Use the imported getCalendarStats function from calendarService
                    const stats = getCalendarStats(calendar);
                    return (
                      <CalendarCard
                        key={calendar.id}
                        calendar={calendar}
                        stats={stats}
                        isExpanded={expandedCalendars[calendar.id] || false}
                        onToggleExpand={handleToggleExpand}
                        onCalendarClick={handleCalendarClick}
                        onViewCharts={handleViewCharts}
                        onEditCalendar={handleEditCalendar}
                        onDuplicateCalendar={handleDuplicateCalendar}
                        onDeleteCalendar={handleDeleteCalendar}
                        onUpdateCalendarProperty={handleUpdateCalendarPropertyForSharing}
                        formatCurrency={formatCurrency}
                      />
                    );
                  })
                )}
              </Box>
            )}
              </>
            )}

            {/* Trash Tab Content */}
            {activeTab === 1 && (
              <>
                {loadingTrash ? (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'repeat(2, 1fr)',
                        lg: 'repeat(3, 1fr)'
                      },
                      gap: 3
                    }}
                  >
                    {Array.from({ length: 6 }).map((_, index) => (
                      <CalendarCardShimmer key={index} />
                    ))}
                  </Box>
                ) : trashCalendars.length === 0 ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      py: { xs: 4, sm: 8 },
                      bgcolor: 'background.paper',
                      borderRadius: 2,
                      boxShadow: 1
                    }}
                  >
                    <TrashIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Trash is empty
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                      Deleted calendars will appear here
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Alert
                      severity="info"
                      icon={<ScheduleIcon />}
                      sx={{
                        mb: 3,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Items will be permanently deleted after 30 days
                      </Typography>
                      <Typography variant="body2">
                        Restore calendars before they're automatically removed. This action cannot be undone after deletion.
                      </Typography>
                    </Alert>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          md: 'repeat(2, 1fr)',
                          lg: 'repeat(3, 1fr)'
                        },
                        gap: { xs: 2, md: 3 }
                      }}
                    >
                      {trashCalendars.map((calendar) => {
                        const daysLeft = getDaysUntilDeletion(calendar.auto_delete_at);
                        const statusColor = getDeletionStatusColor(daysLeft);

                        return (
                          <Card
                            key={calendar.id}
                            sx={{
                              borderRadius: 2,
                              border: `1px solid ${alpha(statusColor, 0.3)}`,
                              bgcolor: alpha(statusColor, 0.05),
                              transition: 'all 0.2s',
                              '&:hover': {
                                boxShadow: 2,
                                transform: 'translateY(-2px)'
                              }
                            }}
                          >
                            <CardContent>
                              <Stack spacing={2}>
                                <Box>
                                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                    {calendar.name}
                                  </Typography>
                                  <Chip
                                    icon={<ScheduleIcon />}
                                    label={`${daysLeft} days until deletion`}
                                    size="small"
                                    sx={{
                                      bgcolor: alpha(statusColor, 0.1),
                                      color: statusColor,
                                      fontWeight: 500
                                    }}
                                  />
                                </Box>

                                <Divider />

                                <Stack spacing={1}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="text.secondary">
                                      Deleted
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {format(new Date(calendar.deleted_at), 'MMM dd, yyyy')}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="body2" color="text.secondary">
                                      Auto-delete
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 500, color: statusColor }}>
                                      {format(new Date(calendar.auto_delete_at), 'MMM dd, yyyy')}
                                    </Typography>
                                  </Box>
                                </Stack>
                              </Stack>
                            </CardContent>
                            <CardActions sx={{ px: 2, pb: 2 }}>
                              <Button
                                size="small"
                                startIcon={<RestoreIcon />}
                                onClick={() => setConfirmDialog({ open: true, action: 'restore', calendar })}
                                disabled={actionLoading === calendar.id}
                                sx={{ flex: 1 }}
                              >
                                Restore
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteForeverIcon />}
                                onClick={() => setConfirmDialog({ open: true, action: 'delete', calendar })}
                                disabled={actionLoading === calendar.id}
                                sx={{ flex: 1 }}
                              >
                                Delete
                              </Button>
                            </CardActions>
                          </Card>
                        );
                      })}
                    </Box>
                  </>
                )}
              </>
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

            {/* Trash Confirmation Dialogs */}
            <Dialog
              open={confirmDialog.open && confirmDialog.action === 'restore'}
              onClose={() => setConfirmDialog({ open: false, action: 'restore', calendar: null })}
              maxWidth="xs"
              fullWidth
              {...dialogProps}
            >
              <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: 'primary.main'
              }}>
                <RestoreIcon fontSize="small" />
                Restore Calendar
              </DialogTitle>
              <DialogContent>
                <Typography>
                  Are you sure you want to restore "{confirmDialog.calendar?.name}"? It will be moved back to your calendars.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setConfirmDialog({ open: false, action: 'restore', calendar: null })}
                  sx={{ color: 'text.secondary' }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => confirmDialog.calendar && handleRestoreCalendar(confirmDialog.calendar)}
                  disabled={actionLoading !== null}
                  sx={{ color: 'primary.main' }}
                >
                  {actionLoading ? <CircularProgress size={20} /> : 'Restore'}
                </Button>
              </DialogActions>
            </Dialog>

            <Dialog
              open={confirmDialog.open && confirmDialog.action === 'delete'}
              onClose={() => setConfirmDialog({ open: false, action: 'delete', calendar: null })}
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
                <WarningIcon fontSize="small" />
                Permanently Delete Calendar
              </DialogTitle>
              <DialogContent>
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    This action cannot be undone!
                  </Typography>
                  <Typography variant="body2">
                    All trades and data will be permanently deleted.
                  </Typography>
                </Alert>
                <Typography>
                  Are you sure you want to permanently delete "{confirmDialog.calendar?.name}"?
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setConfirmDialog({ open: false, action: 'delete', calendar: null })}
                  sx={{ color: 'text.secondary' }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => confirmDialog.calendar && handlePermanentDelete(confirmDialog.calendar)}
                  disabled={actionLoading !== null}
                  sx={{ color: 'error.main' }}
                >
                  {actionLoading ? <CircularProgress size={20} /> : 'Delete Forever'}
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
                  isLoading || calendarTrades.length === 0 ? (
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
                      trades={calendarTrades || []}
                      selectedDate={selectedMonth}
                      accountBalance={selectedCalendarForCharts.account_balance}
                      monthlyTarget={selectedCalendarForCharts.monthly_target ?? undefined}
                      maxDailyDrawdown={selectedCalendarForCharts.max_daily_drawdown}
                      calendarIds={[selectedCalendarForCharts.id]}
                      calendar={selectedCalendarForCharts}
                      dynamicRiskSettings={{
                        account_balance: selectedCalendarForCharts.account_balance,
                        risk_per_trade: selectedCalendarForCharts.risk_per_trade,
                        dynamic_risk_enabled: selectedCalendarForCharts.dynamic_risk_enabled,
                        increased_risk_percentage: selectedCalendarForCharts.increased_risk_percentage,
                        profit_threshold_percentage: selectedCalendarForCharts.profit_threshold_percentage
                      }}
                      scoreSettings={selectedCalendarForCharts.score_settings}
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
                trades={calendarTrades || []}
                accountBalance={selectedCalendarForCharts.account_balance}
                monthlyTarget={selectedCalendarForCharts.monthly_target ?? undefined}
                yearlyTarget={selectedCalendarForCharts.yearly_target}
              />
            )}


          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 'calc(100vh - 200px)',
            }}
          >
            <Card
              sx={{
                maxWidth: 450,
                width: '100%',
                mx: 2,
                p: 4,
                textAlign: 'center',
                background: theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`
                  : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${theme.palette.background.paper} 100%)`,
                backdropFilter: 'blur(10px)',
                boxShadow: theme.palette.mode === 'dark'
                  ? `0 8px 32px 0 ${alpha(theme.palette.common.black, 0.4)}`
                  : `0 8px 32px 0 ${alpha(theme.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              {/* Logo/Icon */}
              <Box
                sx={{
                  margin: '0 auto 24px',
                }}
              >
                <Box
                  component="img"
                  src="/android-chrome-192x192.png"
                  alt="Cotex Logo"
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '20px',
                    boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                  }}
                />
              </Box>

              {/* Welcome Text */}
              <Typography
                variant="h4"
                gutterBottom
                sx={{
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1
                }}
              >
                Cotex
              </Typography>

              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 4 }}
              >
                Track, analyze, and improve your trading performance
              </Typography>

              <Divider sx={{ my: 3 }} />

              {/* Sign In Button */}
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleSignIn}
                startIcon={<GoogleIcon />}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': {
                    boxShadow: `0 6px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
                    transform: 'translateY(-2px)',
                    transition: 'all 0.3s ease'
                  }
                }}
              >
                Sign in with Google
              </Button>

              {/* Features List */}
              <Box sx={{ mt: 4, textAlign: 'left' }}>
                <Stack spacing={2}>
                  {[
                    { icon: <TrendingUp />, text: 'Track all your trades' },
                    { icon: <ChartIcon />, text: 'Analyze performance with advanced charts' },
                    { icon: <CalendarMonth />, text: 'Calendar view & insights' },
                    { icon: <AIIcon />, text: 'AI-powered trading assistant & analysis' }
                  ].map((feature, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        color: 'text.secondary'
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: 'primary.main'
                        }}
                      >
                        {feature.icon}
                      </Box>
                      <Typography variant="body2">
                        {feature.text}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Card>
          </Box>
        )}
        </Box>
      </Box>

      {/* AI Chat Drawer */}
      {calendars.length > 0 && (
        <AIChatDrawer
          open={isAIChatOpen}
          onClose={() => setIsAIChatOpen(false)}
          trades={allTrades}
          calendar={calendars[0]}
          onOpenGalleryMode={() => {}}
          onUpdateTradeProperty={() => Promise.resolve(undefined)}
          onEditTrade={() => {}}
          onDeleteTrade={() => {}}
          onDeleteMultipleTrades={() => {}}
          onZoomImage={setZoomedImage}
          onUpdateCalendarProperty={() => Promise.resolve(undefined)}
          isReadOnly={false}
        />
      )}

      {/* AI Chat FAB */}
      {user && (
        <Tooltip title="AI Trading Assistant" placement="left">
          <Fab
            color="secondary"
            aria-label="open ai chat"
            onClick={() => setIsAIChatOpen(true)}
            sx={{
              position: 'fixed',
              bottom: { xs: 88, sm: 120 },
              right: { xs: 16, sm: 32 },
              zIndex: 1200
            }}
          >
            <SmartToyIcon />
          </Fab>
        </Tooltip>
      )}

      {/* Floating Action Button */}
      {user && (
        <Fab
          color="primary"
          aria-label="add calendar"
          onClick={() => setIsCreateDialogOpen(true)}
          sx={{
            position: 'fixed',
            bottom: { xs: 16, sm: 32 },
            right: { xs: 16, sm: 32 },
            width: { xs: 56, sm: 64 },
            height: { xs: 56, sm: 64 },
            boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
            '&:hover': {
              boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.5)}`,
              transform: 'scale(1.05)',
            },
            transition: 'all 0.3s ease',
          }}
        >
          <AddIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
        </Fab>
      )}
    </Box>
  );
};

export default CalendarHome;