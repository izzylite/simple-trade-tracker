---
name: JournoTrades
description: Trading journal calendar with analytics and an AI assistant, tuned for traders who keep it open all day.
colors:
  violet-primary: "#7c3aed"
  violet-soft: "#a78bfa"
  violet-deep: "#5b21b6"
  violet-hover: "#6d28d9"
  win-green-dark: "#22c55e"
  win-green-light: "#16a34a"
  loss-red-dark: "#ef4444"
  loss-red-light: "#dc2626"
  ink-near-black: "#080808"
  ink-paper-dark: "#131313"
  ink-paper-darker: "#1a1a1a"
  ink-paper-light: "#ffffff"
  page-light: "#e8edf4"
  slate-50: "#f8fafc"
  slate-100: "#f1f5f9"
  slate-200: "#e2e8f0"
  slate-300: "#cbd5e1"
  slate-400: "#94a3b8"
  slate-500: "#64748b"
  slate-700: "#334155"
  slate-800: "#1e293b"
  slate-900: "#0f172a"
  divider-dark: "rgba(255,255,255,0.08)"
  hairline-dark: "rgba(255,255,255,0.14)"
  tint-violet-12: "rgba(124,58,237,0.12)"
  tint-violet-18: "rgba(124,58,237,0.18)"
typography:
  display:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: "1.2"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.3"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.4"
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.55"
    letterSpacing: "0"
  label:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: "1.1"
    letterSpacing: "0.05em"
  numeric:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "1.1"
    letterSpacing: "-0.015em"
    fontFeature: "'tnum' on, 'lnum' on"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.violet-primary}"
    textColor: "{colors.ink-paper-light}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.violet-hover}"
    textColor: "{colors.ink-paper-light}"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.violet-primary}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
  button-pill:
    backgroundColor: "{colors.violet-primary}"
    textColor: "{colors.ink-paper-light}"
    rounded: "{rounded.pill}"
    padding: "8px 24px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.ink-paper-dark}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip-filled:
    backgroundColor: "{colors.violet-primary}"
    textColor: "{colors.slate-50}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    typography: "{typography.label}"
  chip-tint:
    backgroundColor: "{colors.tint-violet-12}"
    textColor: "{colors.slate-100}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.ink-paper-dark}"
    textColor: "{colors.slate-100}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    typography: "{typography.body}"
  side-nav-tile:
    backgroundColor: "transparent"
    textColor: "{colors.slate-400}"
    rounded: "{rounded.xl}"
    height: "44px"
    width: "44px"
  side-nav-tile-active:
    backgroundColor: "{colors.violet-primary}"
    textColor: "{colors.ink-paper-light}"
    rounded: "{rounded.xl}"
    height: "44px"
    width: "44px"
  side-nav-tile-create:
    backgroundColor: "{colors.tint-violet-12}"
    textColor: "{colors.violet-primary}"
    rounded: "{rounded.xl}"
    height: "44px"
    width: "44px"
---

# Design System: JournoTrades

## 1. Overview

**Creative North Star: "The Trader's Logbook"**

JournoTrades looks and behaves like a digital descendant of an analog trading logbook. Pages of structured ledgers, columns of figures, marginal notes in a steady hand. Not a marketing site, not a casino app, not a Bloomberg terminal. A workspace a serious trader keeps open while doing the work, that earns its place by being honest about the data and quiet about itself.

The system rejects the visual reflexes that have become fintech wallpaper. No purple-to-pink gradient over hero numbers. No celebration animation when a trade closes green. No skeuomorphic broker chrome. No Bloomberg-style information avalanche. Hierarchy comes from spacing and weight contrast, not from decorative elevation.

Dark mode is the default surface, tuned for hours of staring on a second monitor in dim or mixed light. Light mode is treated with the same care, never as an afterthought. Win and loss are encoded with color, glyph, and sign together so the meaning survives in any palette and for any user.

**Key Characteristics:**
- Numbers carry the page; chrome stays out of the way.
- Tabular numerals and calm spacing over flashy emphasis.
- One violet, used sparingly. The accent is a signal, not a wallpaper.
- Crisp 8/12 px corners on most affordances; 16 px on icon-tiles; pills only as labels or empty-state CTAs.
- Motion is calm and exponential, defaulting to instant under reduced-motion.

## 2. Colors

A restrained palette: tinted near-black surfaces, a single violet accent that earns each appearance, and a green/red pair reserved for win and loss.

### Primary
- **Trader Violet** (#7c3aed): the only saturated brand color. Used on the active side-nav tile (solid pill), primary buttons, focus rings, key chart indicators. Cap visible coverage on any single screen at ~10%.
- **Violet Soft** (#a78bfa): legible violet for text and icons on tinted-violet backgrounds; in-chart highlights for dark mode.
- **Violet Deep** (#5b21b6): MUI `primary.dark`. Used as the side-nav active-tile hover state and as the border color for selected toggle states (Stats panel toggle, dialog selection rings, RichTextEditor active link). Never used as a foreground color.
- **Violet Hover** (#6d28d9): the resting-button-hover override on `MuiButton.containedPrimary`. One step lighter than Violet Deep so primary CTAs darken on hover without flashing toward indigo. Reserved for that one role.

### Tertiary
- **Win Green** (#22c55e dark / #16a34a light): positive P&L only. Always paired with an up-arrow glyph and a `+` sign.
- **Loss Red** (#ef4444 dark / #dc2626 light): negative P&L only. Always paired with a down-arrow glyph and a `-` sign.

### Neutral
- **Ink Near-Black** (#080808): the dark page backdrop. Off-black, not pure; reads as paper, not as void. Re-exposed on the MUI palette as `custom.pageBackground` so non-MUI surfaces can match the canvas without re-deriving the value.
- **Ink Paper Dark** (#131313): card and panel surface in dark mode; one tonal step above the page so containers feel placed, not pasted.
- **Ink Paper Darker** (#1a1a1a): the rare nested surface, used only when a panel sits inside another panel that already carries `ink-paper-dark`.
- **Ink Paper Light** (#ffffff): card surface in light mode. The only place pure white is permitted.
- **Page Light** (#e8edf4): light-mode page backdrop, a cool slate tint that keeps cards distinct.
- **Slate 50–900** (#f8fafc → #0f172a): typographic neutrals. Body text and chip text resolve into this scale at both ends of the theme.
- **Slate 300** (#cbd5e1): the light-mode card border. One step heavier than Slate 200 so the border survives on the cool `#e8edf4` page tint without feeling drawn.
- **Divider Dark** (rgba(255,255,255,0.08)): the only dark-mode border value used for structural lines.
- **Hairline Dark** (rgba(255,255,255,0.14)): rare emphasis line, used only where a divider needs to read at a glance (chart axes, calendar column header).
- **Tint Violet 12 / 18** (rgba(124,58,237,0.12) / 0.18): the side-nav Create tile background and selected dropdown items. The 18% step is the hover state for those same surfaces. Light mode uses 10% / 16% for the parallel roles.

### Named Rules
**The One Purple Rule.** Trader Violet appears at most on ~10% of any screen surface. The active side-nav tile is the rare full-saturation exception — it works because the rail itself is narrow, so the violet remains a small percentage of the page. If a redesign starts to need violet on multiple structural surfaces, the layout is wrong, not the color. Avoid pairing violet with another saturated hue except the win/loss pair, which lives in its own semantic lane.

**The Win/Loss Triple-Encoding Rule.** Profit and loss are never expressed by color alone. The triple (color + glyph + sign) is mandatory. No green text without an up-arrow and `+`. No red text without a down-arrow and `-`.

**The Pure-Pixel Rule.** Light-mode paper is `#ffffff` for compatibility. Pure white is permitted only on the paper surface. Page backdrop, all neutrals, and any tinted area must be off-white (e.g. `#e8edf4`) to keep the system from looking sterile.

**The Single-Hover-Hex Rule.** Primary-CTA hover is Violet Hover (#6d28d9), not Violet Deep. Only the `MuiButton.containedPrimary` override carries that hex. Any other hover surface that wants a darker violet (toggle borders, side-nav active hover) uses `primary.dark` (Violet Deep). Don't introduce a third violet hover hex.

## 3. Typography

**Display Font:** DM Sans (with system-ui fallback)
**Body Font:** DM Sans (with system-ui fallback)
**Numeric Treatment:** DM Sans with `font-feature-settings: 'tnum' on, 'lnum' on` so columns of P&L line up vertically.

**Character:** A single, geometric humanist sans, set tightly. Negative letter-spacing on display sizes pulls headlines into a structured block; body remains comfortably readable. Tabular figures are mandatory wherever numbers stack.

### Hierarchy
- **Display** (700, 2.125rem / 34px, line-height 1.2, letter-spacing -0.025em): page-level titles such as section headers on Performance or Notes. One per page maximum.
- **Headline** (700, 1.5rem / 24px, line-height 1.3): primary card titles, hero metrics in account stats.
- **Title** (600, 1.125rem / 18px, line-height 1.4): card subheaders, dialog titles, the calendar selector trigger label.
- **Body** (400, 0.875rem / 14px, line-height 1.55): dense reading text. Cap at 65–75ch for any prose-style block (notes, chat, FAQ).
- **Label** (600, 0.6875rem / 11px, letter-spacing 0.05em, uppercase): small labels for category headers, side-nav item names, calendar dropdown header.
- **Numeric** (700, 1.75rem / 28px, tabular figures): P&L, balance, win-rate readouts. Always tabular.

### Named Rules
**The Tabular-Number Rule.** Any cell, list, or readout that renders a count, percent, or currency must use `font-feature-settings: 'tnum' on, 'lnum' on`. Proportional figures in P&L tables are forbidden.

**The Single-Display Rule.** A page may have one Display-size headline at most. Multiple display sizes flatten the hierarchy back into noise.

**The Sentence-Case Default.** Body, captions, and microcopy in sentence case. Title Case is reserved for product surface names ("Performance", "Notes", "Assistant", "Calendars"). ALL CAPS is reserved for the Label role only — never for button text or body sentences.

## 4. Elevation

The system is **mostly flat with selective tonal layering.** Surfaces step up by one tone (page → paper) rather than by shadow. Shadows are reserved for elements that genuinely float (dialogs, drawers, tooltips, dropdown menus, hover-lifted cards).

### Shadow Vocabulary
- **Subtle** (`0 1px 2px rgba(0,0,0,0.30)` dark / `0 1px 2px rgba(0,0,0,0.05)` light): hairline beneath buttons at rest.
- **Card** (`0 2px 8px rgba(0,0,0,0.30)` dark / `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` light): cards, panels.
- **Floating** (`0 4px 16px rgba(0,0,0,0.40)` dark / `0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)` light): popovers, dropdowns, hover-lifted cards.
- **Modal** (`0 8px 24px rgba(0,0,0,0.50)` dark / `0 8px 24px rgba(0,0,0,0.10)` light): dialogs and drawers only.
- **Lifted-Empty-State** (MUI `theme.shadows[6]`): used by the Calendar Lock card. Slightly deeper than Floating but lighter than Modal — it floats above a blurred page without competing with a true dialog stacked over it.

### Named Rules
**The No-Glass Rule.** No `backdrop-filter: blur` decoration on cards, navs, or panels. The two permitted uses are the calendar-lock-overlay backdrop and the calendar-switching spinner overlay, both of which obscure live content for a reason.

**The Hover Lift Rule.** Cards may translate at most `-2px` on hover, paired with the next shadow step up. No scale transforms, no rotation, no shadow expansion beyond one tier.

**The Flat-By-Default Rule.** Resting surfaces are flat. Tonal contrast does the lifting; shadow only signals "this floats."

## 5. Components

### Buttons
- **Shape:** 8 px corners (`{rounded.md}`). Pills (`{rounded.pill}`) are reserved for empty-state CTAs (the Calendar Lock card's "Create Calendar" action) and the FAQ-style helper buttons that wrap text.
- **Primary:** Trader Violet background, white text, 8/20 px padding. Shadow `Subtle` at rest, `Card` on hover. Hover background is **Violet Hover** (#6d28d9), not Violet Deep — see The Single-Hover-Hex Rule. No gradient, ever.
- **Outlined:** Transparent background, Trader Violet text and 1 px border. Hover fills with violet at 8% alpha.
- **Pill:** Same fill + text rules as Primary, but `border-radius: 999px` and 8/24 px padding. Used only as a tactile empty-state CTA so the affordance reads as "do this, this is the one thing on screen", not as a generic button.
- **Hover / Focus:** 150 ms ease-out for color and shadow. Focus ring is `0 0 0 3px rgba(124,58,237,0.15)` around the input or button outline; never `outline: none` without a replacement.
- **Active:** 0.98 scale on `:active`; no background change beyond the hover state.

### Side-Nav Items (signature)

The vertical icon-rail (`SIDE_NAV_WIDTH = 92px`) is composed of three tiers separated by hairline dividers: a top **Create** action, the primary **NAV_ITEMS** stack (Home / Performance / Assistant / Notes), and a demoted **utility** tier (currently About).

- **Item layout:** a 44×44 px tile (`{rounded.xl}` = 16 px corners) holding a 22 px icon, with an 11 px Label-typography caption stacked underneath. The whole button is the click target; the tile is the visual.
- **Default tile:** transparent background, icon in `text.secondary` (Slate 400 / Slate 500). Hover fills the tile with `action.hover` (~4% alpha tint) and lifts the icon to `text.primary` / Slate 100.
- **Active tile (route match):** **solid Trader Violet** background, icon in `primary.contrastText` (white), label below the tile in Trader Violet. The full-saturation pill is the rail's only loud violet; the rail is narrow enough that this still satisfies The One Purple Rule. Hover on an active tile shifts the background to Violet Deep.
- **Create tile (top):** Trader Violet at **12% alpha** background at all times, icon in Trader Violet, label in `text.primary`. Hover lifts to 18% alpha. The variant exists so the primary "Create Calendar" action reads as the page's first affordance without competing with whichever route is currently active.
- **Active press:** 0.96 scale on `:active`, 180 ms ease-out-quart for both background and color transitions.
- **Focus ring:** a doubled 2 px-paper / 4 px-violet@45% alpha ring drawn around the tile (not the outer button), so the ring sits flush with the visible affordance.
- **Hairline dividers:** 1 px `theme.palette.divider` strips above the route stack and above the utility tier. They mark demotion in hierarchy without adding chrome.
- **Below `lg`** the rail collapses into a temporary drawer at the same width.

### Calendar Selector Bar (signature)

The page-header bar that replaces breadcrumbs on Home (TradeCalendarPage) and on the calendar-bound Performance / Stats views.

- **Trigger:** a flat ButtonBase composed of a 32 px rounded avatar (calendar hero image or a violet-tinted CalendarIcon at 18% alpha), the calendar name in Title-size weight 600, and an 18 px chevron that rotates 180° when the menu is open. Hover applies `action.hover`. Focus ring is the stronger `0 0 0 3px rgba(124,58,237,0.25)` glow — bumped from 15% to 25% so the bar's focus state survives next to the page's own busy header chrome.
- **Header bar:** sits inside the page on `background.paper` with a 1 px `divider` bottom border. Padding is 1.25 × 16 px vertical, 16/24 px horizontal. Right side hosts page-level actions (edit, share, FAQ) plus optional inline icon buttons that read as part of the calendar context (Stats toggle, share-link toggles, etc.).
- **Menu:** `min-width: 280px`, `max-width: 380px`, `max-height: 420px`, 12 px corners, Floating-tier shadow.
- **Menu header:** a small uppercase Label "Calendars" on the left (typography role `overline`, 0.6875 rem, weight 600, 0.05 em letter-spacing) and a "View all" text-button on the right that opens the full panel/drawer.
- **Items:** avatar (calendar hero or icon) + name + trade count + signed P&L on the right. Selected item carries a Trader Violet at 12% alpha tint on its full background — **not** a 3 px ::before accent bar (the older accent bar was removed; the tint alone reads cleanly enough at this size). Hover on an unselected item is `action.hover`; hover on a selected item bumps the tint to 16% alpha. P&L uses the win/loss triple-encoding rule.
- Limited to 3 most-recently-updated entries; "View all" opens the full calendars list/drawer.

### Chips (tags, status)
- **Filled:** 6 px corners, 0.75 rem text, weight 500. Trader Violet at full opacity in dark mode, at 10% alpha in light mode, with high-contrast text. Color variants (`success`, `error`) inherit MUI semantics.
- **Tint:** the softer variant — 12% violet background, primary text. Used for tag chips inside notes and the trade list.

### Cards
- 12 px corners (`{rounded.lg}`).
- Background: Ink Paper Dark (dark mode) or Ink Paper Light (light mode).
- Border in light mode only, 1 px Slate 300 (`#cbd5e1`), to compensate for low contrast against the cool page tint.
- Internal padding follows the spacing scale: 16 / 24 px depending on density.
- Hover lift: `translateY(-2px)` paired with one shadow tier up — the system's only animated card behavior.
- Cards must not nest. A card inside a card is a layout failure.

### Inputs
- 8 px corners, paper background.
- Focus: violet border + 3 px violet at 15% alpha glow. No fill change.
- Disabled fields fade text and background to ~50% alpha; no extra strikethrough or border treatment.

### Dialogs and Drawers
- 12 px corners on dialogs.
- Modal-tier shadow.
- Drawers carry no shadow on the body, only on the paper edge.

### P&L Readout (canonical)
- Always color + arrow glyph + sign character together: `<span class="pnl is-win">↑ +$1,247.50</span>`.
- DM Sans, weight 700, tabular figures, letter-spacing -0.01em.
- Baseline-aligned in inline-flex; arrow and sign share a 4 px gap with the value.

### Calendar Lock Overlay (signature)

Empty-state lock used when a section requires at least one calendar (Home, Performance). Notes and Assistant remain accessible without a calendar.

- **Backdrop:** 85% alpha `background.default` over the parent surface, with a 4 px `backdrop-filter: blur` — one of the two permitted uses of blur in the system.
- **Card:** 24 px corners (`border-radius: 3 × 8 px`), `background.paper`, 1 px `divider` border, MUI `shadows[6]` (Lifted-Empty-State). Max width 440 px. Padding 24/40 px responsive. Centered text.
- **Icon panel:** a 64 × 64 px tile with 16 px corners, Trader Violet at 12% alpha background, holding a 36 px AddIcon in Trader Violet. Sits 20 px above the headline.
- **Headline:** Title-size (1.125 rem, weight 700), one line — "Create your first calendar".
- **Body copy:** body typography, `text.secondary`, capped at the card's 440 px max width (well inside 65 ch). One sentence, plain.
- **CTA:** **pill** primary button (`border-radius: 999`), 24/8 px padding, AddIcon `startIcon`. The pill is intentional: there is one action on this surface and the affordance is meant to read as the lock's only escape hatch. When `onCreateCalendar` is undefined the button stays disabled — the empty state never lies about what the click will do.

## 6. Do's and Don'ts

### Do:
- **Do** lead with numbers. Tabular figures, calm labels, generous space around totals.
- **Do** keep Trader Violet rare. One element on a screen is usually enough; the active side-nav tile usually IS that element.
- **Do** pair every win/loss color with both an arrow icon and the sign character.
- **Do** vary spacing for rhythm: page-level sections at 32–48 px apart, related elements at 8–16 px.
- **Do** write copy in trader voice. "476 trades, +$6,814,311.00", not "Your amazing trading journey".
- **Do** keep AppHeader and SideNav mounted across navigation; loading states render below the chrome.
- **Do** use `primary.dark` (Violet Deep) for any "darker violet" need other than primary-button hover; reserve Violet Hover (#6d28d9) for that one override.
- **Do** earn every element. Newer-trader scaffolding belongs in empty states and obvious next actions, not in extra chrome.

### Don't:
- **Don't** use generic SaaS purple gradients. Trader Violet is solid; it never gradients into pink, blue, or itself. The codebase still has two legacy `linear-gradient(primary.dark → primary.main)` decorations in `ImagePickerDialog` and `ImageUploadDialog`; those are violations awaiting cleanup, not a precedent.
- **Don't** clip text in a gradient with `background-clip: text`. Solid color, weight or size for emphasis.
- **Don't** chase Bloomberg terminal density. Information without rhythm is noise.
- **Don't** add Robinhood-style gamification: no confetti on green trades, no balloons, no celebration sounds, no oversized streak counters.
- **Don't** mimic MetaTrader or legacy broker chrome: no skeuomorphic panels, no beveled buttons, no tiny system fonts, no gray-on-gray.
- **Don't** wrap the entire interface in cards. Cards are an affordance, not a container reflex.
- **Don't** nest cards. A card inside a card is a layout failure.
- **Don't** use a `border-left` greater than 1 px as a colored accent stripe on cards, list items, or alerts. The calendar-dropdown selected item used to carry a 3 px ::before accent bar; it was removed in favor of a 12% alpha tint and that pattern should not come back via shortcut.
- **Don't** introduce glassmorphism (frosted blurs) as decoration. Reserve `backdrop-filter` for the calendar-lock backdrop and the calendar-switching spinner overlay.
- **Don't** use #000 or #fff anywhere except the documented light-mode paper. Off-black `#080808` and tinted paper are the system's true neutrals.
- **Don't** introduce new violet hex values. The palette has four (`primary`, `soft`, `deep`, `hover`) and that's the budget.
- **Don't** soften copy for newer traders. Onboarding clarity comes from flow, not from warmer prose.
