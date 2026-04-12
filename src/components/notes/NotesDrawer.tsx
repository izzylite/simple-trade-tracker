/**
 * NotesDrawer Component
 * Thin drawer wrapper around NotesContent for mobile/drawer usage.
 * For desktop side panel usage, render NotesContent directly.
 */

import React, { useState, useCallback } from 'react';
import { useTheme, alpha, IconButton, Tooltip } from '@mui/material';
import { Add as AddIcon, Notes as NotesIcon } from '@mui/icons-material';

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
  const theme = useTheme();
  const [triggerNewNote, setTriggerNewNote] = useState<(() => void) | null>(null);

  const handleNewNoteReady = useCallback((fn: () => void) => {
    setTriggerNewNote(() => fn);
  }, []);

  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Notes"
      icon={<NotesIcon />}
      headerActions={
        !isReadOnly && (
          <Tooltip title="Create new note" arrow>
            <IconButton
              color="primary"
              onClick={() => triggerNewNote?.()}
              disabled={!triggerNewNote}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        )
      }
      width={{ xs: '100%', sm: 450 }}
      headerVariant="default"
      keepMounted={true}
    >
      <NotesContent
        {...contentProps}
        isActive={open}
        isReadOnly={isReadOnly}
        showCalendarPicker={showCalendarPicker}
        onNewNoteReady={handleNewNoteReady}
        showFooter={false}
      />
    </UnifiedDrawer>
  );
};

export default NotesDrawer;
