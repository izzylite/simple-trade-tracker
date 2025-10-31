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
  ListItemText,
  Tabs,
  Tab,
  Badge,
  Avatar,
  IconButton,
  Tooltip,
  InputAdornment,
  TextField
} from '@mui/material';
import {
  PushPin as PinIcon,
  TrendingUp as WinIcon,
  TrendingDown as LossIcon,
  Remove as BreakevenIcon,
  CalendarToday as DateIcon,
  Event as EventIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Note as NoteIcon
} from '@mui/icons-material';
import { Trade, Calendar, PinnedEvent } from '../types/dualWrite';
import { EconomicEvent } from '../types/economicCalendar';
import { format } from 'date-fns';
import UnifiedDrawer from './common/UnifiedDrawer';
import { eventMatchV1, eventMatchV2 } from '../utils/eventNameUtils';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import EconomicEventDetailDialog from './economicCalendar/EconomicEventDetailDialog';
import { economicCalendarService } from '../services/economicCalendarService';
import { logger } from '../utils/logger';

interface PinnedTradesDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  calendar?: Calendar;
  onTradeClick?: (trade: Trade,trades: Trade[],title : string) => void;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: any) => any) => Promise<Calendar | undefined>;
  onOpenGalleryMode?: (trades: Trade[], initialTradeId?: string, title?: string) => void;
  // Trade operation callbacks for EconomicEventDetailDialog
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  onEditTrade?: (trade: Trade) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onDeleteMultipleTrades?: (tradeIds: string[]) => void;
  onZoomImage?: (imageUrl: string, allImages?: string[], initialIndex?: number) => void;
  // Read-only mode for shared calendars
  isReadOnly?: boolean;
}

const PinnedTradesDrawer: React.FC<PinnedTradesDrawerProps> = ({
  open,
  onClose,
  trades,
  calendar,
  onTradeClick,
  onUpdateCalendarProperty,
  onOpenGalleryMode,
  onUpdateTradeProperty,
  onEditTrade,
  onDeleteTrade,
  onDeleteMultipleTrades,
  onZoomImage,
  isReadOnly = false
}) => {
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

  const getTradeTypeIcon = (type: Trade['trade_type']) => {
    switch (type) {
      case 'win':
        return <WinIcon sx={{ fontSize: 20, color: 'success.main' }} />;
      case 'loss':
        return <LossIcon sx={{ fontSize: 20, color: 'error.main' }} />;
      case 'breakeven':
        return <BreakevenIcon sx={{ fontSize: 20, color: 'text.secondary' }} />;
    }
  };

  const getTradeTypeColor = (type: Trade['trade_type']) => {
    switch (type) {
      case 'win':
        return theme.palette.success.main;
      case 'loss':
        return theme.palette.error.main;
      case 'breakeven':
        return theme.palette.text.secondary;
    }
  };



  // Get dynamic title and icon
  const getTitle = () => {
    return activeTab === 0 ? "Pinned Trades" : "Pinned Events";
  };

  const getIcon = () => {
    return activeTab === 0 ? <PinIcon /> : <EventIcon />;
  };

  const getHeaderActions = () => {
    if (activeTab === 0) {
      const totalCount = sortedPinnedTrades.length;
      const filteredCount = filteredPinnedTrades.length;

      if (totalCount === 0) return undefined;

      return (
        <Chip
          label={searchQuery.trim() ? `${filteredCount}/${totalCount}` : totalCount}
          size="small"
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontWeight: 600
          }}
        />
      );
    } else {
      const totalCount = pinnedEvents.length;
      const filteredCount = filteredPinnedEvents.length;

      if (totalCount === 0) return undefined;

      return (
        <Chip
          label={searchQuery.trim() ? `${filteredCount}/${totalCount}` : totalCount}
          size="small"
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontWeight: 600
          }}
        />
      );
    }
  };

  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title={getTitle()}
      icon={getIcon()}
      width={{ xs: '100%', sm: 400 }}
      headerVariant="enhanced"
      headerActions={getHeaderActions()}
    >
      {/* Tabs */}
      {(
        <Box sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => {
              setActiveTab(newValue);
              setSearchQuery(''); // Clear search when switching tabs
            }}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.9rem'
              }
            }}
          >
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PinIcon sx={{ fontSize: 18 }} />
                  Trades
                  {filteredPinnedTrades.length > 0 && (
                    <Badge
                      badgeContent={searchQuery.trim() ? filteredPinnedTrades.length : sortedPinnedTrades.length}
                      color="primary"
                      sx={{ ml: 0.5 }}
                    />
                  )}
                </Box>
              }
            />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EventIcon sx={{ fontSize: 18 }} />
                  Events
                  {filteredPinnedEvents.length > 0 && (
                    <Badge
                      badgeContent={searchQuery.trim() ? filteredPinnedEvents.length : pinnedEvents.length}
                      color="primary"
                      sx={{ ml: 0.5 }}
                    />
                  )}
                </Box>
              }
            />
          </Tabs>
        </Box>
      )}

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
            <List sx={{ p: 0, overflow: 'auto', height: '100%', ...scrollbarStyles(theme) }}>
              {filteredPinnedTrades.map((trade, index) => (
                <React.Fragment key={trade.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => onTradeClick?.(trade,filteredPinnedTrades,"Pinned Trades")}
                      sx={{
                        p: 2,
                        backgroundColor: alpha(
                          trade.trade_type === 'win'
                            ? theme.palette.success.main
                            : trade.trade_type === 'loss'
                            ? theme.palette.error.main
                            : theme.palette.warning.main,
                          0.03
                        ),
                        borderLeft: `3px solid ${
                          trade.trade_type === 'win'
                            ? theme.palette.success.main
                            : trade.trade_type === 'loss'
                            ? theme.palette.error.main
                            : theme.palette.warning.main
                        }`,
                        '&:hover': {
                          backgroundColor: alpha(
                            trade.trade_type === 'win'
                              ? theme.palette.success.main
                              : trade.trade_type === 'loss'
                              ? theme.palette.error.main
                              : theme.palette.warning.main,
                            0.08
                          )
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
                        {/* Trade Type Icon */}
                        <Box sx={{ mt: 0.5 }}>
                          {getTradeTypeIcon(trade.trade_type)}
                        </Box>

                        {/* Trade Content */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                <Typography
                                  variant="subtitle1"
                                  sx={{
                                    fontWeight: 600,
                                    color: 'text.primary',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1,
                                    mr: 1
                                  }}
                                >
                                  {trade.name || `Trade ${trade.id.slice(-6)}`}
                                </Typography>
                                <Typography
                                  variant="subtitle1"
                                  sx={{
                                    fontWeight: 700,
                                    color: getTradeTypeColor(trade.trade_type),
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {trade.amount > 0 ? '+' : ''}${Math.abs(trade.amount).toFixed(2)}
                                </Typography>
                              </Box>
                            }
                            primaryTypographyProps={{ component: 'div' }}
                            secondaryTypographyProps={{ component: 'div' }}
                            secondary={
                              <Box>
                                {/* Date and Session */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <DateIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Typography variant="body2" color="text.secondary">
                                    {format(new Date(trade.trade_date), 'MMM dd, yyyy')}
                                  </Typography>
                                  {trade.session && (
                                    <Chip
                                      label={trade.session}
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.7rem',
                                        borderColor: alpha(theme.palette.text.secondary, 0.3),
                                        color: 'text.secondary'
                                      }}
                                    />
                                  )}
                                </Box>

                                {/* Tags */}
                                {trade.tags && trade.tags.length > 0 && (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {trade.tags.slice(0, 4).map((tag) => (
                                      <Chip
                                        key={tag}
                                        label={tag}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          height: 20,
                                          fontSize: '0.7rem',
                                          borderColor: alpha(theme.palette.primary.main, 0.3),
                                          color: 'primary.main'
                                        }}
                                      />
                                    ))}
                                    {trade.tags.length > 4 && (
                                      <Chip
                                        label={`+${trade.tags.length - 4}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          height: 20,
                                          fontSize: '0.7rem',
                                          borderColor: alpha(theme.palette.text.secondary, 0.3),
                                          color: 'text.secondary'
                                        }}
                                      />
                                    )}
                                  </Box>
                                )}
                              </Box>
                            }
                          />
                        </Box>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                  {index < filteredPinnedTrades.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
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
          onUpdateTradeProperty={onUpdateTradeProperty}
          onEditTrade={onEditTrade}
          onDeleteTrade={onDeleteTrade}
          onDeleteMultipleTrades={onDeleteMultipleTrades}
          onZoomImage={onZoomImage}
          onOpenGalleryMode={onOpenGalleryMode}
          calendarId={calendar.id}
          calendar={calendar}
          onUpdateCalendarProperty={onUpdateCalendarProperty}
          isReadOnly={isReadOnly}
        />
      )}
    </UnifiedDrawer>
  );
};

export default PinnedTradesDrawer;
