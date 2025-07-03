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
  Tooltip
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
  Edit as EditIcon
} from '@mui/icons-material';
import { Trade } from '../types/trade';
import { Calendar, PinnedEvent } from '../types/calendar';
import { format } from 'date-fns';
import UnifiedDrawer from './common/UnifiedDrawer';
import { eventNamesMatch } from '../utils/eventNameUtils';

interface PinnedTradesDrawerProps {
  open: boolean;
  onClose: () => void;
  trades: Trade[];
  calendar?: Calendar;
  onTradeClick?: (trade: Trade,trades: Trade[],title : string) => void;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: any) => any) => Promise<void>;
}

const PinnedTradesDrawer: React.FC<PinnedTradesDrawerProps> = ({
  open,
  onClose,
  trades,
  calendar,
  onTradeClick,
  onUpdateCalendarProperty
}) => {
  const theme = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  // Notes dialog state
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PinnedEvent | null>(null);
  const [notesText, setNotesText] = useState('');

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

  // Handle opening notes dialog
  const handleEditNotes = (pinnedEvent: PinnedEvent) => {
    setEditingEvent(pinnedEvent);
    setNotesText(pinnedEvent.notes || '');
    setNotesDialogOpen(true);
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
      return sortedPinnedTrades.length > 0 ? (
        <Chip
          label={sortedPinnedTrades.length}
          size="small"
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontWeight: 600
          }}
        />
      ) : undefined;
    } else {
      return pinnedEvents.length > 0 ? (
        <Chip
          label={pinnedEvents.length}
          size="small"
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontWeight: 600
          }}
        />
      ) : undefined;
    }
  };

  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title={getTitle()}
      icon={getIcon()}
      width={{ xs: '100%', sm: 400 }}
      headerVariant="default"
      headerActions={getHeaderActions()}
    >
      {/* Back button when viewing event trades */}
      {selectedEvent && (
        <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <ListItemButton
            onClick={() => setSelectedEvent(null)}
            sx={{
              borderRadius: 1,
              p: 1,
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05)
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
            onChange={(_, newValue) => setActiveTab(newValue)}
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
                  {sortedPinnedTrades.length > 0 && (
                    <Badge
                      badgeContent={sortedPinnedTrades.length}
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
                  {pinnedEvents.length > 0 && (
                    <Badge
                      badgeContent={pinnedEvents.length}
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

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Render content based on current state */}
        {selectedEvent ? (
          // Show trades with selected event
          tradesWithSelectedEvent.length === 0 ? (
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
                No Trades Found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 300 }}>
                No trades contain the economic event "{selectedEvent}". Try selecting a different event.
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0, overflow: 'auto', height: '100%' }}>
              {tradesWithSelectedEvent.map((trade, index) => (
                <React.Fragment key={trade.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => onTradeClick?.(trade,tradesWithSelectedEvent,`Trades with ${selectedEvent}`)}
                      sx={{
                        p: 2,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.05)
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
          )
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
          ) : (
            <List sx={{ p: 0, overflow: 'auto', height: '100%' }}>
              {sortedPinnedTrades.map((trade, index) => (
                <React.Fragment key={trade.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => onTradeClick?.(trade,sortedPinnedTrades,"Pinned Trades")}
                      sx={{
                        p: 2,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.05)
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
                  {index < sortedPinnedTrades.length - 1 && <Divider />}
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
          ) : (
            <List sx={{ p: 0, overflow: 'auto', height: '100%' }}>
              {pinnedEvents.map((pinnedEvent, index) => {
                const tradesWithEvent = getTradesWithEvent(pinnedEvent.event);
                return (
                  <React.Fragment key={pinnedEvent.event}>
                    <ListItem disablePadding>
                      <ListItemButton
                        onClick={() => setSelectedEvent(pinnedEvent.event)}
                        sx={{
                          p: 2,
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.05)
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
                                sx={{
                                  fontSize: '0.75rem',
                                  fontStyle: 'italic',
                                  mt: 0.5,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {pinnedEvent.notes}
                              </Typography>
                            )}
                          </Box>

                          {/* Notes Button */}
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
                    {index < pinnedEvents.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </List>
          )
        )}
      </Box>

      {/* Notes Dialog */}
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
    </UnifiedDrawer>
  );
};

export default PinnedTradesDrawer;
