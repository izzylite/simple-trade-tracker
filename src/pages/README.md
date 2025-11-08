# Pages Directory

This directory contains all top-level page components that are used in the application's routing system. Each page represents a distinct route in the application.

## Directory Structure

```
src/pages/
├── index.ts                    # Central export point for all pages
├── HomePage.tsx                # Dashboard/Home page (/)
├── CalendarHomePage.tsx        # Calendars list page (/calendars)
├── TradeCalendarPage.tsx       # Individual calendar view (/calendar/:calendarId)
├── ChatPage.tsx                # AI Chat page (/chat)
├── CommunityPage.tsx           # Community page (/community)
├── SharedTradePage.tsx         # Public shared trade view (/shared/:shareId)
├── SharedCalendarPage.tsx      # Public shared calendar view (/shared-calendar/:shareId)
├── AuthCallbackPage.tsx        # OAuth callback handler (/auth/callback)
└── README.md                   # This file
```

## Page Components

### Main Navigation Pages

#### HomePage.tsx
- **Route**: `/`
- **Purpose**: Main dashboard showing recent calendars, trades, and economic events
- **Features**:
  - Recent calendars grid
  - Recent trades list
  - Upcoming economic events
  - Quick actions (create calendar, add trade, performance analytics, AI chat)
  - Calendar management (edit, duplicate, delete)
  - Performance analytics dialog (accessed via quick action)

#### CalendarHomePage.tsx
- **Route**: `/calendars`
- **Purpose**: Full calendar management page
- **Features**:
  - All calendars grid view
  - Calendar statistics
  - Trash/restore functionality
  - Calendar CRUD operations
  - Performance charts per calendar

#### TradeCalendarPage.tsx
- **Route**: `/calendar/:calendarId`
- **Purpose**: Individual calendar view with monthly trade grid
- **Features**:
  - Monthly calendar grid
  - Trade management (add, edit, delete)
  - Day notes and statistics
  - Account balance tracking
  - Performance metrics
  - Economic calendar integration
  - AI chat integration
  - Trade gallery view
  - Tag management

#### ChatPage.tsx
- **Route**: `/chat`
- **Purpose**: Full-page AI trading assistant interface
- **Features**:
  - AI chat with trading data analysis
  - Question templates
  - Message history
  - Trade and event references
  - Streaming responses

#### CommunityPage.tsx
- **Route**: `/community`
- **Purpose**: Community features (coming soon)
- **Status**: Placeholder page

### Sharing Pages

#### SharedTradePage.tsx
- **Route**: `/shared/:shareId`
- **Purpose**: Public view of a shared trade
- **Features**:
  - Read-only trade details
  - Trade images and notes
  - Performance metrics
  - No authentication required

#### SharedCalendarPage.tsx
- **Route**: `/shared-calendar/:shareId`
- **Purpose**: Public view of a shared calendar
- **Features**:
  - Read-only calendar view
  - All trades in the calendar
  - Calendar statistics
  - No authentication required

### Auth Pages

#### AuthCallbackPage.tsx
- **Route**: `/auth/callback`
- **Purpose**: OAuth callback handler for Supabase authentication
- **Features**:
  - Handles OAuth redirect
  - Session validation
  - Error handling
  - Auto-redirect to dashboard

## Usage

### Importing Pages

All pages are exported from the central `index.ts` file:

```typescript
import {
  HomePage,
  CalendarHomePage,
  TradeCalendarPage,
  ChatPage,
  CommunityPage,
  SharedTradePage,
  SharedCalendarPage,
  AuthCallbackPage
} from './pages';
```

### Lazy Loading in App.tsx

Pages are lazy-loaded for better performance:

```typescript
const HomePage = lazy(() => import('./pages/HomePage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
// etc.
```

### Route Configuration

Routes are configured in `src/App.tsx`:

```typescript
<Routes>
  <Route path="/" element={<HomePage {...props} />} />
  <Route path="/calendars" element={<CalendarHomePage {...props} />} />
  <Route path="/calendar/:calendarId" element={<TradeCalendarPage {...props} />} />
  <Route path="/chat" element={<ChatPage {...props} />} />
  <Route path="/community" element={<CommunityPage {...props} />} />
  <Route path="/shared/:shareId" element={<SharedTradePage />} />
  <Route path="/shared-calendar/:shareId" element={<SharedCalendarPage />} />
  <Route path="/auth/callback" element={<AuthCallbackPage />} />
</Routes>
```

**Note**: Performance analytics is now accessed via a dialog in HomePage rather than a dedicated route.

## Common Page Props

Most navigation pages accept these common props:

```typescript
interface CommonPageProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  onMenuClick?: () => void;
}
```

Additional props are specific to each page's requirements.

## Page Layout Pattern

All pages follow a consistent layout pattern:

```typescript
<Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
  <AppHeader onToggleTheme={onToggleTheme} mode={mode} onMenuClick={onMenuClick} />
  
  {/* Toolbar spacer to prevent content from being hidden under AppHeader */}
  <Toolbar sx={{ pl: 0, pr: 0 }} />

  {/* Page content */}
  <Box sx={{ flex: 1, overflow: 'auto' }}>
    {/* Page-specific content */}
  </Box>
</Box>
```

## Best Practices

1. **Keep pages focused**: Each page should have a single, clear purpose
2. **Extract reusable components**: Move shared UI to `src/components/`
3. **Use consistent layouts**: Follow the established layout pattern
4. **Handle loading states**: Show appropriate loading indicators
5. **Error boundaries**: Wrap pages in error boundaries for graceful error handling
6. **Accessibility**: Ensure all pages are keyboard navigable and screen reader friendly
7. **Responsive design**: All pages should work on mobile, tablet, and desktop
8. **Performance**: Use lazy loading and code splitting for better performance

## Related Directories

- **`src/components/`**: Reusable UI components used by pages
- **`src/services/`**: Business logic and API calls
- **`src/types/`**: TypeScript type definitions
- **`src/utils/`**: Utility functions
- **`src/hooks/`**: Custom React hooks
- **`src/contexts/`**: React context providers

## Migration Notes

This directory was created as part of a refactoring effort to better organize the codebase. Previously, page components were mixed with other components in `src/components/`. The new structure provides:

- **Better organization**: Clear separation between pages and components
- **Easier navigation**: All routes in one place
- **Improved maintainability**: Easier to find and update page-specific code
- **Cleaner imports**: Centralized exports through `index.ts`

