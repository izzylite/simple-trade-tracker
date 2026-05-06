/**
 * NoteViewerDialog Component
 * Read-only dialog for viewing notes. Used when the viewer must
 * appear as a modal (e.g. from DayTradesContent's TradeDetailExpanded).
 * For viewers nested inside other dialogs (e.g. TradeGalleryDialog),
 * use NoteViewerPanel to avoid z-index stacking issues.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  useTheme,
  alpha,
  Toolbar,
  Typography,
  useMediaQuery,
  Chip,
  Stack,
} from '@mui/material';
import {
  Close as CloseIcon,
  PushPin as PinIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';

import { Note } from '../../types/note';
import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { Z_INDEX } from '../../styles/zIndex';
import NoteViewerContent from './NoteViewerContent';

interface NoteViewerDialogProps {
  open: boolean;
  onClose: () => void;
  note: Note | null;
}

const NoteViewerDialog: React.FC<NoteViewerDialogProps> = ({
  open,
  onClose,
  note,
}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  if (!note) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
      sx={{ zIndex: Z_INDEX.DIALOG_POPUP + 1 }}
      PaperProps={{
        sx: {
          height: fullScreen ? '100%' : '85vh',
          m: fullScreen ? 0 : 2,
          borderRadius: fullScreen ? 0 : 3,
        },
      }}
    >
      <Toolbar
        sx={{
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          gap: 1,
          minHeight: 56,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
          <Typography variant="h6" noWrap>
            View Note
          </Typography>
          {note.is_pinned && (
            <PinIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
          )}
          {note.by_assistant && (
            <Chip
              icon={<AIIcon sx={{ fontSize: '0.9rem !important' }} />}
              label="AI"
              size="small"
              sx={{
                height: 20,
                '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' },
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
              }}
            />
          )}
        </Stack>

        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Toolbar>

      <DialogContent
        sx={{
          p: 0,
          overflowY: 'auto',
          bgcolor: 'background.default',
          ...(scrollbarStyles(theme) as any),
        }}
      >
        <NoteViewerContent note={note} />
      </DialogContent>
    </Dialog>
  );
};

export default NoteViewerDialog;
