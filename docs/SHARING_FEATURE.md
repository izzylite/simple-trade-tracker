# Trade Sharing Feature

## Overview

The trade sharing feature allows users to generate shareable links for their trades **on-demand** when they explicitly choose to share. This approach is more efficient and privacy-focused than automatically generating links for every trade. The feature uses direct shareable links and Cloud Functions to create secure, shareable trade views.

**Note**: This implementation uses direct links instead of Firebase Dynamic Links, which will be deprecated on August 25, 2025. This ensures long-term compatibility and reliability.

## Architecture

### Frontend Components

1. **ShareTradeButton** (`src/components/sharing/ShareTradeButton.tsx`)
   - Provides UI for generating and managing share links
   - Handles share link generation and deactivation
   - Shows share dialog with copy functionality

2. **SharedTradeView** (`src/components/sharing/SharedTradeView.tsx`)
   - Displays shared trades in a read-only format
   - Fetches shared trade data from Firebase
   - Increments view count automatically
   - **Reuses TradeDetailExpanded component directly**
   - Includes image zoom functionality via ImageZoomDialog
   - Automatically becomes read-only when no `onUpdateTradeProperty` or `calendarId` props are provided

3. **SharedTradePage** (`src/components/sharing/SharedTradePage.tsx`)
   - Full page component for viewing shared trades
   - Handles URL routing for shared trade links
   - **Reuses AppHeader component** for consistent navigation and branding
   - Includes theme toggle functionality with localStorage persistence
   - Provides error handling for invalid share links

### Backend (Firebase Cloud Functions)

1. **generateTradeShareLinkV2** (`functions/src/sharing.ts`)
   - Creates shareable links **only when requested** by user
   - Stores shared trade data securely in Firestore
   - Generates direct shareable links (future-proof, no dependency on deprecated services)
   - Validates user permissions before creating shares

2. **getSharedTradeV2** (`functions/src/sharing.ts`)
   - Retrieves shared trade data (public access, no auth required)
   - Automatically increments view count
   - Validates share link status and activity

3. **deactivateSharedTradeV2** (`functions/src/sharing.ts`)
   - **Completely deletes shared trade documents** with proper user verification
   - Prevents further access to shared trades (document no longer exists)
   - Cleaner and more secure than just marking as inactive

### ✅ **Improved Architecture (Current Implementation)**

**Key Design Decision**: Instead of storing the full trade object in the shared trade document, we store only the trade ID and calendar ID. When viewing a shared trade, we fetch the actual trade data from the calendar.

**Benefits**:
- **Data Consistency**: Always shows the latest trade data
- **Storage Efficiency**: Smaller shared trade documents
- **Simpler Date Handling**: No timestamp conversion issues
- **Automatic Updates**: If trade is updated, shared view reflects changes

**Database Structure**:
```
sharedTrades/{shareId}
├── id: string
├── tradeId: string        // Reference to actual trade
├── calendarId: string     // Reference to calendar containing trade
├── userId: string
├── createdAt: Timestamp
├── isActive: boolean
└── viewCount: number
```

**Helper Functions**:
- `findTradeInCalendar`: Searches for a trade by ID across calendar year documents

### Data Structure

#### Trade Type Extensions
```typescript
interface Trade {
  // ... existing fields
  shareLink?: string;
  isShared?: boolean;
  sharedAt?: Date;
  shareId?: string;
}
```

#### SharedTrade Document
```typescript
interface SharedTrade {
  id: string;
  tradeId: string;
  calendarId: string;
  userId: string;
  trade: Trade;
  shareLink: string;
  createdAt: Date;
  isActive: boolean;
  viewCount: number;
}
```

## Usage

### Sharing a Trade

1. Click the share button on any trade in TradeDetailExpanded
2. Select "Generate share link" from the menu
3. Copy the generated link from the dialog
4. Share the link with others

### Viewing a Shared Trade

1. Open the shared link in any browser
2. View the trade details in read-only format
3. No authentication required

### Managing Shared Trades

1. Click the share button on a shared trade
2. Select "Stop sharing" to deactivate the link
3. **The shared trade document is completely deleted** - the link will no longer be accessible

## Security & Privacy

- **On-demand sharing**: Links are only created when explicitly requested
- **Read-only access**: Shared trades cannot be modified by viewers
- **No sensitive data**: User information and private details are not exposed
- **User-controlled**: Share links can be completely deleted at any time by the owner
- **Permission validation**: All operations verify user ownership
- **View tracking**: Analytics are collected for legitimate usage monitoring

## URL Structure

Shared trade URLs follow this simple, direct pattern:
```
https://tradetracker-30ec1.web.app/shared/{shareId}
```

Example:
```
https://tradetracker-30ec1.web.app/shared/share_trade123_1703123456789_abc123def
```

**Benefits of Direct URLs:**
- No redirects or intermediate services
- Works immediately on any device/browser
- Easy to share via any platform (email, SMS, social media)
- Future-proof (no dependency on deprecated services)

## Firebase Rules

Ensure your Firestore security rules allow read access to the `sharedTrades` collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow public read access to shared trades
    match /sharedTrades/{shareId} {
      allow read: if true;
    }
  }
}
```

## Deployment

1. ✅ **Deploy the cloud functions** (COMPLETED):
   ```bash
   cd functions
   firebase deploy --only functions
   ```
   **Status**: All sharing functions deployed successfully with CORS enabled:
   - `generateTradeShareLinkV2` ✅
   - `getSharedTradeV2` ✅
   - `deactivateSharedTradeV2` ✅ **Updated to delete documents completely**

2. ✅ **Deploy the web application** (COMPLETED):
   ```bash
   npm run build
   firebase deploy --only hosting
   ```
   **Status**: Web app deployed successfully with improved shared trade view:
   - **Reuses TradeDetailExpanded component directly** ✅
   - **Reuses AppHeader component** for consistent navigation ✅
   - **Full mobile responsiveness** for all screen sizes ✅
   - **No code duplication** - same styling and layout as main app ✅
   - **Image zoom functionality** with ImageZoomDialog ✅
   - **Automatic read-only mode** when editing props not provided ✅
   - **Theme toggle functionality** with localStorage persistence ✅
   - Fixed date handling issues ✅

3. Update Firestore security rules to allow public read access to shared trades

4. ~~Configure Firebase Dynamic Links in the Firebase Console~~ (No longer needed - using direct links)

## Benefits of On-Demand Approach

- **Privacy First**: No automatic link generation means better privacy control
- **Performance**: Reduces database writes and storage usage
- **User Intent**: Links are only created when users actually want to share
- **Cost Effective**: Fewer cloud function calls and database operations
- **Cleaner Data**: No orphaned share links for trades that were never shared

## Benefits of Direct Links (vs Firebase Dynamic Links)

- **Future-Proof**: No dependency on Firebase Dynamic Links (deprecated Aug 25, 2025)
- **Simplicity**: Direct links are easier to understand and debug
- **Reliability**: No third-party service dependency for link resolution
- **Performance**: Faster loading - no redirect through Firebase servers
- **Universal Compatibility**: Works on all devices and browsers without special handling
- **Cost Effective**: No additional Firebase Dynamic Links usage costs

## Future Enhancements

- Expiration dates for shared links
- Password protection for shared trades
- Analytics dashboard for shared trades
- Social media integration
- Bulk sharing capabilities
