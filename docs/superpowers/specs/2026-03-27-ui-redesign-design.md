# JournoTrades UI Redesign — Design Spec

**Date:** 2026-03-27
**Goal:** Polish & personality — give JournoTrades a distinctive visual identity while preserving all existing UX patterns and workflows.
**Approach:** Theme-Up — rewrite MUI theme config, then surgically update key surfaces.
**Scope:** Core first — theme system + Home, Calendar, common components (AppHeader, drawers, dialogs). Landing page and secondary screens follow in a later pass.

---

## Design Direction

- **Vibe:** Clean & confident — Linear/Notion energy. Lots of whitespace, crisp type, minimal color.
- **Accent:** Violet (`#7c3aed`) on a neutral slate base. Unexpected in finance, memorable and modern.
- **Font:** DM Sans — clean geometric with wider proportions, great for number-heavy dashboards.
- **Surfaces:** Soft elevation — gentle shadows with filled backgrounds. Cards feel lifted but not heavy.
- **Theme:** Both dark and light modes, equally polished.

---

## 1. Color Palette

### Dark Mode

| Token | Value | Hex | Usage |
|---|---|---|---|
| `background.default` | slate-900 | `#0f172a` | Page background |
| `background.paper` | slate-800 | `#1e293b` | Cards, dialogs, elevated surfaces |
| `text.primary` | slate-100 | `#f1f5f9` | Headings, primary text |
| `text.secondary` | slate-400 | `#94a3b8` | Labels, captions, metadata |
| `divider` | slate-700 | `#334155` | Borders, separators |

### Light Mode

| Token | Value | Hex | Usage |
|---|---|---|---|
| `background.default` | slate-50 | `#f8fafc` | Page background |
| `background.paper` | white | `#ffffff` | Cards, dialogs, elevated surfaces |
| `text.primary` | slate-900 | `#0f172a` | Headings, primary text |
| `text.secondary` | slate-500 | `#64748b` | Labels, captions, metadata |
| `divider` | slate-200 | `#e2e8f0` | Borders, separators |

### Semantic Colors (Both Modes)

| Token | Value | Hex | Usage |
|---|---|---|---|
| `primary.main` | violet-600 | `#7c3aed` | Buttons, active states, links, focus rings |
| `primary.light` | violet-400 | `#a78bfa` | Hover states, badges, tinted backgrounds |
| `primary.dark` | violet-800 | `#5b21b6` | Pressed states |
| `success.main` | green-500/600 | `#22c55e` / `#16a34a` | Winning trades (dark/light) |
| `error.main` | red-500/600 | `#ef4444` / `#dc2626` | Losing trades (dark/light) |
| `info.main` | slate-500 | `#64748b` | Breakeven, neutral states |

### Derived Colors

- **Win day cell fill (dark):** `rgba(34, 197, 94, 0.12)`
- **Loss day cell fill (dark):** `rgba(239, 68, 68, 0.10)`
- **Win day cell fill (light):** `rgba(22, 163, 74, 0.08)`
- **Loss day cell fill (light):** `rgba(220, 38, 38, 0.08)`
- **Primary tint (dark):** `rgba(124, 58, 237, 0.12)` — tags, active nav pills
- **Primary tint (light):** `rgba(124, 58, 237, 0.08)` — tags, active nav pills
- **Today highlight:** `border: 1.5px solid rgba(124, 58, 237, 0.4)` + `box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25)`

---

## 2. Typography

**Font family:** `'DM Sans', sans-serif`

Load weights 400, 500, 600, 700 from Google Fonts.

| Role | Weight | Size | Letter-spacing | Notes |
|---|---|---|---|---|
| Page headings (h4) | 700 | inherit | `-0.025em` | Tight tracking for impact |
| Section headings (h5, h6) | 700 | inherit | `-0.025em` | |
| Body text | 400 | inherit | normal | |
| Emphasis text | 500 | inherit | normal | |
| Stat numbers | 700 | varies | `-0.03em` | Extra-tight for large numerals |
| Labels/captions | 600 | 10-11px | `0.05em` | Uppercase, used above form fields and stat cards |
| Buttons | 600 | inherit | normal | No text-transform |

---

## 3. Shadow Scale (Soft Elevation)

| Level | Dark Mode | Light Mode |
|---|---|---|
| `sm` | `0 1px 2px rgba(0,0,0,0.3)` | `0 1px 2px rgba(0,0,0,0.05)` |
| `md` | `0 2px 8px rgba(0,0,0,0.3)` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` |
| `lg` | `0 4px 16px rgba(0,0,0,0.4)` | `0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)` |
| `xl` | `0 8px 24px rgba(0,0,0,0.5)` | `0 8px 24px rgba(0,0,0,0.1)` |

---

## 4. Border Radius

| Element | Value | Change from current |
|---|---|---|
| Buttons | `8px` | Same |
| Cards | `12px` | Same |
| Dialogs | `12px` | Up from `4px` (MUI default) |
| Tabs | `8px` | Simplified from 14-20px |
| Badges/chips | `6px` | Down from pill-shaped |
| Inputs | `8px` | Same |
| Calendar day cells | `8px` | Consistent with system |

---

## 5. MUI Component Overrides

### MuiButton
- Border-radius: `8px`
- Font-weight: `600`
- Text-transform: `none`
- Padding: `8px 20px`
- Contained primary: `#7c3aed` bg, white text, shadow `md`
- Hover: `#6d28d9` bg, shadow `lg`
- Outlined: `1px solid` divider, text primary color, hover fills `rgba(124,58,237,0.08)`
- Transition: `all 0.15s ease`

### MuiCard
- Border-radius: `12px`
- Background: `paper`
- Shadow: `md`
- Border: none
- Hover: shadow `lg`, `translateY(-2px)` (reduced from current `-12px`)

### MuiDialog
- Border-radius: `12px`
- Background: `paper`
- Shadow: `xl`
- Backdrop: `rgba(0,0,0,0.6)` dark / `rgba(0,0,0,0.3)` light, no blur
- DialogTitle: font-weight `700`, size `1.1rem`

### MuiDrawer
- Background: `paper`
- Border-left: `1px solid` divider (right-anchored drawers)
- Shadow: `xl`
- No gradient backgrounds (remove "enhanced" mode glassmorphism)
- Width: `450px` on sm+ (unchanged)

### MuiTextField / MuiOutlinedInput
- Border-radius: `8px`
- Border color: divider
- Focus: `#7c3aed` border + `0 0 0 3px rgba(124,58,237,0.15)` ring
- Background: transparent

### MuiChip
- Border-radius: `6px`
- Filled: `rgba(124,58,237,0.12)` bg in dark, `rgba(124,58,237,0.08)` in light, `#7c3aed` text
- Font-weight: `500`, font-size: `12px`

### MuiTab (RoundedTabs)
- Border-radius: `8px`
- Active: `#7c3aed` bg, white text, shadow `sm`
- Inactive: transparent, `text.secondary`
- Font-weight: `600`

### MuiTooltip
- Border-radius: `6px`
- Background: slate-800 (dark) / slate-900 (light)
- Font-size: `12px`
- Shadow: `md`

---

## 6. Page-Level Treatments

### AppHeader
- Solid background (paper color), not glassmorphic
- Bottom border: `1px solid` divider + shadow `sm`
- Logo: "Journo" in text.primary + "Trades" in `#7c3aed`
- Navigation: pill-style items, active state uses primary tint background + primary text color
- User avatar: gradient violet circle with initials
- Theme toggle and icon buttons: `text.secondary`, hover to `text.primary`

### Home Dashboard
- Personalized greeting: "Good evening, {name}" with date subtitle
- Stat cards row: 3-column grid with uppercase labels, large numbers, secondary context
- Calendar cards: hero gradient header strip (violet gradient for primary calendar, slate gradient for others), card body with name/date/stats
- Recent trades section: simple list items in cards
- Tab system (Recent | Trash): use new MuiTab overrides

### Calendar Page
- Month navigation: centered month/year heading with arrow buttons
- Day headers: uppercase, `text.secondary`, `10px`
- Day cells: `8px` border-radius, `paper` background, shadow `sm`
  - **Win days:** full cell background fill `rgba(34,197,94,0.12)` (dark) / `rgba(22,163,74,0.08)` (light)
  - **Loss days:** full cell background fill `rgba(239,68,68,0.10)` (dark) / `rgba(220,38,38,0.08)` (light)
  - **Empty/no-trade days:** neutral `paper` background
  - **Today:** violet border + violet glow shadow + violet dot indicator
  - **Future days:** reduced opacity (0.5)
  - **Event indicator:** small red dot in top-right corner (preserved from current design)
- 8th column: weekly summary cells with P&L, percentage, trade count
- Monthly stats bar: horizontal layout in a card at bottom with P&L, Win Rate, Trades separated by vertical dividers

### Drawers (AI Chat, Notes, Economic Calendar, Search, Tags)
- Header: font-weight 700 title, close button, optional action buttons
- Remove all gradient/glassmorphism backgrounds
- Clean `paper` background with divider borders
- AI Chat: user messages get primary tint background, AI messages get `background.default`, AI avatar is violet gradient circle
- Notes: card-style list items on slightly tinted background
- Consistent `20px` horizontal padding

### Dialogs (Trade Form, Calendar Form, Confirmations)
- `12px` border-radius
- Structured forms: uppercase labels above fields
- Tags rendered as violet-tinted chips
- Action bar: right-aligned, Cancel (text) + Save (contained primary with violet glow shadow)
- No backdrop blur

---

## 7. Animations & Transitions

Preserve the existing animation system but adjust:

| Element | Current | New |
|---|---|---|
| Card hover | `translateY(-12px)` | `translateY(-2px)` — subtler |
| All transitions | `0.15s` / `0.3s` mixed | Standardize to `0.15s ease` for interactions, `0.3s ease` for entrances |
| Drawer open | slide from edge | Same, no changes |
| Dialog open | MUI default fade | Same, no changes |

Remove: animated gradient backgrounds from header. Keep: staggered fade-in on lists, pulse animation on loading states.

---

## 8. Scrollbar Styling

Preserve existing custom scrollbar approach, update colors:

- **Dark mode thumb:** `rgba(148, 163, 184, 0.3)` (slate-400 at 30%), hover `rgba(148, 163, 184, 0.5)`
- **Light mode thumb:** `rgba(100, 116, 139, 0.3)` (slate-500 at 30%), hover `rgba(100, 116, 139, 0.5)`
- Track: transparent
- Width: `8px`

---

## 9. What NOT to Change

- All UX workflows, navigation patterns, and information architecture remain identical
- Drawer widths and breakpoint behavior stay the same
- Chart library (Recharts) stays — chart colors will inherit from the new palette via theme tokens (violet for primary series, success/error for win/loss, slate for axes/grid lines)
- Rich text editor (Draft.js) stays — toolbar inherits new theme
- Z-index hierarchy stays the same
- All business logic, services, and data layer untouched
- File structure stays the same — no component renames or moves

---

## 10. Files to Modify

### Theme System (Phase 1)
- `src/theme.ts` — Complete rewrite with new palette, typography, shadows, component overrides
- `src/styles/dialogStyles.ts` — Update shadow/backdrop values
- `src/styles/scrollbarStyles.ts` — Update thumb colors

### Common Components (Phase 2)
- `src/components/common/AppHeader.tsx` — Remove glassmorphism, apply new nav styling, violet brand
- `src/components/common/RoundedTabs.tsx` — Simplify to new tab style
- `src/components/common/BaseDialog.tsx` — Ensure 12px radius, new backdrop
- `src/components/common/UnifiedDrawer.tsx` — Remove enhanced/gradient mode

### Home Page (Phase 3)
- `src/pages/HomePage.tsx` — Update card layouts, stat styling
- `src/components/CalendarCard.tsx` — New gradient headers, shadow treatment

### Calendar Page (Phase 4)
- `src/pages/TradeCalendarPage.tsx` — Update cell styling (background fills), stats bar
- `src/components/MonthlyStats.tsx` — Apply new stat card pattern
- `src/components/AccountStats.tsx` — Apply new stat card pattern

### Drawers (Phase 5)
- `src/components/aiChat/AIChatDrawer.tsx` — Message bubble styling
- `src/components/notes/NotesDrawer.tsx` — Note list item styling
- `src/components/economicCalendar/EconomicCalendarDrawer.tsx` — Event card styling
- `src/components/SearchDrawer.tsx` — Results styling

### Dialogs (Phase 6)
- `src/components/trades/TradeFormDialog.tsx` — Form field styling
- `src/components/dialogs/CalendarFormDialog.tsx` — Form field styling

### Font Loading
- `public/index.html` — Add Google Fonts link for DM Sans (400, 500, 600, 700)

---

## 11. Success Criteria

- The app is visually distinguishable from a default MUI application
- Violet accent is used consistently and sparingly for primary actions and active states
- DM Sans renders correctly at all sizes, especially numbers
- Dark and light modes both feel polished and intentional
- Calendar day cells correctly show green/red background fills for win/loss days
- Card hover effects are subtle (2px lift, not 12px)
- No glassmorphism or gradient backgrounds on functional surfaces
- All existing functionality works identically after the redesign
