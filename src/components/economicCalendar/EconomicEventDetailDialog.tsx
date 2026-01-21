/**
 * Economic Event Detail Dialog
 * Simple dialog for pinning events and adding notes
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
  TextField,
  CircularProgress,
  Button,
  Collapse
} from '@mui/material';
import {
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  ViewCarousel as GalleryIcon,
  AutoAwesome as AutoAwesomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { EconomicEvent } from '../../types/economicCalendar';
import { Trade } from '../../types/dualWrite';
import { Calendar } from '../../types/calendar';
import { BaseDialog } from '../common';
import TradeList from '../trades/TradeList';
import { cleanEventNameForPinning, eventMatchV1 } from '../../utils/eventNameUtils';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { Z_INDEX } from '../../styles/zIndex';
import Shimmer from '../Shimmer';
import { supabaseAIChatService } from '../../services/supabaseAIChatService';
import { supabase } from '../../config/supabase';
import { hasApiKey } from '../../services/apiKeyStorage';
import ApiKeySettingsDialog from '../aiChat/ApiKeySettingsDialog';

interface EconomicEventDetailDialogProps {
  open: boolean;
  onClose: () => void;
  event: EconomicEvent;
  calendarId: string;
  tradeOperations: TradeOperationsProps;
  isReadOnly?: boolean;
}

const EconomicEventDetailDialog: React.FC<EconomicEventDetailDialogProps> = ({
  open,
  onClose,
  event,
  calendarId,
  tradeOperations,
  isReadOnly = false
}) => {
  const {
    onOpenGalleryMode,
    calendar,
    onUpdateCalendarProperty
  } = tradeOperations;
  const theme = useTheme();
  const [expandedTradeId, setExpandedTradeId] = React.useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const [pinning, setPinning] = useState(false);
  const initialNotesRef = useRef<string>('');

  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiAnalysisExpanded, setAiAnalysisExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiKeySettingsOpen, setApiKeySettingsOpen] = useState(false);

  // State for event trades
  const [eventTrades, setEventTrades] = useState<Trade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const hasInitialLoad = useRef(false);

  // Fetch trades for this event when dialog opens
  useEffect(() => {
    const fetchEventTrades = async () => {
      if (!open || !calendarId) {
        setEventTrades([]);
        // Don't reset AI analysis here, we'll handle it via cache or trades update
        return;
      }

      setIsLoadingTrades(true);
      hasInitialLoad.current = false;
      try {
        const calendarServiceModule = await import('../../services/calendarService');
        const cleanedName = cleanEventNameForPinning(event.event_name);

        const trades = await calendarServiceModule.getTradeRepository().fetchTradesByEvent(
          calendarId,
          cleanedName,
          event.currency,
          event.impact
        );
        setEventTrades(trades);
      } catch (error) {
        console.error('Error fetching trades for event:', error);
        setEventTrades([]);
      } finally {
        setIsLoadingTrades(false);
        hasInitialLoad.current = true;
      }
    };

    fetchEventTrades();
  }, [open, calendarId, event.event_name, event.currency, event.impact]);

  // Load cached AI analysis when trades are loaded
  useEffect(() => {
    if (!open) return; // Don't check cache if dialog is closed (prevent clearing on close)
    if (!calendarId || !event.id) return;
    if (isLoadingTrades) return; // Don't check while loading
    if (!hasInitialLoad.current) return; // Don't check before initial load completes
    const cleanedName = cleanEventNameForPinning(event.event_name);
    const cacheKey = `ai_analysis_${calendarId}_${cleanedName}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        // timestamp check removed as per user request
        // const now = Date.now();
        const tradeCount = eventTrades.length;

        // Check if trade count matches (to ensure analysis is fresh for current data)
        if (parsed.tradeCount === tradeCount) {
          setAiAnalysis(parsed.analysis);
          setAiAnalysisExpanded(true);
        } else {
          // Cache invalid
          localStorage.removeItem(cacheKey);
          setAiAnalysis('');
        }
      } catch (e) {
        console.error('Error parsing cached AI analysis', e);
        localStorage.removeItem(cacheKey);
        setAiAnalysis('');
      }
    } else {
      setAiAnalysis('');
    }
  }, [calendarId, event.id, eventTrades.length, open, isLoadingTrades]); // Depend on trade count to invalidate/reload

  // Check if event is pinned and get pinned event data
  const pinnedEventData = useMemo(() => {
    if (!calendar || !('pinned_events' in calendar) || !calendar.pinned_events) {
      return null;
    }

    // First try to match by event_id (exact match), then fallback to name matching
    return calendar.pinned_events.find(pe =>
      pe.event_id ? pe.event_id === event.id : eventMatchV1(event, pe)
    ) || null;
  }, [calendar, event.id, event.event_name]);

  const isPinned = !!pinnedEventData;

  // Initialize notes text when pinned event data changes
  useEffect(() => {
    const notes = pinnedEventData?.notes || '';
    setNotesText(notes);
    initialNotesRef.current = notes;
  }, [pinnedEventData]);

  // Handle pin/unpin with progress indicator
  const handleTogglePin = async () => {
    if (!calendar || !('id' in calendar) || !('pinned_events' in calendar) || !calendarId || !onUpdateCalendarProperty) {
      return;
    }

    const cleanedEventName = cleanEventNameForPinning(event.event_name);

    try {
      setPinning(true);
      await onUpdateCalendarProperty(calendarId, (cal: Calendar) => {
        const currentPinned = cal.pinned_events || [];

        if (isPinned) {
          // Unpin - use event_id for exact matching if available
          return {
            ...cal,
            pinned_events: currentPinned.filter(pe =>
              pe.event_id ? pe.event_id !== event.id : !eventMatchV1(event, pe)
            )
          };
        } else {
          // Pin - include event_id, flag_url, and country
          return {
            ...cal,
            pinned_events: [...currentPinned, {
              event: cleanedEventName,
              event_id: event.id,
              notes: '',
              impact: event.impact,
              currency: event.currency,
              flag_url: event.flag_url,
              country: event.country
            }]
          };
        }
      });
    } finally {
      setPinning(false);
    }
  };

  // Check if notes have been modified
  const hasNotesChanged = notesText !== initialNotesRef.current;

  // Save notes to calendar (only called on close if changed)
  const saveNotesIfChanged = async () => {
    if (!hasNotesChanged || !calendar || !('id' in calendar) || !('pinned_events' in calendar) || !calendarId || !onUpdateCalendarProperty || !isPinned) {
      return;
    }

    await onUpdateCalendarProperty(calendarId, (cal: Calendar) => {
      const currentPinned = cal.pinned_events || [];
      const existingIndex = currentPinned.findIndex(pe =>
        pe.event_id ? pe.event_id === event.id : eventMatchV1(event, pe)
      );

      if (existingIndex >= 0) {
        const updated = [...currentPinned];
        updated[existingIndex] = {
          ...updated[existingIndex],
          notes: notesText.trim() || undefined
        };
        return {
          ...cal,
          pinned_events: updated
        };
      }

      return cal;
    });
  };

  // Handle dialog close - save notes if changed
  const handleClose = async () => {
    await saveNotesIfChanged();
    onClose();
  };

  // Handle notes change (local state only, no save)
  const handleNotesChange = (newNotes: string) => {
    // Limit to 250 characters
    setNotesText(newNotes.slice(0, 250));
  };

  // Handle gallery mode for event trades
  const handleEventGalleryMode = async () => {
    if (onOpenGalleryMode && eventTrades.length > 0) {
      await saveNotesIfChanged();
      const title = `${event.event_name} - All Trades (${eventTrades.length} trades)`;
      onOpenGalleryMode(eventTrades, eventTrades[0].id, title);
      onClose();
    }
  };

  // Get impact color
  const getImpactColor = (impact: string) => {
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

  // Compute event trade stats
  const stats = useMemo(() => {
    const total = eventTrades.length;
    const wins = eventTrades.filter(t => t.trade_type === 'win').length;
    const losses = eventTrades.filter(t => t.trade_type === 'loss').length;
    const breakevens = eventTrades.filter(t => t.trade_type === 'breakeven').length;
    const denom = wins + losses;
    const win_rate = denom > 0 ? Math.round((wins / denom) * 100) : 0;
    return { total, wins, losses, breakevens, win_rate };
  }, [eventTrades]);

  // Handle Ask AI
  const handleAskAI = async () => {
    // Check if API key exists
    if (!hasApiKey()) {
      setApiKeySettingsOpen(true);
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('User not authenticated');
      }

      const prompt = `
Analyze the economic event: ${event.event_name} for ${event.currency} with ${event.impact} impact.
Please answer:
1. What does this event mean?
2. How does it usually affect ${event.currency} trades?
3. Based on my trading history below, should I trade during this event?

My Trading History for this event:
- Total Trades: ${stats.total}
- Win Rate: ${stats.win_rate}%
- Wins: ${stats.wins}
- Losses: ${stats.losses}
- Breakeven: ${stats.breakevens}

Data for your analysis. Analyze the trade's images, tags, etc to get deep understanding. (DO NOT list these trade IDs or any <trade-ref> tags in your response, just use them to analyze my performance):
${eventTrades.map(t => `- ${t.id}`).join('\n')}
      `.trim();

      const response = await supabaseAIChatService.sendMessage(
        prompt,
        session.user.id,
        calendar as Calendar, // Cast if calendar is available, though it might be Partial
        [], // No conversation history context needed for this one-shot query
      );

      if (response.success) {
        setAiAnalysis(response.message);
        setAiAnalysisExpanded(true);

        // Cache the successful response
        try {
          const cleanedName = cleanEventNameForPinning(event.event_name);
          const cacheKey = `ai_analysis_${calendarId}_${cleanedName}`;
          const cacheData = {
            // timestamp: Date.now(), // No longer needed
            tradeCount: stats.total, // Use stats.total which comes from eventTrades.length
            analysis: response.message
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
          console.error('Failed to cache AI analysis', e);
        }

      } else {
        setAiAnalysis('Failed to get analysis. Please try again.');
      }
    } catch (error) {
      console.error('Error asking AI:', error);

      // If error is about API key (e.g. from backend), prompt for it
      if (error instanceof Error && error.message.includes('API key')) {
        setApiKeySettingsOpen(true);
      }

      setAiAnalysis('An error occurred while analyzing the event. Please check your API key settings.');
    } finally {
      setIsAnalyzing(false);
    }
  };


  // Dialog actions with gallery mode button
  const dialogActions = onOpenGalleryMode && eventTrades.length > 0 && !isReadOnly ? (
    <Button
      onClick={handleEventGalleryMode}
      variant="contained"
      size="large"
      startIcon={<GalleryIcon />}
      sx={{
        textTransform: 'none',
        fontWeight: 600,
        borderRadius: 1.5,
        px: 3
      }}
    >
      Gallery View
    </Button>
  ) : undefined;

  return (
    <>
      <BaseDialog
        open={open}
        onClose={handleClose}
        sx={{
          zIndex: Z_INDEX.ECONOMIC_CALENDAR_DETAIL
        }}
        title={
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
            {event.flag_url && (
              <img
                src={event.flag_url}
                alt={event.currency}
                style={{
                  width: 24,
                  height: 18,
                  borderRadius: 3,
                  objectFit: 'cover'
                }}
              />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {event.event_name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label={event.currency}
                size="small"
                sx={{
                  height: 24,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main'
                }}
              />
              <Chip
                label={event.impact}
                size="small"
                sx={{
                  height: 24,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  backgroundColor: alpha(getImpactColor(event.impact), 0.1),
                  color: getImpactColor(event.impact)
                }}
              />
              {calendar && 'pinned_events' in calendar && onUpdateCalendarProperty && !isReadOnly && (
                <Tooltip title={isPinned ? "Unpin event" : "Pin event"}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={pinning ? undefined : handleTogglePin}
                      disabled={pinning}
                      sx={{
                        color: isPinned ? 'warning.main' : 'text.secondary',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.warning.main, 0.1)
                        },
                        '&.Mui-disabled': {
                          color: 'text.disabled'
                        }
                      }}
                    >
                      {pinning ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        isPinned ? <PinIcon sx={{ fontSize: 20 }} /> : <PinOutlinedIcon sx={{ fontSize: 20 }} />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          </Box>
        }
        maxWidth="sm"
        fullWidth
        actions={dialogActions}
        hideFooterCancelButton
      >
        <Box>
          {/* Stats Section with Ask AI Button */}
          <Box sx={{
            mb: 3,
            mt: 3,
            p: 2,
            borderRadius: 2,
            backgroundColor: alpha(theme.palette.background.paper, 0.5),
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            position: 'relative' // For Ask AI button positioning if needed
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.secondary' }}>
                Stats
              </Typography>
              {!aiAnalysis && (
                <Button
                  variant="text"
                  size="small"
                  startIcon={isAnalyzing ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                  onClick={handleAskAI}
                  disabled={isAnalyzing}
                  sx={{
                    fontSize: '0.75rem',
                    color: theme.palette.primary.main,
                    textTransform: 'none',
                    minWidth: 'auto',
                    padding: '4px 8px'
                  }}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Ask AI'}
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' }, gap: 1.25 }}>
              <Box sx={{ p: 1.25, borderRadius: 1, backgroundColor: alpha(theme.palette.background.paper, 0.3), border: `1px solid ${alpha(theme.palette.divider, 0.15)}` }}>
                <Typography variant="caption" color="text.secondary">Total Trades</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{stats.total}</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1, backgroundColor: alpha(theme.palette.success.main, 0.06), border: `1px solid ${alpha(theme.palette.success.main, 0.15)}` }}>
                <Typography variant="caption" color="text.secondary">Wins</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.main' }}>{stats.wins}</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1, backgroundColor: alpha(theme.palette.error.main, 0.06), border: `1px solid ${alpha(theme.palette.error.main, 0.15)}` }}>
                <Typography variant="caption" color="text.secondary">Losses</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'error.main' }}>{stats.losses}</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1, backgroundColor: alpha(theme.palette.warning.main, 0.06), border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}` }}>
                <Typography variant="caption" color="text.secondary">Breakeven</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'warning.main' }}>{stats.breakevens}</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1, backgroundColor: alpha(theme.palette.primary.main, 0.06), border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                <Typography variant="caption" color="text.secondary">Win Rate</Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main' }}>{`${stats.win_rate}%`}</Typography>
              </Box>
            </Box>
          </Box>

          {/* AI Analysis Result */}
          {aiAnalysis && (
            <Box sx={{
              mb: 3,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              overflow: 'hidden'
            }}>
              <Box
                onClick={() => setAiAnalysisExpanded(!aiAnalysisExpanded)}
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08)
                  }
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                  AI Analysis
                </Typography>
                <IconButton size="small" sx={{ color: 'primary.main' }}>
                  {aiAnalysisExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>

              <Collapse in={aiAnalysisExpanded}>
                <Box sx={{
                  p: 2,
                  pt: 0,
                  typography: 'body2',
                  '& p': { mb: 1, '&:last-child': { mb: 0 } },
                  '& ul, & ol': { pl: 2, mb: 1, mt: 0 },
                  '& li': { mb: 0.5 }
                }}>
                  <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                </Box>
              </Collapse>
            </Box>
          )}

          {/* Notes Section - Only visible when pinned */}
          {isPinned && (
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Add notes about this event (max 250 characters)..."
                value={notesText}
                onChange={(e) => handleNotesChange(e.target.value)}
                disabled={isReadOnly}
                slotProps={{
                  input: {
                    sx: {
                      backgroundColor: alpha(theme.palette.warning.main, 0.05),
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.warning.main, 0.08)
                      },
                      '&.Mui-focused': {
                        backgroundColor: alpha(theme.palette.warning.main, 0.08)
                      }
                    }
                  }
                }}
                helperText={`${notesText.length}/250 characters${hasNotesChanged ? ' • Unsaved changes (saves on close)' : ''}`}
              />
            </Box>
          )}

          {/* Trades List */}
          <Box>
            {isLoadingTrades ? (
              // Show shimmer loading state while fetching trades
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[1, 2, 3].map((index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      backgroundColor: alpha(theme.palette.background.paper, 0.3),
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    {/* Trade header shimmer */}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Shimmer width={60} height={24} borderRadius={4} intensity="medium" />
                      <Shimmer width={80} height={24} borderRadius={4} intensity="medium" />
                      <Box sx={{ flex: 1 }} />
                      <Shimmer width={70} height={28} borderRadius={4} intensity="high" />
                    </Box>
                    {/* Trade details shimmer */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Shimmer width="40%" height={20} borderRadius={4} intensity="low" />
                      <Shimmer width="30%" height={20} borderRadius={4} intensity="low" />
                    </Box>
                    {/* Trade amount shimmer */}
                    <Shimmer width="25%" height={20} borderRadius={4} intensity="low" />
                  </Box>
                ))}
              </Box>
            ) : eventTrades.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 3,
                  backgroundColor: alpha(theme.palette.background.paper, 0.3),
                  borderRadius: 1,
                  border: `1px dashed ${alpha(theme.palette.divider, 0.3)}`
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No trades found for this event
                </Typography>
              </Box>
            ) : (
              <TradeList
                trades={eventTrades}
                expandedTradeId={expandedTradeId}
                onTradeClick={(id) => setExpandedTradeId(prev => prev === id ? null : id)}
                hideActions={isReadOnly}
                tradeOperations={tradeOperations}
              />
            )}
          </Box>
        </Box>
      </BaseDialog>

      {/* API Key Settings Dialog */}
      <ApiKeySettingsDialog
        open={apiKeySettingsOpen}
        onClose={() => setApiKeySettingsOpen(false)}
      />
    </>
  );
};

export default EconomicEventDetailDialog;


