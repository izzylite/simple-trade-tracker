# Service Layer Documentation

## Overview

The Simple Trade Tracker service layer has been completely migrated from Firebase to Supabase, featuring enhanced error handling, automatic retry logic, and comprehensive type safety. This document provides a complete guide to the service layer architecture, patterns, and usage.

## Architecture

### Core Components

```
src/services/
├── utils/
│   ├── supabaseErrorHandler.ts          # Core error handling system
│   └── supabaseServiceErrorHandler.ts   # Service operation utilities
├── repository/
│   ├── repositories/
│   │   ├── BaseRepository.ts             # Enhanced base repository
│   │   ├── CalendarRepository.ts         # Calendar data operations
│   │   └── TradeRepository.ts            # Trade data operations
│   └── RepositoryService.ts              # Service layer integration
├── calendarService.ts                    # Calendar business logic
├── economicCalendarService.ts            # Economic events management
├── economicEventWatcher.ts               # Real-time event processing
└── sharingService.ts                     # Share link generation
```

## Error Handling System

### Core Error Handler (`supabaseErrorHandler.ts`)

The error handling system provides intelligent error categorization, user-friendly messages, and automatic recovery strategies.

#### Error Categories

```typescript
enum SupabaseErrorCategory {
  AUTHENTICATION = 'authentication',
  DATABASE = 'database',
  STORAGE = 'storage',
  NETWORK = 'network',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown'
}
```

#### Error Severity Levels

```typescript
enum SupabaseErrorSeverity {
  LOW = 'low',           // Minor issues, user can continue
  MEDIUM = 'medium',     // Moderate issues, some functionality affected
  HIGH = 'high',         // Major issues, significant functionality affected
  CRITICAL = 'critical'  // Critical issues, application unusable
}
```

#### Usage Example

```typescript
import { parseSupabaseError, handleSupabaseError } from '../utils/supabaseErrorHandler';

try {
  const result = await supabase.from('trades').select('*');
  if (result.error) {
    throw result.error;
  }
  return result.data;
} catch (error) {
  const parsedError = parseSupabaseError(error, 'Fetching trades');
  
  // parsedError contains:
  // - category: SupabaseErrorCategory
  // - severity: SupabaseErrorSeverity
  // - userMessage: User-friendly message
  // - retryable: boolean
  // - recoveryStrategy: RetryStrategy
  
  console.error('Trade fetch failed:', parsedError);
  throw parsedError;
}
```

### Service Error Handler (`supabaseServiceErrorHandler.ts`)

Provides high-level utilities for common Supabase operations with built-in error handling and retry logic.

#### Core Functions

##### `executeSupabaseQuery`
For database queries with automatic retry and error handling.

```typescript
import { executeSupabaseQuery } from '../services/supabaseServiceErrorHandler';

const result = await executeSupabaseQuery(
  supabase.from('trades').select('*').eq('user_id', userId),
  'Fetch User Trades',
  {
    context: `Loading trades for user ${userId}`,
    retryAttempts: 2,
    retryDelay: 1000
  }
);

if (!result.success) {
  // Handle error - result.error contains SupabaseError
  console.error('Query failed:', result.error?.userMessage);
  return;
}

// Use result.data
const trades = result.data;
```

##### `executeSupabaseFunction`
For Edge Function calls with enhanced error handling.

```typescript
import { executeSupabaseFunction } from '../services/supabaseServiceErrorHandler';

const result = await executeSupabaseFunction(
  'update-tag',
  { calendarId, oldTag, newTag },
  supabase,
  {
    context: `Updating tag from "${oldTag}" to "${newTag}"`,
    retryAttempts: 2
  }
);

if (!result.success) {
  return {
    success: false,
    error: result.error?.userMessage || 'Failed to update tag'
  };
}

return {
  success: true,
  tradesUpdated: result.data?.tradesUpdated || 0
};
```

##### `executeSupabaseStorageOperation`
For storage operations with progress tracking and error handling.

```typescript
import { executeSupabaseStorageOperation } from '../services/supabaseServiceErrorHandler';

const result = await executeSupabaseStorageOperation(
  () => supabase.storage.from('trade-images').upload(path, file),
  'Upload Trade Image',
  {
    context: `Uploading image for trade ${tradeId}`,
    retryAttempts: 1
  }
);

if (!result.success) {
  throw new Error(result.error?.userMessage || 'Upload failed');
}

return result.data;
```

## Repository Layer

### Base Repository (`BaseRepository.ts`)

Provides common CRUD operations with enhanced error handling and retry logic.

#### Key Features

- **Automatic Retry Logic**: Configurable retry strategies for different error types
- **Enhanced Error Handling**: All operations return `RepositoryResult<T>` with structured error information
- **Batch Operations**: Support for `createMany`, `updateMany`, `deleteMany` with partial success handling
- **Type Safety**: Full TypeScript support with generic types

#### Repository Result Interface

```typescript
interface RepositoryResult<T = any> {
  success: boolean;
  data?: T;
  error?: SupabaseError;
  operation?: string;
  timestamp: Date;
}
```

#### Usage Example

```typescript
// Create operation
const result = await calendarRepository.create({
  name: 'My Trading Calendar',
  user_id: userId,
  description: 'Main trading calendar'
});

if (!result.success) {
  console.error('Failed to create calendar:', result.error?.userMessage);
  return;
}

const calendar = result.data; // Fully typed Calendar object
```

### Calendar Repository (`CalendarRepository.ts`)

Handles all calendar-related database operations.

#### Key Methods

```typescript
// Create calendar
async create(calendar: Omit<Calendar, 'id' | 'created_at' | 'updated_at'>): Promise<RepositoryResult<Calendar>>

// Update calendar
async update(id: string, updates: Partial<Calendar>): Promise<RepositoryResult<Calendar>>

// Delete calendar
async delete(id: string): Promise<RepositoryResult<boolean>>

// Find by user
async findByUserId(userId: string): Promise<Calendar[]>

// Batch operations
async createMany(calendars: Omit<Calendar, 'id' | 'created_at' | 'updated_at'>[]): Promise<RepositoryResult<Calendar[]>>
```

### Trade Repository (`TradeRepository.ts`)

Handles all trade-related database operations.

#### Key Methods

```typescript
// Create trade
async create(trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<RepositoryResult<Trade>>

// Update trade
async update(id: string, updates: Partial<Trade>): Promise<RepositoryResult<Trade>>

// Delete trade
async delete(id: string): Promise<RepositoryResult<boolean>>

// Find by calendar
async findByCalendarId(calendarId: string): Promise<Trade[]>

// Find by date range
async findByDateRange(calendarId: string, startDate: Date, endDate: Date): Promise<Trade[]>

// Batch operations
async createMany(trades: Omit<Trade, 'id' | 'created_at' | 'updated_at'>[]): Promise<RepositoryResult<Trade[]>>
```

## Service Layer

### Calendar Service (`calendarService.ts`)

Provides high-level calendar operations and business logic.

#### Key Functions

##### `updateTag`
Updates tags across all trades in a calendar using Supabase Edge Functions.

```typescript
const result = await updateTag(calendarId, 'old-tag', 'new-tag');

if (!result.success) {
  console.error('Tag update failed:', result.error);
  return;
}

console.log(`Updated ${result.tradesUpdated} trades`);
```

### Economic Calendar Service (`economicCalendarService.ts`)

Manages economic events with enhanced error handling and pagination.

#### Key Functions

##### `fetchEventsPaginated`
Fetches economic events with automatic retry and error handling.

```typescript
const result = await fetchEventsPaginated({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  page: 1,
  pageSize: 50,
  currencies: ['USD', 'EUR'],
  impacts: ['High', 'Medium']
});

if (!result.success) {
  console.error('Failed to fetch events:', result.error);
  return;
}

const { events, totalCount, hasMore } = result.data;
```

### Economic Event Watcher (`economicEventWatcher.ts`)

Handles real-time economic event processing and calendar updates.

#### Key Functions

##### `refreshCalendarData`
Refreshes economic calendar data using Supabase Edge Functions.

```typescript
await refreshCalendarData(targetDate, currencies);
```

##### `triggerEventUpdate`
Triggers updates for specific economic events.

```typescript
await triggerEventUpdate(events, targetDate, currencies);
```

### Sharing Service (`sharingService.ts`)

Manages share link generation and access using Supabase Edge Functions.

#### Key Functions

All sharing functions now use Supabase Edge Functions with enhanced error handling:

- `generateTradeShareLink(tradeId: string, expiresInHours?: number)`
- `generateCalendarShareLink(calendarId: string, expiresInHours?: number)`
- `getSharedTrade(shareId: string)`
- `getSharedTradesWithCalendar(shareId: string)`
- `deactivateTradeShareLink(shareId: string)`
- `deactivateCalendarShareLink(shareId: string)`

## Retry Logic

### Automatic Retry Strategies

The system implements intelligent retry strategies based on error type:

#### Network Errors
- **Retries**: 3 attempts
- **Delay**: 1000ms with exponential backoff
- **Reason**: Transient network issues

#### Rate Limit Errors
- **Retries**: 2 attempts  
- **Delay**: 5000ms with exponential backoff
- **Reason**: API rate limiting

#### Database Timeout Errors
- **Retries**: 2 attempts
- **Delay**: 500ms with exponential backoff
- **Reason**: Temporary database load

#### Non-Retryable Errors
- **Authentication Errors**: Invalid credentials, expired tokens
- **Permission Errors**: Access denied, insufficient privileges
- **Validation Errors**: Invalid data, constraint violations

### Custom Retry Configuration

```typescript
const result = await executeSupabaseQuery(
  query,
  'Custom Operation',
  {
    retryAttempts: 3,
    retryDelay: 2000,
    retryMultiplier: 1.5,
    maxRetryDelay: 10000
  }
);
```

## Migration Notes

### From Firebase to Supabase

#### Key Changes

1. **Error Handling**: Replaced generic Error objects with structured SupabaseError
2. **Retry Logic**: Added automatic retry for transient errors
3. **Type Safety**: Enhanced TypeScript support throughout
4. **Repository Pattern**: Introduced repository layer for data access
5. **Edge Functions**: Replaced Firebase Cloud Functions with Supabase Edge Functions

#### Migration Patterns

##### Before (Firebase)
```typescript
try {
  const result = await firestore.collection('trades').add(trade);
  return result.id;
} catch (error) {
  console.error('Error:', error.message);
  throw new Error('Failed to create trade');
}
```

##### After (Supabase)
```typescript
const result = await executeSupabaseQuery(
  supabase.from('trades').insert(trade).select().single(),
  'Create Trade',
  { context: 'Creating new trade', retryAttempts: 2 }
);

if (!result.success) {
  throw new Error(result.error?.userMessage || 'Failed to create trade');
}

return result.data.id;
```

## Best Practices

### Error Handling

1. **Always use service utilities** for Supabase operations
2. **Provide context** in error handling calls
3. **Use user-friendly messages** from parsed errors
4. **Log structured errors** for debugging
5. **Handle partial failures** in batch operations

### Repository Usage

1. **Use repository layer** for all database operations
2. **Check RepositoryResult.success** before using data
3. **Handle errors gracefully** with fallback strategies
4. **Use batch operations** for multiple related operations
5. **Provide operation context** for better error tracking

### Service Integration

1. **Use service layer** for business logic
2. **Keep repositories focused** on data access
3. **Implement proper error boundaries** in React components
4. **Use TypeScript strictly** for type safety
5. **Test error scenarios** thoroughly

## Troubleshooting

### Common Issues

#### Authentication Errors
- **Symptom**: `invalid_credentials` or `token_expired` errors
- **Solution**: Check user authentication state, refresh tokens
- **Prevention**: Implement proper auth state management

#### Permission Errors  
- **Symptom**: `PGRST116` or access denied errors
- **Solution**: Verify RLS policies and user permissions
- **Prevention**: Test with different user roles

#### Network Errors
- **Symptom**: Connection timeouts or network failures
- **Solution**: Automatic retry will handle most cases
- **Prevention**: Implement offline handling

#### Rate Limiting
- **Symptom**: `rate_limit_exceeded` errors
- **Solution**: Automatic retry with exponential backoff
- **Prevention**: Implement request throttling

### Debugging

#### Error Logging
All errors are logged with structured information:

```typescript
{
  category: 'database',
  severity: 'high',
  code: '23505',
  message: 'duplicate key value violates unique constraint',
  userMessage: 'This item already exists. Please use a different name.',
  context: 'Creating calendar',
  timestamp: '2024-01-15T10:30:00Z',
  retryable: false
}
```

#### Performance Monitoring
- Monitor retry attempts and success rates
- Track error categories and frequencies  
- Measure operation response times
- Alert on critical error patterns

---

## Next Steps

1. **Review service implementations** for consistency
2. **Add integration tests** for error scenarios
3. **Monitor error patterns** in production
4. **Optimize retry strategies** based on usage data
5. **Enhance documentation** with real-world examples

For specific implementation details, see the individual service files and their JSDoc comments.
