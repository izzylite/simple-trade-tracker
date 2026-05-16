import React, { useCallback } from 'react';
import { Box, IconButton, Typography, alpha, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { AppNotification, isReminderFiredPayload } from '../../types/notification';
import { useNotifications } from '../../contexts/NotificationsContext';
import { formatNotificationTime } from './timeAgo';

interface CrossSessionReminderCardProps {
  notification: AppNotification;
}

const CrossSessionReminderCard: React.FC<CrossSessionReminderCardProps> = ({
  notification,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { markAsRead, dismiss, tryRouteNotification } = useNotifications();

  const handleOpen = useCallback(() => {
    if (!isReminderFiredPayload(notification)) return;
    void markAsRead(notification.id);
    if (tryRouteNotification(notification)) return;
    const params = new URLSearchParams();
    if (notification.payload.calendarId)
      params.set('calendarId', notification.payload.calendarId);
    params.set('conversationId', notification.payload.conversationId);
    if (notification.payload.messageId)
      params.set('messageId', notification.payload.messageId);
    navigate(`/assistant?${params.toString()}`);
  }, [notification, markAsRead, navigate, tryRouteNotification]);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void dismiss(notification.id);
    },
    [notification.id, dismiss]
  );

  if (!isReminderFiredPayload(notification)) return null;

  const preview = notification.payload.preview ?? '';
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        my: 2,
        ml: 0,
        mr: { xs: 1, sm: 6 },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
        aria-label={`Open ${notification.title}`}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          borderRadius: 1.5,
          border: `1px solid ${
            isDark ? alpha(theme.palette.text.primary, 0.12) : theme.palette.divider
          }`,
          backgroundColor: 'transparent',
          px: 2,
          py: 1.75,
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 150ms ease-out, background-color 150ms ease-out',
          '&:hover': {
            borderColor: alpha(theme.palette.primary.main, 0.45),
            backgroundColor: theme.palette.action.hover,
          },
          '&:focus-visible': {
            borderColor: theme.palette.primary.main,
            boxShadow: theme.palette.custom.focusRingStrong,
          },
        }}
      >
        <IconButton
          onClick={handleDismiss}
          size="small"
          aria-label="Dismiss"
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            color: 'text.disabled',
            '&:hover': {
              color: 'text.secondary',
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>

        <Typography
          component="div"
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            mb: 0.5,
          }}
        >
          From another session
        </Typography>
        <Typography
          component="div"
          sx={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'text.primary',
            lineHeight: 1.4,
            pr: 3,
          }}
        >
          {notification.title}
        </Typography>
        {preview && (
          <Typography
            component="div"
            sx={{
              mt: 0.75,
              fontSize: '0.8125rem',
              color: 'text.secondary',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview}
          </Typography>
        )}
        <Typography
          component="div"
          sx={{
            mt: 1,
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'text.disabled',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatNotificationTime(notification.created_at)}
        </Typography>
      </Box>
    </Box>
  );
};

export default CrossSessionReminderCard;
