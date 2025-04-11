import { SxProps, Theme } from '@mui/material';

export const dialogProps = {
  PaperProps: {
    sx: {
      bgcolor: 'background.paper',
      borderRadius: 2,
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)'
    }
  },
  sx: {
    '& .MuiBackdrop-root': {
      backdropFilter: 'blur(4px)',
      backgroundColor: 'rgba(0, 0, 0, 0.5)'
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