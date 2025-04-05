import { createTheme, alpha, Theme, ThemeOptions } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

// Custom color palette
const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? '#2196F3' : '#90CAF9',
      light: mode === 'light' ? '#64B5F6' : '#BBDEFB',
      dark: mode === 'light' ? '#1976D2' : '#42A5F5',
      contrastText: mode === 'light' ? '#fff' : '#000',
    },
    secondary: {
      main: mode === 'light' ? '#FF4081' : '#FF80AB',
      light: mode === 'light' ? '#FF80AB' : '#FF80AB',
      dark: mode === 'light' ? '#F50057' : '#FF4081',
      contrastText: mode === 'light' ? '#fff' : '#000',
    },
    success: {
      main: mode === 'light' ? '#4CAF50' : '#81C784',
      light: mode === 'light' ? '#81C784' : '#A5D6A7',
      dark: mode === 'light' ? '#388E3C' : '#66BB6A',
    },
    error: {
      main: mode === 'light' ? '#F44336' : '#E57373',
      light: mode === 'light' ? '#E57373' : '#EF9A9A',
      dark: mode === 'light' ? '#D32F2F' : '#EF5350',
    },
    warning: {
      main: mode === 'light' ? '#FFA726' : '#FFB74D',
      light: mode === 'light' ? '#FFB74D' : '#FFCC80',
      dark: mode === 'light' ? '#F57C00' : '#FFA726',
    },
    info: {
      main: mode === 'light' ? '#29B6F6' : '#4FC3F7',
      light: mode === 'light' ? '#4FC3F7' : '#81D4FA',
      dark: mode === 'light' ? '#0288D1' : '#29B6F6',
    },
    background: {
      default: mode === 'light' ? '#F5F5F5' : '#121212',
      paper: mode === 'light' ? '#FFFFFF' : '#1E1E1E',
    },
    text: {
      primary: mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'rgba(255, 255, 255, 0.87)',
      secondary: mode === 'light' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)',
    },
    divider: mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none' as const,
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        contained: ({ theme }: { theme: Theme }) => ({
          boxShadow: 'none',
          '&:hover': {
            boxShadow: theme.shadows[4],
          },
        }),
        outlined: ({ theme }: { theme: Theme }) => ({
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
          },
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          backgroundImage: 'none',
          transition: 'all 0.2s ease-in-out',
          ...(theme.palette.mode === 'dark' && {
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.025))',
          }),
        }),
        elevation1: {
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
        },
        elevation2: {
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
        },
        elevation3: {
          boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)',
        },
        elevation4: {
          boxShadow: '0px 12px 24px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&:hover': {
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid',
          borderColor: 'divider',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': {
            borderBottom: 0,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(8px)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

// Create theme instance
export const createAppTheme = (mode: PaletteMode) => {
  return createTheme(getDesignTokens(mode) as ThemeOptions);
};

// Export light and dark themes
export const lightTheme = createAppTheme('light');
export const darkTheme = createAppTheme('dark'); 