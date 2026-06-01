import React from 'react';
import { Badge, Box, Fab, Tooltip, alpha, useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useAuthState } from 'contexts/AuthStateContext';
import { useAIChat } from 'features/orion/contexts/AIChatContext';
import { useAnyPanelOpen } from 'contexts/PanelMutexContext';
import OrionMark from 'features/orion/components/aiChat/OrionMark';

/**
 * Inline panel width at lg+ — kept in sync with SidePanel/AppLayout's
 * `PANEL_WIDTH`. When an inline panel is open the FAB shifts left by this
 * amount so it rides alongside the panel instead of hiding behind it.
 */
const INLINE_PANEL_WIDTH = 'clamp(340px, 28vw, 450px)';

/**
 * Floating "Open Orion" button mounted once at App level. Shows on every
 * authenticated, non-shared route. Click opens the global AI chat drawer;
 * an unread Orion task pulses a ring + shows a red dot.
 *
 * Reads the unread count from AIChatContext.aiTasks (a single
 * useOrionTasks call owned by the provider) so the app keeps exactly one
 * subscription regardless of how many surfaces consume the bundle.
 */
const HIDDEN_PREFIXES = ['/shared', '/auth'];

/** Stable identity so `useAnyPanelOpen`'s internal memo doesn't churn. */
const EXCLUDE_CHAT_SLOT = ['ai-chat'] as const;

const GlobalAIChatFab: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuthState();
  const { open, aiTasks, isOpen: isChatOpen } = useAIChat();
  const location = useLocation();
  // Exclude the chat slot — that's hidden separately below. `anyPanelOpen`
  // here means "some OTHER inline/drawer panel is open".
  const anyPanelOpen = useAnyPanelOpen(EXCLUDE_CHAT_SLOT);
  // At lg+ panels are inline (they push page content and leave the corner
  // free), so the FAB can slide alongside them. Below lg panels are overlay
  // drawers that cover the corner, so the FAB still hides.
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));

  if (!user) return null;
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null;
  // The chat drawer being open makes the launcher redundant — hide it.
  if (isChatOpen) return null;
  // Below lg an open panel is a full-height overlay drawer that covers the
  // launcher's corner; there's nowhere to shift to, so keep hiding.
  if (anyPanelOpen && !isLgUp) return null;
  // Landing route at exactly "/" is auth-gated to LandingPage when no user;
  // when user is present "/" redirects through HomeRouteResolver to a
  // calendar route, so it's safe to render here.

  const unreadCount = aiTasks.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  // When an inline panel is open at lg+, ride just to the left of it instead
  // of disappearing. The translate matches the panel's 0.3s width slide so
  // the launcher tracks the panel edge as it opens/closes.
  const shiftForPanel = anyPanelOpen && isLgUp;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 16, sm: 24 },
        right: { xs: 16, sm: 24 },
        zIndex: theme.zIndex.modal - 1,
        pointerEvents: 'none',
        transform: shiftForPanel
          ? `translateX(calc(-1 * ${INLINE_PANEL_WIDTH}))`
          : 'translateX(0)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
            {/* OrionMark inherits color from the Fab's contrast text token.
                The catch dot is set to the Fab background so the iris reads
                as a punched-through eye against the violet field. Switches
                to the `alert` state — double-blink + ring thickening — when
                an Orion task is unread, complementing the outer box-shadow
                pulse already on the Fab. */}
            <OrionMark
              size={32}
              state={hasUnread ? 'alert' : 'idle'}
              color="currentColor"
              catchColor={theme.palette.secondary.main}
            />
          </Badge>
        </Fab>
      </Tooltip>
    </Box>
  );
};

export default GlobalAIChatFab;
