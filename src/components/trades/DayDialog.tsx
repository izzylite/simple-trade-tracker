import React from 'react';
import { Event as EventIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import UnifiedDrawer from '../common/UnifiedDrawer';
import { DayTradesContent, DayTradesContentProps } from '../sidePanel/content/DayTradesContent';

interface DayDialogProps extends DayTradesContentProps {
  open: boolean;
  onClose: () => void;
}

const DayDialog: React.FC<DayDialogProps> = ({
  open,
  onClose,
  ...contentProps
}) => {
  const { date } = contentProps;

  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title={format(date, 'EEEE, MMMM d, yyyy')}
      icon={<EventIcon />}
      width={{ xs: '100%', sm: 450 }}
    >
      <DayTradesContent
        {...contentProps}
        isActive={open}
        showFooter
      />
    </UnifiedDrawer>
  );
};

export default DayDialog;
