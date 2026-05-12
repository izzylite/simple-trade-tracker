import React from 'react';
import { Badge, Box, Fab, Tooltip, alpha, useTheme } from '@mui/material';
import { SmartToy as AIIcon } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useAuthState } from '../../contexts/AuthStateContext';
import { useAIChat } from '../../contexts/AIChatContext';

/**
 * Floating "Open Orion" button mounted once at App level. Shows on every
 * authenticated, non-shared route. Click opens the global AI chat drawer;
 * an unread Orion task pulses a ring + shows a red dot.
 *
 * Reads the unread count from AIChatContext.aiTasks (a single
 * useOrionTasks call owned by the provider) so the app keeps exactly one
 * subscription regardless of how many surfaces consume the bundle.
 */
const HIDDEN_PREFIXES = ['/shared', '/auth', '/landing'];

const GlobalAIChatFab: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuthState();
  const { open, aiTasks } = useAIChat();
  const location = useLocation();

  if (!user) return null;
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null;
  // Landing route at exactly "/" is auth-gated to LandingPage when no user;
  // when user is present "/" redirects through HomeRouteResolver to a
  // calendar route, so it's safe to render here.

  const unreadCount = aiTasks.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 16, sm: 24 },
        right: { xs: 16, sm: 24 },
        zIndex: theme.zIndex.modal - 1,
        pointerEvents: 'none',
      }}
    >
      <Tooltip title="Orion" placement="left">
        <Fab
          aria-label="open ai chat"
          onClick={() => open()}
          color="secondary"
          size="medium"
          sx={{
            pointerEvents: 'auto',
            width: { xs: 48, sm: 56 },
            height: { xs: 48, sm: 56 },
            '&:hover': { transform: 'scale(1.08)' },
            transition: 'transform 0.2s ease',
            ...(hasUnread && {
              animation: 'orionFabPulse 1.8s ease-out infinite',
              '@keyframes orionFabPulse': {
                '0%': {
                  boxShadow: `0 0 0 0 ${alpha(theme.palette.secondary.main, 0.55)}`,
                },
                '70%': {
                  boxShadow: `0 0 0 14px ${alpha(theme.palette.secondary.main, 0)}`,
                },
                '100%': {
                  boxShadow: `0 0 0 0 ${alpha(theme.palette.secondary.main, 0)}`,
                },
              },
            }),
          }}
        >
          <Badge
            variant="dot"
            color="error"
            invisible={!hasUnread}
            sx={{
              '& .MuiBadge-badge': {
                top: 4,
                right: 4,
                width: 10,
                height: 10,
                borderRadius: '50%',
              },
            }}
          >
            <AIIcon />
          </Badge>
        </Fab>
      </Tooltip>
    </Box>
  );
};

export default GlobalAIChatFab;
