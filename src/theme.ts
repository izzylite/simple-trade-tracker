import { createTheme, alpha } from '@mui/material/styles';

// Design tokens — sourced from DESIGN.md
const palette = {
  violet: {
    main: '#7c3aed',
    light: '#a78bfa',
    dark: '#5b21b6',
    hover: '#6d28d9',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
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

  // DESIGN.md: dark uses 12% / 18% violet tints; light uses 10% / 16%.
  const tintVioletSoft = alpha(palette.violet.main, isDark ? 0.12 : 0.10);
  const tintVioletStrong = alpha(palette.violet.main, isDark ? 0.18 : 0.16);

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
      warning: {
        // Amber accent for charts and threshold indicators on the Performance
        // page. Deeper in light mode for legibility on white paper.
        main: isDark ? '#f59e0b' : '#d97706',
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
        // DESIGN.md fg-tertiary — slate-500 dark / slate-400 light.
        // For captions, timestamps, helper hints below text.secondary.
        tertiary: isDark ? palette.slate[500] : palette.slate[400],
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : palette.slate[200],
      custom: {
        pageBackground: isDark ? '#080808' : '#e8edf4',
        paperDarker: isDark ? '#1a1a1a' : palette.slate[50],
        hairline: isDark ? 'rgba(255,255,255,0.14)' : palette.slate[300],
        tintViolet: {
          soft: tintVioletSoft,
          strong: tintVioletStrong,
        },
        // Standard 15% glow used everywhere; 25% variant only where the
        // ring competes with busy header chrome (calendar selector).
        focusRing: `0 0 0 3px ${alpha(palette.violet.main, 0.15)}`,
        focusRingStrong: `0 0 0 3px ${alpha(palette.violet.main, 0.25)}`,
        // DESIGN.md radius scale — named so component sx reads as intent.
        radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24, pill: 999 },
        // Side-nav's ease-out-quart — the canonical confidence curve.
        easing: { smooth: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      },
    },
    shape: {
      borderRadius: 8,
    },
    // DESIGN.md motion durations: 150 / 180 / 240 ms. Mapped onto MUI's
    // existing slots so `theme.transitions.duration.shortest` already
    // resolves to the spec value across the whole stack.
    transitions: {
      duration: {
        shortest: 150,
        shorter: 180,
        short: 240,
        standard: 240,
        complex: 300,
        enteringScreen: 180,
        leavingScreen: 150,
      },
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
        easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
        sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      },
    },
    typography: {
      fontFamily: "'DM Sans', sans-serif",
      // ─── DESIGN.md typographic roles ───────────────────────────────────
      // Display — page-level titles (one per page max).
      h3: {
        fontSize: '2.125rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.025em',
      },
      // Headline — primary card titles, hero metrics.
      h4: {
        fontSize: '1.5rem',
        fontWeight: 700,
        lineHeight: 1.3,
        letterSpacing: '-0.025em',
      },
      h5: {
        fontSize: '1.5rem',
        fontWeight: 700,
        lineHeight: 1.3,
        letterSpacing: '-0.025em',
      },
      // Title — card subheaders, dialog titles, panel headings.
      h6: {
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '-0.015em',
      },
      subtitle1: {
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '-0.015em',
      },
      subtitle2: {
        fontSize: '0.9375rem',
        fontWeight: 600,
        lineHeight: 1.45,
        letterSpacing: '-0.01em',
      },
      // Body — dense reading text. body1 stays at 1rem for compat with
      // existing layouts; body2 is the canonical DESIGN.md Body.
      body2: {
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: 1.55,
        letterSpacing: 0,
      },
      caption: {
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: 0,
      },
      // Label — small uppercase labels (side-nav captions, eyebrow text).
      overline: {
        fontSize: '0.6875rem',
        fontWeight: 600,
        lineHeight: 1.1,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
      },
      // Numeric — P&L, balance, win-rate readouts. Tabular figures are
      // baked in here so every numeric site that opts into this variant
      // gets the Tabular-Number Rule for free.
      numeric: {
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '1.75rem',
        fontWeight: 700,
        lineHeight: 1.1,
        letterSpacing: '-0.015em',
        fontFeatureSettings: "'tnum' on, 'lnum' on",
      },
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
          // DESIGN.md: motion defaults to instant under reduced-motion.
          // Zero out CSS *transitions* (hover/focus/state decoration) but
          // leave CSS *animations* alone — those carry functional meaning
          // (loading spinners, progress indicators, attention pulses) and
          // freezing them would hide system state from a11y users. Per
          // W3C/MDN guidance: kill decorative motion, preserve feedback.
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              transitionDuration: '0ms !important',
              scrollBehavior: 'auto !important',
            },
          },
        },
      },
      MuiTypography: {
        // Register the custom Numeric variant so `<Typography variant="numeric">`
        // renders without warnings and picks the right wrapper element.
        defaultProps: {
          variantMapping: {
            numeric: 'span',
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
            lineHeight: 1,
            transition: 'background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
            // Replace the default browser outline with the violet focus ring.
            // Never `outline: none` without a replacement — DESIGN.md rule.
            '&:focus-visible': {
              outline: 'none',
              boxShadow: `0 0 0 3px ${alpha(palette.violet.main, 0.15)}`,
            },
            // Tactile press feedback. Scale only — no background change beyond hover.
            '&:active': {
              transform: 'scale(0.98)',
            },
          },
          // DESIGN.md: Subtle at rest, Card on hover. Theme was previously
          // shipping md→lg which made primary CTAs read as floating dialogs.
          containedPrimary: {
            boxShadow: s.sm,
            '&:hover': {
              backgroundColor: palette.violet.hover,
              boxShadow: s.md,
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
            transition: 'box-shadow 150ms cubic-bezier(0.22, 1, 0.36, 1), transform 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            ...(isDark ? {} : { border: `1px solid ${palette.slate[300]}` }),
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
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            boxShadow: s.lg,
            ...(isDark ? {} : { border: `1px solid ${palette.slate[200]}` }),
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
          // Default (uncolored) filled chip: violet-tinted background with
          // high-contrast text. The previous violet-on-violet scheme was
          // illegible. Colored variants (color="primary" etc.) bypass this
          // override and keep MUI's own background/text handling.
          filled: {
            backgroundColor: alpha(palette.violet.main, isDark ? 1 : 0.1),
            color: isDark ? palette.slate[50] : palette.slate[900],
            '& .MuiChip-deleteIcon': {
              color: alpha(isDark ? palette.slate[50] : palette.slate[900], 0.6),
              '&:hover': {
                color: isDark ? palette.slate[50] : palette.slate[900],
              },
            },
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
      MuiSwitch: {
        styleOverrides: {
          root: {
            // Slim iOS-style track + thumb. Replaces MUI's default
            // beefy `size="medium"` and the slightly clumsy `size="small"`
            // proportions. Used everywhere — keep it canonical.
            width: 36,
            height: 20,
            padding: 0,
            overflow: 'visible',
          },
          switchBase: {
            padding: 2,
            color: isDark ? palette.slate[400] : palette.slate[100],
            '&.Mui-checked': {
              transform: 'translateX(16px)',
              color: '#fff',
              '& + .MuiSwitch-track': {
                backgroundColor: palette.violet.main,
                opacity: 1,
              },
            },
            '&.Mui-focusVisible .MuiSwitch-thumb': {
              boxShadow: `0 0 0 3px ${alpha(palette.violet.main, 0.25)}`,
            },
          },
          thumb: {
            width: 16,
            height: 16,
            boxShadow: 'none',
          },
          track: {
            borderRadius: 999,
            backgroundColor: isDark ? palette.slate[700] : palette.slate[300],
            opacity: 1,
            transition: 'background-color 150ms',
          },
          sizeSmall: {
            // Cancel MUI's small-size overrides — our root values ARE small.
            width: 36,
            height: 20,
            padding: 0,
            '& .MuiSwitch-switchBase': {
              padding: 2,
            },
            '& .MuiSwitch-thumb': {
              width: 16,
              height: 16,
            },
          },
        },
      },
    },
  });
}
