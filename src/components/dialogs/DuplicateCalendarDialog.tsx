import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import { ContentCopy as CopyIcon } from '@mui/icons-material';
import { CalendarWithUIState } from '../../types/calendar';
import { dialogProps } from '../../styles/dialogStyles';

interface DuplicateCalendarDialogProps {
  open: boolean;
  calendar: CalendarWithUIState | null;
  isDuplicating: boolean;
  onClose: () => void;
  onDuplicate: (withContent: boolean) => void;
}

export const DuplicateCalendarDialog: React.FC<DuplicateCalendarDialogProps> = ({
  open,
  calendar,
  isDuplicating,
  onClose,
  onDuplicate
}) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      {...dialogProps}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        color: 'primary.main'
      }}>
        <CopyIcon fontSize="small" />
        Duplicate Calendar Options
      </DialogTitle>
      <DialogContent>
        {isDuplicating ? (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 4
          }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Duplicating calendar...
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body1" sx={{ mb: 3 }}>
              How would you like to duplicate "{calendar?.name}"?
            </Typography>

            <Stack spacing={2}>
              <Button
                variant="outlined"
                onClick={() => onDuplicate(false)}
                disabled={isDuplicating}
                sx={{
                  p: 2,
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  borderColor: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    backgroundColor: alpha(theme.palette.primary.main, 0.05)
                  }
                }}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Settings Only
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Copy calendar settings without trades
                  </Typography>
                </Box>
              </Button>

              <Button
                variant="outlined"
                onClick={() => onDuplicate(true)}
                disabled={isDuplicating}
                sx={{
                  p: 2,
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  borderColor: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    backgroundColor: alpha(theme.palette.primary.main, 0.05)
                  }
                }}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Settings & Trades
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Copy everything including all trades
                  </Typography>
                </Box>
              </Button>
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={isDuplicating}
          sx={{ color: 'text.secondary' }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

