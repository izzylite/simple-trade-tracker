import React from 'react';
import { Box } from '@mui/material';
import EconomicEventNotification from 'features/events/components/notifications/EconomicEventNotification';
import { useEventNotifications } from 'features/events/contexts/EventNotificationsContext';

/**
 * App-level mount for the economic event notification slider stack.
 * Renders fixed bottom-left and consumes EventNotificationsContext for
 * the active card list + close handler. Position + sizing matches the
 * pre-lift in-page stack (see TradeCalendarPage history).
 */
const GlobalEventNotifications: React.FC = () => {
  const { notifications, removingIds, closeNotification } =
    useEventNotifications();

  if (notifications.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 16, sm: 24 },
        left: { xs: 8, sm: 12 },
        right: { xs: 8, sm: 'auto' },
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1.5, sm: 2 },
        pointerEvents: 'none',
        maxWidth: { xs: 'calc(100% - 16px)', sm: '400px' },
      }}
    >
      {notifications.map((event) => (
        <EconomicEventNotification
          key={event.id}
          event={event}
          onClose={() => closeNotification(event.id)}
          autoHideDuration={30000}
          isRemoving={removingIds.has(event.id)}
        />
      ))}
    </Box>
  );
};

export default GlobalEventNotifications;
