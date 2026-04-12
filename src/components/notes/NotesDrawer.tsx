/**
 * NotesDrawer Component
 * Thin drawer wrapper around NotesContent for mobile/drawer usage.
 * For desktop side panel usage, render NotesContent directly.
 */

import React from 'react';
import { Notes as NotesIcon } from '@mui/icons-material';

import UnifiedDrawer from '../common/UnifiedDrawer';
import NotesContent, { NotesContentProps } from '../sidePanel/content/NotesContent';

interface NotesDrawerProps extends NotesContentProps {
  open: boolean;
  onClose: () => void;
}

const NotesDrawer: React.FC<NotesDrawerProps> = ({
  open,
  onClose,
  isReadOnly = false,
  showCalendarPicker = false,
  ...contentProps
}) => {
  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Notes"
      icon={<NotesIcon />}
      width={{ xs: '100%', sm: 450 }}
      keepMounted={true}
      contentSx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <NotesContent
        {...contentProps}
        isActive={open}
        isReadOnly={isReadOnly}
        showCalendarPicker={showCalendarPicker}
        showFooter
      />
    </UnifiedDrawer>
  );
};

export default NotesDrawer;
