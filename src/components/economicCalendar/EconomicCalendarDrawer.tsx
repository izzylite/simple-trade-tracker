/**
 * Economic Calendar Drawer Component
 * Redesigned to match search drawer style with day/week/month pagination
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  useTheme,
  alpha,
  Chip,
  Button,
  ButtonGroup,
  Collapse,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  TextField,
  Avatar,
  Stack,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FilterAlt as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  DateRange as WeekIcon,
  CalendarMonth as MonthIcon,
  Event as EventIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, isToday, isTomorrow, parseISO } from 'date-fns';
import {
  EconomicCalendarDrawerProps,
  EconomicEvent,
  Currency,
  ImpactLevel
} from '../../types/economicCalendar';
import { economicCalendarService } from '../../services/economicCalendarService';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import EconomicEventListItem from './EconomicEventListItem';
import Shimmer from '../Shimmer';

// View types for pagination
type ViewType = 'day' | 'week' | 'month';

// Available currencies and impacts
const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'];
const IMPACTS: ImpactLevel[] = ['High', 'Medium', 'Low'];

// Helper function to get date header for month view
const getDateHeader = (date: string) => {
  const eventDate = parseISO(date);
  const today = new Date();

  if (isToday(eventDate)) {
    return 'Today';
  } else if (isTomorrow(eventDate)) {
    return 'Tomorrow';
  } else {
    return format(eventDate, 'EEE, MMM d');
  }
};

// Group events by date for month view
const groupEventsByDate = (events: EconomicEvent[]) => {
  const grouped: { [key: string]: EconomicEvent[] } = {};

  events.forEach(event => {
    const date = event.date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(event);
  });

  // Sort dates
  const sortedDates = Object.keys(grouped).sort();

  return sortedDates.map(date => ({
    date,
    events: grouped[date].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc))
  }));
};

// Economic Event Shimmer Component
const EconomicEventShimmer: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <Box key={index} sx={{ mb: 3 }}>
          {/* Event header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Shimmer
              width={40}
              height={20}
              borderRadius={4}
              variant="default"
              intensity="medium"
              sx={{ animationDelay: `${index * 0.1}s` }}
            />
            <Shimmer
              width={60}
              height={20}
              borderRadius={4}
              variant="default"
              intensity="medium"
              sx={{ animationDelay: `${index * 0.1 + 0.1}s` }}
            />
            <Shimmer
              width={50}
              height={16}
              borderRadius={4}
              variant="default"
              intensity="low"
              sx={{ animationDelay: `${index * 0.1 + 0.2}s` }}
            />
          </Box>
          
          {/* Event title */}
          <Shimmer
            width="80%"
            height={18}
            borderRadius={4}
            variant="wave"
            intensity="medium"
            sx={{ 
              mb: 0.5,
              animationDelay: `${index * 0.1 + 0.3}s`
            }}
          />
          
          {/* Event details */}
          <Shimmer
            width="60%"
            height={14}
            borderRadius={4}
            variant="default"
            intensity="low"
            sx={{ animationDelay: `${index * 0.1 + 0.4}s` }}
          />
        </Box>
      ))}
    </Box>
  );
};

const EconomicCalendarDrawer: React.FC<EconomicCalendarDrawerProps> = ({
  open,
  onClose
}) => {
  const theme = useTheme();

  // State management
  const [viewType, setViewType] = useState<ViewType>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageSize] = useState(50); // Events per page

  // Filter state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  
  // Applied filters (used for queries)
  const [appliedCurrencies, setAppliedCurrencies] = useState<Currency[]>(['USD', 'EUR', 'GBP']);
  const [appliedImpacts, setAppliedImpacts] = useState<ImpactLevel[]>(['High', 'Medium', 'Low']);
  
  // Pending filters (temporary state before applying)
  const [pendingCurrencies, setPendingCurrencies] = useState<Currency[]>(['USD', 'EUR', 'GBP']);
  const [pendingImpacts, setPendingImpacts] = useState<ImpactLevel[]>(['High', 'Medium', 'Low']);
  
  // Track if filters have been modified
  const [filtersModified, setFiltersModified] = useState(false);

  // Sync pending filters with applied filters on mount
  useEffect(() => {
    setPendingCurrencies(appliedCurrencies);
    setPendingImpacts(appliedImpacts);
  }, []); // Only run on mount

  // Calculate date range based on view type and current date
  const dateRange = useMemo(() => {
    // If custom date range is explicitly set, use it
    if (startDate && endDate && startDate !== endDate) {
      console.log('📅 Using custom date range:', { start: startDate, end: endDate });
      return {
        start: startDate,
        end: endDate
      };
    }

    const date = currentDate;

    switch (viewType) {
      case 'day':
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        const dayResult = {
          start: format(dayStart, 'yyyy-MM-dd'),
          end: format(dayEnd, 'yyyy-MM-dd')
        };
        console.log('📅 Day view date range:', dayResult);
        return dayResult;

      case 'week':
        const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
        const weekResult = {
          start: format(weekStart, 'yyyy-MM-dd'),
          end: format(weekEnd, 'yyyy-MM-dd')
        };
        console.log('📅 Week view date range:', weekResult);
        return weekResult;

      case 'month':
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        const monthResult = {
          start: format(monthStart, 'yyyy-MM-dd'),
          end: format(monthEnd, 'yyyy-MM-dd')
        };
        console.log('📅 Month view date range:', monthResult);
        return monthResult;

      default:
        const defaultResult = {
          start: format(date, 'yyyy-MM-dd'),
          end: format(date, 'yyyy-MM-dd')
        };
        console.log('📅 Default date range:', defaultResult);
        return defaultResult;
    }
  }, [viewType, currentDate, startDate, endDate]);

  // Fetch events when date range or filters change
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      setEvents([]); // Clear existing events
      setLastDoc(undefined); // Reset pagination

      try {
        console.log(`🔄 Fetching ${viewType} events for ${dateRange.start} to ${dateRange.end}`);

        const result = await economicCalendarService.fetchEventsPaginated(
          dateRange,
          { pageSize },
          {
            currencies: appliedCurrencies,
            impacts: appliedImpacts
          }
        );

        setEvents(result.events);
        setHasMore(result.hasMore);
        setLastDoc(result.lastDoc);
        console.log(`✅ Fetched ${result.events.length} events (hasMore: ${result.hasMore})`);

      } catch (err) {
        console.error('❌ Error fetching events:', err);
        setError('Failed to load economic events');
        setEvents([]);
        setHasMore(false);
        setLastDoc(undefined);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchEvents();
    }
  }, [dateRange, appliedCurrencies, appliedImpacts, open, viewType, pageSize, startDate, endDate]);

  // Load more events function
  const loadMoreEvents = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;

    setLoadingMore(true);

    try {
      console.log('🔄 Loading more events...');

      const result = await economicCalendarService.fetchEventsPaginated(
        dateRange,
        { pageSize, lastDoc },
        {
          currencies: appliedCurrencies,
          impacts: appliedImpacts
        }
      );

      setEvents(prev => [...prev, ...result.events]);
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
      console.log(`✅ Loaded ${result.events.length} more events (hasMore: ${result.hasMore})`);

    } catch (err) {
      console.error('❌ Error loading more events:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Infinite scroll handler
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when user scrolls to 80% of the content
    if (scrollPercentage > 0.8 && hasMore && !loadingMore && !loading) {
      loadMoreEvents();
    }
  }, [hasMore, loadingMore, loading, loadMoreEvents]);

  // Navigation handlers
  const handlePrevious = () => {
    // Clear custom date range when navigating
    setStartDate(null);
    setEndDate(null);
    
    switch (viewType) {
      case 'day':
        setCurrentDate(prev => addDays(prev, -1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, -1));
        break;
      case 'month':
        setCurrentDate(prev => addMonths(prev, -1));
        break;
    }
  };

  const handleNext = () => {
    // Clear custom date range when navigating
    setStartDate(null);
    setEndDate(null);
    
    switch (viewType) {
      case 'day':
        setCurrentDate(prev => addDays(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'month':
        setCurrentDate(prev => addMonths(prev, 1));
        break;
    }
  };

  // Filter handlers
  const handleCurrencyChange = (currency: Currency) => {
    setPendingCurrencies(prev =>
      prev.includes(currency)
        ? prev.filter(c => c !== currency)
        : [...prev, currency]
    );
    setFiltersModified(true);
  };

  const handleImpactChange = (impact: ImpactLevel) => {
    setPendingImpacts(prev =>
      prev.includes(impact)
        ? prev.filter(i => i !== impact)
        : [...prev, impact]
    );
    setFiltersModified(true);
  };

  // Apply filters function
  const handleApplyFilters = () => {
    setAppliedCurrencies(pendingCurrencies);
    setAppliedImpacts(pendingImpacts);
    setFiltersModified(false);
    setIsFilterExpanded(false); // Collapse filter section after applying
  };

  // Reset filters function
  const handleResetFilters = () => {
    const defaultCurrencies: Currency[] = ['USD', 'EUR', 'GBP'];
    const defaultImpacts: ImpactLevel[] = ['High', 'Medium', 'Low'];
    
    setPendingCurrencies(defaultCurrencies);
    setPendingImpacts(defaultImpacts);
    setAppliedCurrencies(defaultCurrencies);
    setAppliedImpacts(defaultImpacts);
    setFiltersModified(false);
  };

  // Format display text for current period
  const getDisplayText = () => {
    switch (viewType) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      default:
        return '';
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 1300,
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 450 },
          maxWidth: '100vw',
          zIndex: 1300,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(18, 18, 18, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.4)'
            : '0 8px 32px rgba(0, 0, 0, 0.12)'
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{
          p: 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)'
        }}>
          <Box sx={{
            p: 1.5,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CalendarIcon sx={{ color: 'primary.main', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              Economic Calendar
            </Typography>
            <Typography variant="caption" sx={{
              color: 'text.secondary',
              fontSize: '0.75rem'
            }}>
              Economic events and indicators
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.action.hover, 0.5),
              '&:hover': {
                bgcolor: alpha(theme.palette.action.hover, 0.8),
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* View Controls */}
        <Box sx={{
          p: 3,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          background: alpha(theme.palette.background.default, 0.3)
        }}>
          {/* View Type Selector */}
          <Box sx={{ mb: 2 }}>
            <ButtonGroup variant="outlined" size="small" fullWidth>
              <Button
                startIcon={<EventIcon />}
                onClick={() => {
                  setViewType('day');
                  setStartDate(null);
                  setEndDate(null);
                }}
                variant={viewType === 'day' ? 'contained' : 'outlined'}
                sx={{ flex: 1 }}
              >
                Today
              </Button>
              <Button
                startIcon={<WeekIcon />}
                onClick={() => {
                  setViewType('week');
                  setStartDate(null);
                  setEndDate(null);
                }}
                variant={viewType === 'week' ? 'contained' : 'outlined'}
                sx={{ flex: 1 }}
              >
                This Week
              </Button>
              <Button
                startIcon={<MonthIcon />}
                onClick={() => {
                  setViewType('month');
                  setStartDate(null);
                  setEndDate(null);
                }}
                variant={viewType === 'month' ? 'contained' : 'outlined'}
                sx={{ flex: 1 }}
              >
                This Month
              </Button>
            </ButtonGroup>
          </Box>

          {/* Date Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <IconButton onClick={handlePrevious} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {getDisplayText()}
              </Typography>
            </Box>
            <IconButton onClick={handleNext} size="small">
              <ChevronRightIcon />
            </IconButton>
          </Box>

          {/* Filter Toggle */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              background: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                background: alpha(theme.palette.primary.main, 0.08),
                borderColor: alpha(theme.palette.primary.main, 0.2),
                transform: 'translateY(-1px)',
              }
            }}
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  p: 1,
                  borderRadius: 1.5,
                  background: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FilterIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ 
                    fontWeight: 600, 
                    color: 'primary.main',
                    mb: 0.5
                  }}>
                    Filters
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`${appliedCurrencies.length + appliedImpacts.length} active`}
                      size="small"
                      color={filtersModified ? "warning" : "primary"}
                      variant={filtersModified ? "filled" : "outlined"}
                      sx={{
                        height: 20,
                        fontSize: '0.75rem',
                        '& .MuiChip-label': {
                          px: 1,
                        }
                      }}
                    />
                    {filtersModified && (
                      <Chip
                        label="Modified"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{
                          fontSize: '0.75rem',
                          height: 20,
                          '& .MuiChip-label': {
                            px: 1,
                          }
                        }}
                      />
                    )}
                  </Box>
                </Box>
              </Box>
              <IconButton
                size="small"
                sx={{
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    transform: 'scale(1.1)',
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {isFilterExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Paper>
        </Box>

        {/* Filters Section */}
        <Collapse in={isFilterExpanded}>
          <Box sx={{ px: 3, pb: 3 }}>
            <Stack spacing={3}>
              {/* Month Picker */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: alpha(theme.palette.background.paper, 0.6),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <FormControl component="fieldset" fullWidth>
                  <FormLabel component="legend" sx={{ 
                    mb: 1.5, 
                    fontSize: '0.875rem', 
                    fontWeight: 600,
                    color: 'text.primary'
                  }}>
                    Month Filter
                  </FormLabel>
                  <TextField
                    label="Select Month"
                    type="month"
                    value={format(currentDate, 'yyyy-MM')}
                    onChange={(e) => {
                      const selectedDate = new Date(e.target.value + '-01');
                      console.log('📅 Month picker changed:', { 
                        selectedValue: e.target.value, 
                        selectedDate: format(selectedDate, 'yyyy-MM-dd') 
                      });
                      setCurrentDate(selectedDate);
                      // Clear custom date range to ensure currentDate is used for date range calculation
                      setStartDate(null);
                      setEndDate(null);
                    }}
                    size="small"
                    fullWidth
                    InputLabelProps={{
                      shrink: true,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1.5,
                      }
                    }}
                  />
                </FormControl>
              </Paper>

              {/* Currency Filters */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: alpha(theme.palette.background.paper, 0.6),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <FormControl component="fieldset" fullWidth>
                  <FormLabel component="legend" sx={{ 
                    mb: 1.5, 
                    fontSize: '0.875rem', 
                    fontWeight: 600,
                    color: 'text.primary'
                  }}>
                    Currencies
                  </FormLabel>
                  <FormGroup row sx={{ gap: 1 }}>
                    {CURRENCIES.map((currency) => (
                      <FormControlLabel
                        key={currency}
                        control={
                          <Checkbox
                            checked={pendingCurrencies.includes(currency)}
                            onChange={() => handleCurrencyChange(currency)}
                            size="small"
                            sx={{
                              '&.Mui-checked': {
                                color: 'primary.main',
                              }
                            }}
                          />
                        }
                        label={currency}
                        sx={{ 
                          mr: 0,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '0.875rem',
                            fontWeight: 500,
                          }
                        }}
                      />
                    ))}
                  </FormGroup>
                </FormControl>
              </Paper>

              {/* Impact Filters */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: alpha(theme.palette.background.paper, 0.6),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <FormControl component="fieldset" fullWidth>
                  <FormLabel component="legend" sx={{ 
                    mb: 1.5, 
                    fontSize: '0.875rem', 
                    fontWeight: 600,
                    color: 'text.primary'
                  }}>
                    Impact Level
                  </FormLabel>
                  <FormGroup row sx={{ gap: 1 }}>
                    {IMPACTS.map((impact) => (
                      <FormControlLabel
                        key={impact}
                        control={
                          <Checkbox
                            checked={pendingImpacts.includes(impact)}
                            onChange={() => handleImpactChange(impact)}
                            size="small"
                            sx={{
                              '&.Mui-checked': {
                                color: 'primary.main',
                              }
                            }}
                          />
                        }
                        label={impact}
                        sx={{ 
                          mr: 0,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '0.875rem',
                            fontWeight: 500,
                          }
                        }}
                      />
                    ))}
                  </FormGroup>
                </FormControl>
              </Paper>

              {/* Filter Actions */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  background: alpha(theme.palette.background.paper, 0.6),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                      {pendingCurrencies.length} currencies, {pendingImpacts.length} impact levels
                    </Typography>
                    {filtersModified && (
                      <Chip
                        label="Modified"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ 
                          fontSize: '0.75rem',
                          height: 20,
                          '& .MuiChip-label': {
                            px: 1,
                          }
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      onClick={handleResetFilters}
                      size="small"
                      color="inherit"
                      variant="outlined"
                      sx={{
                        borderRadius: 1.5,
                        textTransform: 'none',
                        fontWeight: 500,
                        px: 2,
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      onClick={handleApplyFilters}
                      size="small"
                      variant="contained"
                      disabled={!filtersModified}
                      startIcon={loading ? <CircularProgress size={16} /> : undefined}
                      sx={{
                        borderRadius: 1.5,
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 2,
                        minWidth: 80,
                      }}
                    >
                      Apply
                    </Button>
                  </Box>
                </Box>
              </Paper>
            </Stack>
          </Box>
        </Collapse>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            ...scrollbarStyles(theme)
          }}
          onScroll={handleScroll}
        >
          {loading ? (
            <EconomicEventShimmer />
          ) : error ? (
            <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
              <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                {error}
              </Typography>
              <Button onClick={() => window.location.reload()} variant="outlined" size="small">
                Retry
              </Button>
            </Box>
          ) : events.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, px: 3 }}>
              <CalendarIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                No events found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your filters or date range
              </Typography>
            </Box>
          ) : (
           
              <Box>
                {groupEventsByDate(events).map((dayGroup, dayIndex) => (
                  <Box key={dayGroup.date}>
                    {/* Sticky Date Header */}
                    <Box sx={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      background: alpha(theme.palette.background.paper, 0.95),
                      backdropFilter: 'blur(10px)',
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      px: 3,
                      py: 1.5
                    }}>
                      <Typography variant="subtitle2" sx={{
                        fontWeight: 700,
                        color: isToday(parseISO(dayGroup.date)) ? 'primary.main' : 'text.primary'
                      }}>
                        {getDateHeader(dayGroup.date)}
                      </Typography>
                    </Box>

                    {/* Events for this date */}
                    <List sx={{ p: 0 }}>
                      {dayGroup.events.map((event, eventIndex) => (
                        <React.Fragment key={event.id || `${dayIndex}-${eventIndex}`}>
                          <EconomicEventListItem event={event} />
                          {eventIndex < dayGroup.events.length - 1 && <Divider sx={{ ml: 3 }} />}
                        </React.Fragment>
                      ))}
                    </List>
                  </Box>
                ))}
              </Box>
           
          )}

          {/* Loading More Indicator */}
          {loadingMore && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CircularProgress size={24} sx={{ mb: 1 }} />
              <Typography variant="caption" color="text.secondary" display="block">
                Loading more events...
              </Typography>
            </Box>
          )}

          {/* Load More Button */}
          {hasMore && !loading && !loadingMore && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Button
                onClick={loadMoreEvents}
                disabled={loadingMore}
                variant="outlined"
                fullWidth
                startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  background: alpha(theme.palette.primary.main, 0.05),
                  '&:hover': {
                    background: alpha(theme.palette.primary.main, 0.1)
                  }
                }}
              >
                {loadingMore ? 'Loading more events...' : `Load more events`}
              </Button>
            </Box>
          )}

          {/* End of results indicator */}
          {!hasMore && events.length > 0 && !loading && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                No more events to load
              </Typography>
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          background: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)'
        }}>
          {/* Pagination Info */}
          {events.length > 0 && (
            <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mb: 0.5 }}>
              Showing {events.length} events{hasMore ? ' (more available)' : ''}
            </Typography>
          )}

        
          <Typography variant="caption" color="success.main" align="center" display="block" sx={{ mt: 0.5 }}>
          Economic events updates every 30 minutes
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};

export default EconomicCalendarDrawer;
