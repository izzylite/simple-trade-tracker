# Economic Event Correlation Analysis

## Benefits of This Performance Section

The Economic Event Correlation Analysis provides traders with critical insights into how external market forces impact their trading performance. This analysis helps you:

### 🎯 **Identify Market Timing Patterns**
- Discover if your losses tend to cluster around high-impact economic events
- Understand whether you're more successful trading during quiet market periods vs. news-heavy days
- Optimize your trading schedule by avoiding sessions with historically poor correlation patterns

### 📊 **Improve Risk Management**
- Quantify the relationship between economic events and trade outcomes
- Adjust position sizes or avoid trading entirely during high-risk economic announcements
- Develop session-specific strategies based on historical event correlation data

### 🔍 **Enhance Trading Strategy**
- Compare how economic events affect your winning vs. losing trades differently
- Identify specific event types that consistently impact your performance
- Make data-driven decisions about when to trade more aggressively or conservatively

### 💡 **Gain Competitive Edge**
- Use session-based correlation analysis for precise timing insights
- Leverage real-time economic calendar integration for forward-looking strategy adjustments
- Transform reactive trading into proactive, data-informed decision making

This performance section transforms raw trading data into actionable intelligence, helping you understand not just *what* happened, but *why* it happened in relation to market-moving events.

## Overview

The Economic Event Correlation Analysis is a comprehensive performance section that analyzes the correlation between both winning and losing trades with economic events. This feature helps traders understand whether their trading performance is influenced by economic news and market-moving events, providing insights for both successful and unsuccessful trades.

## Features

### 1. Dual Analysis - Losing & Winning Trades
- **Losing Trades Analysis**: Complete analysis of how losing trades correlate with economic events
- **Winning Trades Analysis**: Parallel analysis showing how winning trades correlate with economic events
- **Comparative Insights**: Side-by-side comparison to understand if economic events affect trade outcomes differently

### 2. Correlation Statistics
#### Losing Trades:
- **Total Losing Trades**: Shows the total number of losing trades in the selected period
- **High Impact Event Correlation**: Percentage of losing trades that occurred on days with high-impact economic events
- **Medium Impact Event Correlation**: Percentage of losing trades that occurred on days with medium-impact economic events
- **Any Economic Event Correlation**: Percentage of losing trades that occurred on days with any economic events

#### Winning Trades:
- **Total Winning Trades**: Shows the total number of winning trades in the selected period
- **High Impact Event Correlation**: Percentage of winning trades that occurred on days with high-impact economic events
- **Medium Impact Event Correlation**: Percentage of winning trades that occurred on days with medium-impact economic events
- **Any Economic Event Correlation**: Percentage of winning trades that occurred on days with any economic events

### 3. Average Performance Comparison
- **Average Loss Comparison**: Compares average loss amounts for trades on days with vs. without economic events
- **Average Win Comparison**: Compares average win amounts for trades on days with vs. without economic events
- Helps identify if economic events lead to larger losses or smaller wins

### 4. Interactive Event Analysis
- **Most Common Event Types**: Lists the most frequently occurring economic events affecting trades
- **Clickable Events**: Click on any event to view all associated trades (both winning and losing)
- **Detailed Statistics**: Shows win rate, average loss, average win, and trade counts for each event type
- **Trade Dialog**: Opens a detailed view showing all trades that occurred during specific economic events

### 5. Impact Distribution
- Shows the distribution of economic events by impact level (High, Medium, Low, Holiday, Non-Economic)

## How It Works

### Data Collection
1. **Trade Filtering**: Filters trades based on the selected time period (month/year/all)
2. **Dual Trade Analysis**: Analyzes both winning trades ('win') and losing trades ('loss')
3. **Economic Events**: Fetches economic events from the database for the date range of all relevant trades
4. **Date Matching**: Matches trades with economic events that occurred on the same day

### Correlation Analysis
1. **Event Categorization**: Categorizes events by impact level (High, Medium, Low)
2. **Trade-Event Mapping**: Maps each trade (both winning and losing) to economic events on the same day
3. **Statistical Calculation**: Calculates correlation percentages, average losses, average wins, and win rates
4. **Pattern Recognition**: Identifies the most common event types and their impact on trade outcomes
5. **Comparative Analysis**: Compares how economic events affect winning vs. losing trades differently

### Filtering
The analysis respects the economic calendar filter settings from the calendar configuration:
- **Currencies**: Uses the selected currencies (default: USD, EUR, GBP)
- **Impact Levels**: Uses the selected impact levels (default: High, Medium)

## User Interface

### Summary Cards
#### Losing Trades Section (Red Theme):
- **Total Losing Trades**: Shows the total count of losing trades
- **High Impact Events**: Orange-themed card showing correlation percentage for losing trades
- **Medium Impact Events**: Blue-themed card showing correlation percentage for losing trades
- **Any Economic Events**: Primary-themed card showing overall correlation for losing trades

#### Winning Trades Section (Green Theme):
- **Total Winning Trades**: Shows the total count of winning trades
- **High Impact Events**: Orange-themed card showing correlation percentage for winning trades
- **Medium Impact Events**: Blue-themed card showing correlation percentage for winning trades
- **Any Economic Events**: Primary-themed card showing overall correlation for winning trades

### Expandable Details
- Click the expand/collapse button to show detailed analysis
- **Average Loss Comparison**: Visual comparison of losses with/without events
- **Average Win Comparison**: Visual comparison of wins with/without events
- **Interactive Event Types**: Clickable cards showing detailed statistics for each event type

### Interactive Features
- **Clickable Event Cards**: Click on any event type to view all associated trades
- **Trade Details Dialog**: Shows comprehensive list of trades that occurred during specific events
- **Win Rate Display**: Each event shows its associated win rate and trade statistics
- **Hover Effects**: Visual feedback when hovering over clickable elements

### Loading States
- Shows a progress bar while fetching economic events data
- Displays error messages if data fetching fails
- Shows appropriate messages when no losing trades are found

## Integration

### Location
The component is integrated into the PerformanceCharts component and appears:
- After the Session Performance Analysis
- Before the Trading Score Section

### Dependencies
- **Economic Calendar Service**: Fetches economic events data
- **Trade Data**: Uses the filtered trades from the performance charts
- **Calendar Settings**: Respects economic calendar filter settings

## Technical Implementation

### Key Components
- `EconomicEventCorrelationAnalysis.tsx`: Main component file
- Integrated into `PerformanceCharts.tsx`
- Exported through `charts/index.ts`

### Data Types
- Uses existing `Trade` and `EconomicEvent` interfaces
- Defines `TradeEventCorrelation` and `CorrelationStats` interfaces for analysis

### Performance Considerations
- Fetches economic events only when there are losing trades
- Caches economic events data during component lifecycle
- Uses memoization for expensive calculations

## Usage Tips

1. **Time Period Selection**: Use different time periods to see how correlations change over time
2. **Filter Settings**: Adjust economic calendar filters to focus on specific currencies or impact levels
3. **Pattern Recognition**: Look for patterns in the most common event types to avoid trading during specific news
4. **Loss Comparison**: Pay attention to whether losses are larger on event days vs. non-event days

## Future Enhancements

Potential improvements could include:
- Time-based correlation (events before/during/after trades)
- Currency-specific correlation analysis
- Event category grouping (employment, inflation, central bank, etc.)
- Historical correlation trends over time
- Integration with trade tags for more granular analysis
