import { SxProps, Theme } from '@mui/material';

export const dialogProps = {
  PaperProps: {
    sx: {
      bgcolor: 'background.paper',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }
  },
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