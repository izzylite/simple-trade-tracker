import { Theme } from '@mui/material/styles';

/**
 * Creates consistent scrollbar styles for use throughout the application
 * @param theme The current MUI theme
 * @returns An object containing scrollbar styles that can be spread into sx props
 */
export const scrollbarStyles = (theme: Theme) => ({
  '&::-webkit-scrollbar': {
    width: '8px',
    height: '8px'
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent'
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.2)'
      : 'rgba(0, 0, 0, 0.2)',
    borderRadius: '4px',
    '&:hover': {
      background: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.3)'
        : 'rgba(0, 0, 0, 0.3)'
    }
  }
});