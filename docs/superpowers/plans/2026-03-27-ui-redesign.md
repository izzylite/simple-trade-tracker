# JournoTrades UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform JournoTrades from default-MUI aesthetic to a distinctive violet-accented, DM Sans-powered, soft-elevation design system while preserving all existing functionality.

**Architecture:** Theme-Up approach — rewrite `theme.ts` with new design tokens (colors, typography, shadows, component overrides), then surgically update key surfaces (AppHeader, HomePage, CalendarPage, drawers, dialogs). Most components get 70% of the transformation for free via MUI theme cascading.

**Tech Stack:** React 19, MUI v7, DM Sans (Google Fonts), Emotion styled components

**Branch:** `feat/ui-redesign`

**Design Spec:** `docs/superpowers/specs/2026-03-27-ui-redesign-design.md`

---

## File Structure

### Files to Create
- None — all changes modify existing files

### Files to Modify

| File | Responsibility |
|---|---|
| `public/index.html` | Add DM Sans font loading |
| `src/theme.ts` | Complete rewrite — new palette, typography, shadows, component overrides |
| `src/styles/dialogStyles.ts` | Update shadow, backdrop, border-radius values |
| `src/styles/scrollbarStyles.ts` | Update thumb colors to slate palette |
| `src/components/common/AppHeader.tsx` | Remove glassmorphism, new nav styling, violet brand |
| `src/components/common/RoundedTabs.tsx` | Simplify to new tab style with violet active |
| `src/components/common/BaseDialog.tsx` | Ensure new dialog overrides apply cleanly |
| `src/components/common/UnifiedDrawer.tsx` | Remove enhanced/gradient mode |
| `src/components/StyledComponents.tsx` | Update calendar cells, cards, stat items to new tokens |
| `src/pages/HomePage.tsx` | Update layout styling to use new design tokens |
| `src/components/CalendarCard.tsx` | New shadow treatment, reduced hover, gradient headers |
| `src/pages/TradeCalendarPage.tsx` | Update calendar grid cell styling |
| `src/components/MonthlyStats.tsx` | Apply new stat card pattern |
| `src/components/AccountStats.tsx` | Apply new stat card pattern |
| `src/components/aiChat/AIChatDrawer.tsx` | Remove glassmorphism, new message styling |
| `src/components/notes/NotesDrawer.tsx` | Update to default drawer variant |
| `src/components/economicCalendar/EconomicCalendarDrawer.tsx` | Update drawer styling |

---

### Task 1: Create Branch and Load Font

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b feat/ui-redesign
```

- [ ] **Step 2: Add DM Sans font to index.html**

In `public/index.html`, add Google Fonts preconnect and stylesheet links inside `<head>`, after the existing meta tags (around line 4):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 3: Verify the font loads**

Run: `npm start`

Open the app in browser, open DevTools → Network tab, filter by "font". Confirm DM Sans woff2 files are loading. The app will still show Roboto until we update the theme.

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: add DM Sans font loading for UI redesign"
```

---

### Task 2: Rewrite Theme System

**Files:**
- Modify: `src/theme.ts` (complete rewrite, lines 1-101)

- [ ] **Step 1: Read the current theme file**

Read `src/theme.ts` to understand the current `createAppTheme` function signature and exports. The function takes a `mode: 'light' | 'dark'` parameter and returns a MUI theme. Preserve that interface.

- [ ] **Step 2: Rewrite theme.ts with new design system**

Replace the entire contents of `src/theme.ts` with:

```typescript
import { createTheme, alpha } from '@mui/material/styles';

// Design tokens
const palette = {
  violet: {
    main: '#7c3aed',
    light: '#a78bfa',
    dark: '#5b21b6',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    400: '#94a3b8',
    500: '#64748b',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
};

const shadows = {
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
};

export function getScrollbarColors(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  return {
    thumb: isDark ? 'rgba(148,163,184,0.3)' : 'rgba(100,116,139,0.3)',
    thumbHover: isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)',
  };
}

export function createAppTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark';
  const s = isDark ? shadows.dark : shadows.light;
  const scrollbar = getScrollbarColors(mode);

  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.violet.main,
        light: palette.violet.light,
        dark: palette.violet.dark,
      },
      secondary: {
        main: palette.violet.light,
      },
      success: {
        main: isDark ? '#22c55e' : '#16a34a',
      },
      error: {
        main: isDark ? '#ef4444' : '#dc2626',
      },
      info: {
        main: palette.slate[500],
      },
      background: {
        default: isDark ? palette.slate[900] : palette.slate[50],
        paper: isDark ? palette.slate[800] : '#ffffff',
      },
      text: {
        primary: isDark ? palette.slate[100] : palette.slate[900],
        secondary: isDark ? palette.slate[400] : palette.slate[500],
      },
      divider: isDark ? palette.slate[700] : palette.slate[200],
      custom: {
        pageBackground: isDark ? palette.slate[900] : palette.slate[50],
      },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: "'DM Sans', sans-serif",
      h4: { fontWeight: 700, letterSpacing: '-0.025em' },
      h5: { fontWeight: 700, letterSpacing: '-0.025em' },
      h6: { fontWeight: 700, letterSpacing: '-0.025em' },
      button: { fontWeight: 600, textTransform: 'none' as const },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            scrollbarColor: `${scrollbar.thumb} transparent`,
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: scrollbar.thumb,
              borderRadius: 4,
              '&:hover': { backgroundColor: scrollbar.thumbHover },
            },
          },
          '*': {
            scrollbarWidth: 'thin',
            scrollbarColor: `${scrollbar.thumb} transparent`,
            '&::-webkit-scrollbar': { width: 8, height: 8 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: scrollbar.thumb,
              borderRadius: 4,
              '&:hover': { backgroundColor: scrollbar.thumbHover },
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            textTransform: 'none' as const,
            padding: '8px 20px',
            transition: 'all 0.15s ease',
          },
          containedPrimary: {
            boxShadow: s.md,
            '&:hover': {
              backgroundColor: '#6d28d9',
              boxShadow: s.lg,
            },
          },
          outlined: {
            '&:hover': {
              backgroundColor: alpha(palette.violet.main, 0.08),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: s.md,
            transition: 'all 0.15s ease',
            '&:hover': {
              boxShadow: s.lg,
              transform: 'translateY(-2px)',
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            boxShadow: s.xl,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: palette.violet.main,
              boxShadow: `0 0 0 3px ${alpha(palette.violet.main, 0.15)}`,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 500,
            fontSize: '0.75rem',
          },
          filled: {
            backgroundColor: alpha(
              palette.violet.main,
              isDark ? 0.12 : 0.08
            ),
            color: palette.violet.main,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 6,
            fontSize: '0.75rem',
            backgroundColor: isDark
              ? palette.slate[800]
              : palette.slate[900],
            boxShadow: s.md,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            boxShadow: s.xl,
          },
        },
      },
    },
  });
}
```

- [ ] **Step 3: Verify the app renders with new theme**

Run: `npm start`

Open browser. The app should now show DM Sans font, violet primary color, and updated backgrounds. Check both dark and light mode toggle. Expect some visual inconsistencies in components that have hardcoded styles — that's expected and will be fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add src/theme.ts
git commit -m "feat: rewrite theme with violet palette, DM Sans, soft elevation"
```

---

### Task 3: Update Dialog and Scrollbar Styles

**Files:**
- Modify: `src/styles/dialogStyles.ts` (lines 1-26)
- Modify: `src/styles/scrollbarStyles.ts` (lines 1-32)

- [ ] **Step 1: Read current dialog styles**

Read `src/styles/dialogStyles.ts` to see the current `dialogProps` constant.

- [ ] **Step 2: Update dialogStyles.ts**

Update the `dialogProps` constant to use the new design tokens. The backdrop should NOT use blur, and border-radius should be 12px:

Replace the PaperProps and BackdropProps values:
- `borderRadius` from current value to `'12px'`
- `boxShadow` to `'0 8px 24px rgba(0,0,0,0.5)'` (dark) — note: since this is a static style, use the darker value and let theme mode override where needed
- Remove `backdropFilter: 'blur(4px)'` from BackdropProps
- Update backdrop `backgroundColor` to `'rgba(0,0,0,0.6)'`

- [ ] **Step 3: Read current scrollbar styles**

Read `src/styles/scrollbarStyles.ts`.

- [ ] **Step 4: Update scrollbarStyles.ts**

Update the scrollbar color values to match the new slate palette:
- Dark mode thumb: `rgba(148, 163, 184, 0.3)` (slate-400 at 30%), hover: `rgba(148, 163, 184, 0.5)`
- Light mode thumb: `rgba(100, 116, 139, 0.3)` (slate-500 at 30%), hover: `rgba(100, 116, 139, 0.5)`

- [ ] **Step 5: Verify dialogs render correctly**

Open the app, trigger a dialog (e.g., click to create a trade or calendar). Confirm:
- Dialog has 12px rounded corners
- Backdrop is dark without blur
- Dialog feels elevated with proper shadow

- [ ] **Step 6: Commit**

```bash
git add src/styles/dialogStyles.ts src/styles/scrollbarStyles.ts
git commit -m "feat: update dialog backdrop and scrollbar colors for redesign"
```

---

### Task 4: Update AppHeader

**Files:**
- Modify: `src/components/common/AppHeader.tsx` (370 lines)

- [ ] **Step 1: Read AppHeader.tsx**

Read the full file. Identify:
1. The AppBar `sx` prop (around line 100-115) — has `backdropFilter: blur` and gradient background
2. The logo section (around lines 118-159) — uses gradient text with primary+secondary
3. The navigation buttons (around lines 167-202) — current active/inactive styling

- [ ] **Step 2: Update AppBar styling**

Find the AppBar's `sx` prop and update:
- Remove `backdropFilter: 'blur(12px)'` or similar blur effects
- Change background to `background.paper` (solid, not transparent)
- Add `borderBottom: 1` with `borderColor: 'divider'`
- Set `boxShadow` to the `sm` shadow value: `(theme) => theme.palette.mode === 'dark' ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.05)'`

- [ ] **Step 3: Update logo branding**

Find the logo Typography element and update:
- Remove gradient text effect (`background: linear-gradient`, `WebkitBackgroundClip`, etc.)
- Replace with: "Journo" in `text.primary` color + "Trades" in `primary.main` (`#7c3aed`)
- This can be done by rendering two `<span>` elements within the Typography, or using an `sx` approach

- [ ] **Step 4: Update navigation items**

Find the nav button styling and update active/inactive states:
- Active: `backgroundColor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.08)`, `color: 'text.primary'`, `fontWeight: 600`, `borderRadius: '6px'`
- Inactive: `color: 'text.secondary'`, `fontWeight: 500`, `borderRadius: '6px'`
- Padding: `'6px 12px'`

- [ ] **Step 5: Update user avatar**

Find the Avatar component and update:
- Background: `'linear-gradient(135deg, #7c3aed, #a78bfa)'`
- This gives the avatar the violet gradient look from the mockup

- [ ] **Step 6: Verify header in both modes**

Toggle between dark and light mode. Confirm:
- Solid background (no transparency/blur)
- "Journo" + violet "Trades" branding
- Active nav pill has violet tint
- Avatar has violet gradient

- [ ] **Step 7: Commit**

```bash
git add src/components/common/AppHeader.tsx
git commit -m "feat: redesign AppHeader with violet brand and solid background"
```

---

### Task 5: Update RoundedTabs

**Files:**
- Modify: `src/components/common/RoundedTabs.tsx` (178 lines)

- [ ] **Step 1: Read RoundedTabs.tsx**

Read the file. Focus on the `getVariantStyles` function (around lines 88-124) and the tab indicator/styling sections.

- [ ] **Step 2: Update tab styling**

Update the active tab styles in the variant styling function:
- Active tab: `backgroundColor: 'primary.main'` (`#7c3aed`), `color: '#ffffff'`, `boxShadow` to `sm` level
- Inactive tab: `backgroundColor: 'transparent'`, `color: 'text.secondary'`
- All tabs: `borderRadius: '8px'`, `fontWeight: 600`
- Remove or simplify the size-variant border-radius differences (standardize to `8px`)

- [ ] **Step 3: Verify tabs across the app**

Check tabs on the HomePage (Recent | Trash), Performance charts tabs, Notes drawer tabs. Confirm violet active state with white text.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/RoundedTabs.tsx
git commit -m "feat: update RoundedTabs with violet active state"
```

---

### Task 6: Update UnifiedDrawer

**Files:**
- Modify: `src/components/common/UnifiedDrawer.tsx` (197 lines)

- [ ] **Step 1: Read UnifiedDrawer.tsx**

Read the file. Focus on:
1. Enhanced drawer styles (lines 65-75) — gradient background + blur
2. Enhanced header styles (lines 78-86) — special header styling
3. The conditional logic that switches between enhanced and default

- [ ] **Step 2: Remove enhanced mode styling**

- Remove the `enhancedDrawerStyles` object (the gradient background + backdropFilter styles around lines 65-75)
- Remove the `enhancedHeaderStyles` object (around lines 78-86)
- Simplify the drawer Paper sx to always use the default (solid paper background) style
- The `headerVariant` prop can stay in the interface for backward compatibility, but it should no longer change visual output
- Ensure the drawer border uses `borderColor: 'divider'` (1px solid)
- Set drawer Paper `boxShadow` to the `xl` level shadow

- [ ] **Step 3: Update header styling**

Update the default header styles:
- Title: `fontWeight: 700`, `fontSize: '0.95rem'`
- Consistent padding: `16px 20px`
- Border-bottom: `1px solid` with `divider` color

- [ ] **Step 4: Verify drawers**

Open the AI Chat drawer, Notes drawer, and Economic Calendar drawer. Confirm:
- Solid paper background (no gradients or blur)
- Clean header with proper spacing
- Proper shadow on the drawer panel

- [ ] **Step 5: Commit**

```bash
git add src/components/common/UnifiedDrawer.tsx
git commit -m "feat: simplify UnifiedDrawer, remove glassmorphism"
```

---

### Task 7: Update StyledComponents (Calendar Grid)

**Files:**
- Modify: `src/components/StyledComponents.tsx` (468 lines)

This is the largest styling file. Focus on calendar-related styled components.

- [ ] **Step 1: Read StyledComponents.tsx**

Read the full file. Key styled components to update:
- `StyledCalendarDay` (lines 7-66): the calendar day cells
- `CalendarCell` (lines 68-73): cell wrapper
- `WeekdayHeader` (lines 75-83): day name headers
- `DayNumber` (lines 86-93)
- `TradeAmount` (lines 96-106)
- `CardContainer` (lines 149-160)
- `StatsContainer` (lines 163-175)
- `StatItem` (lines 178-188)
- `MonthlyStatsCard` (lines 388-396)
- `MonthlyStatItem` (lines 412-430)
- `AccountBalanceCard` (lines 344-357)
- `TradeListItem` (lines 255-295)

- [ ] **Step 2: Update StyledCalendarDay**

Update the `StyledCalendarDay` styled component (lines 7-66). Key changes:
- `borderRadius` to `8px`
- Win status background: `rgba(34, 197, 94, 0.12)` (dark) / `rgba(22, 163, 74, 0.08)` (light) — full cell fill
- Loss status background: `rgba(239, 68, 68, 0.10)` (dark) / `rgba(220, 38, 38, 0.08)` (light) — full cell fill
- Neutral/empty: use `background.paper` from theme
- Remove or reduce the `border: 2px solid` approach — the background fill carries the status now
- Current day indicator: `border: 1.5px solid` with `rgba(124, 58, 237, 0.4)`, `boxShadow: 0 2px 8px rgba(124, 58, 237, 0.25)`
- Shadow: `sm` level for all cells
- Hover: subtle border color change, not dramatic transform

- [ ] **Step 3: Update CalendarCell and WeekdayHeader**

- `CalendarCell`: `borderRadius: 8px`, remove `backgroundColor: background.paper@alpha(0.05)` — use `transparent` or let the day status color show through
- `WeekdayHeader`: update `fontSize: '0.75rem'`, `fontWeight: 600`, `textTransform: 'uppercase'`, `letterSpacing: '0.05em'`, `color: text.secondary`

- [ ] **Step 4: Update card and stat styled components**

- `CardContainer`: update `boxShadow` to use `md` level, remove `alpha(0.7)` background and use solid `background.paper`, hover `translateY(-2px)` (not larger)
- `StatsContainer`: solid `background.paper`, `borderRadius: 12px`
- `StatItem`: `borderRadius: 8px`, shadow `sm`, solid `background.paper`
- `MonthlyStatsCard`: remove `backdropFilter: blur(10px)`, solid `background.paper`, `borderRadius: 12`, shadow `md`
- `MonthlyStatItem`: hover `translateY(-2px)` only, shadow `sm` → `md` on hover
- `AccountBalanceCard`: solid `background.paper`, shadow `md`, hover `translateY(-2px)`

- [ ] **Step 5: Update TradeListItem**

- Win trades: `backgroundColor` with `rgba(34, 197, 94, 0.08)`, border `rgba(34, 197, 94, 0.2)`
- Loss trades: `backgroundColor` with `rgba(239, 68, 68, 0.08)`, border `rgba(239, 68, 68, 0.2)`
- Hover transform: keep `translateY(-1px)`, subtle

- [ ] **Step 6: Verify calendar grid rendering**

Navigate to a calendar with trades. Confirm:
- Win days have green-tinted background (full cell fill)
- Loss days have red-tinted background (full cell fill)
- Empty days are neutral
- Today has violet border glow
- Weekly stats column renders cleanly

- [ ] **Step 7: Commit**

```bash
git add src/components/StyledComponents.tsx
git commit -m "feat: update styled components with new design tokens and cell fills"
```

---

### Task 8: Update CalendarCard

**Files:**
- Modify: `src/components/CalendarCard.tsx` (487 lines)

- [ ] **Step 1: Read CalendarCard.tsx**

Read the file. Focus on:
- Card container sx (lines 190-216): gradient background, backdrop blur, box shadow
- Hover effects (lines 207-214): translateY(-8px), scale(1.02)
- Hero image section (lines 219-226)

- [ ] **Step 2: Update card container styling**

Find the main Card or Box sx prop and update:
- Remove `background: linear-gradient(...)` and `backdropFilter: blur(10px)`
- Set `backgroundColor: 'background.paper'`
- Set `borderRadius: '12px'` (or `3` in theme spacing)
- Set `boxShadow` to `md` level
- Remove `border: 1px solid divider@alpha(0.1)` — let shadows carry depth

- [ ] **Step 3: Reduce hover effects**

Update hover sx:
- Change `transform: translateY(-8px) scale(1.02)` to `transform: translateY(-2px)`
- Update `boxShadow` hover to `lg` level
- Remove `borderColor` change on hover

- [ ] **Step 4: Add violet gradient header for primary calendar**

If the calendar card has a hero image, keep it. If no hero image, consider adding a gradient header strip:
- Primary calendar: `background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)`
- Other calendars: `background: linear-gradient(135deg, ${theme.palette.divider} 0%, ${theme.palette.background.paper} 100%)`
- Height: `48px` for the gradient strip

Only add this if the existing card structure supports it naturally. Don't force a layout change.

- [ ] **Step 5: Verify calendar cards on home page**

Navigate to home page with multiple calendars. Confirm:
- Cards have clean shadows (no blur/glass)
- Hover is subtle (2px lift)
- Stats are readable

- [ ] **Step 6: Commit**

```bash
git add src/components/CalendarCard.tsx
git commit -m "feat: update CalendarCard with soft elevation and reduced hover"
```

---

### Task 9: Update HomePage

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Read HomePage.tsx styling sections**

Read the file focusing on layout containers, stat sections, and any hardcoded colors or shadows. Look for uses of `AnimatedBackground`, any glassmorphism effects, and hardcoded color values.

- [ ] **Step 2: Update page-level styling**

- If `AnimatedBackground` is used, consider removing it or making it very subtle — the new design favors clean solid backgrounds
- Update any hardcoded background colors to use theme tokens (`background.default`, `background.paper`)
- Update any hardcoded text colors to use `text.primary`, `text.secondary`
- Ensure grid/card containers use theme-consistent spacing and shadows

- [ ] **Step 3: Update tab section**

The Recent | Trash tabs should automatically pick up the new RoundedTabs styling from Task 5. Verify they look correct.

- [ ] **Step 4: Verify home page in both modes**

Check dark and light mode. Confirm:
- Clean background without animated gradients (or very subtle if kept)
- Calendar cards arranged properly with new styling
- Consistent spacing and typography

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: update HomePage styling for redesign"
```

---

### Task 10: Update TradeCalendarPage

**Files:**
- Modify: `src/pages/TradeCalendarPage.tsx`

- [ ] **Step 1: Read TradeCalendarPage.tsx styling sections**

Read the file focusing on:
- Calendar grid rendering and cell styling
- The WeeklyPnL component (lines 157-300) — border and background colors
- Monthly stats bar at the bottom
- Any hardcoded color values

- [ ] **Step 2: Update WeeklyPnL styling**

Find the WeeklyPnL component's cell styling and update:
- Border colors: use theme divider or remove thick borders
- Background colors: align with the new success/error alpha values from the spec
- Tooltip styling: solid backgrounds, no transparency hacks

- [ ] **Step 3: Update monthly stats bar**

If there's a stats bar at the bottom of the calendar:
- Use `background.paper` with `borderRadius: 10px` and shadow `md`
- Stats separated by vertical dividers (`1px solid divider`)
- Labels: uppercase, `text.secondary`, small font
- Values: `fontWeight: 700`, appropriate colors

- [ ] **Step 4: Update any hardcoded colors**

Search for any remaining hardcoded hex values or rgba colors that don't match the new palette. Replace with theme-aware values.

- [ ] **Step 5: Verify calendar page**

Open a calendar with trade data. Confirm:
- Day cells use full background fills for win/loss
- Today has violet glow
- Stats bar renders cleanly
- Week summary column looks good

- [ ] **Step 6: Commit**

```bash
git add src/pages/TradeCalendarPage.tsx
git commit -m "feat: update TradeCalendarPage styling for redesign"
```

---

### Task 11: Update MonthlyStats and AccountStats

**Files:**
- Modify: `src/components/MonthlyStats.tsx` (771 lines)
- Modify: `src/components/AccountStats.tsx` (373 lines)

- [ ] **Step 1: Read both stat components**

Read `MonthlyStats.tsx` and `AccountStats.tsx`. Focus on stat card styling, paper containers, and icon colors.

- [ ] **Step 2: Update MonthlyStats**

- Main Paper container: solid `background.paper`, `borderRadius: 12px`, shadow `md`, remove `elevation: 2` and use explicit boxShadow
- Stat cards: solid `background.default` backgrounds (remove `alpha(0.5)`), `borderRadius: 8px`
- Stat labels: use `text.secondary`, uppercase pattern
- Stat values: appropriate semantic colors (success for positive, error for negative, text.primary for neutral)
- Action buttons: use `primary.main` for color, `alpha(primary, 0.08)` for hover backgrounds

- [ ] **Step 3: Update AccountStats**

- Main Paper container: solid `background.paper`, `borderRadius: 12px`, shadow `md`
- Balance display: `fontWeight: 700`, `text.primary`
- Risk section backgrounds: use `alpha(primary.main, 0.08)` for risk-per-trade, `alpha(error.main, 0.08)` for daily drawdown
- Remove any `alpha(0.5)` or `alpha(0.3)` backgrounds on nested containers — use solid or very light alpha

- [ ] **Step 4: Verify stats display**

Open a calendar and check the stats section. Confirm both stat panels render with the new design.

- [ ] **Step 5: Commit**

```bash
git add src/components/MonthlyStats.tsx src/components/AccountStats.tsx
git commit -m "feat: update stat components with new design tokens"
```

---

### Task 12: Update AI Chat Drawer

**Files:**
- Modify: `src/components/aiChat/AIChatDrawer.tsx` (835 lines)

- [ ] **Step 1: Read AIChatDrawer.tsx**

Read the file. Focus on:
- Backdrop styling (lines 245-262): has `backdropFilter: blur(4px)`
- Bottom sheet container (lines 265-293): gradient background, blur, border
- Header section (lines 302-313): has `backdropFilter: blur(10px)`
- Avatar styling (lines 315-322): gradient primary

- [ ] **Step 2: Update backdrop**

- Remove `backdropFilter: 'blur(4px)'`
- Update `backgroundColor` to `'rgba(0,0,0,0.6)'` (dark) / `'rgba(0,0,0,0.3)'` (light)

- [ ] **Step 3: Update bottom sheet container**

- Remove `background: linear-gradient(...)` and `backdropFilter: blur(20px)`
- Set `backgroundColor: 'background.paper'`
- Set `borderTopLeftRadius: 12`, `borderTopRightRadius: 12` (reduced from 20)
- Set `boxShadow` to `xl` level: `'0 -8px 24px rgba(0,0,0,0.5)'` (dark) or lighter for light mode
- Update border to `1px solid` with `divider` color

- [ ] **Step 4: Update header section**

- Remove `backdropFilter: blur(10px)` and `background: background.paper@alpha(0.8)`
- Set solid `borderBottom: 1px solid` with `divider` color
- Padding: `16px 20px`

- [ ] **Step 5: Update AI avatar**

- Ensure the gradient uses violet: `'linear-gradient(135deg, #7c3aed, #a78bfa)'`
- Keep the `2px solid` border but use `alpha(primary.main, 0.2)` color

- [ ] **Step 6: Verify AI chat drawer**

Open the AI chat. Confirm:
- Solid paper background
- Clean header with no blur
- Violet AI avatar
- Messages readable in both modes

- [ ] **Step 7: Commit**

```bash
git add src/components/aiChat/AIChatDrawer.tsx
git commit -m "feat: update AIChatDrawer with solid background, remove glassmorphism"
```

---

### Task 13: Update Notes and Economic Calendar Drawers

**Files:**
- Modify: `src/components/notes/NotesDrawer.tsx` (547 lines)
- Modify: `src/components/economicCalendar/EconomicCalendarDrawer.tsx`

- [ ] **Step 1: Read both drawer files**

Read the styling sections. Focus on:
- `headerVariant` prop usage — if set to `'enhanced'`, change to `'default'`
- Any hardcoded background alpha values
- Search bar and filter styling

- [ ] **Step 2: Update NotesDrawer**

- Change `headerVariant` from `'enhanced'` to `'default'` (if set)
- Update search bar: `borderRadius: 8px`, `backgroundColor: 'background.default'` (solid, not alpha)
- Update any `background.paper@alpha(0.5)` or similar to solid `background.paper` or `background.default`

- [ ] **Step 3: Update EconomicCalendarDrawer**

- Change `headerVariant` to `'default'` (if set to enhanced)
- Update any glassmorphism or alpha backgrounds to solid
- Ensure event cards use the new shadow system

- [ ] **Step 4: Verify both drawers**

Open Notes drawer and Economic Calendar drawer. Confirm solid backgrounds, clean headers, proper spacing.

- [ ] **Step 5: Commit**

```bash
git add src/components/notes/NotesDrawer.tsx src/components/economicCalendar/EconomicCalendarDrawer.tsx
git commit -m "feat: update Notes and Economic Calendar drawers for redesign"
```

---

### Task 14: Final Verification and Cleanup

- [ ] **Step 1: Full app walkthrough — Dark mode**

Navigate through every key surface in dark mode:
1. Landing page (secondary — just check nothing is broken)
2. Login → Home dashboard
3. Open a calendar → Calendar page
4. Click a day → Day dialog
5. Open AI chat drawer
6. Open Notes drawer
7. Open Economic Calendar drawer
8. Create/edit a trade (dialog)
9. Check performance charts
10. Toggle to light mode

- [ ] **Step 2: Full app walkthrough — Light mode**

Repeat the same walkthrough in light mode. Note any visual issues.

- [ ] **Step 3: Fix any remaining hardcoded colors**

Search for any remaining old color values that clash:
- Old blue: `#1976d2`
- Old pink/secondary: `#dc004e`
- Any hardcoded `rgba(0,0,0,0.2)` scrollbar values
- Any remaining `backdropFilter: blur` instances

Run: Search codebase for `#1976d2`, `#dc004e`, `backdropFilter`, `blur(` in component files.

Replace with theme-aware equivalents.

- [ ] **Step 4: Build verification**

Run: `npm run build`

Confirm no TypeScript errors and build succeeds.

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: clean up remaining hardcoded colors and verify build"
```

- [ ] **Step 6: Final commit summary**

Verify the branch has clean, logical commits:
```bash
git log --oneline feat/ui-redesign
```
