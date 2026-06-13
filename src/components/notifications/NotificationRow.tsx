import React from 'react';
import { Box, IconButton, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { AppNotification } from 'types/notification';
import { formatNotificationTime } from 'components/notifications/timeAgo';

interface NotificationRowProps {
  notification: AppNotification;
  onClick: (n: AppNotification) => void;
  onDismiss?: (id: string) => void;
  isLast?: boolean;
}

const NotificationRow: React.FC<NotificationRowProps> = ({
  notification,
  onClick,
  onDismiss,
  isLast = false,
}) => {
  const theme = useTheme();
  const isUnread = !notification.read_at;
  const preview = (notification.payload as { preview?: string })?.preview ?? '';

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => onClick(notification)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(notification);
        }
      }}
      sx={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '12px 1fr 80px',
        alignItems: 'flex-start',
        columnGap: 1.5,
        px: 2,
        py: 1.5,
        cursor: 'pointer',
        outline: 'none',
        borderBottom: isLast ? 'none' : `1px solid ${theme.palette.divider}`,
        transition: 'background-color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
        '&:focus-visible': {
          backgroundColor: theme.palette.action.hover,
          boxShadow: `inset 0 0 0 2px ${alpha(theme.palette.primary.main, 0.45)}`,
        },
      }}
    >
      <Box
        aria-label={isUnread ? 'Unread' : 'Read'}
        sx={{
          width: 6,
          height: 6,
          mt: '6px',
          borderRadius: '50%',
          backgroundColor: isUnread ? theme.palette.primary.main : 'transparent',
          transition: 'background-color 150ms ease-out',
          justifySelf: 'center',
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            fontSize: '0.875rem',
            fontWeight: isUnread ? 600 : 500,
            color: 'text.primary',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {notification.title}
        </Typography>
        {preview && (
          <Typography
            component="div"
            sx={{
              mt: 0.5,
              fontSize: '0.8125rem',
              fontWeight: 400,
              color: 'text.secondary',
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {preview}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 0.25,
          pt: '2px',
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: 'text.secondary',
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatNotificationTime(notification.created_at)}
        </Typography>
        {onDismiss && (
          <Tooltip title="Clear" arrow>
            <IconButton
              size="small"
              aria-label="Clear notification"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(notification.id);
              }}
              sx={{
                p: { xs: 1, sm: 0.25 },
                color: 'text.disabled',
                '&:hover': {
                  color: 'text.secondary',
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default NotificationRow;
