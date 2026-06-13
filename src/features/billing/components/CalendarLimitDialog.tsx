import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  useFullScreenDialog,
  SAFE_AREA_BOTTOM,
} from 'components/common/useFullScreenDialog';

interface CalendarLimitDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Upgrade nudge shown when a free-tier user tries to create a second
 * calendar. Surfaces the tier limit cleanly (instead of a generic error
 * snackbar) and routes the user to the pricing page.
 *
 * Triggered by callers when `CalendarRepository.create()` returns
 * `{ success: false, error: { message: 'tier_limit_calendars', ... } }`,
 * or when the DB trigger surfaces the same `tier_limit_calendars` string
 * via PostgREST (P0001) on bypass.
 */
export const CalendarLimitDialog: React.FC<CalendarLimitDialogProps> = ({
  open,
  onClose,
}) => {
  const navigate = useNavigate();
  const { fullScreen, fullScreenPaperSx } = useFullScreenDialog();

  const handleSeePlans = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={fullScreen}
      PaperProps={{ sx: { ...fullScreenPaperSx } }}
    >
      <DialogTitle>Free plan includes one calendar</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Upgrade to add more calendars — useful for tracking multiple prop
          firm accounts, personal vs business trading, or trying different
          strategies in parallel.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ pb: fullScreen ? SAFE_AREA_BOTTOM : undefined }}>
        <Button onClick={onClose}>Maybe later</Button>
        <Button variant="contained" onClick={handleSeePlans}>
          See plans
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CalendarLimitDialog;
