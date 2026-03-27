import { SxProps, Theme } from '@mui/material';

// MuiDialog theme override already sets borderRadius: 12 and boxShadow: xl.
// dialogProps only needs the backdrop color — do not add redundant radius/shadow overrides.
export const dialogProps = {
  sx: {
    '& .MuiBackdrop-root': {
      backgroundColor: 'rgba(0,0,0,0.6)'
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