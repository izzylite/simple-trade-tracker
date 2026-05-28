/**
 * useDialogTokens
 *
 * Single source of truth for the tag-dialog style language used across every
 * form / picker / detail dialog in the app. Returns raw color/hairline values
 * plus pre-composed sx blocks for the header avatar, footer chrome, mono
 * labels, inset inputs, chips, and CTAs.
 *
 * Pass `accentOverride` to retint the violet family (used by ConfirmationDialog
 * to recolor the avatar + primary button when confirmColor is error / warning /
 * success / info).
 */

import { useMemo } from 'react';
import { alpha, useTheme } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { isDarkMode } from 'utils/themeMode';

export const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

export interface DialogTokens {
  isDark: boolean;

  // Raw values
  accent: string;
  accentDark: string;
  accentSoft: string;
  accentSofter: string;
  accentBorder: string;
  surfaceInset: string;
  hairline: string;
  footerBg: string;

  // Violet-aliased values — same as accent* when no override is passed. Kept
  // distinct so callers reading the brand language stay readable.
  violet: string;
  violetSoft: string;
  violetSofter: string;
  violetBorder: string;

  // Composed sx blocks
  paperSx: Record<string, any>;
  headerSx: Record<string, any>;
  iconAvatarSx: Record<string, any>;
  footerSx: Record<string, any>;
  monoLabelSx: Record<string, any>;
  monoSectionLabelSx: Record<string, any>;
  optionalSx: Record<string, any>;
  inputSx: Record<string, any>;
  primaryButtonSx: Record<string, any>;
  ghostButtonSx: Record<string, any>;
  destructiveButtonSx: Record<string, any>;
  chipStyle: (selected: boolean) => Record<string, any>;
}

function buildTokens(theme: Theme, accentOverride?: string): DialogTokens {
  const isDark = isDarkMode(theme);
  const accent = accentOverride ?? theme.palette.primary.main;
  const accentDark = accentOverride
    ? theme.palette.augmentColor({ color: { main: accent } }).dark
    : theme.palette.primary.dark;
  const accentSoft = alpha(accent, isDark ? 0.18 : 0.14);
  const accentSofter = alpha(accent, isDark ? 0.12 : 0.10);
  const accentBorder = alpha(accent, isDark ? 0.35 : 0.28);
  const surfaceInset = isDark ? 'rgba(255,255,255,0.03)' : alpha(theme.palette.text.primary, 0.03);
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : theme.palette.divider;
  const footerBg = isDark ? 'rgba(255,255,255,0.02)' : alpha(theme.palette.text.primary, 0.02);

  const paperSx = {
    borderRadius: 2,
    border: `1px solid ${hairline}`,
    boxShadow: theme.shadows[10],
    backgroundImage: 'none',
    overflow: 'hidden',
  };

  const headerSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    px: 2.5,
    py: 1.75,
    borderBottom: `1px solid ${hairline}`,
  };

  const iconAvatarSx = {
    width: 32,
    height: 32,
    borderRadius: 1.25,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accentSoft,
    color: accent,
    border: `1px solid ${accentBorder}`,
    flexShrink: 0,
  };

  const footerSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 1,
    px: 2.5,
    py: 1.5,
    borderTop: `1px solid ${hairline}`,
    backgroundColor: footerBg,
  };

  const monoLabelSx = {
    fontFamily: MONO_FONT,
    fontSize: '0.68rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.75,
  };

  const monoSectionLabelSx = {
    ...monoLabelSx,
    fontSize: '0.62rem',
    color: alpha(theme.palette.text.secondary, 0.85),
  };

  const optionalSx = {
    fontFamily: MONO_FONT,
    fontSize: '0.66rem',
    fontWeight: 500,
    letterSpacing: '0.08em',
    color: alpha(theme.palette.text.secondary, 0.7),
    textTransform: 'none' as const,
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 1.5,
      backgroundColor: surfaceInset,
      '& fieldset': { borderColor: hairline },
      '&:hover fieldset': { borderColor: alpha(accent, 0.5) },
      '&.Mui-focused fieldset': { borderColor: accent, borderWidth: 1 },
    },
    '& .MuiOutlinedInput-input, & .MuiSelect-select': {
      py: 1.1,
      fontSize: '0.88rem',
      fontWeight: 500,
    },
  };

  const primaryButtonSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.85rem',
    backgroundColor: accent,
    color: '#fff',
    borderRadius: 1.25,
    px: 1.75,
    py: 0.75,
    boxShadow: 'none',
    '&:hover': { backgroundColor: accentDark, boxShadow: 'none' },
    '&.Mui-disabled': {
      backgroundColor: alpha(accent, 0.35),
      color: alpha('#fff', 0.7),
    },
  };

  const ghostButtonSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.85rem',
    color: theme.palette.text.secondary,
    '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.04) },
  };

  const destructiveButtonSx = {
    textTransform: 'none' as const,
    fontWeight: 600,
    fontSize: '0.82rem',
    color: theme.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, 0.08),
    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
    borderRadius: 1.25,
    px: 1.5,
    py: 0.5,
    '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.16) },
  };

  const chipStyle = (selected: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    px: 1.25,
    py: 0.5,
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 600,
    userSelect: 'none' as const,
    fontFamily: 'inherit',
    transition: 'all 120ms ease',
    backgroundColor: selected ? accentSoft : surfaceInset,
    color: selected ? accent : theme.palette.text.primary,
    border: `1px solid ${selected ? accentBorder : hairline}`,
    '&:hover': {
      backgroundColor: selected
        ? accentSoft
        : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
    },
  });

  return {
    isDark,
    accent,
    accentDark,
    accentSoft,
    accentSofter,
    accentBorder,
    surfaceInset,
    hairline,
    footerBg,
    // violet aliases — same values when no override
    violet: accent,
    violetSoft: accentSoft,
    violetSofter: accentSofter,
    violetBorder: accentBorder,
    paperSx,
    headerSx,
    iconAvatarSx,
    footerSx,
    monoLabelSx,
    monoSectionLabelSx,
    optionalSx,
    inputSx,
    primaryButtonSx,
    ghostButtonSx,
    destructiveButtonSx,
    chipStyle,
  };
}

export function useDialogTokens(accentOverride?: string): DialogTokens {
  const theme = useTheme();
  return useMemo(() => buildTokens(theme, accentOverride), [theme, accentOverride]);
}
