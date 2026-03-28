import { createTheme, alpha } from '@mui/material/styles';

// Design tokens
const palette = {
  violet: {
    main: '#7c3aed',
    light: '#a78bfa',
    dark: '#5b21b6',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    400: '#94a3b8',
    500: '#64748b',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
};

const shadows = {
  dark: {
    sm: '0 1px 2px rgba(0,0,0,0.3)',
    md: '0 2px 8px rgba(0,0,0,0.3)',
    lg: '0 4px 16px rgba(0,0,0,0.4)',
    xl: '0 8px 24px rgba(0,0,0,0.5)',
  },
  light: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    lg: '0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)',
    xl: '0 8px 24px rgba(0,0,0,0.1)',
  },
};

export function getScrollbarColors(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  return {
    thumb: isDark ? 'rgba(148,163,184,0.3)' : 'rgba(100,116,139,0.3)',
    thumbHover: isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)',
  };
}

export function createAppTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  const s = isDark ? shadows.dark : shadows.light;
  const scrollbar = getScrollbarColors(mode);

  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.violet.main,
        light: palette.violet.light,
        dark: palette.violet.dark,
      },
      secondary: {
        main: palette.violet.light,
      },
      success: {
        main: isDark ? '#22c55e' : '#16a34a',
      },
      error: {
        main: isDark ? '#ef4444' : '#dc2626',
      },
      info: {
        main: palette.slate[500],
      },
      background: {
        default: isDark ? '#080808' : '#e8edf4',
        paper: isDark ? '#131313' : '#ffffff',
      },
      text: {
        primary: isDark ? palette.slate[100] : palette.slate[900],
        secondary: isDark ? palette.slate[400] : palette.slate[500],
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : palette.slate[200],
      custom: {
        pageBackground: isDark ? '#080808' : '#e8edf4',
      },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: "'DM Sans', sans-serif",
      h4: { fontWeight: 700, letterSpacing: '-0.025em' },
      h5: { fontWeight: 700, letterSpacing: '-0.025em' },
      h6: { fontWeight: 700, letterSpacing: '-0.025em' },
      button: { fontWeight: 600, textTransform: 'none' as const },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            scrollbarColor: `${scrollbar.thumb} transparent`,
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: scrollbar.thumb,
              borderRadius: 4,
              '&:hover': { backgroundColor: scrollbar.thumbHover },
            },
          },
          '*': {
            scrollbarWidth: 'thin',
            scrollbarColor: `${scrollbar.thumb} transparent`,
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: scrollbar.thumb,
              borderRadius: 4,
              '&:hover': { backgroundColor: scrollbar.thumbHover },
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            textTransform: 'none' as const,
            padding: '8px 20px',
            transition: 'all 0.15s ease',
          },
          containedPrimary: {
            boxShadow: s.md,
            '&:hover': {
              backgroundColor: '#6d28d9',
              boxShadow: s.lg,
            },
          },
          outlined: {
            '&:hover': {
              backgroundColor: alpha(palette.violet.main, 0.08),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: s.md,
            transition: 'all 0.15s ease',
            ...(isDark ? {} : { border: '1px solid #cbd5e1' }),
            '&:hover': {
              boxShadow: s.lg,
              transform: 'translateY(-2px)',
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            boxShadow: s.xl,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: palette.violet.main,
              boxShadow: `0 0 0 3px ${alpha(palette.violet.main, 0.15)}`,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 500,
            fontSize: '0.75rem',
          },
          filled: {
            backgroundColor: alpha(palette.violet.main, isDark ? 0.12 : 0.08),
            color: palette.violet.main,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 6,
            fontSize: '0.75rem',
            backgroundColor: isDark ? palette.slate[800] : palette.slate[900],
            boxShadow: s.md,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            boxShadow: s.xl,
            backgroundImage: 'none',
          },
        },
      },
    },
  });
}
