# Trade Link Navigation Test

This file documents the improved trade link navigation feature added to RichTextEditor.

## Feature Overview

The RichTextEditor now supports intelligent link navigation for trade-related URLs with smart trade detection:

### Supported Link Types

1. **Calendar Links**: `/calendar/{calendarId}`
   - If the link points to the current calendar and trades are available, opens gallery mode
   - Otherwise, navigates to the calendar page

2. **Shared Trade Links**: `/shared/{shareId}` - **IMPROVED LOGIC**
   - **Extracts tradeId** from shareId format: `share_{tradeId}_{timestamp}_{random}`
   - **Checks if trade exists** in current calendar
   - **If found**: Opens gallery mode directly (no page navigation)
   - **If not found**: Navigates to shared trade page with back button support

3. **External Links**: All other URLs
   - Opens in a new tab (existing behavior)

### Implementation Details

- **LinkComponent**: Updated to detect internal trade links and handle navigation
- **RichTextEditor Props**: Added optional `calendarId`, `trades`, and `onOpenGalleryMode` props
- **Decorator Factory**: Created `createDecorator()` to pass props to LinkComponent
- **URL Detection**: Uses regex patterns to identify calendar and shared trade links

### Usage Examples

```typescript
// In a component with trade data
<RichTextEditor
  value={content}
  onChange={setContent}
  calendarId="calendar123"
  trades={allTrades}
  onOpenGalleryMode={openGalleryMode}
/>
```

### Test Cases

1. **Calendar Link (Current Calendar)**
   - URL: `https://tradetracker-30ec1.web.app/calendar/calendar123`
   - Expected: Opens gallery mode with all trades

2. **Calendar Link (Different Calendar)**
   - URL: `https://tradetracker-30ec1.web.app/calendar/other456`
   - Expected: Navigates to the other calendar

3. **Shared Trade Link (Trade in Current Calendar)** - **NEW BEHAVIOR**
   - URL: `https://tradetracker-30ec1.web.app/shared/share_trade123_1703123456789_abc123def`
   - TradeId: `trade123` (extracted from shareId)
   - Current Calendar has trade with ID `trade123`
   - Expected: **Opens gallery mode directly** with trade `trade123` selected

4. **Shared Trade Link (Trade in Different Calendar)** - **NEW BEHAVIOR**
   - URL: `https://tradetracker-30ec1.web.app/shared/share_trade456_1703123456789_def456ghi`
   - TradeId: `trade456` (extracted from shareId)
   - Current Calendar does NOT have trade with ID `trade456`
   - Expected: **Navigates to shared trade page** with back button to return

5. **External Link**
   - URL: `https://google.com`
   - Expected: Opens in new tab

### Components Updated

- **RichTextEditor**: Enhanced with trade ID extraction and smart navigation logic
- **DayNotesDialog**: Passes trade props to RichTextEditor
- **CalendarNote**: Passes trade props to RichTextEditor
- **TradeCalendar**: Provides trade data to note components
- **SharedTradePage**: Added back button support when navigated from links
- **AppHeader**: Added `onBackClick` prop for custom back navigation

### Key Improvements

#### **🎯 Smart Trade Detection**
```typescript
// Extract tradeId from shareId format: share_{tradeId}_{timestamp}_{random}
const shareIdParts = shareId.split('_');
const tradeId = shareIdParts[1];

// Check if trade exists in current calendar
const tradeInCurrentCalendar = trades?.find(trade => trade.id === tradeId);
```

#### **🔄 Context-Aware Navigation**
```typescript
if (tradeInCurrentCalendar && onOpenGalleryMode) {
  // Trade found - open gallery mode directly
  onOpenGalleryMode(trades, tradeId, 'Shared Trade');
} else {
  // Trade not found - navigate with referrer info
  navigate(`/shared/${shareId}`, {
    state: { referrer: currentPath, referrerCalendarId: calendarId }
  });
}
```

#### **⬅️ Back Navigation Support**
- SharedTradePage detects referrer state
- Shows back button when navigated from a link
- Returns to original calendar/page

### Benefits

- **🚀 Instant Access**: Trades in current calendar open immediately in gallery mode
- **🎯 Smart Routing**: Only navigates to shared page when necessary
- **⬅️ Easy Return**: Back button returns to original context
- **🔗 Universal Links**: Works with any shared trade link regardless of calendar
- **📱 Better UX**: Reduces unnecessary page loads and navigation steps
- **🔒 Backward Compatible**: Existing links continue to work as before
