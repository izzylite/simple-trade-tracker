/**
 * Cross-Session Reminder Batch Card
 *
 * Collapses every cross-session `reminder_fired` notification sharing the
 * same `payload.batchId` into a single card. The model creates batches when
 * the user asks for a polling loop ("monitor X every 5min for 30min") or a
 * multi-event group, so rendering each fire as its own card would flood the
 * stream. We show: a stripped shared title, the most-recent preview, a
 * sibling count chip, and an expand toggle that lists every fire in the
 * batch (newest first). Dismissing the card dismisses every notification in
 * the group.
 *
 * Why a separate file from CrossSessionReminderCard: the solo card has zero
 * collapsed/expanded state and one dismiss target. Conflating them would
 * grow the simple component with toggle plumbing it doesn't need.
 */

import React, { useCallback, useState } from 'react';
import {
  Box,
  Collapse,
  IconButton,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate } from 'react-router-dom';
import {
  AppNotification,
  isReminderFiredPayload,
} from 'types/notification';
import { useNotifications } from 'contexts/NotificationsContext';
import { formatNotificationTime } from 'components/notifications/timeAgo';

interface CrossSessionReminderBatchCardProps {
  // Sorted descending by created_at (newest first). All share batchId.
  notifications: AppNotification[];
}

/**
 * Strip a trailing " N/M" or " N/M (interval)" suffix that the model
 * appends to per-fire titles. The group card represents the whole batch, so
 * those per-iteration markers are noise.
 */
function stripBatchSuffix(title: string): string {
  return title.replace(/\s+\d+\/\d+\s*(?:\([^)]*\))?\s*$/u, '').trim() || title;
}

const CrossSessionReminderBatchCard: React.FC<
  CrossSessionReminderBatchCardProps
> = ({ notifications }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { markAsRead, dismiss, tryRouteNotification } = useNotifications();
  const [expanded, setExpanded] = useState(false);

  const latest = notifications[0];
  const count = notifications.length;
  const isDark = theme.palette.mode === 'dark';

  const openNotification = useCallback(
    (n: AppNotification) => {
      if (!isReminderFiredPayload(n)) return;
      void markAsRead(n.id);
      if (tryRouteNotification(n)) return;
      const params = new URLSearchParams();
      if (n.payload.calendarId) params.set('calendarId', n.payload.calendarId);
      params.set('conversationId', n.payload.conversationId);
      if (n.payload.messageId) params.set('messageId', n.payload.messageId);
      navigate(`/assistant?${params.toString()}`);
    },
    [markAsRead, navigate, tryRouteNotification],
  );

  const handleDismissAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Fire-and-forget per row. Optimistic state lives in NotificationsContext;
      // failures there are logged but non-fatal — the user can re-dismiss.
      for (const n of notifications) {
        void dismiss(n.id);
      }
    },
    [notifications, dismiss],
  );

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  if (!isReminderFiredPayload(latest)) return null;

  const sharedTitle = stripBatchSuffix(latest.title);
  const latestPreview = latest.payload.preview ?? '';

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
        onClick={() => openNotification(latest)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openNotification(latest);
          }
        }}
        aria-label={`Open ${sharedTitle}, ${count} reminders from another session`}
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
          transition:
            'border-color 150ms ease-out, background-color 150ms ease-out',
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
          onClick={handleDismissAll}
          size="small"
          aria-label={`Dismiss all ${count} reminders`}
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
          From another session · {count} fires
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
          {sharedTitle}
        </Typography>

        {latestPreview && (
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
            {latestPreview}
          </Typography>
        )}

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mt: 1 }}
        >
          <Typography
            component="div"
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'text.disabled',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Latest {formatNotificationTime(latest.created_at)}
          </Typography>
          <Box
            role="button"
            tabIndex={0}
            onClick={toggleExpanded}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }
            }}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide earlier fires' : 'Show earlier fires'}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              cursor: 'pointer',
              borderRadius: 1,
              px: 0.5,
              py: 0.25,
              '&:hover': { color: 'text.primary' },
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 1,
              },
            }}
          >
            {expanded ? 'Hide' : 'Show all'}
            <ExpandMoreIcon
              sx={{
                fontSize: 14,
                transition: 'transform 150ms ease-out',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </Box>
        </Stack>

        <Collapse in={expanded} unmountOnExit>
          <Stack
            spacing={0.5}
            sx={{
              mt: 1,
              pt: 1,
              borderTop: `1px solid ${
                isDark
                  ? alpha(theme.palette.text.primary, 0.08)
                  : theme.palette.divider
              }`,
            }}
          >
            {notifications.map((n) => {
              if (!isReminderFiredPayload(n)) return null;
              const preview = n.payload.preview ?? '';
              return (
                <Box
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    openNotification(n);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      openNotification(n);
                    }
                  }}
                  aria-label={`Open ${n.title}`}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.25,
                    py: 0.75,
                    px: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 1,
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography
                      component="div"
                      sx={{
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: 'text.primary',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.title}
                    </Typography>
                    <Typography
                      component="div"
                      sx={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'text.disabled',
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}
                    >
                      {formatNotificationTime(n.created_at)}
                    </Typography>
                  </Stack>
                  {preview && (
                    <Typography
                      component="div"
                      sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {preview}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Stack>
        </Collapse>
      </Box>
    </Box>
  );
};

export default CrossSessionReminderBatchCard;
