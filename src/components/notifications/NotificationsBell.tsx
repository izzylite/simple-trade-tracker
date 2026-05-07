import React, { useCallback, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, alpha, useTheme } from '@mui/material';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationsContext';
import {
  AppNotification,
  isOrionTaskResultPayload,
  isReminderFiredPayload,
} from '../../types/notification';
import NotificationsPopover from './NotificationsPopover';

const LAST_ACTIVE_CALENDAR_KEY = 'last_active_calendar_id';

const NotificationsBell: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { unreadCount, markAsRead, tryRouteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSelect = useCallback(
    (n: AppNotification) => {
      void markAsRead(n.id);
      setOpen(false);

      // Local handlers (e.g. the active calendar page) get first shot.
      // Only fall back to URL navigation when no surface claims the click.
      if (tryRouteNotification(n)) return;

      if (isReminderFiredPayload(n)) {
        const params = new URLSearchParams();
        if (n.payload.calendarId) params.set('calendarId', n.payload.calendarId);
        params.set('conversationId', n.payload.conversationId);
        if (n.payload.messageId) params.set('messageId', n.payload.messageId);
        navigate(`/assistant?${params.toString()}`);
        return;
      }

      if (isOrionTaskResultPayload(n)) {
        // Tasks live in the AIChatDrawer's Tasks tab, hosted by calendar
        // routes. Drop the user on their last-active calendar with a
        // ?openTasks=1 hint; the calendar page consumes it on mount.
        let lastCalendarId: string | null = null;
        try {
          lastCalendarId = localStorage.getItem(LAST_ACTIVE_CALENDAR_KEY);
        } catch {
          // localStorage disabled — fall through to /assistant as a last resort
        }
        if (lastCalendarId) {
          navigate(`/calendar/${lastCalendarId}?openTasks=1`);
        } else {
          navigate('/assistant');
        }
      }
    },
    [markAsRead, navigate, tryRouteNotification]
  );

  return (
    <>
      <Tooltip title="Notifications" arrow>
        <IconButton
          ref={anchorRef}
          onClick={handleOpen}
          size="small"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
          sx={{
            position: 'relative',
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
              backgroundColor: alpha(theme.palette.text.primary, 0.06),
            },
          }}
        >
          <NotificationsNoneIcon fontSize="small" />
          {unreadCount > 0 && (
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: theme.palette.error.main,
                boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
              }}
            />
          )}
        </IconButton>
      </Tooltip>

      <NotificationsPopover
        open={open}
        anchorEl={anchorRef.current}
        onClose={handleClose}
        onSelect={handleSelect}
      />
    </>
  );
};

export default NotificationsBell;
