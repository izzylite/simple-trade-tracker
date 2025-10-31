# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cotex is a React-based trading journal application that allows traders to track their trades, analyze performance, and manage trading calendars. The project uses Supabase, TypeScript, Material-UI, and includes Supabase edge functions for backend operations.

## Common Development Commands

### Frontend Development
- `npm start` - Start the React development server
- `npm run build` - Build the production application
- `npm test` - Run Jest tests
- `npm run eject` - Eject from Create React App

### Database Migration and Setup
- `npm run migrate-events` - Run trade event migration script using ts-node
- `npm run migrate-trade-events` - Run trade events migration using Node.js

### Deployment
- `npm run deploy` - Deploy to GitHub Pages (runs build first)

## High-Level Architecture

### Frontend Structure
- **React SPA**: Built with Create React App and TypeScript
- **UI Framework**: Material-UI (MUI) v7 with custom theming
- **Routing**: React Router v7 for navigation
- **State Management**: React Context (AuthContext) with local component state
- **Rich Text**: Draft.js for trade notes with custom toolbar
- **Charts**: Recharts for performance visualization

### Data Layer
- **Primary Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Data Structure**: Year-based subcollections for trade organization

### Backend Services
- **Edge Functions**: Supabase Edge Functions (Deno-based) in `/supabase/functions/`
- **Economic Calendar**: Automated scraping and processing of economic events
- **Trade Sharing**: On-demand share link generation
- **Tag Management**: Bulk tag updates across trades
- **Background Tasks**: Cleanup and maintenance operations

### Key Service Files
- `src/services/calendarService.ts` - Core trade and calendar operations with Supabase
- `src/services/supabaseStorageService.ts` - File upload/download with Supabase Storage
- `src/services/ai/supabaseAIChatService.ts` - AI chat service with Supabase edge functions

## Architecture Patterns

### Trade Data Organization
- Calendars contain years as subcollections
- Each year document stores an array of trades
- Statistics calculated at calendar level and cached
- Transactions used for consistency in multi-document operations

### File Management
- Trade images stored in Supabase Storage with signed URLs
- Image optimization performed client-side before upload
- Progress tracking for uploads using XMLHttpRequest
- User-scoped file paths: `users/{userId}/trade-images/{filename}`

### UI Patterns
- Drawer-based navigation with toolbar integration
- Dialog components with cancel buttons and close icons
- Shimmer loading states for better UX
- Responsive design with mobile-first approach
- Rich text editor with 1024 character limit

### Data Synchronization
- Supabase postgres_changes subscriptions for real-time updates
- Calendar statistics recalculation on trade changes
- Background processing with user feedback

## Development Guidelines

### Code Style and Conventions
- TypeScript strict mode enabled
- Prefer service layer calculations over UI calculations
- Use transactions for database operations
- Extract reusable components, especially complex ones
- Store numeric values as numbers, not strings
- Use Unix timestamps for publishedAt/updatedAt fields

### UI/UX Preferences
- Rounded tab styling and curved cards
- Tooltips for calculations and complex UI elements
- Immediate dialog closures with background processing
- Full-width components with reduced border radius
- Hero images spanning full screen with overlaying components
- Maximum component height of 350px for information displays

### Risk Management
- Dynamic risk adjustment based on performance
- Risk per trade field with balance calculations
- Required tag groups validation
- Granular update functions for specific properties

### Testing and Quality
- Run tests with `npm test`
- Use React Testing Library for component tests
- Test edge functions with Deno test framework
- Verify database operations with transactions

## Important Files and Patterns

### Configuration Files
- `.cursor/rules/` - Cursor AI coding rules and patterns
- `supabase/config.toml` - Supabase configuration
- `supabase/migrations/` - Database schema and migrations

### Core Components
- `src/components/trades/TradeForm.tsx` - Main trade creation/editing
- `src/components/common/RichTextEditor/` - Custom Draft.js implementation
- `src/components/charts/` - Performance visualization components
- `src/components/economicCalendar/` - Economic event display

### Edge Functions
- `supabase/functions/process-economic-events/` - Economic calendar data processing
- `supabase/functions/handle-trade-changes/` - Trade change event handling
- `supabase/functions/*-share-link/` - Trade/calendar sharing functionality

## Migration Notes

The project is actively migrating from Firebase to Supabase:
- Database: Firestore → Supabase PostgreSQL
- Auth: Firebase Auth → Supabase Auth (planned)
- Storage: Firebase Storage → Supabase Storage (completed)
- Functions: Firebase Functions → Supabase Edge Functions (in progress)

When working with data operations, check both Firebase and Supabase implementations as some features may exist in both systems during the transition.