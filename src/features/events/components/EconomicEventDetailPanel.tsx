/**
 * Cross-calendar variant of EconomicEventDetailDialog rendered as a side
 * panel (no BaseDialog chrome). Designed for the user-level Events page
 * where the SidePanelProvider supplies the panel header. Pin/notes are
 * user-scoped; trades come from the user-level cross-calendar query.
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
  Collapse,
} from '@mui/material';
import {
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  ViewCarousel as GalleryIcon,
  AutoAwesome as AutoAwesomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { EconomicEvent } from 'features/events/types/economicCalendar';
import { Trade, Calendar } from 'features/calendar/types/dualWrite';
import TradeList from 'features/calendar/components/trades/TradeList';
import { cleanEventNameForPinning, eventMatchV1 } from 'features/events/utils/eventNameUtils';
import { useUserPinnedEvents } from 'features/events/contexts/UserPinnedEventsContext';
import { useAuthState } from 'contexts/AuthStateContext';
import { useCalendars } from 'features/calendar/hooks/useCalendars';
import { getSessionForTimestamp, SESSION_COLORS } from 'utils/sessionTimeUtils';
import { TradeOperationsProps } from 'features/calendar/types/tradeOperations';
import Shimmer from 'components/Shimmer';
import { supabaseAIChatService } from 'features/orion/services/supabaseAIChatService';
import { supabase } from 'config/supabase';
import { EYEBROW_SX, TNUM, MONO_FONT, getInsetTileSx } from 'styles/designTokens';

interface EconomicEventDetailPanelProps {
  event: EconomicEvent;
  tradeOperations: TradeOperationsProps;
  isReadOnly?: boolean;
}

const EconomicEventDetailPanel: React.FC<EconomicEventDetailPanelProps> = ({
  event,
  tradeOperations,
  isReadOnly = false,
}) => {
  const { onOpenGalleryMode } = tradeOperations;
  const theme = useTheme();
  const { user } = useAuthState();
  const userId = user?.id ?? null;

  const { calendars: userCalendars } = useCalendars(userId ?? undefined);
  const calendarsById = useMemo(() => {
    if (!userCalendars) return undefined;
    const map = new Map<string, Calendar>();
    for (const c of userCalendars) map.set(c.id, c);
    return map;
  }, [userCalendars]);

  const {
    pins: userPins,
    pin: userPin,
    unpin: userUnpin,
    updateNotes: userUpdateNotes,
    pinningEventId,
  } = useUserPinnedEvents();

  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const initialNotesRef = useRef<string>('');
  const pinning = pinningEventId === event.id;

  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiAnalysisExpanded, setAiAnalysisExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [eventTrades, setEventTrades] = useState<Trade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const hasInitialLoad = useRef(false);

  const eventSession = useMemo(
    () => (event.is_all_day ? null : getSessionForTimestamp(event.time_utc)),
    [event.time_utc, event.is_all_day]
  );

  // Cross-calendar trade fetch — filters by user_id, JSONB containment.
  useEffect(() => {
    const fetchEventTrades = async () => {
      if (!userId) {
        setEventTrades([]);
        return;
      }
      setIsLoadingTrades(true);
      hasInitialLoad.current = false;
      try {
        const calendarServiceModule = await import('features/calendar/services/calendarService');
        const cleanedName = cleanEventNameForPinning(event.event_name);
        const trades = await calendarServiceModule
          .getTradeRepository()
          .fetchUserTradesByEvent(
            userId,
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
  }, [userId, event.event_name, event.currency, event.impact, eventSession]);

  // AI analysis cache — user-scoped key.
  useEffect(() => {
    if (!userId || !event.id) return;
    if (isLoadingTrades) return;
    if (!hasInitialLoad.current) return;
    const cleanedName = cleanEventNameForPinning(event.event_name);
    const cacheKey = `ai_analysis_user_${userId}_${cleanedName}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.tradeCount === eventTrades.length) {
          setAiAnalysis(parsed.analysis);
          setAiAnalysisExpanded(false);
        } else {
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
  }, [userId, event.id, event.event_name, eventTrades.length, isLoadingTrades]);

  const pinnedEventData = useMemo(
    () =>
      userPins.find((pe) =>
        pe.event_id ? pe.event_id === event.id : eventMatchV1(event, pe)
      ) || null,
    [userPins, event]
  );
  const isPinned = !!pinnedEventData;

  useEffect(() => {
    const notes = pinnedEventData?.notes || '';
    setNotesText(notes);
    initialNotesRef.current = notes;
  }, [pinnedEventData]);

  const handleTogglePin = async () => {
    if (isPinned) await userUnpin(event);
    else await userPin(event);
  };

  const hasNotesChanged = notesText !== initialNotesRef.current;

  const saveNotesIfChanged = async () => {
    if (!hasNotesChanged || !isPinned) return;
    await userUpdateNotes(event.id, notesText.trim());
  };

  // Save notes when the event under view changes — captures unsaved edits
  // before the panel swaps to a different event.
  const eventIdRef = useRef(event.id);
  useEffect(() => {
    if (eventIdRef.current !== event.id) {
      void saveNotesIfChanged();
      eventIdRef.current = event.id;
    }
  }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on unmount too (panel close).
  useEffect(() => {
    return () => {
      void saveNotesIfChanged();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNotesChange = (newNotes: string) => {
    setNotesText(newNotes.slice(0, 250));
  };

  const handleEventGalleryMode = async () => {
    if (onOpenGalleryMode && eventTrades.length > 0) {
      await saveNotesIfChanged();
      const title = `${event.event_name} - All Trades (${eventTrades.length} trades)`;
      onOpenGalleryMode(eventTrades, eventTrades[0].id, title);
    }
  };

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

  const stats = useMemo(() => {
    const total = eventTrades.length;
    const wins = eventTrades.filter((t) => t.trade_type === 'win').length;
    const losses = eventTrades.filter((t) => t.trade_type === 'loss').length;
    const breakevens = eventTrades.filter((t) => t.trade_type === 'breakeven').length;
    const denom = wins + losses;
    const win_rate = denom > 0 ? Math.round((wins / denom) * 100) : 0;
    return { total, wins, losses, breakevens, win_rate };
  }, [eventTrades]);

  const handleAskAI = async () => {
    setIsAnalyzing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('User not authenticated');

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
${eventTrades.map((t) => `- ${t.id}`).join('\n')}
      `.trim();

      const response = await supabaseAIChatService.sendMessage(
        prompt,
        session.user.id,
        undefined,
        []
      );

      if (response.success) {
        setAiAnalysis(response.message);
        setAiAnalysisExpanded(true);
        try {
          const cleanedName = cleanEventNameForPinning(event.event_name);
          const cacheKey = `ai_analysis_user_${userId}_${cleanedName}`;
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ tradeCount: stats.total, analysis: response.message })
          );
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Sub-header — flag, name, currency/impact/session chips, pin */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
          {event.flag_url && (
            <img
              src={event.flag_url}
              alt={event.currency}
              style={{ width: 24, height: 18, borderRadius: 3, objectFit: 'cover', marginTop: 4 }}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '1rem', lineHeight: 1.3 }}>
              {event.event_name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
              <Chip
                label={event.currency}
                size="small"
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                }}
              />
              <Chip
                label={event.impact}
                size="small"
                sx={{
                  height: 22,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  backgroundColor: alpha(getImpactColor(event.impact), 0.1),
                  color: getImpactColor(event.impact),
                }}
              />
              {eventSession && (
                <Chip
                  label={eventSession}
                  size="small"
                  sx={{
                    height: 22,
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    backgroundColor: alpha(
                      SESSION_COLORS[eventSession] || theme.palette.info.main,
                      0.1
                    ),
                    color: SESSION_COLORS[eventSession] || theme.palette.info.main,
                  }}
                />
              )}
            </Box>
          </Box>
          {!isReadOnly && (
            <Tooltip title={isPinned ? 'Unpin event' : 'Pin event'}>
              <span>
                <IconButton
                  size="small"
                  onClick={pinning ? undefined : handleTogglePin}
                  disabled={pinning}
                  sx={{
                    color: isPinned ? 'warning.main' : 'text.secondary',
                    '&:hover': { backgroundColor: alpha(theme.palette.warning.main, 0.1) },
                  }}
                >
                  {pinning ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : isPinned ? (
                    <PinIcon sx={{ fontSize: 20 }} />
                  ) : (
                    <PinOutlinedIcon sx={{ fontSize: 20 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Scrollable body */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          px: 2,
          py: 2,
        }}
      >
        {/* Stats + Ask AI */}
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'text.secondary' }}>
              Stats · all calendars
            </Typography>
            {!aiAnalysis && (
              <Button
                variant="text"
                size="small"
                startIcon={
                  isAnalyzing ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                  )
                }
                onClick={handleAskAI}
                disabled={isAnalyzing}
                sx={{ fontSize: '0.75rem', textTransform: 'none', minWidth: 'auto', padding: '4px 8px' }}
              >
                {isAnalyzing ? 'Analyzing...' : 'Ask AI'}
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' }, gap: 1 }}>
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Wins" value={stats.wins} color="success.main" />
            <StatCard label="Losses" value={stats.losses} color="error.main" />
            <StatCard label="Breakeven" value={stats.breakevens} color="warning.main" />
            <StatCard label="Win Rate" value={`${stats.win_rate}%`} color="primary.main" />
          </Box>
        </Box>

        {/* AI analysis */}
        {aiAnalysis && (
          <Box
            sx={{
              mb: 2,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              overflow: 'hidden',
            }}
          >
            <Box
              onClick={() => setAiAnalysisExpanded(!aiAnalysisExpanded)}
              sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                AI Analysis
              </Typography>
              <IconButton size="small" sx={{ color: 'primary.main' }}>
                {aiAnalysisExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={aiAnalysisExpanded}>
              <Box
                sx={{
                  p: 1.5,
                  pt: 0,
                  typography: 'body2',
                  '& p': { mb: 1, '&:last-child': { mb: 0 } },
                  '& ul, & ol': { pl: 2, mb: 1, mt: 0 },
                  '& li': { mb: 0.5 },
                }}
              >
                <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Notes — only visible when pinned */}
        {isPinned && (
          <Box sx={{ mb: 2 }}>
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
                    '&:hover': { backgroundColor: alpha(theme.palette.warning.main, 0.08) },
                    '&.Mui-focused': { backgroundColor: alpha(theme.palette.warning.main, 0.08) },
                  },
                },
              }}
              helperText={`${notesText.length}/250 characters${
                hasNotesChanged ? ' • Unsaved changes (saves on close)' : ''
              }`}
            />
          </Box>
        )}

        {/* Trades */}
        <Box>
          {isLoadingTrades ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[1, 2, 3].map((i) => (
                <Box
                  key={i}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    backgroundColor: theme.palette.background.paper,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Shimmer width={60} height={24} borderRadius={4} intensity="medium" />
                    <Shimmer width={80} height={24} borderRadius={4} intensity="medium" />
                    <Box sx={{ flex: 1 }} />
                    <Shimmer width={70} height={28} borderRadius={4} intensity="high" />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Shimmer width="40%" height={20} borderRadius={4} intensity="low" />
                    <Shimmer width="30%" height={20} borderRadius={4} intensity="low" />
                  </Box>
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
                border: `1px dashed ${alpha(theme.palette.divider, 0.3)}`,
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
              onTradeClick={(id) => setExpandedTradeId((prev) => (prev === id ? null : id))}
              hideActions={isReadOnly || !tradeOperations.onEditTrade}
              calendarsById={calendarsById}
              tradeOperations={tradeOperations}
            />
          )}
        </Box>
      </Box>

      {/* Sticky footer — gallery view */}
      {onOpenGalleryMode && eventTrades.length > 0 && !isReadOnly && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            flexShrink: 0,
          }}
        >
          <Button
            onClick={handleEventGalleryMode}
            variant="contained"
            fullWidth
            startIcon={<GalleryIcon />}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
          >
            Gallery View
          </Button>
        </Box>
      )}
    </Box>
  );
};

const StatCard: React.FC<{
  label: string;
  value: number | string;
  color?: string;
}> = ({ label, value, color }) => {
  const theme = useTheme();
  return (
    <Box sx={{ ...getInsetTileSx(theme), display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Typography sx={EYEBROW_SX}>{label}</Typography>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: '1.1rem',
          color: color ?? 'text.primary',
          fontFamily: MONO_FONT,
          fontFeatureSettings: TNUM,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

export default EconomicEventDetailPanel;
