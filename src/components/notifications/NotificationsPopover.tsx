import React, { useCallback, useState } from 'react';
import {
  Box,
  Popover,
  Typography,
  Button,
  Skeleton,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useNotifications } from 'contexts/NotificationsContext';
import { AppNotification } from 'types/notification';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import NotificationRow from 'components/notifications/NotificationRow';
import NotificationsEmpty from 'components/notifications/NotificationsEmpty';
import ClearAllConfirmDialog from 'components/notifications/ClearAllConfirmDialog';

interface NotificationsPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelect: (notification: AppNotification) => void;
}

const PANEL_WIDTH = 380;
const PANEL_MAX_HEIGHT = 520;

const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  open,
  anchorEl,
  onClose,
  onSelect,
}) => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { notifications, unreadCount, loading, clearAll, dismiss } = useNotifications();
  const [clearOpen, setClearOpen] = useState(false);

  const visible = notifications.filter((n) => !n.dismissed_at);
  const showSkeleton = loading && visible.length === 0;

  const handleClearConfirm = useCallback(async () => {
    setClearOpen(false);
    await clearAll();
  }, [clearAll]);

  const handleRowClick = useCallback(
    (n: AppNotification) => {
      onSelect(n);
    },
    [onSelect]
  );

  return (
    <>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              mt: 1,
              width: isNarrow ? `calc(100vw - ${theme.spacing(2)})` : PANEL_WIDTH,
              maxWidth: '100vw',
              maxHeight: PANEL_MAX_HEIGHT,
              backgroundImage: 'none',
              backgroundColor: 'background.paper',
              borderRadius: 1.5,
              border:
                theme.palette.mode === 'light'
                  ? `1px solid ${theme.palette.divider}`
                  : 'none',
              boxShadow:
                theme.palette.mode === 'dark'
                  ? '0 4px 16px rgba(0,0,0,0.4)'
                  : '0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.5,
            minHeight: 56,
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexShrink: 0,
          }}
        >
          <Typography
            component="h2"
            sx={{
              fontSize: '1.0625rem',
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: 'text.primary',
              lineHeight: 1.2,
            }}
          >
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Box
              sx={{
                px: 1,
                py: '2px',
                borderRadius: '6px',
                backgroundColor: alpha(theme.palette.text.primary, 0.08),
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {unreadCount} UNREAD
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          {visible.length > 0 && (
            <Button
              onClick={() => setClearOpen(true)}
              size="small"
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                minWidth: 0,
                px: 1,
                '&:hover': {
                  color: 'text.primary',
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Clear all
            </Button>
          )}
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            ...scrollbarStyles(theme),
          }}
        >
          {showSkeleton ? (
            <Box>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom:
                      i === 2 ? 'none' : `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <Skeleton variant="text" width="70%" height={18} />
                  <Skeleton variant="text" width="90%" height={16} />
                </Box>
              ))}
            </Box>
          ) : visible.length === 0 ? (
            <NotificationsEmpty />
          ) : (
            visible.map((n, i) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onClick={handleRowClick}
                onDismiss={(id) => void dismiss(id)}
                isLast={i === visible.length - 1}
              />
            ))
          )}
        </Box>
      </Popover>

      <ClearAllConfirmDialog
        open={clearOpen}
        count={visible.length}
        onCancel={() => setClearOpen(false)}
        onConfirm={handleClearConfirm}
      />
    </>
  );
};

export default NotificationsPopover;
