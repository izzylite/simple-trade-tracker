# AI Economic Events Analysis Capabilities

## Overview

The AI system now has comprehensive economic events analysis capabilities, allowing users to query and analyze how economic events correlate with their trading performance. This enhancement leverages the existing economic events data stored in both Firebase and Supabase.

## New AI Functions

### 1. Enhanced `searchTrades` Function

The `searchTrades` function now supports economic events filtering:

**New Parameters:**
- `hasEconomicEvents`: Filter by presence/absence of economic events
- `economicEventImpact`: Filter by event impact level (High, Medium, Low)
- `economicEventCurrency`: Filter by event currency (USD, EUR, GBP, etc.)
- `economicEventName`: Filter by event name (partial match)

**Example Queries:**
```
"Show me all my trades during high-impact USD economic events"
"Find trades that happened during NFP releases"
"Get my EUR trades during ECB announcements"
```

### 2. Enhanced `getTradeStatistics` Function

**New Parameters:**
- `includeEconomicEventStats`: Include detailed economic events statistics
- `economicEventImpact`: Filter economic events analysis by impact level
- `groupBy`: Now supports "economicEvent" grouping

**Economic Events Statistics Include:**
- Total trades with/without events
- Percentage of trades with events
- Breakdown by impact level and currency
- Most common events
- Win rates with vs. without events

### 3. New `analyzeEconomicEvents` Function

Dedicated function for comprehensive economic events correlation analysis.

**Parameters:**
- `impactLevel`: Filter by event impact (High, Medium, Low, all)
- `currency`: Filter by event currency
- `eventName`: Filter by specific event name
- `dateRange`: Time period for analysis
- `compareWithoutEvents`: Include comparison with non-event trades

**Analysis Provides:**
- Detailed comparison of trades with vs. without events
- Performance breakdown by event characteristics
- Most common events affecting trades
- Statistical significance of event correlation

## Data Structure

### Economic Events in Trades
Each trade can contain an `economicEvents` array:
```typescript
economicEvents: [
  {
    name: "Non-Farm Payrolls",
    impact: "High",
    currency: "USD",
    timeUtc: "2024-01-05T13:30:00Z"
  }
]
```

### Supabase Integration
Economic events are stored in the `trade_embeddings` table as JSONB:
- Enables complex SQL queries on economic events data
- Supports vector search with economic events context
- Allows for advanced filtering and aggregation

## Example AI Conversations

### 1. Basic Economic Events Analysis
**User:** "How do I perform during economic events?"
**AI Response:** Uses `getTradeStatistics({ includeEconomicEventStats: true })` to provide comprehensive analysis.

### 2. Specific Event Analysis
**User:** "Show me my performance during NFP releases"
**AI Response:** Uses `analyzeEconomicEvents({ eventName: "NFP" })` to analyze NFP-specific performance.

### 3. Currency-Specific Analysis
**User:** "How do EUR events affect my trading?"
**AI Response:** Uses `analyzeEconomicEvents({ currency: "EUR" })` to analyze EUR event correlation.

### 4. Impact Level Analysis
**User:** "Do high-impact events hurt my performance?"
**AI Response:** Uses `analyzeEconomicEvents({ impactLevel: "High", compareWithoutEvents: true })` to compare performance.

### 5. Complex Filtering
**User:** "Find my worst trades during high-impact USD events in the last 3 months"
**AI Response:** Uses `searchTrades({ economicEventCurrency: "USD", economicEventImpact: "High", tradeType: "loss", dateRange: "last 3 months" })`

## Technical Implementation

### Database Schema
- **Firebase**: Trades store economic events in `economicEvents` array field
- **Supabase**: `trade_embeddings.economic_events` JSONB field for vector search
- **Indexing**: GIN index on economic_events for fast queries

### AI Function Calling
- Functions use compositional approach for complex analysis
- Automatic filtering ensures user data isolation
- Results include both statistical summaries and individual trades

### Performance Considerations
- Economic events filtering is optimized for large datasets
- Vector search includes economic events context
- Results are limited to prevent overwhelming responses

## Benefits for Traders

1. **Event Correlation Analysis**: Understand how news affects performance
2. **Risk Management**: Identify problematic event types or currencies
3. **Strategy Optimization**: Adjust trading approach around economic events
4. **Pattern Recognition**: Discover hidden correlations with market events
5. **Performance Attribution**: Separate skill-based vs. event-driven results

## Future Enhancements

1. **Event Prediction**: Warn about upcoming high-impact events
2. **Strategy Recommendations**: Suggest event-specific trading approaches
3. **Real-time Analysis**: Live correlation during active trading sessions
4. **Advanced Statistics**: Statistical significance testing for correlations
5. **Event Clustering**: Group similar events for pattern analysis

## Usage Examples

The AI can now answer sophisticated questions like:
- "What's my win rate during FOMC meetings vs. regular trading days?"
- "Which economic events consistently lead to my worst trades?"
- "How should I adjust my strategy around high-impact EUR events?"
- "Show me all my profitable trades during central bank announcements"
- "Compare my performance during Asian vs. European economic events"

This enhancement significantly expands the AI's analytical capabilities, providing traders with deep insights into how external market forces affect their trading performance.
