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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Tooltip,
  InputAdornment
} from '@mui/material';
import {
  PushPin as PinIcon,
  TrendingUp as WinIcon,
  TrendingDown as LossIcon,
  Remove as BreakevenIcon,
  CalendarToday as DateIcon,
  Event as EventIcon,
  ArrowBack as BackIcon,
  Note as NoteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { Trade } from '../types/trade';
import { Calendar, PinnedEvent } from '../types/calendar';
import { format } from 'date-fns';
import UnifiedDrawer from './common/UnifiedDrawer';
import { eventNamesMatch } from '../utils/eventNameUtils';
import { scrollbarStyles } from '../styles/scrollbarStyles';

interface PinnedTradesDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  calendar?: Calendar;
  onTradeClick?: (trade: Trade,trades: Trade[],title : string) => void;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: any) => any) => Promise<Calendar | undefined>;
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
  isReadOnly = false
}) => {
  const theme = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Notes dialog state
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PinnedEvent | null>(null);
  const [notesText, setNotesText] = useState('');

  // View notes dialog state
  const [viewNotesDialogOpen, setViewNotesDialogOpen] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<PinnedEvent | null>(null);

  // Get pinned trades
  const pinnedTrades = useMemo(() => {
    return trades.filter(trade => trade.isPinned);
  }, [trades]);

  // Get pinned events from calendar
  const pinnedEvents = useMemo(() => {
    return calendar?.pinnedEvents || [];
  }, [calendar?.pinnedEvents]);

  // Sort pinned trades by date (most recent first)
  const sortedPinnedTrades = useMemo(() => {
    return [...pinnedTrades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
      if (trade.economicEvents?.some(event => event.name.toLowerCase().includes(query))) return true;

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

  // Get trades that contain a specific economic event
  const getTradesWithEvent = useMemo(() => {
    return (eventName: string) => {
      return trades.filter(trade =>
        trade.economicEvents?.some(event =>
           eventNamesMatch(event.name, eventName)
        )
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };
  }, [trades]);

  // Get trades for selected event
  const tradesWithSelectedEvent = useMemo(() => {
    return selectedEvent ? getTradesWithEvent(selectedEvent) : [];
  }, [selectedEvent, getTradesWithEvent]);

  // Get the selected pinned event object (for notes)
  const selectedPinnedEvent = useMemo(() => {
    return selectedEvent ? pinnedEvents.find(pe => pe.event === selectedEvent) : null;
  }, [selectedEvent, pinnedEvents]);

  // Handle opening notes dialog
  const handleEditNotes = (pinnedEvent: PinnedEvent) => {
    setEditingEvent(pinnedEvent);
    setNotesText(pinnedEvent.notes || '');
    setNotesDialogOpen(true);
  };

  // Handle viewing notes dialog
  const handleViewNotes = (pinnedEvent: PinnedEvent) => {
    setViewingEvent(pinnedEvent);
    setViewNotesDialogOpen(true);
  };

  // Handle closing view notes dialog
  const handleCloseViewNotesDialog = () => {
    setViewNotesDialogOpen(false);
    setViewingEvent(null);
  };

  // Handle saving notes
  const handleSaveNotes = async () => {
    if (!editingEvent || !calendar?.id || !onUpdateCalendarProperty) return;

    try {
      await onUpdateCalendarProperty(calendar.id, (calendar: Calendar) => {
        const updatedPinnedEvents = calendar.pinnedEvents?.map(event =>
          event.event === editingEvent.event
            ? { ...event, notes: notesText.trim() || undefined }
            : event
        ) || [];

        return {
          ...calendar,
          pinnedEvents: updatedPinnedEvents
        };
      });

      setNotesDialogOpen(false);
      setEditingEvent(null);
      setNotesText('');
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  // Handle closing notes dialog
  const handleCloseNotesDialog = () => {
    setNotesDialogOpen(false);
    setEditingEvent(null);
    setNotesText('');
  };

  const getTradeTypeIcon = (type: Trade['type']) => {
    switch (type) {
      case 'win':
        return <WinIcon sx={{ fontSize: 20, color: 'success.main' }} />;
      case 'loss':
        return <LossIcon sx={{ fontSize: 20, color: 'error.main' }} />;
      case 'breakeven':
        return <BreakevenIcon sx={{ fontSize: 20, color: 'text.secondary' }} />;
    }
  };

  const getTradeTypeColor = (type: Trade['type']) => {
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
    if (selectedEvent) {
      return `Trades with "${selectedEvent}"`;
    }
    return activeTab === 0 ? "Pinned Trades" : "Pinned Events";
  };

  const getIcon = () => {
    if (selectedEvent) {
      return <EventIcon />;
    }
    return activeTab === 0 ? <PinIcon /> : <EventIcon />;
  };

  const getHeaderActions = () => {
    if (selectedEvent) {
      return (
        <Chip
          label={tradesWithSelectedEvent.length}
          size="small"
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontWeight: 600
          }}
        />
      );
    }

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
      {/* Back button when viewing event trades */}
      {selectedEvent && (
        <Box sx={{
          p: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          backgroundColor: alpha(theme.palette.background.paper, 0.5)
        }}>
          <ListItemButton
            onClick={() => {
              setSelectedEvent(null);
              setSearchQuery(''); // Clear search when going back
            }}
            sx={{
              borderRadius: 1,
              p: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.02),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            <BackIcon sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="body2">Back to Pinned Events</Typography>
          </ListItemButton>
        </Box>
      )}

      {/* Tabs - only show when not viewing event trades */}
      {!selectedEvent && (
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

      {/* Search Input - only show when not viewing event trades */}
      {!selectedEvent && (
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
        {selectedEvent ? (
          // Show trades with selected event
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Event Notes Section */}
            {selectedPinnedEvent?.notes && (
              <Box
                sx={{
                  p: 2,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  backgroundColor: alpha(theme.palette.warning.main, 0.05),
                  borderLeft: `3px solid ${theme.palette.warning.main}`
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <NoteIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.5 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        color: 'primary.main',
                        mb: 0.5
                      }}
                    >
                      Event Notes
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.5
                      }}
                    >
                      {selectedPinnedEvent.notes}
                    </Typography>
                  </Box>
                  {!isReadOnly && (
                    <Tooltip title="Edit notes">
                      <IconButton
                        size="small"
                        onClick={() => selectedPinnedEvent && handleEditNotes(selectedPinnedEvent)}
                        sx={{
                          color: 'primary.main',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.1)
                          }
                        }}
                      >
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            )}

            {/* Trades List */}
            {tradesWithSelectedEvent.length === 0 ? (
              <Box
                sx={{
                  p: 4,
                  textAlign: 'center',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <EventIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                  No Trades Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 300 }}>
                  No trades contain the economic event "{selectedEvent}". Try selecting a different event.
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0, overflow: 'auto', flex: 1, ...scrollbarStyles(theme) }}>
              {tradesWithSelectedEvent.map((trade, index) => (
                <React.Fragment key={trade.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => onTradeClick?.(trade,tradesWithSelectedEvent,`Trades with ${selectedEvent}`)}
                      sx={{
                        p: 2,
                        backgroundColor: alpha(
                          trade.type === 'win'
                            ? theme.palette.success.main
                            : trade.type === 'loss'
                            ? theme.palette.error.main
                            : theme.palette.warning.main,
                          0.03
                        ),
                        borderLeft: `3px solid ${
                          trade.type === 'win'
                            ? theme.palette.success.main
                            : trade.type === 'loss'
                            ? theme.palette.error.main
                            : theme.palette.warning.main
                        }`,
                        '&:hover': {
                          backgroundColor: alpha(
                            trade.type === 'win'
                              ? theme.palette.success.main
                              : trade.type === 'loss'
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
                          {getTradeTypeIcon(trade.type)}
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
                                  {trade.name}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: getTradeTypeColor(trade.type),
                                    fontWeight: 600,
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  {trade.type === 'win' ? '+' : trade.type === 'loss' ? '-' : ''}
                                  {trade.amount ? `$${Math.abs(trade.amount).toFixed(2)}` : ''}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                  <DateIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                    {format(new Date(trade.date), 'MMM d, yyyy')}
                                  </Typography>
                                </Box>
                                {/* Show matching economic events */}
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                  {trade.economicEvents?.filter(event =>
                                    event.name.toLowerCase().includes(selectedEvent.toLowerCase()) ||
                                    selectedEvent.toLowerCase().includes(event.name.toLowerCase())
                                  ).map((event, eventIndex) => (
                                    <Chip
                                      key={eventIndex}
                                      label={event.name}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.65rem',
                                        backgroundColor: alpha(theme.palette.warning.main, 0.1),
                                        color: 'warning.main',
                                        '& .MuiChip-label': { px: 0.75 }
                                      }}
                                    />
                                  ))}
                                </Box>
                              </Box>
                            }
                          />
                        </Box>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                  {index < tradesWithSelectedEvent.length - 1 && <Divider sx={{ ml: 3 }} />}
                </React.Fragment>
              ))}
            </List>
            )}
          </Box>
        ) : activeTab === 0 ? (
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
                          trade.type === 'win'
                            ? theme.palette.success.main
                            : trade.type === 'loss'
                            ? theme.palette.error.main
                            : theme.palette.warning.main,
                          0.03
                        ),
                        borderLeft: `3px solid ${
                          trade.type === 'win'
                            ? theme.palette.success.main
                            : trade.type === 'loss'
                            ? theme.palette.error.main
                            : theme.palette.warning.main
                        }`,
                        '&:hover': {
                          backgroundColor: alpha(
                            trade.type === 'win'
                              ? theme.palette.success.main
                              : trade.type === 'loss'
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
                          {getTradeTypeIcon(trade.type)}
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
                                    color: getTradeTypeColor(trade.type),
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {trade.amount > 0 ? '+' : ''}${Math.abs(trade.amount).toFixed(2)}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <Box>
                                {/* Date and Session */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <DateIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Typography variant="body2" color="text.secondary">
                                    {format(new Date(trade.date), 'MMM dd, yyyy')}
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
                const tradesWithEvent = getTradesWithEvent(pinnedEvent.event);
                return (
                  <React.Fragment key={pinnedEvent.event}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => setSelectedEvent(pinnedEvent.event)}
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
                              {pinnedEvent.notes && (
                                <Box component="span" sx={{ ml: 1, display: 'inline-flex', alignItems: 'center' }}>
                                  • <NoteIcon sx={{ fontSize: 12, ml: 0.5 }} />
                                </Box>
                              )}
                            </Typography>
                            {pinnedEvent.notes && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewNotes(pinnedEvent);
                                }}
                                sx={{
                                  fontSize: '0.75rem',
                                  fontStyle: 'italic',
                                  mt: 0.5,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  cursor: 'pointer',
                                  '&:hover': {
                                    color: 'primary.main',
                                    textDecoration: 'underline'
                                  }
                                }}
                              >
                                {pinnedEvent.notes}
                              </Typography>
                            )}
                          </Box>

                          {/* Notes Button */}
                          {!isReadOnly && (
                            <Tooltip title={pinnedEvent.notes ? "Edit notes" : "Add notes"}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditNotes(pinnedEvent);
                                }}
                                sx={{
                                  color: pinnedEvent.notes ? 'primary.main' : 'text.secondary',
                                  '&:hover': {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.1)
                                  }
                                }}
                              >
                                {pinnedEvent.notes ? <NoteIcon sx={{ fontSize: 18 }} /> : <EditIcon sx={{ fontSize: 18 }} />}
                              </IconButton>
                            </Tooltip>
                          )}

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

      {/* Edit Notes Dialog */}
      <Dialog
        open={notesDialogOpen}
        onClose={handleCloseNotesDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingEvent?.notes ? 'Edit Notes' : 'Add Notes'}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {editingEvent?.event}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            label="Notes"
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Add your notes about this economic event..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNotesDialog}>Cancel</Button>
          <Button onClick={handleSaveNotes} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Notes Dialog */}
      <Dialog
        open={viewNotesDialogOpen}
        onClose={handleCloseViewNotesDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Event Notes
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {viewingEvent?.event}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body1"
            sx={{
              mt: 1,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {viewingEvent?.notes || 'No notes available.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseViewNotesDialog}>Close</Button>
          {!isReadOnly && (
            <Button
              onClick={() => {
                handleCloseViewNotesDialog();
                if (viewingEvent) {
                  handleEditNotes(viewingEvent);
                }
              }}
              variant="outlined"
            >
              Edit Notes
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </UnifiedDrawer>
  );
};

export default PinnedTradesDrawer;
