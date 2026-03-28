# P&L Heatmap — Design Spec

## Overview
GitHub-style year-at-a-glance heatmap showing daily P&L intensity. Placed in the Basic tab of PerformanceCharts, after PnLChartsWrapper and before Win/Loss Distribution.

## Component
- **File:** `src/components/charts/PnLHeatmap.tsx`
- **Pattern:** Follows existing chart components (Paper wrapper, useTheme, MUI)

## Visual Design
- Grid: 52 columns (weeks) x 7 rows (Mon-Sun)
- Cell size: ~14px with 2px gap (responsive — smaller on mobile)
- Month labels along top, day-of-week labels (M/W/F) on left
- Rounded corners on cells (2px border-radius)

### Color Scale
- **Wins (green):** 4 intensity levels based on P&L magnitude relative to period max
  - Level 1: lightest green (0-25% of max win)
  - Level 2: medium green (25-50%)
  - Level 3: dark green (50-75%)
  - Level 4: darkest green (75-100%)
- **Losses (red):** 4 intensity levels (same thresholds, using absolute value)
- **No trades:** theme-aware neutral (dark mode: rgba(255,255,255,0.05), light: rgba(0,0,0,0.05))
- **Today:** subtle primary-color border

### Theme Integration
- Uses theme success/error colors as base, with alpha variations for intensity
- Paper wrapper matches existing chart components

## Behavior
- **Time period:** Shows full year grid for "Year"/"All Time", condensed for "Month"
- **Tooltip:** Date, daily P&L (formatted), trade count
- **Click:** Opens TradesListDialog with that day's trades (reuses existing dialog)
- **Responsive:** Smaller cells on mobile, horizontal scroll if needed

## Data Flow
- Input: `filteredTrades` (already loaded in PerformanceCharts)
- Processing: Group trades by date, sum P&L per day, compute intensity thresholds
- No new API calls or data fetching required

## Props Interface
```typescript
interface PnLHeatmapProps {
  trades: Trade[];
  timePeriod: TimePeriod;
  selectedDate: Date;
  setMultipleTradesDialog: (dialogState: any) => void;
}
```

## Integration Point
In PerformanceCharts.tsx Basic tab, after `<PnLChartsWrapper>` and before the Win/Loss + Daily Summary flex row.
