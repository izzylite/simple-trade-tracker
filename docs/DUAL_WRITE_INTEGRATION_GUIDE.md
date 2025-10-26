# Dual-Write System Integration Guide

This guide explains how to integrate and use the dual-write system for safe migration from Firebase to Supabase.

## Overview

The dual-write system allows you to write data to both Firebase and Supabase simultaneously, ensuring data consistency during migration while providing a safety net for rollback if needed.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │───▶│  DualWriteService │───▶│   Repositories  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  ConfigService   │    │  BaseRepository │
                       └──────────────────┘    └─────────────────┘
                                                        │
                                        ┌───────────────┼───────────────┐
                                        ▼               ▼               ▼
                                ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                                │  Firebase   │ │  Supabase   │ │ Validation  │
                                │  Operations │ │ Operations  │ │   Logic     │
                                └─────────────┘ └─────────────┘ └─────────────┘
```

## Quick Start

### 1. Initialize the Dual-Write Service

```typescript
import { DualWriteService } from '../services/dualWrite/DualWriteService';

const dualWriteService = DualWriteService.getInstance();
```

### 2. Configure the System

```typescript
import { DualWriteConfigService } from '../services/dualWrite/DualWriteConfigService';

const configService = DualWriteConfigService.getInstance();

// Start with Firebase-only mode (safe default)
configService.updateConfig({
  enableDualWrite: false,
  enableFirebase: true,
  enableSupabase: false
});
```

### 3. Create Data Using Dual-Write

```typescript
// Create a calendar
const calendar = await dualWriteService.createCalendar({
  userId: 'user123',
  name: 'My Trading Calendar',
  accountBalance: 10000,
  maxDailyDrawdown: 500,
  riskPerTrade: 2.5
});

// Create a trade
const trade = await dualWriteService.createTrade({
  calendarId: calendar.firebaseResult?.data?.id || '',
  userId: 'user123',
  name: 'EUR/USD Long',
  amount: 500,
  type: 'win',
  date: new Date(),
  entryPrice: 1.2500,
  exitPrice: 1.2550
});
```

## Migration Phases

### Phase 1: Preparation
```typescript
// Enable Supabase but keep Firebase as primary
configService.startMigrationPhase1();
// Status: "Both systems available (single-write)"
```

### Phase 2: Gradual Dual-Write
```typescript
// Enable dual-write for calendars only
configService.startMigrationPhase2();
// Status: "Dual-write mode" (calendars only)
```

### Phase 3: Full Dual-Write
```typescript
// Enable dual-write for all entities
configService.startMigrationPhase3();
// Status: "Dual-write mode" (all entities)
```

### Phase 4: Migration Complete
```typescript
// Switch to Supabase-only
configService.completeMigration();
// Status: "Supabase only"
```

## Configuration Options

### Environment Variables

Add these to your `.env` file:

```bash
# Dual-write feature flags
REACT_APP_DUAL_WRITE_ENABLED=false
REACT_APP_FIREBASE_ENABLED=true
REACT_APP_SUPABASE_ENABLED=false

# Behavior settings
REACT_APP_FAIL_ON_PARTIAL_WRITE=false
REACT_APP_RETRY_ATTEMPTS=3
REACT_APP_RETRY_DELAY_MS=1000

# Entity-specific flags
REACT_APP_CALENDAR_DUAL_WRITE=false
REACT_APP_TRADE_DUAL_WRITE=false
REACT_APP_IMAGE_DUAL_WRITE=false
```

### Runtime Configuration

```typescript
// Update configuration at runtime
configService.updateConfig({
  enableDualWrite: true,
  enableFirebase: true,
  enableSupabase: true,
  failOnPartialWrite: false, // Continue if one system fails
  retryAttempts: 3,
  retryDelayMs: 1000
});

// Enable specific entities
configService.enableEntityDualWrite('calendar');
configService.enableEntityDualWrite('trade');
```

## Data Consistency Validation

### Manual Validation

```typescript
import { DataConsistencyValidator } from '../services/dualWrite/DataConsistencyValidator';

const validator = new DataConsistencyValidator();

// Validate all data for a user
const summary = await validator.validateAllData('user123');

console.log(`Consistency: ${summary.consistencyPercentage}%`);
console.log(`Critical issues: ${summary.criticalIssues}`);

// Generate detailed report
const report = validator.generateReport(summary);
console.log(report);
```

### Automated Validation

```typescript
// Validate specific entity
const result = await dualWriteService.validateDataConsistency('calendar', 'cal123');

if (!result.consistent) {
  console.log('Differences found:', result.differences);
}
```

## Error Handling

### Handling Dual-Write Results

```typescript
const result = await dualWriteService.createCalendar(calendarData);

if (result.success) {
  console.log('✅ Operation succeeded');
  
  // Check individual system results
  if (result.firebaseResult?.success) {
    console.log('Firebase: Success');
  }
  
  if (result.supabaseResult?.success) {
    console.log('Supabase: Success');
  }
} else {
  console.error('❌ Operation failed');
  
  if (result.firebaseResult?.error) {
    console.error('Firebase error:', result.firebaseResult.error);
  }
  
  if (result.supabaseResult?.error) {
    console.error('Supabase error:', result.supabaseResult.error);
  }
}
```

### Partial Failure Handling

```typescript
// Configure to continue on partial failures
configService.updateConfig({
  failOnPartialWrite: false
});

// This will succeed if at least one system succeeds
const result = await dualWriteService.createCalendar(calendarData);

if (result.success && result.firebaseResult?.success && !result.supabaseResult?.success) {
  console.log('⚠️ Partial success: Firebase succeeded, Supabase failed');
  // Handle partial failure (e.g., retry Supabase later)
}
```

## Testing

### Running the Test Suite

```typescript
import { DualWriteTestSuite } from '../scripts/testDualWrite';

const testSuite = new DualWriteTestSuite();
await testSuite.runAllTests();
```

### Custom Tests

```typescript
// Test specific functionality
const healthCheck = await dualWriteService.healthCheck();
console.log('System status:', healthCheck.status);

// Test configuration changes
configService.enableDualWrite();
const config = configService.getConfig();
console.log('Dual-write enabled:', config.enableDualWrite);
```

## Monitoring and Logging

### Built-in Logging

The system automatically logs all operations:

```typescript
// Logs are automatically generated for:
// - Configuration changes
// - Dual-write operations
// - Success/failure of each system
// - Data consistency issues
// - Performance metrics
```

### Custom Monitoring

```typescript
// Add configuration change listener
configService.addConfigListener((config) => {
  console.log('Configuration changed:', config);
  // Send to monitoring service
});

// Monitor dual-write results
const result = await dualWriteService.createCalendar(data);
// Results include detailed success/failure information for monitoring
```

## Best Practices

### 1. Gradual Rollout
- Start with single-write mode
- Enable dual-write for one entity type at a time
- Monitor consistency before proceeding

### 2. Error Handling
- Always check both `result.success` and individual system results
- Configure `failOnPartialWrite` based on your requirements
- Implement retry logic for failed operations

### 3. Data Validation
- Run consistency validation regularly
- Address critical issues immediately
- Monitor consistency percentage over time

### 4. Performance
- Use batch operations when possible
- Monitor write latency
- Consider async processing for non-critical operations

### 5. Rollback Strategy
- Keep Firebase as fallback during migration
- Test rollback procedures
- Maintain data export capabilities

## Troubleshooting

### Common Issues

1. **Configuration not taking effect**
   - Check environment variables
   - Verify localStorage settings
   - Restart application

2. **Partial write failures**
   - Check network connectivity
   - Verify credentials for both systems
   - Review error logs

3. **Data inconsistency**
   - Run consistency validation
   - Check for concurrent modifications
   - Verify data transformation logic

4. **Performance issues**
   - Monitor write latency
   - Consider reducing retry attempts
   - Use batch operations

### Debug Mode

```typescript
// Enable detailed logging
configService.updateConfig({
  enableLogging: true,
  enableMetrics: true
});

// Check system health
const health = await dualWriteService.healthCheck();
console.log('System health:', health);
```

## Support

For issues or questions:
1. Check the logs for detailed error information
2. Run the consistency validator
3. Review the configuration settings
4. Test with the provided test suite
