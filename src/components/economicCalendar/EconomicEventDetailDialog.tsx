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
import { BaseDialog } from '../common';
import TradeList from '../trades/TradeList';
import { cleanEventNameForPinning, eventMatchV1 } from '../../utils/eventNameUtils';
import { useUserPinnedEvents } from '../../contexts/UserPinnedEventsContext';
import { useAuthState } from '../../contexts/AuthStateContext';
import { useCalendars } from '../../hooks/useCalendars';
import { getSessionForTimestamp, SESSION_COLORS } from '../../utils/sessionTimeUtils';
import { TradeOperationsProps } from '../../types/tradeOperations';
import { Z_INDEX } from '../../styles/zIndex';
import Shimmer from '../Shimmer';
import { supabaseAIChatService } from '../../services/supabaseAIChatService';
import { supabase } from '../../config/supabase';

interface EconomicEventDetailDialogProps {
  open: boolean;
  onClose: () => void;
  event: EconomicEvent;
  /**
   * Calendar context for trade fetching + per-calendar AI analysis. Optional
   * because the user-scoped Events page surfaces this dialog without binding
   * to any one calendar. Pin/notes still work — they live on the user.
   */
  calendarId?: string;
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
  } = tradeOperations;
  const theme = useTheme();
  const { user } = useAuthState();
  const userId = user?.id ?? null;
  // Cross-calendar mode: load calendars once so the trade list can show a
  // small calendar-name chip per trade. SWR-cached, so the list will reuse
  // the result if other surfaces already loaded it.
  const isCrossCalendar = !calendarId && !!userId;
  const { calendars: userCalendars } = useCalendars(
    isCrossCalendar ? userId ?? undefined : undefined
  );
  const calendarsById = useMemo(() => {
    if (!isCrossCalendar || !userCalendars) return undefined;
    const map = new Map<string, typeof userCalendars[number]>();
    for (const c of userCalendars) map.set(c.id, c);
    return map;
  }, [isCrossCalendar, userCalendars]);
  const {
    pins: userPins,
    pin: userPin,
    unpin: userUnpin,
    updateNotes: userUpdateNotes,
    pinningEventId,
  } = useUserPinnedEvents();
  const [expandedTradeId, setExpandedTradeId] = React.useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const initialNotesRef = useRef<string>('');
  const pinning = pinningEventId === event.id;

  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiAnalysisExpanded, setAiAnalysisExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // State for event trades
  const [eventTrades, setEventTrades] = useState<Trade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const hasInitialLoad = useRef(false);

  // Determine which trading session this event falls under
  const eventSession = useMemo(
    () => event.is_all_day ? null : getSessionForTimestamp(event.time_utc),
    [event.time_utc, event.is_all_day]
  );

  // Fetch trades for this event when dialog opens. Prefers calendar-scoped
  // fetch when a calendarId is provided; falls back to a user-scoped query
  // (across all the user's calendars) for the user-level Events page.
  useEffect(() => {
    const fetchEventTrades = async () => {
      if (!open || (!calendarId && !userId)) {
        setEventTrades([]);
        return;
      }

      setIsLoadingTrades(true);
      hasInitialLoad.current = false;
      try {
        const calendarServiceModule = await import('../../services/calendarService');
        const cleanedName = cleanEventNameForPinning(event.event_name);
        const repo = calendarServiceModule.getTradeRepository();

        const trades = calendarId
          ? await repo.fetchTradesByEvent(
              calendarId,
              cleanedName,
              event.currency,
              event.impact,
              eventSession ?? undefined
            )
          : await repo.fetchUserTradesByEvent(
              userId as string,
              cleanedName,
              event.currency,
              event.impact,
              eventSession ?? undefined
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
  }, [open, calendarId, userId, event.event_name, event.currency, event.impact, eventSession]);

  // Load cached AI analysis when trades are loaded
  useEffect(() => {
    if (!open) return; // Don't check cache if dialog is closed (prevent clearing on close)
    if ((!calendarId && !userId) || !event.id) return;
    if (isLoadingTrades) return; // Don't check while loading
    if (!hasInitialLoad.current) return; // Don't check before initial load completes
    const cleanedName = cleanEventNameForPinning(event.event_name);
    const scope = calendarId ?? `user_${userId}`;
    const cacheKey = `ai_analysis_${scope}_${cleanedName}`;
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
          setAiAnalysisExpanded(false);
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
  }, [calendarId, userId, event.id, eventTrades.length, open, isLoadingTrades]); // Depend on trade count to invalidate/reload

  // Check if event is pinned and get pinned event data (user-level)
  const pinnedEventData = useMemo(() => {
    return userPins.find(pe =>
      pe.event_id ? pe.event_id === event.id : eventMatchV1(event, pe)
    ) || null;
  }, [userPins, event]);

  const isPinned = !!pinnedEventData;

  // Initialize notes text when pinned event data changes
  useEffect(() => {
    const notes = pinnedEventData?.notes || '';
    setNotesText(notes);
    initialNotesRef.current = notes;
  }, [pinnedEventData]);

  // Handle pin/unpin via user-level context.
  const handleTogglePin = async () => {
    if (isPinned) {
      await userUnpin(event);
    } else {
      await userPin(event);
    }
  };

  // Check if notes have been modified
  const hasNotesChanged = notesText !== initialNotesRef.current;

  // Save notes through user-level context (only when pinned and changed).
  const saveNotesIfChanged = async () => {
    if (!hasNotesChanged || !isPinned) return;
    await userUpdateNotes(event.id, notesText.trim());
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
        undefined, // No calendar context — pinning + AI now run user-scoped
        [], // No conversation history context needed for this one-shot query
      );

      if (response.success) {
        setAiAnalysis(response.message);
        setAiAnalysisExpanded(true);

        // Cache the successful response
        try {
          const cleanedName = cleanEventNameForPinning(event.event_name);
          const scope = calendarId ?? `user_${userId}`;
          const cacheKey = `ai_analysis_${scope}_${cleanedName}`;
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
      setAiAnalysis('An error occurred while analyzing the event. Please try again.');
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
              {eventSession && (
                <Chip
                  label={eventSession}
                  size="small"
                  sx={{
                    height: 24,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    backgroundColor: alpha(
                      SESSION_COLORS[eventSession] || theme.palette.info.main,
                      0.1
                    ),
                    color: SESSION_COLORS[eventSession] || theme.palette.info.main
                  }}
                />
              )}
              {!isReadOnly && (
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
            backgroundColor: theme.palette.background.paper,
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
              <Box sx={{ p: 1.25, borderRadius: 1, backgroundColor: theme.palette.background.paper, border: `1px solid ${alpha(theme.palette.divider, 0.15)}` }}>
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
                      backgroundColor: theme.palette.background.paper,
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
                  backgroundColor: theme.palette.background.paper,
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
                calendarsById={calendarsById}
                tradeOperations={tradeOperations}
              />
            )}
          </Box>
        </Box>
      </BaseDialog>

    </>
  );
};

export default EconomicEventDetailDialog;


