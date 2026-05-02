/**
 * Reminders Panel
 *
 * Lists the user's pending reminders with click-to-navigate (opens the
 * originating conversation) and an inline cancel action. Stays in sync via
 * a Supabase realtime subscription.
 *
 * Why refetch on every event instead of patching local state from the
 * payload: postgres_changes payloads don't include the joined
 * `conversation_title`, and reminders are capped at 50/user — refetch is
 * cheap and avoids stale-title bugs after rename.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AlarmIcon from '@mui/icons-material/Alarm';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  getReminders,
  cancelReminder,
  type Reminder,
} from '../../services/remindersService';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import { logger } from '../../utils/logger';
import ReminderListItem from './ReminderListItem';
import EconomicEventShimmer from '../economicCalendar/EconomicEventShimmer';

interface RemindersPanelProps {
  onNavigateToConversation: (conversationId: string) => void;
}

const RemindersPanel: React.FC<RemindersPanelProps> = ({
  onNavigateToConversation,
}) => {
  const theme = useTheme();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const cancelledRef = useRef(false);

  // Initial fetch on mount.
  useEffect(() => {
    cancelledRef.current = false;
    void getReminders()
      .then((rows) => {
        if (!cancelledRef.current) setReminders(rows);
      })
      .catch((err) => {
        logger.error('Failed to load reminders:', err);
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Refetch helper — used by the realtime callback and the cancel-fallback path.
  const refetch = useCallback(async () => {
    try {
      const rows = await getReminders();
      if (!cancelledRef.current) setReminders(rows);
    } catch (err) {
      logger.error('Failed to refetch reminders:', err);
    }
  }, []);

  // Stable handler identities so useRealtimeSubscription doesn't churn on
  // every parent re-render.
  const handleChannelCreated = useCallback(
    (channel: RealtimeChannel) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders' },
        (payload) => {
          const evtType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const newRow = payload.new as Reminder | undefined;
          const matters =
            (evtType === 'INSERT' && newRow?.status === 'pending') ||
            evtType === 'UPDATE' ||
            evtType === 'DELETE';
          if (matters) void refetch();
        },
      );
    },
    [refetch],
  );

  const handleSubscribed = useCallback(() => {
    // After (re)connect, resync in case events were missed during the gap.
    void refetch();
  }, [refetch]);

  useRealtimeSubscription({
    channelName: 'reminders-panel',
    privateChannel: false,
    onChannelCreated: handleChannelCreated,
    onSubscribed: handleSubscribed,
  });

  const handleCancel = useCallback(
    async (id: string) => {
      // Optimistic: remove from list immediately.
      setReminders((prev) => prev.filter((r) => r.id !== id));
      try {
        await cancelReminder(id);
      } catch (err) {
        logger.error('Failed to cancel reminder; refetching:', err);
        void refetch();
      }
    },
    [refetch],
  );

  if (loading) {
    return <EconomicEventShimmer count={10} />;
  }

  if (reminders.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          px: 4,
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.main,
          }}
        >
          <AlarmIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="subtitle1" fontWeight={600}>
          No active reminders
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
          Ask Orion to set one — e.g. &quot;remind me when jobless claims
          comes out&quot;.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={0.5} p={1}>
      {reminders.map((r) => (
        <ReminderListItem
          key={r.id}
          reminder={r}
          onCancel={handleCancel}
          onClick={(rem) => onNavigateToConversation(rem.conversation_id)}
        />
      ))}
    </Stack>
  );
};

export default RemindersPanel;
