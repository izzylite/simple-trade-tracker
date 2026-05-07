import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { useAuthState } from '../contexts/AuthStateContext';
import { useCalendars } from '../hooks/useCalendars';
import { useAIChat } from '../hooks/useAIChat';
import AIChatContent from '../components/sidePanel/content/AIChatContent';
import { Trade } from '../types/dualWrite';
import { ConversationRepository } from '../services/repository/repositories/ConversationRepository';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'assistant_selected_calendar_id';
const SWITCH_SPINNER_MS = 350;
const APP_HEADER_HEIGHT = 64;

/**
 * Cross-calendar Orion entry point. Defaults to "All Calendars" — chat
 * conversations save at user level (saveAsUserLevel) so they persist
 * regardless of which calendar context is selected for AI grounding.
 *
 * The dropdown for calendar context lives inside AIChatContent's own header;
 * we feed it via availableCalendars/selectedCalendarId/onCalendarChange and
 * surface a brief spinner overlay during the switch so context changes feel
 * intentional.
 */
const AssistantPage: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuthState();
  const { calendars } = useCalendars(user?.uid);

  const activeCalendars = useMemo(
    () => (calendars || []).filter((c) => !c.deleted_at),
    [calendars]
  );

  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);
  const conversationRepoRef = useRef(new ConversationRepository());

  // Drop a stale stored ID when its calendar is gone (deleted/trashed).
  // Empty string means "All Calendars" and is always valid.
  useEffect(() => {
    if (!selectedCalendarId) return;
    const exists = activeCalendars.some((c) => c.id === selectedCalendarId);
    if (!exists && activeCalendars.length > 0) {
      setSelectedCalendarId('');
      try {
        localStorage.setItem(STORAGE_KEY, '');
      } catch {
        // ignore
      }
    }
  }, [activeCalendars, selectedCalendarId]);

  useEffect(() => {
    return () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    };
  }, []);

  const handleCalendarChange = useCallback((id: string) => {
    setSelectedCalendarId((prev) => (prev === id ? prev : id));
    setIsSwitching(true);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    switchTimerRef.current = setTimeout(
      () => setIsSwitching(false),
      SWITCH_SPINNER_MS
    );
  }, []);

  const selectedCalendar = useMemo(
    () => activeCalendars.find((c) => c.id === selectedCalendarId),
    [activeCalendars, selectedCalendarId]
  );

  // Conversation history follows the selected calendar:
  //  - calendar selected: loads/saves under that calendar_id
  //  - "All Calendars" (selectedCalendar = undefined): loads/saves user-level
  // (saveAsUserLevel intentionally omitted — that flag forces user-level
  // regardless of calendar and breaks per-calendar history switching.)
  const sharedChatState = useAIChat({
    userId: user?.uid,
    calendar: selectedCalendar,
    messageLimit: 100,
    autoSaveConversation: true,
  });

  // Deep-link handler: ?calendarId=&conversationId=&messageId=
  // Triggered when the user clicks a notification (from the bell or an
  // in-stream card). Sets the calendar context, loads the target
  // conversation, and queues a scroll-to-message highlight. Params are
  // cleared after consumption so a refresh doesn't re-trigger.
  useEffect(() => {
    const calIdParam = searchParams.get('calendarId');
    const convoIdParam = searchParams.get('conversationId');
    const msgIdParam = searchParams.get('messageId');
    if (!convoIdParam) return;

    const nextCalId = calIdParam ?? '';
    setSelectedCalendarId(nextCalId);
    try {
      localStorage.setItem(STORAGE_KEY, nextCalId);
    } catch {
      // ignore
    }

    let cancelled = false;
    conversationRepoRef.current
      .findById(convoIdParam)
      .then((convo) => {
        if (cancelled) return;
        if (!convo) {
          logger.warn(
            'Notification deep-link: conversation not found',
            convoIdParam
          );
          return;
        }
        sharedChatState.selectConversation(convo);
        if (msgIdParam) setScrollToMessageId(msgIdParam);
      })
      .catch((err) => {
        logger.error('Notification deep-link load failed', err);
      });

    setSearchParams(new URLSearchParams(), { replace: true });
    return () => {
      cancelled = true;
    };
  }, [searchParams, sharedChatState.selectConversation, setSearchParams]);

  // Stub operations — Assistant page does not host trade-edit flows; users
  // open the calendar to edit trades. Image zoom is a no-op here for now.
  const stubTradeOperations = useMemo(
    () => ({
      onOpenGalleryMode: () => {},
      onUpdateTradeProperty: () =>
        Promise.resolve(undefined as Trade | undefined),
      onEditTrade: () => {},
      onDeleteTrade: () => Promise.resolve(),
      onDeleteMultipleTrades: () => {},
      onZoomImage: () => {},
      isTradeUpdating: () => false,
      onUpdateCalendarProperty: () => Promise.resolve(undefined),
    }),
    []
  );

  return (
    <Box
      sx={{
        position: 'relative',
        height: `calc(100vh - ${APP_HEADER_HEIGHT}px)`,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <AIChatContent
        tradeOperations={stubTradeOperations}
        isActive
        calendar={selectedCalendar}
        sharedChatState={sharedChatState}
        availableCalendars={activeCalendars}
        selectedCalendarId={selectedCalendarId}
        onCalendarChange={handleCalendarChange}
        scrollToMessageId={scrollToMessageId}
        onScrolledToMessage={() => setScrollToMessageId(null)}
      />

      {isSwitching && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            bgcolor: alpha(theme.palette.background.default, 0.7),
            backdropFilter: 'blur(2px)',
            zIndex: 10,
            pointerEvents: 'auto',
          }}
        >
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">
            Switching calendar context…
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AssistantPage;
