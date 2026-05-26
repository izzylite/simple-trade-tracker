// Shared helpers + style tokens for the custom-tool form pieces. Pulled
// out of CustomToolFormDialog so the dialog + its sub-components can all
// reach for the same name/url validators and docs <pre> styling without
// re-declaring them.

import type { Theme } from '@mui/material';

const NAME_REGEX = /^[a-z][a-z0-9_]*$/;

export function isValidName(value: string): boolean {
  return NAME_REGEX.test(value) && value.length <= 54;
}

/** Stricter URL check than `startsWith('https://')` — catches blanks,
 *  malformed URLs, and any non-https scheme via WHATWG URL parser. */
export function isValidHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !!u.hostname;
  } catch {
    return false;
  }
}

/** Style for the docs <pre> snippets in WebhookDocsAccordion. Theme-aware
 *  so it picks up the right hover surface + divider in dark/light mode. */
export const preBox = (theme: Theme) => ({
  m: 0,
  p: 1,
  borderRadius: 1,
  backgroundColor: theme.palette.action.hover,
  border: `1px solid ${theme.palette.divider}`,
  fontFamily: 'monospace',
  fontSize: '0.72rem',
  lineHeight: 1.4,
  overflow: 'auto',
  whiteSpace: 'pre' as const,
});
