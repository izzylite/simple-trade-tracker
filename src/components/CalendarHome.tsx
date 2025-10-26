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
import { Calendar, CalendarWithUIState } from '../types/calendar';
import { formatCurrency } from '../utils/formatters';
import { dialogProps } from '../styles/dialogStyles';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import PerformanceCharts from './PerformanceCharts';
import SelectDateDialog from './SelectDateDialog';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { getCalendarStats } from '../services/calendarService';
import Shimmer from './Shimmer';
import AppHeader from './common/AppHeader';
import CalendarCard from './CalendarCard';
import { logger } from '../utils/logger';
// TradeDetailDialog has been removed

interface CalendarHomeProps {
  calendars: CalendarWithUIState[];
  onCreateCalendar: (name: string, account_balance: number, max_daily_drawdown: number, weeklyTarget?: number, monthlyTarget?: number, yearlyTarget?: number, riskPerTrade?: number, dynamic_risk_enabled?: boolean, increased_risk_percentage?: number, profit_threshold_percentage?: number, heroImageUrl?: string, heroImageAttribution?: any, heroImagePosition?: string) => void;
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
  const [calendarToEdit, setCalendarToEdit] = useState<CalendarWithUIState | null>(null);
  const [calendarToDuplicate, setCalendarToDuplicate] = useState<CalendarWithUIState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const [expandedCalendars, setExpandedCalendars] = useState<{[key: string]: boolean}>({});
  const [menuAnchorEl, setMenuAnchorEl] = useState<{[key: string]: HTMLElement | null}>({});
  const theme = useTheme();
  const navigate = useNavigate();
  const [selectedCalendarForCharts, setSelectedCalendarForCharts] = useState<CalendarWithUIState | null>(null);
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

  const handleViewCharts = async (e: React.MouseEvent, calendar: CalendarWithUIState) => {
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
  const handleUpdateCalendarProperty = async (calendarId: string, updateCallback: (calendar: CalendarWithUIState) => Calendar): Promise<Calendar | undefined> => {
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
  const handleUpdateCalendarPropertyForSharing = async (calendarId: string, updateCallback: (calendar: CalendarWithUIState) => Calendar): Promise<Calendar | undefined> => {
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

    const trades = selectedCalendarForCharts.cachedTrades || [];
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
  }, [selectedCalendarForCharts]);



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
      bgcolor: 'custom.pageBackground'
    }}>

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
                gap: 2,
                alignItems: 'start'
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
                      <Box
                        key={calendar.id}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          height: 'fit-content'
                        }}
                      >
                        <CalendarCard
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
                      </Box>
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
                      accountBalance={selectedCalendarForCharts.account_balance}
                      monthlyTarget={selectedCalendarForCharts.monthly_target ?? undefined}
                      maxDailyDrawdown={selectedCalendarForCharts.max_daily_drawdown}
                      calendarId={selectedCalendarForCharts.id}
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
                trades={selectedCalendarForCharts.cachedTrades || []}
                accountBalance={selectedCalendarForCharts.account_balance}
                monthlyTarget={selectedCalendarForCharts.monthly_target ?? undefined}
                yearlyTarget={selectedCalendarForCharts.yearly_target}
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