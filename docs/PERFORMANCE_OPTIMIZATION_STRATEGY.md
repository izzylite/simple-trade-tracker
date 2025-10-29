# Performance Optimization Strategy: Moving Calculations to PostgreSQL

## Problem Statement

With 250+ trades, the Performance Charts dialog experiences significant lag (2-3 seconds) when opening because:

1. **All trades loaded into browser memory** (~500KB for 250 trades)
2. **Heavy client-side calculations** blocking the UI thread:
   - Win/loss statistics aggregation
   - Tag performance analysis (nested loops)
   - Daily summary calculations
   - Risk/reward statistics
   - Session performance analysis
   - Chart data transformations

3. **JavaScript single-threaded execution** - calculations block UI rendering

## Solution: PostgreSQL RPC Functions

Move heavy calculations to PostgreSQL using RPC (Remote Procedure Call) functions.

### Benefits

#### 🚀 **Performance**
- **10-100x faster** - PostgreSQL optimized for aggregations
- **Parallel processing** - database uses multiple cores
- **Indexed queries** - instant filtering by date, tags, trade_type
- **No UI blocking** - calculations happen server-side

#### 📊 **Scalability**
- Handles 1,000+ trades efficiently
- No browser memory constraints
- Reduced client bundle size

#### 🌐 **Network Efficiency**
- **Before**: Send 250 trades (~500KB)
- **After**: Send aggregated results (~5-10KB)
- **50-100x reduction** in data transfer

#### 🛠️ **Maintainability**
- SQL is declarative and easier to optimize
- Database query planner handles optimization
- Easier to add indexes for performance

## Implementation Plan

### Phase 1: Create RPC Functions ✅

Created in `supabase/migrations/030_performance_calculation_functions.sql`:

1. **`calculate_performance_metrics()`** - Main function returning all metrics
   - Win/loss statistics
   - Tag performance
   - Daily summaries
   - Risk/reward stats
   - Session statistics
   - All unique tags

2. **`calculate_chart_data()`** - Cumulative P&L chart data
   - Daily P&L
   - Cumulative totals
   - Trade counts

3. **`calculate_tag_performance()`** - Detailed tag analysis
   - Primary/secondary tag filtering
   - Win rates per tag
   - P&L per tag
   - Max win/loss per tag

### Phase 2: Update Service Layer

Update `src/services/performanceCalculationService.ts`:

```typescript
export class PerformanceCalculationService {
  // NEW: Call PostgreSQL RPC function
  public async calculatePerformanceMetrics(
    calendarId: string,
    selectedDate: Date,
    timePeriod: TimePeriod,
    accountBalance: number,
    comparisonTags: string[] = [],
    onProgress?: (progress: CalculationProgress) => void
  ): Promise<PerformanceCalculationResult> {
    onProgress?.({ step: 'Fetching performance metrics...', progress: 1, total: 1 });

    // Call PostgreSQL RPC function
    const { data, error } = await supabase.rpc('calculate_performance_metrics', {
      p_calendar_id: calendarId,
      p_time_period: timePeriod,
      p_selected_date: selectedDate.toISOString(),
      p_comparison_tags: comparisonTags
    });

    if (error) throw error;

    // Transform database result to match existing interface
    return {
      winLossStats: data.winLossStats,
      tagStats: data.tagStats,
      dailySummaryData: data.dailySummaryData,
      riskRewardStats: data.riskRewardStats,
      sessionStats: data.sessionStats,
      allTags: data.allTags,
      winLossData: [
        { name: 'Wins', value: data.winLossStats.winners.total },
        { name: 'Losses', value: data.winLossStats.losers.total },
        { name: 'Breakeven', value: data.winLossStats.breakevens.total }
      ].filter(item => item.value > 0)
    };
  }

  // NEW: Call chart data RPC function
  public async calculateChartData(
    calendarId: string,
    selectedDate: Date,
    timePeriod: TimePeriod
  ): Promise<ChartDataPoint[]> {
    const { data, error } = await supabase.rpc('calculate_chart_data', {
      p_calendar_id: calendarId,
      p_time_period: timePeriod,
      p_selected_date: selectedDate.toISOString()
    });

    if (error) throw error;
    return data || [];
  }
}
```

### Phase 3: Update Components

Update `src/components/PerformanceCharts.tsx`:

```typescript
// BEFORE: Pass all trades to service
const data = await performanceCalculationService.calculatePerformanceMetrics(
  trades,  // ❌ Sending 250 trades to service
  selectedDate,
  timePeriod,
  accountBalance,
  comparisonTags,
  setCalculationProgress
);

// AFTER: Pass only calendar ID
const data = await performanceCalculationService.calculatePerformanceMetrics(
  calendarId,  // ✅ Sending only ID
  selectedDate,
  timePeriod,
  accountBalance,
  comparisonTags,
  setCalculationProgress
);
```

### Phase 4: Performance Indexes

Add indexes to optimize queries:

```sql
-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_trades_calendar_date 
ON public.trades(calendar_id, trade_date) 
WHERE is_deleted = FALSE;

-- Index for tag queries (GIN index for array operations)
CREATE INDEX IF NOT EXISTS idx_trades_tags 
ON public.trades USING GIN(tags) 
WHERE is_deleted = FALSE;

-- Index for session queries
CREATE INDEX IF NOT EXISTS idx_trades_session 
ON public.trades(calendar_id, session) 
WHERE is_deleted = FALSE AND session IS NOT NULL;

-- Index for risk/reward queries
CREATE INDEX IF NOT EXISTS idx_trades_risk_reward 
ON public.trades(calendar_id, risk_to_reward) 
WHERE is_deleted = FALSE AND risk_to_reward IS NOT NULL;
```

## Expected Performance Improvements

### Current Performance (250 trades)
- **Initial load**: 2-3 seconds lag
- **Data transfer**: ~500KB
- **Memory usage**: High (all trades in memory)
- **UI blocking**: Yes (calculations block rendering)

### Expected Performance (250 trades)
- **Initial load**: <300ms ⚡
- **Data transfer**: ~5-10KB 📉
- **Memory usage**: Minimal (only aggregated results)
- **UI blocking**: No (calculations server-side)

### Scalability (1,000 trades)
- **Current**: 10-15 seconds lag ❌
- **With RPC**: <500ms ✅

## Migration Strategy

### Step 1: Apply Migration
```bash
# Apply the migration
supabase db push

# Or via Supabase dashboard SQL editor
# Copy content from supabase/migrations/030_performance_calculation_functions.sql
```

### Step 2: Update Service Layer
- Modify `performanceCalculationService.ts` to call RPC functions
- Keep old implementation as fallback (feature flag)

### Step 3: Update Components
- Update `PerformanceCharts.tsx` to pass `calendarId` instead of `trades`
- Update `MonthlyStatisticsSection.tsx` similarly

### Step 4: Test & Validate
- Test with 250+ trades
- Verify all charts render correctly
- Check performance metrics
- Remove old implementation after validation

### Step 5: Add Indexes
- Apply performance indexes
- Monitor query performance
- Adjust as needed

## Backward Compatibility

Keep old client-side calculations as fallback:

```typescript
public async calculatePerformanceMetrics(...) {
  try {
    // Try RPC function first
    return await this.calculatePerformanceMetricsRPC(...);
  } catch (error) {
    logger.warn('RPC calculation failed, falling back to client-side', error);
    // Fallback to old client-side calculation
    return await this.calculatePerformanceMetricsClientSide(...);
  }
}
```

## Monitoring & Optimization

### Query Performance
```sql
-- Check query execution time
EXPLAIN ANALYZE 
SELECT * FROM calculate_performance_metrics(
  'calendar-id-here'::UUID,
  'month',
  NOW()
);
```

### Index Usage
```sql
-- Check if indexes are being used
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'trades'
ORDER BY idx_scan DESC;
```

## Future Enhancements

1. **Caching**: Cache results in `calendar_stats` table
2. **Materialized Views**: Pre-calculate common aggregations
3. **Incremental Updates**: Update stats on trade changes (triggers)
4. **Pagination**: Load chart data in chunks for very large datasets

## Conclusion

Moving calculations to PostgreSQL RPC functions will:
- ✅ Eliminate UI lag with 250+ trades
- ✅ Reduce network traffic by 50-100x
- ✅ Scale to 1,000+ trades efficiently
- ✅ Improve user experience significantly
- ✅ Maintain code maintainability

**Recommendation**: Implement this optimization immediately for production use.

