/**
 * Shared design tokens for the JournoTrades style concept.
 *
 * Re-exports the canonical sx primitives that every redesigned component uses:
 * - EYEBROW_SX: uppercase neutral label (the 0.6875rem / 600 / 0.05em pattern)
 * - TNUM: tabular-numeric font-feature string
 * - SHADOWS / getShadow(theme, size): the mode-aware elevation scale
 * - getInsetSurface(theme): the 3%-tinted surface used inside outer cards
 * - getInsetHoverSurface(theme): the slightly-deeper hover variant of the above
 * - getHairline(theme): the 8%-white / divider hairline used across cards & dialogs
 * - getInsetTileSx(theme): the canonical 10px inset tile
 * - getCardShellSx(theme, radius): the canonical outer card shell
 *
 * Source of truth: `.aidesigner/handoff/journotrades-design-system/project/colors_and_type.css`
 * and CLAUDE.md's "Design Source of Truth" section.
 */

import { Theme, alpha } from '@mui/material/styles';
import { isDarkMode } from 'utils/themeMode';

/**
 * The mode-aware elevation scale. Sourced here so `theme.ts` (which builds the
 * MUI theme) and component sx (`getShadow(theme, ...)`) read from a single
 * table — eliminates the inline-string duplication that previously copied the
 * 80-char `lg`/`md` strings across ~7 files.
 */
export const SHADOWS = {
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
} as const;

export type ShadowSize = keyof typeof SHADOWS['dark'];

/** Mode-aware elevation string. Prefer over inlining the literal shadow value. */
export function getShadow(theme: Theme, size: ShadowSize): string {
  return SHADOWS[isDarkMode(theme) ? 'dark' : 'light'][size];
}

/** Tabular-figure font-feature string. Use wherever numbers stack. */
export const TNUM = "'tnum' on, 'lnum' on";

/**
 * Mono font stack for currency / numeric amounts.
 *
 * Re-exported from `styles/dialogTokens` so every redesigned component imports
 * the JetBrains Mono → ui-monospace → monospace fallback chain from one place.
 * Use for any P&L, currency, or amount display where the mono typographic
 * texture is part of the design language.
 */
export { MONO_FONT } from 'styles/dialogTokens';

/**
 * Canonical eyebrow label sx — uppercase neutral mini-heading used for
 * card subtitles, table column headers, section labels above a tile grid.
 * Color defaults to `text.secondary`; override per-site if you need primary
 * or tertiary by spreading: `{ ...EYEBROW_SX, color: 'text.primary' }`.
 */
export const EYEBROW_SX = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  color: 'text.secondary',
  lineHeight: 1.2,
} as const;

/**
 * Surface color for inset tiles inside an outer card. Slightly lighter than
 * the page background in dark mode (3% white) and slightly darker than paper
 * in light mode (3% text). Always reads as "this is nested content".
 */
export function getInsetSurface(theme: Theme): string {
  return isDarkMode(theme)
    ? 'rgba(255,255,255,0.03)'
    : alpha(theme.palette.text.primary, 0.03);
}

/**
 * Deeper variant of `getInsetSurface` used on hover/active states inside
 * dialogs — 6% white in dark, 5% text in light. Pair with `getInsetSurface`
 * for the rest state.
 */
export function getInsetHoverSurface(theme: Theme): string {
  return isDarkMode(theme)
    ? 'rgba(255,255,255,0.06)'
    : alpha(theme.palette.text.primary, 0.05);
}

/**
 * Canonical hairline color — the 8%-white-in-dark / `palette.divider`-in-light
 * value that draws card edges, dialog borders, and inset-tile rules. Same
 * computation that was previously redeclared inline in 6 files.
 */
export function getHairline(theme: Theme): string {
  return isDarkMode(theme) ? 'rgba(255,255,255,0.08)' : theme.palette.divider;
}

/**
 * Canonical inset-tile sx — 10px radius, hairline border, 3% surface.
 * Spread into any tile's sx; layout children come from the consumer.
 */
export function getInsetTileSx(theme: Theme) {
  return {
    p: 1.25,
    borderRadius: '10px',
    bgcolor: getInsetSurface(theme),
    border: `1px solid ${theme.palette.divider}`,
  } as const;
}

/**
 * Canonical outer-card shell sx — paper background + hairline divider border +
 * a semantic radius from the DESIGN.md scale. No box-shadow at rest; the
 * divider carries the edge. Use `'xl'` (16px) for top-level page sections and
 * `'lg'` (12px) for nested sub-cards.
 */
export function getCardShellSx(theme: Theme, radiusKey: 'lg' | 'xl' = 'xl') {
  return {
    bgcolor: 'background.paper',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: `${theme.palette.custom.radius[radiusKey]}px`,
    overflow: 'hidden' as const,
  };
}
