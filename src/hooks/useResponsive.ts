import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * Responsive breakpoint hooks — the single source of truth for viewport-class
 * decisions across the app. Prefer these over scattering raw
 * `useMediaQuery(theme.breakpoints.*)` calls so every surface agrees on where
 * "phone", "compact", and "desktop" begin.
 *
 * Breakpoint contract (see `.planning/architecture/mobile-responsive-support.md`):
 *  - mobile   : < sm  (< 600px)  → phone layouts: full-screen dialogs, mobile
 *                                  calendar tuning, table→card transforms,
 *                                  Orion full-screen chat.
 *  - compact  : < md  (< 900px)  → tablet-portrait tweaks.
 *  - desktop  : ≥ lg  (≥ 1200px) → persistent side-nav rail + inline panels.
 *
 * `mobile` and `desktop` are INDEPENDENT axes: the nav rail collapses to a
 * drawer below `lg`, while phone-specific layouts switch below `sm`.
 */

/** True on phones (< 600px). Drives full-screen dialogs + mobile layouts. */
export function useIsMobile(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

/** True on compact viewports (< 900px) — phones + portrait tablets. */
export function useIsCompact(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'));
}

/** True on desktop (≥ 1200px) — persistent rail + inline side panels. */
export function useIsDesktop(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.up('lg'));
}
