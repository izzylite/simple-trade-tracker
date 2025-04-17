import { Theme } from '@mui/material';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { dialogProps } from '../styles/dialogStyles';

/**
 * Creates consistent dialog props with styling
 * @param theme Current theme
 * @returns Dialog props with consistent styling
 */
export const getDialogProps = (theme: Theme) => ({
  ...dialogProps,
  PaperProps: {
    sx: {
      borderRadius: 2,
      boxShadow: 'none',
      border: `1px solid ${theme.palette.divider}`,
      maxHeight: '90vh',
      overflow: 'hidden',
      '& .MuiDialogContent-root': {
        ...scrollbarStyles(theme)
      }
    }
  }
});

/**
 * Creates consistent dialog content props with scrollbar styling
 * @param theme Current theme
 * @returns Dialog content props with consistent styling
 */
export const getDialogContentProps = (theme: Theme) => ({
  sx: {
    ...scrollbarStyles(theme)
  }
});
