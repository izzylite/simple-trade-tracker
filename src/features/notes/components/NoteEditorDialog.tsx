/**
 * NoteEditorDialog — modal wrapper around NoteEditorBody.
 *
 * Owns the MUI <Dialog> shell + close button. All editor logic lives in
 * NoteEditorBody so the dedicated NotesPage can render the same editor
 * inline without a dialog.
 */

import React, { useRef } from 'react';
import {
  Dialog,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

import { Note, DayAbbreviation } from '../types/note';
import type { Currency, ImpactLevel } from 'types/economicCalendar';
import NoteEditorBody, { NoteEditorBodyHandle } from './NoteEditorBody';

// Re-export tag config for downstream consumers
export {
  DEFAULT_NOTE_TAGS_MAP,
  getTagDisplayLabel,
  getTagSubtitle,
  getTagIcon,
} from './NoteEditorDialogTags';
export type { TagInfo } from './NoteEditorDialogTags';

interface NoteEditorDialogProps {
  open: boolean;
  onClose: () => void;
  note?: Note;
  calendarId: string;
  onSave?: (note: Note, isCreated?: boolean) => void;
  onDelete?: (noteId: string) => void;
  weekKey?: string;
  gamePlanDay?: DayAbbreviation;
  initialTags?: string[];
  availableTradeTags?: string[];
  calendarNotes?: Array<{ id: string; title: string }>;
  pinnedEvents?: Array<{
    event_id: string;
    event: string;
    currency?: Currency;
    impact?: ImpactLevel;
  }>;
}

const NoteEditorDialog: React.FC<NoteEditorDialogProps> = ({
  open,
  onClose,
  ...bodyProps
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const bodyRef = useRef<NoteEditorBodyHandle>(null);

  const handleClose = async () => {
    if (bodyRef.current) await bodyRef.current.saveIfDirty();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={fullScreen}
      maxWidth="md"
      sx={{
        zIndex: (t) => t.zIndex.modal + 100,
      }}
      PaperProps={{
        sx: {
          height: fullScreen ? '100%' : '90vh',
          width: fullScreen ? '100%' : 700,
          maxWidth: fullScreen ? '100%' : 700,
          m: fullScreen ? 0 : 2,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <NoteEditorBody
        ref={bodyRef}
        isActive={open}
        onCloseRequest={onClose}
        trailingAction={
          <IconButton size="small" onClick={() => { void handleClose(); }}>
            <CloseIcon />
          </IconButton>
        }
        {...bodyProps}
      />
    </Dialog>
  );
};

export default NoteEditorDialog;
