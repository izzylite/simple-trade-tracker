# Error Handling Guide

## Overview

The Simple Trade Tracker implements a comprehensive error handling system specifically designed for Supabase operations. This guide provides detailed information on error handling patterns, recovery strategies, and best practices.

## Error Handling Architecture

### Core Components

1. **`supabaseErrorHandler.ts`** - Core error parsing and categorization
2. **`supabaseServiceErrorHandler.ts`** - Service-level operation utilities
3. **Repository Layer** - Enhanced error handling in data access
4. **Service Layer** - Business logic error management

## Error Categories and Handling

### Authentication Errors

#### Common Codes
- `invalid_credentials` - Invalid email/password
- `email_not_confirmed` - Email verification required
- `token_expired` - Session expired
- `signup_disabled` - Registration disabled

#### Handling Strategy
```typescript
// Authentication errors are NOT retryable
const error = parseSupabaseError(authError, 'User login');

if (error.category === SupabaseErrorCategory.AUTHENTICATION) {
  // Redirect to login page
  // Show user-friendly message
  // Clear stored tokens
}
```

#### User Messages
- `invalid_credentials` → "Invalid email or password. Please check your credentials and try again."
- `email_not_confirmed` → "Please check your email and click the confirmation link."
- `token_expired` → "Your session has expired. Please sign in again."

### Database Errors

#### Common Codes
- `23505` - Unique constraint violation
- `23503` - Foreign key constraint violation
- `PGRST116` - RLS policy violation (no rows returned)
- `PGRST301` - Row not found

#### Handling Strategy
```typescript
const result = await executeSupabaseQuery(
  supabase.from('trades').insert(trade),
  'Create Trade',
  { retryAttempts: 2 }
);

if (!result.success && result.error?.code === '23505') {
  // Handle duplicate entry
  showUserMessage('This trade already exists');
}
```

#### User Messages
- `23505` → "This item already exists. Please use a different name or identifier."
- `23503` → "Cannot delete this item because it is referenced by other data."
- `PGRST116` → "Access denied. You do not have permission to access this data."

### Storage Errors

#### Common Codes
- `file_not_found` - File doesn't exist
- `file_too_large` - File exceeds size limit
- `invalid_mime_type` - Unsupported file type
- `storage_quota_exceeded` - Storage limit reached

#### Handling Strategy
```typescript
const result = await executeSupabaseStorageOperation(
  () => supabase.storage.from('trade-images').upload(path, file),
  'Upload Trade Image',
  { retryAttempts: 1 }
);

if (!result.success) {
  if (result.error?.code === 'file_too_large') {
    showUserMessage('File is too large. Please choose a smaller image.');
  }
}
```

#### User Messages
- `file_not_found` → "The requested file could not be found."
- `file_too_large` → "File is too large. Please choose a smaller file."
- `invalid_mime_type` → "File type not supported. Please choose a different file."

### Network Errors

#### Common Scenarios
- Connection timeouts
- DNS resolution failures
- Network connectivity issues
- Server unavailable

#### Handling Strategy
```typescript
// Network errors are automatically retried
const result = await executeSupabaseQuery(
  query,
  'Fetch Data',
  {
    retryAttempts: 3,
    retryDelay: 1000
  }
);

// Automatic retry with exponential backoff:
// Attempt 1: immediate
// Attempt 2: 1000ms delay
// Attempt 3: 2000ms delay
// Attempt 4: 4000ms delay
```

#### User Messages
- Network errors → "Network connection error. Please check your internet connection and try again."

### Permission Errors

#### Common Scenarios
- RLS policy violations
- Insufficient user privileges
- Access to restricted resources

#### Handling Strategy
```typescript
if (error.category === SupabaseErrorCategory.PERMISSION) {
  // Log security event
  logger.warn('Permission denied', { userId, operation, resource });
  
  // Show generic message (don't reveal system details)
  showUserMessage('You do not have permission to perform this action.');
}
```

#### User Messages
- Permission errors → "You do not have permission to perform this action."

### Rate Limit Errors

#### Common Codes
- `rate_limit_exceeded` - Too many requests
- `quota_exceeded` - API quota reached

#### Handling Strategy
```typescript
// Rate limit errors are retried with longer delays
const result = await executeSupabaseQuery(
  query,
  'API Call',
  {
    retryAttempts: 2,
    retryDelay: 5000  // 5 second delay for rate limits
  }
);
```

#### User Messages
- Rate limit errors → "Too many requests. Please wait a moment and try again."

## Retry Logic Implementation

### Retry Strategies

#### Network Errors
```typescript
{
  shouldRetry: true,
  retryDelay: 1000,
  maxRetries: 3,
  retryMultiplier: 2.0
}
```

#### Rate Limit Errors
```typescript
{
  shouldRetry: true,
  retryDelay: 5000,
  maxRetries: 2,
  retryMultiplier: 1.5
}
```

#### Database Timeout Errors
```typescript
{
  shouldRetry: true,
  retryDelay: 500,
  maxRetries: 2,
  retryMultiplier: 2.0
}
```

#### Non-Retryable Errors
```typescript
{
  shouldRetry: false,
  retryDelay: 0,
  maxRetries: 0
}
```

### Custom Retry Configuration

```typescript
const result = await executeSupabaseQuery(
  query,
  'Custom Operation',
  {
    retryAttempts: 5,           // Override default retry count
    retryDelay: 2000,           // Override default delay
    retryMultiplier: 1.5,       // Override backoff multiplier
    maxRetryDelay: 30000,       // Maximum delay between retries
    retryCondition: (error) => { // Custom retry condition
      return error.category === SupabaseErrorCategory.NETWORK;
    }
  }
);
```

## Error Logging and Monitoring

### Structured Logging

```typescript
// All errors are logged with structured data
{
  level: 'error',
  category: 'database',
  severity: 'high',
  code: '23505',
  message: 'duplicate key value violates unique constraint',
  userMessage: 'This item already exists',
  context: 'Creating trade',
  operation: 'create',
  timestamp: '2024-01-15T10:30:00Z',
  userId: 'user-123',
  retryAttempt: 2,
  retryable: false,
  originalError: { /* full error object */ }
}
```

### Error Metrics

Track key metrics for monitoring:

- **Error Rate**: Percentage of operations that fail
- **Error Categories**: Distribution of error types
- **Retry Success Rate**: Percentage of retries that succeed
- **Response Times**: Operation duration including retries
- **User Impact**: Errors that affect user experience

### Alerting

Set up alerts for:

- **High Error Rates**: > 5% error rate for any operation
- **Critical Errors**: Authentication or permission failures
- **Retry Failures**: Operations that fail after all retries
- **Performance Issues**: Operations taking > 10 seconds

## Best Practices

### Error Handling

1. **Always use service utilities** for Supabase operations
2. **Provide meaningful context** in error messages
3. **Use structured logging** for debugging
4. **Handle errors at appropriate levels** (service vs component)
5. **Test error scenarios** thoroughly

### User Experience

1. **Show user-friendly messages** from parsed errors
2. **Provide actionable guidance** when possible
3. **Implement loading states** during retries
4. **Use error boundaries** in React components
5. **Graceful degradation** for non-critical features

### Security

1. **Don't expose system details** in user messages
2. **Log security events** for permission errors
3. **Validate user input** before database operations
4. **Use RLS policies** for data access control
5. **Monitor for suspicious patterns**

### Performance

1. **Use appropriate retry strategies** for different error types
2. **Implement circuit breakers** for failing services
3. **Cache successful responses** when appropriate
4. **Monitor retry overhead** and adjust strategies
5. **Use batch operations** to reduce error surface area

## Testing Error Scenarios

### Unit Tests

```typescript
describe('Error Handling', () => {
  it('should parse authentication errors correctly', () => {
    const error = { code: 'invalid_credentials', message: 'Invalid login' };
    const parsed = parseSupabaseError(error);
    
    expect(parsed.category).toBe(SupabaseErrorCategory.AUTHENTICATION);
    expect(parsed.retryable).toBe(false);
    expect(parsed.userMessage).toContain('Invalid email or password');
  });

  it('should retry network errors', async () => {
    const mockQuery = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await executeSupabaseQuery(
      mockQuery(),
      'Test Query',
      { retryAttempts: 1 }
    );

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Service Error Handling', () => {
  it('should handle database constraint violations', async () => {
    // Create trade with duplicate data
    const trade = { name: 'Test Trade', calendar_id: 'cal-123' };
    
    await tradeService.createTrade(trade);
    const result = await tradeService.createTrade(trade);
    
    expect(result.success).toBe(false);
    expect(result.error?.category).toBe(SupabaseErrorCategory.DATABASE);
    expect(result.error?.code).toBe('23505');
  });
});
```

### Manual Testing

1. **Network Failures**: Disconnect network during operations
2. **Rate Limiting**: Make rapid API calls to trigger limits
3. **Permission Errors**: Test with different user roles
4. **Invalid Data**: Submit malformed data to test validation
5. **Concurrent Operations**: Test race conditions and conflicts

## Troubleshooting Common Issues

### High Error Rates

1. **Check network connectivity** and DNS resolution
2. **Verify Supabase service status** and quotas
3. **Review RLS policies** for permission issues
4. **Monitor database performance** and connection limits
5. **Check for code changes** that might introduce errors

### Retry Loops

1. **Verify retry conditions** are appropriate
2. **Check for infinite retry scenarios**
3. **Monitor retry success rates**
4. **Adjust retry delays** if needed
5. **Implement circuit breakers** for failing operations

### Performance Issues

1. **Monitor retry overhead** and frequency
2. **Optimize database queries** to reduce errors
3. **Implement caching** for frequently accessed data
4. **Use connection pooling** for database operations
5. **Profile error handling code** for bottlenecks

### User Experience Problems

1. **Review error messages** for clarity
2. **Test error scenarios** with real users
3. **Implement progressive disclosure** for error details
4. **Provide recovery actions** where possible
5. **Monitor user feedback** on error handling

---

## Error Code Reference

### Authentication Errors
- `invalid_credentials` - Invalid login credentials
- `email_not_confirmed` - Email verification required
- `token_expired` - Authentication token expired
- `signup_disabled` - User registration disabled

### Database Errors
- `23505` - Unique constraint violation
- `23503` - Foreign key constraint violation
- `23514` - Check constraint violation
- `PGRST116` - RLS policy violation (no access)
- `PGRST301` - Row not found

### Storage Errors
- `file_not_found` - Requested file doesn't exist
- `file_too_large` - File exceeds size limit
- `invalid_mime_type` - Unsupported file type
- `storage_quota_exceeded` - Storage limit reached

### Network Errors
- `network_error` - General network failure
- `timeout_error` - Request timeout
- `connection_error` - Connection failure
- `dns_error` - DNS resolution failure

### Rate Limit Errors
- `rate_limit_exceeded` - Too many requests
- `quota_exceeded` - API quota reached
- `concurrent_limit_exceeded` - Too many concurrent requests

For more detailed information, see the service layer documentation and individual service files.
