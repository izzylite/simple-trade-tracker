import React from 'react';
import { Drawer, useTheme, alpha } from '@mui/material';
import { EconomicCalendarDrawerProps } from '../../types/economicCalendar';
import { Z_INDEX } from '../../styles/zIndex';
import EconomicCalendarPanel from './EconomicCalendarPanel';

// Re-exports kept for backwards compatibility — imported by multiple files
export type { EconomicCalendarFilterSettings } from '../../hooks/useEconomicCalendarFilters';
export { DEFAULT_FILTER_SETTINGS as DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../../hooks/useEconomicCalendarFilters';

const EconomicCalendarDrawer: React.FC<EconomicCalendarDrawerProps> = ({
  open,
  onClose,
  calendar,
  payload,
  tradeOperations,
  isReadOnly,
  initialDate,
  enabled,
}) => {
  const theme = useTheme();
  const drawerZIndex = initialDate
    ? Z_INDEX.ECONOMIC_CALENDAR_DRAWER_OVER_DIALOG
    : Z_INDEX.ECONOMIC_CALENDAR_DRAWER;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        zIndex: drawerZIndex,
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 450 },
          maxWidth: '100vw',
          zIndex: drawerZIndex,
          backgroundColor: theme.palette.background.paper,
          borderLeft: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.4)'
            : '0 8px 32px rgba(0, 0, 0, 0.12)',
        },
      }}
    >
      <EconomicCalendarPanel
        calendar={calendar}
        payload={payload}
        tradeOperations={tradeOperations}
        isReadOnly={isReadOnly}
        initialDate={initialDate}
        onCollapse={onClose}
        enabled={enabled ?? open}
      />
    </Drawer>
  );
};

export default EconomicCalendarDrawer;
