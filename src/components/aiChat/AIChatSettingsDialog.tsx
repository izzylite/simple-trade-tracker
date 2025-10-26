/**
 * AI Chat Vector Migration Dialog
 * Provides access to vector migration functionality
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon
} from '@mui/icons-material';

import { Calendar } from '../../types/calendar';
import { VectorMigrationTab } from './tabs';


interface AIChatSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  calendar?: Calendar;
}

const AIChatSettingsDialog: React.FC<AIChatSettingsDialogProps> = ({
  open,
  onClose,
  calendar
}) => {

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: 2 } }
      }}
    >
      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6">Vector Migration</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        <VectorMigrationTab calendar={calendar} />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AIChatSettingsDialog;
