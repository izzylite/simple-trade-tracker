# Firebase Cloud Functions Inventory

## Overview
This document provides a comprehensive inventory of all Firebase Cloud Functions in the simple-trade-tracker project that need to be migrated to Supabase Edge Functions.

## Function Categories

### 1. Firestore Triggers
These functions are automatically triggered by Firestore document changes.

#### onTradeChangedV2
- **Type**: Firestore Document Update Trigger
- **Path**: `calendars/{calendarId}/years/{yearId}`
- **File**: `functions/src/index.ts` (lines 33-56)
- **Purpose**: Handles trade document updates, including:
  - Image cleanup when trades are modified
  - Trade year changes (moving trades between year documents)
  - Calendar tag updates when trade tags change
- **Dependencies**: 
  - `cleanupRemovedImagesHelper()` from utils.ts
  - `handleTradeYearChanges()` from utils.ts
  - `haveTagsChanged()` from utils.ts
  - `updateCalendarTagsFromTradeChanges()` from utils.ts

#### cleanupDeletedCalendarV2
- **Type**: Firestore Document Delete Trigger
- **Path**: `calendars/{calendarId}`
- **File**: `functions/src/index.ts` (lines 60-171)
- **Purpose**: Cleans up all data when a calendar is deleted:
  - Deletes all year subcollections and trades
  - Removes all associated images from Firebase Storage
  - Handles both regular and duplicated calendars
- **Dependencies**: Firebase Admin SDK for Firestore and Storage

### 2. Callable Functions (HTTP Endpoints)
These functions are called directly from the client application.

#### updateTagV2
- **Type**: HTTPS Callable Function
- **File**: `functions/src/index.ts` (lines 174-end)
- **Purpose**: Updates tags across all trades in a calendar
- **Features**:
  - CORS enabled
  - App Check verification
  - Authentication required
  - Handles group name changes
  - Batch processing with transaction support
- **Dependencies**: 
  - `updateTradeTagsWithGroupNameChange()` from utils.ts
  - `updateCalendarTagsFromTradeChanges()` from utils.ts

### 3. Scheduled Functions
These functions run on a schedule using Cloud Scheduler.

#### cleanupExpiredCalendarsV2
- **Type**: Scheduled Function (Daily at 2 AM)
- **Schedule**: `0 2 * * *`
- **File**: `functions/src/cleanupExpiredCalendars.ts`
- **Purpose**: Permanently deletes calendars that have been in trash for >30 days
- **Features**:
  - Queries calendars with `isDeleted: true` and `autoDeleteAt <= now`
  - Batch deletion with error handling
  - Comprehensive logging

#### autoRefreshEconomicCalendarV2
- **Type**: Scheduled Function (Every 30 minutes)
- **Schedule**: `*/30 * * * *`
- **File**: `functions/src/economicCalendar.ts` (lines 33-60)
- **Purpose**: Fetches economic calendar data from MyFXBook API
- **Features**:
  - Memory: 1GiB, Timeout: 540s
  - Filters for major currencies (USD, EUR, GBP, JPY, AUD, CAD, CHF)
  - Stores events in `economicEvents` collection
- **Dependencies**: External MyFXBook API, cheerio for HTML parsing

### 4. Economic Calendar Functions

#### processHtmlEconomicEvents
- **Type**: HTTPS Callable Function
- **File**: `functions/src/economicCalendar.ts`
- **Purpose**: Processes HTML economic event data
- **Features**: CORS enabled, App Check verification

#### refreshEconomicCalendar
- **Type**: HTTPS Callable Function
- **File**: `functions/src/economicCalendar.ts`
- **Purpose**: Manually refreshes economic calendar data for specific dates/currencies
- **Features**: CORS enabled, App Check verification

### 5. Sharing Functions
These functions handle trade and calendar sharing functionality.

#### generateTradeShareLinkV2
- **Type**: HTTPS Callable Function
- **File**: `functions/src/sharing.ts` (lines 78-123)
- **Purpose**: Creates shareable links for individual trades
- **Features**:
  - CORS enabled, App Check verification
  - Creates documents in `sharedTrades` collection
  - Generates direct links (no Firebase Dynamic Links)

#### getSharedTradeV2
- **Type**: HTTPS Callable Function
- **File**: `functions/src/sharing.ts`
- **Purpose**: Retrieves shared trade data for public viewing
- **Features**: Increments view count, validates share status

#### deactivateSharedTradeV2
- **Type**: HTTPS Callable Function
- **File**: `functions/src/sharing.ts`
- **Purpose**: Deactivates/deletes shared trade links
- **Features**: Complete document deletion (updated behavior)

#### generateCalendarShareLinkV2
- **Type**: HTTPS Callable Function
- **File**: `functions/src/sharing.ts` (lines 255-326)
- **Purpose**: Creates shareable links for entire calendars
- **Features**: Similar to trade sharing but for calendar collections

#### getSharedCalendarV2
- **Type**: HTTPS Callable Function
- **File**: `functions/src/sharing.ts`
- **Purpose**: Retrieves shared calendar data for public viewing

#### deactivateSharedCalendarV2
- **Type**: HTTPS Callable Function
- **File**: `functions/src/sharing.ts`
- **Purpose**: Deactivates/deletes shared calendar links

## Dependencies Summary

### Firebase Services Used
- **Firestore**: Document CRUD operations, transactions, queries
- **Storage**: File upload/deletion for trade images
- **Auth**: User authentication and authorization
- **Functions**: Runtime environment and triggers

### External Dependencies
- **MyFXBook API**: Economic calendar data source
- **cheerio**: HTML parsing for economic events
- **crypto**: Hash generation for unique IDs

### Internal Utilities (utils.ts)
- Image management and cleanup logic
- Trade year change handling
- Tag management and updates
- Calendar maintenance functions

## Configuration Files
- **package.json**: Node.js 18, Firebase Functions v6.3.2
- **firebase.json**: Functions source directory, emulator ports
- **tsconfig.json**: TypeScript compilation settings

## Current Deployment
- Functions are deployed to Firebase Cloud Functions
- Using Firebase CLI: `firebase deploy --only functions`
- Emulator available on port 5001 for local development
