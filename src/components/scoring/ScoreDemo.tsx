import React from 'react';
import { Box, Typography, Paper, Chip, useTheme } from '@mui/material';
import { Trade } from '../../types/trade';
import { scoreService } from '../../services/scoreService';
import { getTagChipStyles } from '../../utils/tagColors';
import { logger } from '../../utils/logger';

// Demo component to test scoring functionality
const ScoreDemo: React.FC = () => {
  const theme = useTheme();

  // Sample trades for testing
  const sampleTrades: Trade[] = [
    {
      id: '1',
      date: new Date('2024-01-15'),
      amount: 150,
      type: 'win',
      name: 'EURUSD Long',
      session: 'London',
      tags: ['Breakout', 'Trend Following'],
      riskToReward: 2.5
    },
    {
      id: '2',
      date: new Date('2024-01-16'),
      amount: -75,
      type: 'loss',
      name: 'GBPUSD Short',
      session: 'London',
      tags: ['Reversal', 'Support/Resistance'],
      riskToReward: 2.0
    },
    {
      id: '3',
      date: new Date('2024-01-17'),
      amount: 200,
      type: 'win',
      name: 'USDJPY Long',
      session: 'NY AM',
      tags: ['Breakout', 'News Trading'],
      riskToReward: 3.0
    },
    {
      id: '4',
      date: new Date('2024-01-18'),
      amount: -50,
      type: 'loss',
      name: 'AUDUSD Short',
      session: 'London',
      tags: ['Trend Following', 'Support/Resistance'],
      riskToReward: 1.5
    },
    {
      id: '5',
      date: new Date('2024-01-19'),
      amount: 125,
      type: 'win',
      name: 'EURJPY Long',
      session: 'London',
      tags: ['Breakout', 'Trend Following'],
      riskToReward: 2.2
    }
  ];

  const [scoreAnalysis, setScoreAnalysis] = React.useState<any>(null);
  const [scoreSummary, setScoreSummary] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const calculateScores = async () => {
      try {
        const [analysis, summary] = await Promise.all([
          scoreService.calculateScore(sampleTrades, 'weekly'),
          scoreService.getScoreSummary(sampleTrades)
        ]);
        setScoreAnalysis(analysis);
        setScoreSummary(summary);
      } catch (error) {
        logger.error('Error calculating demo scores:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateScores();
  }, []);

  if (loading) {
    return (
      <Paper sx={{ p: 3, m: 2 }}>
        <Typography variant="h6" gutterBottom>
          🧪 Score Demo - Loading...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Calculating scores for sample data...
        </Typography>
      </Paper>
    );
  }

  if (!scoreAnalysis || !scoreSummary) {
    return (
      <Paper sx={{ p: 3, m: 2 }}>
        <Typography variant="h6" color="error" gutterBottom>
          ❌ Score Demo - Error
        </Typography>
        <Typography variant="body2">
          Failed to calculate scores for demo data.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, m: 2 }}>
      <Typography variant="h6" gutterBottom>
        🧪 Score Demo - Testing Functionality
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Sample Data: {sampleTrades.length} trades
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Win Rate: {((sampleTrades.filter(t => t.type === 'win').length / sampleTrades.length) * 100).toFixed(1)}%
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total P&L: ${sampleTrades.reduce((sum, t) => sum + t.amount, 0)}
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Score Analysis Results:
        </Typography>
        <Typography variant="body2">
          Overall Score: {scoreAnalysis.currentScore.overall.toFixed(1)}%
        </Typography>
        <Typography variant="body2">
          Consistency: {scoreAnalysis.currentScore.consistency.toFixed(1)}%
        </Typography>
        <Typography variant="body2">
          Risk Management: {scoreAnalysis.currentScore.riskManagement.toFixed(1)}%
        </Typography>
        <Typography variant="body2">
          Performance: {scoreAnalysis.currentScore.performance.toFixed(1)}%
        </Typography>
        <Typography variant="body2">
          Discipline: {scoreAnalysis.currentScore.discipline.toFixed(1)}%
        </Typography>
        <Typography variant="body2">
          Trend: {scoreAnalysis.trend}
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Trading Pattern:
        </Typography>
        <Typography variant="body2">
          Preferred Sessions: {scoreAnalysis.pattern.preferredSessions.join(', ')}
        </Typography>
        <Box>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Common Tags:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {scoreAnalysis.pattern.commonTags.map((tag: string, index: number) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                sx={getTagChipStyles(tag, theme)}
              />
            ))}
          </Box>
        </Box>
        <Typography variant="body2">
          Avg Trades/Week: {scoreAnalysis.pattern.avgTradesPerWeek.toFixed(1)}
        </Typography>
      </Box>

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Recommendations:
        </Typography>
        {scoreAnalysis.recommendations.map((rec: string, index: number) => (
          <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
            • {rec}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
};

export default ScoreDemo;
