import React from 'react';
import { CalendarToday } from '@mui/icons-material';

import UnifiedDrawer from '../common/UnifiedDrawer';
import CalendarsListContent, {
  CalendarsListContentProps,
} from '../sidePanel/content/CalendarsListContent';

interface CalendarsListDrawerProps
  extends CalendarsListContentProps {
  open: boolean;
  onClose: () => void;
}

const CalendarsListDrawer: React.FC<
  CalendarsListDrawerProps
> = ({ open, onClose, ...contentProps }) => {
  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Calendars"
      icon={<CalendarToday />}
      width={{ xs: '100%', sm: 450 }}
      keepMounted={false}
      contentSx={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CalendarsListContent
        {...contentProps}
        isActive={open}
      />
    </UnifiedDrawer>
  );
};

export default CalendarsListDrawer;
