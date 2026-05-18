/**
 * Economic Event Detail Dialog
 * Viewer dialog for a single economic event — metadata, history, AI insights,
 * related trades.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
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
  ExpandLess as ExpandLessIcon,
  EventOutlined,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { EconomicEvent } from '../types/economicCalendar';
import { Trade } from 'types/dualWrite';
import { BaseDialog } from 'components/common';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';
import TradeList from 'components/trades/TradeList';
import { cleanEventNameForPinning, eventMatchV1 } from '../utils/eventNameUtils';
import { useUserPinnedEvents } from '../contexts/UserPinnedEventsContext';
import { useAuthState } from 'contexts/AuthStateContext';
import { useCalendars } from 'hooks/useCalendars';
import { getSessionForTimestamp, SESSION_COLORS } from 'utils/sessionTimeUtils';
import { TradeOperationsProps } from 'types/tradeOperations';
import { Z_INDEX } from 'styles/zIndex';
import Shimmer from 'components/Shimmer';
import { supabaseAIChatService } from 'features/orion/services/supabaseAIChatService';
import { supabase } from 'config/supabase';

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
  const {
    isDark,
    violet,
    violetSoft,
    violetSofter,
    violetBorder,
    surfaceInset,
    hairline,
    monoLabelSx,
  } = useDialogTokens();
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

  // ── design tokens (additional local) ──────────────────────────────────
  const surfaceInsetHover = isDark ? 'rgba(255,255,255,0.06)' : alpha(theme.palette.text.primary, 0.05);

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
        const calendarServiceModule = await import('services/calendarService');
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
  }, [calendarId, userId, event.id, eventTrades.length, open, isLoadingTrades]);

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

  const impactColor = getImpactColor(event.impact);

  // Format event time for subtitle (e.g. "USD · High impact · 14:30 · London")
  const formattedTime = useMemo(() => {
    if (event.is_all_day) return 'All day';
    try {
      return new Date(event.time_utc).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [event.time_utc, event.is_all_day]);

  const formattedDate = useMemo(() => {
    try {
      return new Date(event.time_utc).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }, [event.time_utc]);

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
            tradeCount: stats.total,
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

  // ── header title row ──────────────────────────────────────────────────
  const dialogTitle = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0 }}>
      {event.flag_url && (
        <img
          src={event.flag_url}
          alt={event.currency}
          style={{
            width: 22,
            height: 16,
            borderRadius: 3,
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '0.95rem',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.event_name}
        </Typography>
      </Box>
      {!isReadOnly && (
        <Tooltip title={isPinned ? 'Unpin event' : 'Pin event'}>
          <span>
            <IconButton
              size="small"
              onClick={pinning ? undefined : handleTogglePin}
              disabled={pinning}
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                color: isPinned ? theme.palette.warning.main : theme.palette.text.secondary,
                backgroundColor: isPinned
                  ? alpha(theme.palette.warning.main, isDark ? 0.16 : 0.12)
                  : 'transparent',
                border: `1px solid ${
                  isPinned
                    ? alpha(theme.palette.warning.main, isDark ? 0.4 : 0.3)
                    : hairline
                }`,
                '&:hover': {
                  backgroundColor: isPinned
                    ? alpha(theme.palette.warning.main, isDark ? 0.24 : 0.18)
                    : surfaceInsetHover,
                  color: isPinned ? theme.palette.warning.main : theme.palette.text.primary,
                },
                '&.Mui-disabled': {
                  color: theme.palette.text.disabled,
                  borderColor: hairline,
                },
              }}
            >
              {pinning ? (
                <CircularProgress size={14} thickness={5} color="inherit" />
              ) : isPinned ? (
                <PinIcon sx={{ fontSize: 16 }} />
              ) : (
                <PinOutlinedIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );

  // ── header subtitle row: meta chips (currency, impact, time, session) ──
  const subtitlePillSx = (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    px: 0.85,
    py: 0.2,
    borderRadius: 999,
    fontFamily: MONO_FONT,
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    color,
    backgroundColor: alpha(color, isDark ? 0.16 : 0.12),
    border: `1px solid ${alpha(color, isDark ? 0.4 : 0.3)}`,
    whiteSpace: 'nowrap' as const,
  });

  const dialogSubtitle = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.6,
        flexWrap: 'wrap',
        mt: 0.5,
      }}
    >
      <Box sx={subtitlePillSx(violet)}>{event.currency}</Box>
      <Box sx={subtitlePillSx(impactColor)}>
        <Box
          component="span"
          sx={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: impactColor,
          }}
        />
        {event.impact} impact
      </Box>
      {formattedDate && (
        <Typography
          sx={{
            fontFamily: MONO_FONT,
            fontSize: '0.7rem',
            color: theme.palette.text.secondary,
            fontWeight: 500,
          }}
        >
          {formattedDate}
          {formattedTime && ` · ${formattedTime}`}
        </Typography>
      )}
      {eventSession && (
        <Box sx={subtitlePillSx(SESSION_COLORS[eventSession] || theme.palette.info.main)}>
          {eventSession}
        </Box>
      )}
    </Box>
  );

  // ── footer actions ────────────────────────────────────────────────────
  const dialogActions = onOpenGalleryMode && eventTrades.length > 0 && !isReadOnly ? (
    <Button
      onClick={handleEventGalleryMode}
      variant="contained"
      startIcon={<GalleryIcon sx={{ fontSize: 16 }} />}
      sx={{
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.85rem',
        backgroundColor: violet,
        color: '#fff',
        borderRadius: 1.25,
        px: 1.75,
        py: 0.75,
        boxShadow: 'none',
        '&:hover': { backgroundColor: theme.palette.primary.dark, boxShadow: 'none' },
      }}
    >
      Gallery view
    </Button>
  ) : undefined;

  // ── stat tile (compact, JetBrains Mono numbers) ───────────────────────
  const StatTile: React.FC<{
    label: string;
    value: React.ReactNode;
    accent?: string;
  }> = ({ label, value, accent }) => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 1.25,
        borderRadius: 1.5,
        backgroundColor: surfaceInset,
        border: `1px solid ${hairline}`,
      }}
    >
      <Typography sx={{ ...monoLabelSx, fontSize: '0.6rem' }}>{label}</Typography>
      <Typography
        sx={{
          fontFamily: MONO_FONT,
          fontWeight: 700,
          fontSize: '1.05rem',
          letterSpacing: '-0.01em',
          color: accent || theme.palette.text.primary,
        }}
      >
        {value}
      </Typography>
    </Box>
  );

  // Whether the event has actual/forecast/previous values worth showing
  const hasReadings = !!(
    event.actual_value ||
    event.forecast_value ||
    event.previous_value
  );

  return (
    <BaseDialog
      open={open}
      onClose={handleClose}
      sx={{ zIndex: Z_INDEX.ECONOMIC_CALENDAR_DETAIL }}
      title={dialogTitle}
      subtitle={dialogSubtitle}
      headerIcon={<EventOutlined sx={{ fontSize: 18 }} />}
      maxWidth="sm"
      fullWidth
      actions={dialogActions}
      hideFooterCancelButton
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        {/* ── Description (if present) ─────────────────────────────── */}
        {event.description && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography sx={monoLabelSx}>About</Typography>
            <Box
              sx={{
                px: 1.5,
                py: 1.25,
                borderRadius: 1.5,
                border: `1px solid ${hairline}`,
                backgroundColor: surfaceInset,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: theme.palette.text.secondary,
                  lineHeight: 1.55,
                }}
              >
                {event.description}
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── Readings: Previous / Forecast / Actual ──────────────── */}
        {hasReadings && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography sx={monoLabelSx}>Readings</Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
              }}
            >
              <StatTile label="Previous" value={event.previous_value || '—'} />
              <StatTile label="Forecast" value={event.forecast_value || '—'} />
              <StatTile
                label="Actual"
                value={event.actual_value || '—'}
                accent={
                  event.actual_result_type === 'good'
                    ? theme.palette.success.main
                    : event.actual_result_type === 'bad'
                      ? theme.palette.error.main
                      : undefined
                }
              />
            </Box>
          </Box>
        )}

        {/* ── Trading performance + Ask AI ─────────────────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography sx={monoLabelSx}>Your performance</Typography>
            {!aiAnalysis && (
              <Button
                size="small"
                onClick={handleAskAI}
                disabled={isAnalyzing || stats.total === 0}
                startIcon={
                  isAnalyzing ? (
                    <CircularProgress size={12} thickness={5} sx={{ color: 'inherit' }} />
                  ) : (
                    <AutoAwesomeIcon sx={{ fontSize: 14 }} />
                  )
                }
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  color: violet,
                  backgroundColor: violetSofter,
                  border: `1px solid ${violetBorder}`,
                  borderRadius: 1,
                  px: 1.1,
                  py: 0.25,
                  minHeight: 0,
                  '&:hover': { backgroundColor: violetSoft },
                  '&.Mui-disabled': {
                    color: alpha(violet, 0.45),
                    borderColor: alpha(violet, 0.18),
                    backgroundColor: alpha(violet, 0.05),
                  },
                }}
              >
                {isAnalyzing ? 'Analyzing…' : 'Ask Orion'}
              </Button>
            )}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(5, 1fr)',
              },
              gap: 1,
            }}
          >
            <StatTile label="Trades" value={stats.total} />
            <StatTile
              label="Wins"
              value={stats.wins}
              accent={stats.wins > 0 ? theme.palette.success.main : undefined}
            />
            <StatTile
              label="Losses"
              value={stats.losses}
              accent={stats.losses > 0 ? theme.palette.error.main : undefined}
            />
            <StatTile
              label="Breakeven"
              value={stats.breakevens}
              accent={stats.breakevens > 0 ? theme.palette.warning.main : undefined}
            />
            <StatTile
              label="Win rate"
              value={`${stats.win_rate}%`}
              accent={
                stats.win_rate >= 50 && stats.total > 0
                  ? theme.palette.success.main
                  : stats.total > 0
                    ? theme.palette.error.main
                    : undefined
              }
            />
          </Box>
        </Box>

        {/* ── AI Analysis Result ───────────────────────────────────── */}
        {aiAnalysis && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 1.5,
              border: `1px solid ${violetBorder}`,
              backgroundColor: violetSofter,
              overflow: 'hidden',
            }}
          >
            <Box
              onClick={() => setAiAnalysisExpanded(!aiAnalysisExpanded)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                px: 1.5,
                py: 1,
                cursor: 'pointer',
                '&:hover': { backgroundColor: violetSoft },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <AutoAwesomeIcon sx={{ fontSize: 14, color: violet }} />
                <Typography sx={{ ...monoLabelSx, color: violet }}>
                  Orion analysis
                </Typography>
              </Box>
              <IconButton
                size="small"
                sx={{
                  width: 24,
                  height: 24,
                  color: violet,
                  '&:hover': { backgroundColor: alpha(violet, 0.2) },
                }}
              >
                {aiAnalysisExpanded ? (
                  <ExpandLessIcon sx={{ fontSize: 18 }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </Box>

            <Collapse in={aiAnalysisExpanded}>
              <Box
                sx={{
                  px: 1.5,
                  pb: 1.25,
                  pt: 0,
                  fontSize: '0.85rem',
                  lineHeight: 1.55,
                  color: theme.palette.text.primary,
                  '& p': { mb: 1, '&:last-child': { mb: 0 } },
                  '& ul, & ol': { pl: 2.25, mb: 1, mt: 0 },
                  '& li': { mb: 0.5 },
                  '& strong': { fontWeight: 700 },
                  '& code': {
                    fontFamily: MONO_FONT,
                    fontSize: '0.82em',
                    px: 0.5,
                    py: 0.1,
                    borderRadius: 0.5,
                    backgroundColor: alpha(violet, isDark ? 0.18 : 0.12),
                  },
                }}
              >
                <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
              </Box>
            </Collapse>
          </Box>
        )}

        {/* ── Notes (only when pinned) ─────────────────────────────── */}
        {isPinned && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Typography sx={monoLabelSx}>
                <PinIcon sx={{ fontSize: 13, color: theme.palette.warning.main }} />
                Pinned notes
              </Typography>
              <Typography
                sx={{
                  fontFamily: MONO_FONT,
                  fontSize: '0.68rem',
                  color: hasNotesChanged
                    ? theme.palette.warning.main
                    : alpha(theme.palette.text.secondary, 0.7),
                  fontWeight: 600,
                }}
              >
                {notesText.length}/250
                {hasNotesChanged && ' · unsaved'}
              </Typography>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Capture your read on this event (saves on close)…"
              value={notesText}
              onChange={(e) => handleNotesChange(e.target.value)}
              disabled={isReadOnly}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  backgroundColor: surfaceInset,
                  '& fieldset': { borderColor: hairline },
                  '&:hover fieldset': { borderColor: alpha(violet, 0.5) },
                  '&.Mui-focused fieldset': { borderColor: violet, borderWidth: 1 },
                },
                '& .MuiOutlinedInput-input': {
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                },
              }}
            />
          </Box>
        )}

        {/* ── Related trades ───────────────────────────────────────── */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography sx={monoLabelSx}>
            Related trades
            {!isLoadingTrades && eventTrades.length > 0 && (
              <Box
                component="span"
                sx={{
                  ml: 0.5,
                  fontFamily: MONO_FONT,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                }}
              >
                · {eventTrades.length}
              </Box>
            )}
          </Typography>

          {isLoadingTrades ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[1, 2, 3].map((index) => (
                <Box
                  key={index}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: `1px solid ${hairline}`,
                    backgroundColor: surfaceInset,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Shimmer width={60} height={20} borderRadius={4} intensity="medium" />
                    <Shimmer width={80} height={20} borderRadius={4} intensity="medium" />
                    <Box sx={{ flex: 1 }} />
                    <Shimmer width={70} height={24} borderRadius={4} intensity="high" />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Shimmer width="40%" height={16} borderRadius={4} intensity="low" />
                    <Shimmer width="30%" height={16} borderRadius={4} intensity="low" />
                  </Box>
                  <Shimmer width="25%" height={16} borderRadius={4} intensity="low" />
                </Box>
              ))}
            </Box>
          ) : eventTrades.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 3,
                px: 2,
                borderRadius: 1.5,
                border: `1px dashed ${hairline}`,
                backgroundColor: surfaceInset,
              }}
            >
              <Typography
                sx={{
                  fontFamily: MONO_FONT,
                  fontSize: '0.78rem',
                  color: alpha(theme.palette.text.secondary, 0.8),
                  fontWeight: 500,
                }}
              >
                No trades logged around this event yet
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
  );
};

export default EconomicEventDetailDialog;
