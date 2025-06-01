# Trading Score Feature

## Overview

The Trading Score feature is a comprehensive system designed to evaluate and score trading performance based on consistency with established trading patterns. This feature helps traders stick to their trading system by providing objective feedback on their performance across multiple dimensions.

## Purpose

The main purpose of this feature is to:
- **Encourage Consistency**: Score traders based on how well they follow their established patterns
- **Identify Weaknesses**: Highlight areas where traders deviate from their successful strategies
- **Provide Actionable Feedback**: Offer specific recommendations for improvement
- **Track Progress**: Monitor scoring trends over time to measure improvement

## Scoring Methodology

The scoring system evaluates four key components:

### 1. Consistency Score (Default Weight: 40%)
Measures how well a trader sticks to their established patterns:
- **Session Consistency**: Trading during preferred sessions
- **Tag Consistency**: Using proven strategies and setups
- **Timing Consistency**: Trading on preferred days of the week
- **Size Consistency**: Maintaining consistent position sizing

### 2. Risk Management Score (Default Weight: 25%)
Evaluates risk management discipline:
- **Risk/Reward Ratio**: Adherence to target risk/reward ratios
- **Position Sizing**: Consistency in position sizing
- **Max Drawdown Adherence**: Staying within acceptable drawdown limits
- **Stop Loss Usage**: Proper risk management practices

### 3. Performance Score (Default Weight: 20%)
Assesses performance consistency vs historical patterns:
- **Win Rate Consistency**: Maintaining historical win rate levels
- **Profit Factor Stability**: Consistent profit factor performance
- **Returns Consistency**: Stable return patterns
- **Volatility Control**: Managing performance volatility

### 4. Discipline Score (Default Weight: 15%)
Measures trading discipline and emotional control:
- **Trading Plan Adherence**: Following established trading rules
- **Emotional Control**: Consistent behavior under pressure
- **Overtrading Detection**: Avoiding excessive trading frequency
- **Rule Following**: Completing required trade information

## Components

### ScoreCard
Displays the overall score and component scores with visual indicators:
- Overall score with color-coded progress bars
- Individual component scores
- Trend indicators (improving/declining/stable)
- Compact and detailed view modes

### ScoreBreakdown
Provides detailed analysis of score components:
- Expandable sections for each score component
- Factor-level breakdown within each component
- Recommendations and insights
- Strengths and weaknesses identification
- Trading pattern summary

### ScoreHistory
Shows historical score trends:
- Line charts showing score evolution over time
- Multiple time period views (daily/weekly/monthly)
- Component score trends
- Summary statistics

### ScoreSettings
Allows customization of scoring parameters:
- Adjustable component weights
- Calculation thresholds
- Performance targets
- Save/restore functionality

## Usage

### Basic Integration
```tsx
import ScoreSection from './ScoreSection';

<ScoreSection
  trades={trades}
  selectedDate={selectedDate}
/>
```

### Service Usage
```tsx
import { scoreService } from '../services/scoreService';

// Calculate score for current week (async)
const analysis = await scoreService.calculateScore(trades, 'weekly');

// Get score history (async)
const history = await scoreService.getScoreHistory(trades, 'weekly', 12);

// Get quick summary (async)
const summary = await scoreService.getScoreSummary(trades);

// Example with React hooks
const [scoreAnalysis, setScoreAnalysis] = useState(null);

useEffect(() => {
  const calculateScore = async () => {
    try {
      const analysis = await scoreService.calculateScore(trades, 'weekly');
      setScoreAnalysis(analysis);
    } catch (error) {
      console.error('Error calculating score:', error);
    }
  };

  if (trades.length > 0) {
    calculateScore();
  }
}, [trades]);
```

## Configuration

### Default Settings
- **Minimum Trades**: 10 trades required for scoring
- **Lookback Period**: 30 days for pattern analysis
- **Consistency Tolerance**: 15% acceptable deviation
- **Component Weights**: Consistency 40%, Risk Mgmt 25%, Performance 20%, Discipline 15%

### Customization
All settings can be customized through the ScoreSettings component:
- Adjust component weights (must total 100%)
- Modify calculation thresholds
- Set performance targets
- Configure lookback periods

## Data Requirements

The scoring system requires trades with the following fields:
- **Required**: `id`, `date`, `amount`, `type`
- **Recommended**: `session`, `tags`, `riskToReward`
- **Optional**: `name`, `entry`, `exit`, `notes`

More complete data leads to more accurate scoring.

## Scoring Interpretation

### Score Ranges
- **80-100%**: Excellent - Strong adherence to trading system
- **60-79%**: Good - Minor areas for improvement
- **40-59%**: Fair - Significant room for improvement
- **0-39%**: Poor - Major deviations from trading system

### Trend Indicators
- **Improving**: Score increased by >5% over recent periods
- **Declining**: Score decreased by >5% over recent periods
- **Stable**: Score within ±5% range

## Best Practices

1. **Establish Patterns First**: Allow 30+ trades to establish baseline patterns
2. **Regular Review**: Check scores weekly to identify trends
3. **Focus on Weakest Component**: Address the lowest-scoring area first
4. **Gradual Improvement**: Aim for consistent small improvements
5. **Customize Settings**: Adjust weights based on your trading priorities

## Technical Implementation

### File Structure
```
src/components/scoring/
├── ScoreCard.tsx          # Score display component
├── ScoreBreakdown.tsx     # Detailed analysis component
├── ScoreHistory.tsx       # Historical trends component
├── ScoreSettings.tsx      # Configuration component
├── ScoreDemo.tsx          # Testing component
├── index.ts              # Export file
└── README.md             # This file

src/services/
└── scoreService.ts       # Main scoring service

src/utils/
└── scoreUtils.ts         # Scoring calculations

src/types/
└── score.ts              # Type definitions
```

### Key Classes
- **ScoreService**: Main service class for score calculations
- **scoreService**: Singleton instance for global use

### Storage
- Settings are saved to localStorage
- Score history is calculated on-demand
- No persistent storage of scores (recalculated from trades)

## Future Enhancements

Potential improvements for the scoring system:
- Machine learning-based pattern recognition
- Peer comparison scoring
- Goal-based scoring adjustments
- Advanced statistical analysis
- Integration with external trading platforms
- Real-time score updates during trading sessions
