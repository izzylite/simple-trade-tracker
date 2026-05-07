---
name: JournoTrades
description: Trading journal calendar with analytics and an AI assistant, tuned for traders who keep it open all day.
colors:
  violet-primary: "#7c3aed"
  violet-soft: "#a78bfa"
  violet-deep: "#5b21b6"
  win-green-dark: "#22c55e"
  win-green-light: "#16a34a"
  loss-red-dark: "#ef4444"
  loss-red-light: "#dc2626"
  ink-near-black: "#080808"
  ink-paper-dark: "#131313"
  ink-paper-light: "#ffffff"
  page-light: "#e8edf4"
  slate-50: "#f8fafc"
  slate-100: "#f1f5f9"
  slate-200: "#e2e8f0"
  slate-400: "#94a3b8"
  slate-500: "#64748b"
  slate-700: "#334155"
  slate-800: "#1e293b"
  slate-900: "#0f172a"
  divider-dark: "rgba(255,255,255,0.08)"
typography:
  display:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: "1.2"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.3"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.4"
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.55"
    letterSpacing: "0"
  label:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: "1.1"
    letterSpacing: "0.05em"
  numeric:
    fontFamily: "'DM Sans', sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "1.1"
    fontFeature: "'tnum' on, 'lnum' on"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
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
    backgroundColor: "{colors.violet-deep}"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.violet-primary}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
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
  input:
    backgroundColor: "{colors.ink-paper-dark}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  side-nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.slate-400}"
    rounded: "{rounded.md}"
    padding: "8px 4px"
    typography: "{typography.label}"
  side-nav-item-active:
    backgroundColor: "{colors.violet-primary}"
    textColor: "{colors.violet-soft}"
---

# Design System: JournoTrades

## 1. Overview

**Creative North Star: "The Trader's Logbook"**

JournoTrades looks and behaves like a digital descendant of an analog trading logbook. Pages of structured ledgers, columns of figures, marginal notes in a steady hand. Not a marketing site, not a casino app, not a Bloomberg terminal. A workspace a serious trader keeps open while doing the work, that earns its place by being honest about the data and quiet about itself.

The system rejects the visual noise that has become a fintech reflex. No purple-to-pink gradient washes over hero numbers. No celebration animation when a trade closes green. No skeuomorphic broker chrome. No Bloomberg-style information avalanche. Hierarchy comes from spacing and weight contrast, not from decorative elevation.

Dark mode is the default surface, tuned for hours of staring on a second monitor in dim or mixed light. Light mode is treated with the same care, never as an afterthought. Win and loss are encoded with color, glyph, and sign together so the meaning survives in any palette and for any user.

**Key Characteristics:**
- Numbers carry the page; chrome stays out of the way.
- Tabular numerals and calm spacing over flashy emphasis.
- One purple, used sparingly. The accent is a signal, not a wallpaper.
- Crisp 8/12 px corners. Nothing fully rounded except pills used as labels.
- Motion is calm and exponential, defaulting to instant under reduced-motion.

## 2. Colors

A restrained palette: tinted near-black surfaces, a single violet accent that earns each appearance, and a green/red pair reserved for win and loss.

### Primary
- **Trader Violet** (#7c3aed): the only saturated brand color. Used on active nav state, primary buttons, focus rings, key indicators in charts. Cap visible coverage on any single screen.
- **Violet Soft** (#a78bfa): legible violet for text and icons on tinted-violet backgrounds (active side-nav label, in-chart highlights for dark mode).
- **Violet Deep** (#5b21b6): hover/pressed states on primary buttons. Never used as a foreground color.

### Tertiary
- **Win Green** (#22c55e dark / #16a34a light): positive P&L only. Always paired with an up-arrow glyph and a `+` sign.
- **Loss Red** (#ef4444 dark / #dc2626 light): negative P&L only. Always paired with a down-arrow glyph and a `-` sign.

### Neutral
- **Ink Near-Black** (#080808): the dark page backdrop. Off-black, not pure; reads as paper, not as void.
- **Ink Paper Dark** (#131313): card and panel surface in dark mode; one tonal step above the page so containers feel placed, not pasted.
- **Ink Paper Light** (#ffffff): card surface in light mode.
- **Page Light** (#e8edf4): light-mode page backdrop, a cool slate tint that keeps cards distinct.
- **Slate 50–900** (#f8fafc → #0f172a): typographic neutrals. Body text and chip text resolve into this scale at both ends of the theme.
- **Divider Dark** (rgba(255,255,255,0.08)): the only dark-mode border value used. Subtle, not structural.

### Named Rules
**The One Purple Rule.** Trader Violet appears at most on ~10% of any screen surface. If a redesign starts to need violet on multiple structural surfaces, the layout is wrong, not the color. Avoid pairing violet with another saturated hue except the win/loss pair, which lives in its own semantic lane.

**The Win/Loss Triple-Encoding Rule.** Profit and loss are never expressed by color alone. The pair (color + glyph + sign) is mandatory. No green text without an up-arrow and `+`. No red text without a down-arrow and `-`.

**The Pure-Pixel Rule.** Light-mode paper is currently `#ffffff` for compatibility. Pure white is permitted only on the paper surface. Page backdrop, all neutrals, and any tinted area must be off-white (e.g. `#e8edf4`) to keep the system from looking sterile.

## 3. Typography

**Display Font:** DM Sans (with system-ui fallback)
**Body Font:** DM Sans (with system-ui fallback)
**Numeric Treatment:** DM Sans with `font-feature-settings: 'tnum' on, 'lnum' on` so columns of P&L line up vertically.

**Character:** A single, geometric humanist sans, set tightly. Negative letter-spacing on display sizes pulls headlines into a structured block; body remains comfortably readable. Tabular figures are mandatory wherever numbers stack.

### Hierarchy
- **Display** (700, 2.125rem, line-height 1.2, letter-spacing -0.025em): page-level titles such as section headers on Performance or Notes. One per page maximum.
- **Headline** (700, 1.5rem, line-height 1.3): primary card titles, hero metrics in account stats.
- **Title** (600, 1.125rem, line-height 1.4): card subheaders, dialog titles.
- **Body** (400, 0.875rem, line-height 1.55): dense reading text. Cap at 65–75ch for any prose-style block (notes, chat, FAQ).
- **Label** (600, 0.6875rem, letter-spacing 0.05em): small uppercase labels for category headers, side-nav item names, calendar dropdown header.
- **Numeric** (700, 1.75rem, tabular figures): P&L, balance, win-rate readouts. Always tabular.

### Named Rules
**The Tabular-Number Rule.** Any cell, list, or readout that renders a count, percent, or currency must use `font-feature-settings: 'tnum' on, 'lnum' on`. Proportional figures in P&L tables are forbidden.

**The Single-Display Rule.** A page may have one Display-size headline at most. Multiple display sizes flatten the hierarchy back into noise.

## 4. Elevation

The system is **mostly flat with selective tonal layering**. Surfaces step up by one tone (page → paper) rather than by shadow. Shadows are reserved for elements that genuinely float (dialogs, drawers, tooltips, dropdown menus).

### Shadow Vocabulary
- **Subtle** (`0 1px 2px rgba(0,0,0,0.3)` dark / `0 1px 2px rgba(0,0,0,0.05)` light): hairline beneath buttons in their resting state.
- **Card** (`0 2px 8px rgba(0,0,0,0.3)` dark / `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` light): cards, panels.
- **Floating** (`0 4px 16px rgba(0,0,0,0.4)` dark / `0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)` light): popovers, dropdowns, hover-lifted cards.
- **Modal** (`0 8px 24px rgba(0,0,0,0.5)` dark / `0 8px 24px rgba(0,0,0,0.1)` light): dialogs and drawers only.

### Named Rules
**The No-Glass Rule.** No `backdrop-filter: blur` decoration on cards, navs, or panels. The single permitted use is the lock-overlay backdrop and the calendar-switching spinner overlay, both of which obscure live content for a reason.

**The Hover Lift Rule.** Cards may translate at most `-2px` on hover, paired with the next shadow step up. No scale transforms, no rotation, no shadow expansion beyond one tier.

## 5. Components

### Buttons
- **Shape:** 8 px corners (`{rounded.md}`). Pills (`{rounded.pill}`) are reserved for FAQ-style helper buttons that wrap text.
- **Primary:** Trader Violet background, white text, 8/20 px padding. Shadow `Subtle` at rest, `Card` on hover. No gradient, ever.
- **Outlined:** Transparent background, Trader Violet text and 1 px border. Hover fills with violet at 8% alpha.
- **Hover / Focus:** 0.15 s ease-out for color and shadow. Focus ring is a 3 px violet at 15% alpha around the input or button outline; never `outline: none` without a replacement.

### Side-Nav Items
- Vertical icon-rail layout: 22 px icon stacked above an 11 px label, centered.
- Default: text Slate 400, transparent background.
- Hover: background `action.hover`, text Slate 100/900.
- Active: background Trader Violet at 12% alpha, icon and label in Trader Violet.
- 84 px rail width on lg+. Below lg, the rail collapses into a temporary drawer.

### Calendar Dropdown (signature)
- Triggered from the page header (no breadcrumb above it on Home).
- Header section inside the menu: small uppercase Label "CALENDARS" with a "View all" text-button on the right.
- Items: avatar (calendar hero or icon), name, trade count, signed P&L. Selected item carries a Trader Violet accent bar on the left at 3 px and a 12% alpha tint.
- Limited to 3 most-recently-updated entries; "View all" opens the panel/drawer.

### Chips (tags, status)
- 6 px corners, 0.75 rem text, 500 weight.
- Default filled: Trader Violet at full opacity in dark mode, at 10% alpha in light mode, with high-contrast text. Color variants (`success`, `error`) inherit MUI semantics.

### Cards
- 12 px corners (`{rounded.lg}`).
- Background: Ink Paper Dark (dark mode) or Ink Paper Light (light mode).
- Border in light mode only, 1 px Slate 200, to compensate for low contrast.
- Internal padding follows the spacing scale: 16 / 24 px depending on density.
- Cards must not nest. A card inside a card is a layout failure.

### Inputs
- 8 px corners, paper background.
- Focus: violet border + 3 px violet at 15% alpha glow. No fill change.

### Dialogs and Drawers
- 12 px corners on dialogs.
- Modal-tier shadow.
- Drawers carry no shadow on the body, only on the paper edge.

### Lock Overlay (signature)
- Used when a feature requires a calendar that doesn't exist.
- 85% alpha page-color backdrop with a 4 px backdrop-blur.
- Centered card with one icon, one Title-size headline, body copy at 65ch max, and a single primary action.
- Never blocks Notes or Assistant; both must remain accessible without a calendar.

## 6. Do's and Don'ts

### Do:
- **Do** lead with numbers. Tabular figures, calm labels, generous space around totals.
- **Do** keep Trader Violet rare. One element on a screen is usually enough.
- **Do** pair every win/loss color with both an arrow icon and the sign character.
- **Do** vary spacing for rhythm: page-level sections at 32–48 px apart, related elements at 8–16 px.
- **Do** write copy in trader voice. "476 trades, +$6,814,311.00", not "Your amazing trading journey".
- **Do** keep AppHeader and SideNav mounted across navigation; loading states render below the chrome.

### Don't:
- **Don't** use generic SaaS purple gradients. Trader Violet is solid; it never gradients into pink, blue, or itself.
- **Don't** clip text in a gradient with `background-clip: text`. Solid color, weight or size for emphasis.
- **Don't** chase Bloomberg terminal density. Information without rhythm is noise.
- **Don't** add Robinhood-style gamification: no confetti on green trades, no balloons, no celebration sounds, no oversized streak counters.
- **Don't** mimic MetaTrader or legacy broker chrome: no skeuomorphic panels, no beveled buttons, no tiny system fonts, no gray-on-gray.
- **Don't** wrap the entire interface in cards. Cards are an affordance, not a container reflex.
- **Don't** use a `border-left` greater than 1 px as a colored accent stripe on cards, list items, or alerts. The selected calendar item's 3 px accent bar uses `::before`, not a side border, and is the only such accent in the system.
- **Don't** introduce glassmorphism (frosted blurs) as decoration. Reserve `backdrop-filter` for the lock and switch overlays.
- **Don't** use #000 or #fff anywhere except the documented light-mode paper. Off-black `#080808` and tinted paper are the system's true neutrals.
