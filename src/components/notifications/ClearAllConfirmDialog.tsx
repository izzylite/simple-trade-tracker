import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';

interface ClearAllConfirmDialogProps {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const ClearAllConfirmDialog: React.FC<ClearAllConfirmDialogProps> = ({
  open,
  count,
  onCancel,
  onConfirm,
}) => {
  const theme = useTheme();
  const titleText =
    count === 1 ? 'Clear 1 notification?' : `Clear all ${count} notifications?`;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            backgroundImage: 'none',
          },
        },
      }}
    >
      <DialogTitle
        sx={{ fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.015em' }}
      >
        {titleText}
      </DialogTitle>
      <DialogContent>
        <Typography
          sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.55 }}
        >
          This removes them from your inbox. Already-fired reminders stay in their
          conversation threads.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onCancel}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            color: 'text.secondary',
          }}
        >
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: 'none',
            backgroundColor: theme.palette.error.main,
            color: theme.palette.common.white,
            '&:hover': {
              backgroundColor: theme.palette.error.dark,
              boxShadow: `0 2px 8px ${alpha(theme.palette.error.main, 0.35)}`,
            },
          }}
        >
          Clear all
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClearAllConfirmDialog;
