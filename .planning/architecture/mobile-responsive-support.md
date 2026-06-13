# Mobile Responsive Support — Design & Plan

**Status:** Implemented (P0–P4 complete) — pending review/merge
**Branch:** `feat/mobile-responsive-support`
**Started / Completed:** 2026-06-13
**Owner:** app-wide UI

## Outcome (2026-06-13)

Shipped P0–P3 across 5 commits. Verification: `tsc --noEmit` clean (all
changed files), `npm run build` green, `npm run test:ci` green, static
overflow sweep clean. Playwright at 360px **and** 320px on the public routes
(`/`, `/pricing`, `/about`, `/terms`) → **0 horizontal page overflow**, 0
console errors. The authenticated pillars (calendar/performance/notes/events/
orion) were fixed against the structured audit + reviewed at the diff level but
**not** driven through Playwright (Supabase auth — no test credentials in this
environment); a future manual/logged-in pass at 360px is the remaining check.

Audit basis: `mobile-audit-findings.json` (179 surfaces) + `mobile-audit-tasks.txt`.

## Goal

Make every page and dialog usable and well-laid-out on phones, down to a **360px**
design floor (no horizontal overflow down to **320px**). This is an app-wide
responsive sweep, not a single feature.

## Decisions (locked with product owner)

| Decision | Choice |
| --- | --- |
| **Scope** | **Everything** — all ~21 route pages (incl. Landing, Pricing, About, Legal, Shared-link, auth/login, account/billing) + all ~30 dialogs. |
| **Depth** | **Hybrid** — harden every surface (no overflow, full-screen dialogs, 44px tap targets, readable type) AND build purpose-built mobile layouts for the genuinely hard surfaces. |
| **Design floor** | **360px** (modern Android). iPhone SE 375 and up comfortable. No horizontal overflow to 320px. |
| **Mobile navigation** | **Top-bar hamburger drawer** — proper hamburger in `AppHeader` opens the existing `SideNav` rail as a drawer. Retire the temporary floating button in `AppLayout`. |
| **Calendar grid** | **Keep the 7-col month grid, mobile-tuned** — shrink cells, compact per-day P&L, tap → full-screen day dialog. Preserve the month-at-a-glance mental model. |

## Current state (as found)

- The only responsive split today is `useMediaQuery(theme.breakpoints.up('lg'))`
  (1200px): the `SideNav` is a permanent rail + inline panels at `lg+`, and a
  temporary drawer / `UnifiedDrawer` below `lg`.
- `AppLayout` renders a **temporary floating hamburger** (a code comment admits
  it is a stopgap "until AppHeader gets a hamburger").
- `BaseDialog` (used by most of the ~30 dialogs) has **no full-screen-on-phone
  behavior** — it only caps at `maxWidth` + `maxHeight: 90vh`.
- **Latent bug:** `App.tsx` pads main content `pt: 8` (64px) and
  `AppLayout`/`SideNav` hardcode `64px`, but `AppHeader` is only `56px` tall on
  `xs` → an 8px misalignment / dead-band on phones.
- `AppHeader` and `AppLayout` are **siblings** in `App.tsx`; the
  `mobileNavOpen` state lives in `AppLayout`, so the header hamburger needs a
  small shared context.

## Breakpoint contract

Single source of truth in `src/hooks/useResponsive.ts`:

- `useIsMobile()` → `down('sm')` (**< 600px**) — triggers phone layouts:
  full-screen dialogs, mobile calendar tuning, table→card transforms, Orion
  full-screen chat.
- `useIsCompact()` → `down('md')` (**< 900px**) — tablet-portrait tweaks.
- `useIsDesktop()` → `up('lg')` (**≥ 1200px**) — desktop rail + inline panels
  (replaces the repeated inline `up('lg')` queries).

These are **independent**: the nav rail switches at `< lg` (unchanged); the
phone layouts switch at `< sm`. Don't churn the existing `lg` split.

## Approach

**Centralized primitives (backbone) + bespoke layouts for hard surfaces only.**

Rejected alternatives:
- *Per-page `sx` pass* — ~50 surfaces hand-tuned → duplication + drift, violates
  the repo's Reuse-Before-Creating rule, doesn't scale.
- *Parallel mobile component tree* — 2× maintenance + drift. Reserved ONLY for a
  surface that genuinely can't be one responsive component (likely the PnL
  heatmap).

## P0 — Backbone (fix once, inherit everywhere)

1. **`src/hooks/useResponsive.ts`** — the three hooks above.
2. **`src/styles/layout.ts`** — shared layout dims:
   `HEADER_HEIGHT = { xs: 56, sm: 64 }`, `BELOW_HEADER_HEIGHT` calc strings,
   `PAGE_GUTTER = { xs: 2, sm: 3 }`. Replaces all hardcoded `64px`.
3. **`src/contexts/MobileNavContext.tsx`** — `{ open, openNav, closeNav,
   toggleNav }`. Provider wraps the header + routes in `App.tsx`.
4. **`AppHeader`** — add a hamburger `IconButton` (auth user + `< lg`) wired to
   `openNav()`; hide Discord on `xs`; tighten toolbar gaps + selector width so
   the bar fits 360px.
5. **`AppLayout`** — consume `MobileNavContext` (remove local `mobileNavOpen`),
   delete the floating button, use `HEADER_HEIGHT`/`BELOW_HEADER_HEIGHT`.
6. **`SideNav`** — use `HEADER_HEIGHT` token for drawer `top`/height.
7. **`App.tsx`** — mount `MobileNavProvider`; make the content `pt` responsive
   (`{ xs: 7, sm: 8 }`).
8. **`BaseDialog`** — `fullScreen={useIsMobile()}`; square the radius + flatten
   the maxHeight when full-screen; keep sticky header/footer. All BaseDialog
   consumers inherit phone full-screen.
9. **`UnifiedDrawer`** — verify full-height + `width: { xs: '100%', sm: 450 }`
   + safe-area padding.

## P1 — Core pillars (bespoke mobile layouts)

- **Calendar** — month grid tuned for 360px; selector bar + weekday header fit;
  `DayDialog` / `TradeFormDialog` full-screen.
- **Performance** — stack chart cards vertically; responsive Recharts
  containers; PnL heatmap → horizontally-scrollable / simplified mobile variant
  (the likely Approach-C exception); tap-friendly tooltips.
- **Notes** — Draft.js editor + toolbar usable on phone; note list single-col.
- **Events** — wide economic-events table → stacked cards below `sm`.
- **Orion** — chat full-screen takeover on phone; input bar pinned above the
  keyboard with `env(safe-area-inset-*)`.

## P2 — Dialog sweep

All ~30 dialogs verified at 360px. BaseDialog ones inherit full-screen; the raw
`<Dialog>`/`Modal` ones (e.g. image zoom, trade gallery) get matching
treatment. Wide content (import mapping table, tag pickers) made scrollable /
stacked.

## P3 — Public pages

Landing, Pricing, About, Legal (Terms/Privacy/Refund), Shared-link
(Calendar/Trade/Note), auth/login, account/billing — all verified responsive.

## P4 — Verification

Playwright pass at **360×800** (+ a **320** no-overflow check) over every route
and each dialog opened: full-page screenshots + `document.scrollingElement`
horizontal-overflow assertion + console-error capture. Backed by a parallel
audit workflow so coverage is exhaustive, not spot-checked.

## Testing / quality gates

- `npx tsc --noEmit` clean after each phase.
- `npm run test:ci` green (no regressions to existing unit tests).
- `npm run build` succeeds.
- Playwright responsive audit (P4).

## Commit strategy

One commit per phase (P0…P4) on `feat/mobile-responsive-support` so any phase
can be reverted independently.
