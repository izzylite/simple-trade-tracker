import { ThemeOptions } from '@mui/material/styles';

// Scrollbar colors based on theme mode
const getScrollbarColors = (mode: 'light' | 'dark') => ({
  thumb: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
  thumbHover: mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
});

export const createAppTheme = (mode: 'light' | 'dark'): ThemeOptions => {
  const scrollbarColors = getScrollbarColors(mode);

  return {
    palette: {
      mode,
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#dc004e',
        light: '#ff4081',
        dark: '#c51162',
      },
      info: {
        main: '#757575',
        light: '#9e9e9e',
        dark: '#424242',
      },
      background: {
        default: mode === 'dark' ? '#121212' : '#f5f5f5',
        paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
      },
      // Custom background for main page areas
      custom: {
        pageBackground: mode === 'dark' ? '#121212' : '#e8e8e8',
      },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 600,
      },
      h5: {
        fontWeight: 500,
      },
      h6: {
        fontWeight: 500,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // Global scrollbar styles
          '*': {
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: scrollbarColors.thumb,
              borderRadius: '4px',
              '&:hover': {
                background: scrollbarColors.thumbHover,
              },
            },
          },
          // Firefox scrollbar support
          html: {
            scrollbarWidth: 'thin',
            scrollbarColor: `${scrollbarColors.thumb} transparent`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: mode === 'dark'
              ? '0 4px 12px rgba(0,0,0,0.2)'
              : '0 4px 12px rgba(0,0,0,0.05)',
          },
        },
      },
    },
  };
}; 