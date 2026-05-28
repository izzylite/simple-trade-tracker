/**
 * Theme-mode predicates.
 *
 * Single source of truth for "is the active theme dark?". Replaces the
 * `theme.palette.mode === 'dark'` idiom that was duplicated across ~45 files.
 *
 * Works anywhere a `Theme` is in scope — components that called `useTheme()`
 * and `sx` callbacks alike:
 *
 *   const isDark = isDarkMode(theme);
 *   sx={{ bgcolor: (theme) => (isDarkMode(theme) ? '#000' : '#fff') }}
 */

import { Theme } from '@mui/material/styles';

/** True when the active MUI theme is in dark mode. */
export const isDarkMode = (theme: Theme): boolean => theme.palette.mode === 'dark';
