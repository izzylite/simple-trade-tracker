/**
 * Shared app-shell layout dimensions.
 *
 * The fixed `AppHeader` is shorter on phones (56px) than on tablet/desktop
 * (64px). Several surfaces need to offset by exactly that height — the main
 * content padding, the route-content column height, and the side-nav drawer's
 * top edge. Centralising the values here keeps them in lockstep and fixes the
 * latent bug where everything hardcoded `64px` and left an 8px dead-band on
 * phones.
 */

export const HEADER_HEIGHT_XS = 56;
export const HEADER_HEIGHT_SM = 64;

/** Responsive header height — spread into an sx `height`/`top`/`minHeight`. */
export const HEADER_HEIGHT = { xs: HEADER_HEIGHT_XS, sm: HEADER_HEIGHT_SM } as const;

/** Viewport height minus the header — for full-height page columns (`100vh`). */
export const BELOW_HEADER_HEIGHT = {
  xs: `calc(100vh - ${HEADER_HEIGHT_XS}px)`,
  sm: `calc(100vh - ${HEADER_HEIGHT_SM}px)`,
} as const;

/** Parent-height minus the header — for children sized in `%` (e.g. drawers). */
export const BELOW_HEADER_HEIGHT_PCT = {
  xs: `calc(100% - ${HEADER_HEIGHT_XS}px)`,
  sm: `calc(100% - ${HEADER_HEIGHT_SM}px)`,
} as const;

/** Canonical page horizontal gutter — `px: PAGE_GUTTER` on page containers. */
export const PAGE_GUTTER = { xs: 2, sm: 3 } as const;
