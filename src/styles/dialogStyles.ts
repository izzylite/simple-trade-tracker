import { SxProps, Theme } from '@mui/material';
import { getScrim } from 'styles/designTokens';

// MuiDialog theme override already sets borderRadius: 12 and boxShadow: xl.
// dialogProps only needs the backdrop color — do not add redundant radius/shadow overrides.
// Backdrop scrim reads the mode-aware SCRIM token (same value the global
// MuiBackdrop override uses) so every dialog dims consistently.
export const dialogProps = {
  sx: {
    '& .MuiBackdrop-root:not(.MuiBackdrop-invisible)': {
      backgroundColor: (theme: Theme) => getScrim(theme),
    }
  }
} as const;

// Helper function to merge additional styles with default dialog styles
export const mergeDialogStyles = (additionalSx?: SxProps<Theme>) => ({
  ...dialogProps,
  sx: {
    ...dialogProps.sx,
    ...(additionalSx || {})
  }
}); 