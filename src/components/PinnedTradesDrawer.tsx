import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  alpha,
  useTheme,
  Divider,
  List,
  ListItem,
  ListItemButton,
  Avatar,
  IconButton,
  InputAdornment,
  TextField,
  Stack,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  PushPin as PinIcon,
  Event as EventIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  StickyNote2 as NoteIcon
} from '@mui/icons-material';
import { Trade, Calendar, PinnedEvent } from '../types/dualWrite';
import { EconomicEvent } from '../types/economicCalendar';
import UnifiedDrawer from './common/UnifiedDrawer';
import { eventMatchV2 } from '../utils/eventNameUtils';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import EconomicEventDetailDialog from './economicCalendar/EconomicEventDetailDialog';
import { logger } from '../utils/logger';
import TradeCard from './aiChat/TradeCard';
import RoundedTabs, { TabPanel } from './common/RoundedTabs';
import { TradeOperationsProps } from '../types/tradeOperations';
import * as calendarService from '../services/calendarService';
import Shimmer from './Shimmer';

interface PinnedTradesDrawerProps {
  open: boolean;
  onClose: () => void;
  calendarId: string | undefined;
  onTradeClick?: (trade: Trade, trades: Trade[], title: string) => void;
  tradeOperations: TradeOperationsProps;
}

// Helper function to get impact colors (matches EconomicEventListItem)
const getImpactColor = (impact: string | undefined, theme: any) => {
  switch (impact) {
    case 'High':
      return theme.palette.error.main;
    case 'Medium':
      return theme.palette.warning.main;
    case 'Low':
      return theme.palette.success.main;
    default:
      return theme.palette.text.secondary;
  }
};

const PinnedTradesDrawer: React.FC<PinnedTradesDrawerProps> = ({
  open,
  onClose,
  calendarId,
  onTradeClick,
  tradeOperations
}) => {
  const { calendar, isReadOnly = false } = tradeOperations;
  const theme = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Economic event detail dialog state
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [eventDetailDialogOpen, setEventDetailDialogOpen] = useState(false);

  // Pinned trades state
  const [pinnedTrades, setPinnedTrades] = useState<Trade[]>([]);
  const [isLoadingPinned, setIsLoadingPinned] = useState(false);

  // Fetch pinned trades when drawer opens
  useEffect(() => {
    const fetchPinnedTrades = async () => {
      if (!open || !calendarId) return;

      setIsLoadingPinned(true);
      try {
        const trades = await calendarService.getTradeRepository().fetchPinnedTrades(calendarId);
        setPinnedTrades(trades);
        logger.log(`📌 Loaded ${trades.length} pinned trades`);
      } catch (error) {
        logger.error('Error fetching pinned trades:', error);
        setPinnedTrades([]);
      } finally {
        setIsLoadingPinned(false);
      }
    };

    fetchPinnedTrades();
  }, [open, calendarId]);

  // Get pinned events from calendar
  const pinnedEvents = useMemo(() => {
    return calendar?.pinned_events || [];
  }, [calendar?.pinned_events]);

  // Sort pinned trades by date (most recent first)
  const sortedPinnedTrades = useMemo(() => {
    return [...pinnedTrades].sort((a, b) => new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime());
  }, [pinnedTrades]);

  // Filter pinned trades based on search query
  const filteredPinnedTrades = useMemo(() => {
    if (!searchQuery.trim()) return sortedPinnedTrades;

    const query = searchQuery.toLowerCase().trim();
    return sortedPinnedTrades.filter(trade => {
      // Search in trade name
      if (trade.name?.toLowerCase().includes(query)) return true;

      // Search in tags
      if (trade.tags?.some(tag => tag.toLowerCase().includes(query))) return true;

      // Search in session
      if (trade.session?.toLowerCase().includes(query)) return true;

      // Search in economic events
      if (trade.economic_events?.some(event => event.name.toLowerCase().includes(query))) return true;

      // Search in notes (if available)
      if (trade.notes?.toLowerCase().includes(query)) return true;

      return false;
    });
  }, [sortedPinnedTrades, searchQuery]);

  // Filter pinned events based on search query
  const filteredPinnedEvents = useMemo(() => {
    if (!searchQuery.trim()) return pinnedEvents;

    const query = searchQuery.toLowerCase().trim();
    return pinnedEvents.filter(pinnedEvent => {
      // Search in event name
      if (pinnedEvent.event.toLowerCase().includes(query)) return true;

      // Search in notes
      if (pinnedEvent.notes?.toLowerCase().includes(query)) return true;

      return false;
    });
  }, [pinnedEvents, searchQuery]);

  // Handle clicking on a pinned event - construct event from stored data
  const handleEventClick = (pinnedEvent: PinnedEvent) => {
    if (!calendar || !pinnedEvent.event_id) {
      logger.warn('Pinned event does not have event_id. Please re-pin the event to get the latest data.');
      return;
    }

    // Construct EconomicEvent from PinnedEvent data (no fetch needed)
    const event: EconomicEvent = {
      id: pinnedEvent.event_id,
      event_name: pinnedEvent.event,
      currency: pinnedEvent.currency || 'USD',
      impact: pinnedEvent.impact || 'Medium',
      flag_url: pinnedEvent.flag_url,
      country: pinnedEvent.country,
      // Default values for fields not needed by the detail dialog
      actual_result_type: '',
      event_time: '',
      time_utc: '',
      actual_value: '',
      forecast_value: '',
      previous_value: '',
      event_date: ''
    };

    setSelectedEvent(event);
    setEventDetailDialogOpen(true);
  };

  // Get dynamic title and icon
  const getTitle = () => {
    return activeTab === 0 ? "Pinned Trades" : "Pinned Events";
  };

  const getIcon = () => {
    return activeTab === 0 ? <PinIcon /> : <EventIcon />;
  };

  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title={getTitle()}
      icon={getIcon()}
      width={{ xs: '100%', sm: 400 }}
      headerVariant="enhanced"
    >
      {/* Tabs */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
        <RoundedTabs
          tabs={[
            { label: 'Trades' },
            { label: 'Events' }
          ]}
          activeTab={activeTab}
          onTabChange={(_, newValue) => {
            setActiveTab(newValue);
            setSearchQuery(''); // Clear search when switching tabs
          }}
          fullWidth
          size="medium"
        />
      </Box>

      {/* Search Input */}
      {(
        <Box sx={{
          p: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          backgroundColor: alpha(theme.palette.background.paper, 0.3)
        }}>
          <TextField
            fullWidth
            size="small"
            placeholder={activeTab === 0 ? "Search pinned trades..." : "Search pinned events..."}
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                    sx={{ color: 'text.secondary' }}
                  >
                    <ClearIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: alpha(theme.palette.background.paper, 0.5),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.background.paper, 0.8)
                },
                '&.Mui-focused': {
                  backgroundColor: theme.palette.background.paper
                }
              }
            }}
          />
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', ...scrollbarStyles(theme) }}>
        {/* Render content based on current state */}
        {activeTab === 0 ? (
          // Pinned Trades Tab
          isLoadingPinned ? (
            <Stack spacing={2} sx={{ p: 2, overflow: 'auto', height: '100%', ...scrollbarStyles(theme) }}>
              {/* Show 3 shimmer cards while loading */}
              {[1, 2, 3].map((index) => (
                <Box
                  key={index}
                  sx={{
                    maxWidth: 400,
                    border: '1px solid',
                    borderColor: alpha(theme.palette.divider, 0.2),
                    borderRadius: 1,
                    p: 2,
                    pt: 1
                  }}
                >
                  {/* Header - Name and Amount */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Shimmer height={20} width="40%" borderRadius={4} variant="wave" intensity="medium" />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Shimmer height={16} width={16} borderRadius="50%" variant="wave" intensity="medium" />
                      <Shimmer height={20} width={80} borderRadius={4} variant="wave" intensity="medium" />
                    </Box>
                  </Box>

                  {/* Info Icons Row */}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                    <Shimmer height={14} width={14} borderRadius="50%" variant="wave" intensity="low" />
                    <Shimmer height={14} width={14} borderRadius="50%" variant="wave" intensity="low" />
                    <Shimmer height={12} width={80} borderRadius={4} variant="wave" intensity="low" />
                    <Shimmer height={14} width={14} borderRadius="50%" variant="wave" intensity="low" />
                    <Shimmer height={12} width={60} borderRadius={4} variant="wave" intensity="low" />
                  </Box>

                  {/* Tags Row */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Shimmer height={20} width={80} borderRadius={10} variant="wave" intensity="medium" />
                    <Shimmer height={20} width={60} borderRadius={10} variant="wave" intensity="medium" />
                    <Shimmer height={20} width={70} borderRadius={10} variant="wave" intensity="medium" />
                  </Box>
                </Box>
              ))}
            </Stack>
          ) : sortedPinnedTrades.length === 0 ? (
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <PinIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                No Pinned Trades
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 300 }}>
                Pin important trades to keep them easily accessible. Open any trade and click the pin button to add trades here.
              </Typography>
            </Box>
          ) : filteredPinnedTrades.length === 0 ? (
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                No Matching Trades
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 300 }}>
                No pinned trades match your search query "{searchQuery}". Try adjusting your search terms.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2} sx={{ p: 2, overflow: 'auto', height: '100%', ...scrollbarStyles(theme) }}>
              {filteredPinnedTrades.map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  showTags
                  onClick={() => onTradeClick?.(trade, filteredPinnedTrades, "Pinned Trades")}
                />
              ))}
            </Stack>
          )
        ) : (
          // Pinned Events Tab
          pinnedEvents.length === 0 ? (
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <EventIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                No Pinned Events
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 300 }}>
                Pin important economic events from the calendar to track trades that occurred during those events.
              </Typography>
            </Box>
          ) : filteredPinnedEvents.length === 0 ? (
            <Box
              sx={{
                p: 4,
                textAlign: 'center',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                No Matching Events
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 300 }}>
                No pinned events match your search query "{searchQuery}". Try adjusting your search terms.
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0, overflow: 'auto', height: '100%', ...scrollbarStyles(theme) }}>
              {filteredPinnedEvents.map((pinnedEvent, index) => {
                // Note: Trade count for events will be fetched when implementing EconomicCalendarDrawer optimization
                const impactColor = getImpactColor(pinnedEvent.impact, theme);

                return (
                  <React.Fragment key={pinnedEvent.event}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => handleEventClick(pinnedEvent)}
                        sx={{
                          p: 2,
                          backgroundColor: alpha(impactColor, 0.03),
                          borderLeft: `3px solid ${impactColor}`,
                          '&:hover': {
                            backgroundColor: alpha(impactColor, 0.08)
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                          {/* Event Flag or Icon */}
                          {pinnedEvent.flag_url ? (
                            <img
                              src={pinnedEvent.flag_url}
                              alt={pinnedEvent.country || pinnedEvent.currency || ''}
                              style={{
                                width: 32,
                                height: 24,
                                borderRadius: 4,
                                objectFit: 'cover'
                              }}
                            />
                          ) : (
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                backgroundColor: alpha(impactColor, 0.1),
                                color: impactColor
                              }}
                            >
                              <EventIcon sx={{ fontSize: 18 }} />
                            </Avatar>
                          )}

                          {/* Event Content */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: 600,
                                color: 'text.primary',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                mb: 0.5
                              }}
                            >
                              {pinnedEvent.event}
                            </Typography>
                          </Box>

                          {/* Note Icon */}
                          {pinnedEvent.notes && (
                            <Tooltip title={pinnedEvent.notes} arrow placement="top">
                              <NoteIcon
                                sx={{
                                  fontSize: 18,
                                  color: alpha(theme.palette.info.main, 0.7),
                                  cursor: 'pointer'
                                }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </ListItemButton>
                    </ListItem>
                    {index < filteredPinnedEvents.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          )
        )}
      </Box>

      {/* Economic Event Detail Dialog */}
      {selectedEvent && calendar && (
        <EconomicEventDetailDialog
          open={eventDetailDialogOpen}
          onClose={() => {
            setEventDetailDialogOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          calendarId={calendar.id}
          tradeOperations={tradeOperations}
        />
      )}
    </UnifiedDrawer>
  );
};

export default PinnedTradesDrawer;
