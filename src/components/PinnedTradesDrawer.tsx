import React, { useMemo, useState } from 'react';
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
  Stack
} from '@mui/material';
import {
  PushPin as PinIcon,
  Event as EventIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { Trade, Calendar, PinnedEvent } from '../types/dualWrite';
import { EconomicEvent } from '../types/economicCalendar';
import UnifiedDrawer from './common/UnifiedDrawer';
import { eventMatchV2 } from '../utils/eventNameUtils';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import EconomicEventDetailDialog from './economicCalendar/EconomicEventDetailDialog';
import { economicCalendarService } from '../services/economicCalendarService';
import { logger } from '../utils/logger';
import TradeCard from './aiChat/TradeCard';
import RoundedTabs, { TabPanel } from './common/RoundedTabs';
import { TradeOperationsProps } from '../types/tradeOperations';

interface PinnedTradesDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  onTradeClick?: (trade: Trade, trades: Trade[], title: string) => void;
  tradeOperations: TradeOperationsProps;
}

const PinnedTradesDrawer: React.FC<PinnedTradesDrawerProps> = ({
  open,
  onClose,
  trades,
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
  const [loadingEvent, setLoadingEvent] = useState(false);

  // Get pinned trades
  const pinnedTrades = useMemo(() => {
    return trades.filter(trade => trade.is_pinned);
  }, [trades]);

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

  // Handle clicking on a pinned event - fetch and open detail dialog
  const handleEventClick = async (pinnedEvent: PinnedEvent) => {
    if (!calendar) return;

    try {
      setLoadingEvent(true);

      // Use event_id to fetch the event directly from the database
      if (pinnedEvent.event_id) {
        const event = await economicCalendarService.getEventById(pinnedEvent.event_id);

        if (event) {
          setSelectedEvent(event);
          setEventDetailDialogOpen(true);
        } else {
          logger.warn(`No economic event found with ID: ${pinnedEvent.event_id}`);
        }
      } else {
        // Fallback for old pinned events without event_id
        logger.warn('Pinned event does not have event_id. Please re-pin the event to get the latest data.');
      }
    } catch (error) {
      logger.error('Error fetching economic event:', error);
    } finally {
      setLoadingEvent(false);
    }
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
          sortedPinnedTrades.length === 0 ? (
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
                const tradesWithEvent = trades.filter(trade =>
                  trade.economic_events?.some(event =>
                    eventMatchV2(event, pinnedEvent)
                  )
                );

                return (
                  <React.Fragment key={pinnedEvent.event}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => handleEventClick(pinnedEvent)}
                        disabled={loadingEvent}
                        sx={{
                          p: 2,
                          backgroundColor: alpha(theme.palette.warning.main, 0.03),
                          borderLeft: `3px solid ${theme.palette.warning.main}`,
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.warning.main, 0.08)
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                          {/* Event Icon */}
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              backgroundColor: alpha(theme.palette.warning.main, 0.1),
                              color: 'warning.main'
                            }}
                          >
                            <EventIcon sx={{ fontSize: 18 }} />
                          </Avatar>

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
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                              {tradesWithEvent.length} trade{tradesWithEvent.length !== 1 ? 's' : ''} found
                            </Typography>
                          </Box>

                          {/* Trade Count Badge */}
                          {tradesWithEvent.length > 0 && (
                            <Chip
                              label={tradesWithEvent.length}
                              size="small"
                              sx={{
                                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                color: 'primary.main',
                                fontWeight: 600,
                                minWidth: 32
                              }}
                            />
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
          trades={trades}
          tradeOperations={tradeOperations}
        />
      )}
    </UnifiedDrawer>
  );
};

export default PinnedTradesDrawer;
