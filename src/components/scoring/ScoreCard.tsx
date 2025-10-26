import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  useTheme,
  Tooltip
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Psychology,
  Shield,
  Timeline,
  Rule,
  HelpOutline
} from '@mui/icons-material';
import { ScoreMetrics } from '../../types/score';

interface ScoreCardProps {
  score: ScoreMetrics;
  trend: 'improving' | 'declining' | 'stable';
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  compact?: boolean;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  score,
  trend,
  period,
  compact = false
}) => {
  const theme = useTheme();

  const getScoreColor = (value: number) => {
    if (value >= 50) return theme.palette.success.main;
    if (value >= 30) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <TrendingUp sx={{ color: theme.palette.success.main }} />;
      case 'declining':
        return <TrendingDown sx={{ color: theme.palette.error.main }} />;
      default:
        return <TrendingFlat sx={{ color: theme.palette.text.secondary }} />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'improving':
        return theme.palette.success.main;
      case 'declining':
        return theme.palette.error.main;
      default:
        return theme.palette.text.secondary;
    }
  };



  const ProgressBar: React.FC<{
    value: number;
    height: number;
  }> = ({ value, height }) => (
    <LinearProgress
      variant="determinate"
      value={isNaN(value) ? 0 : value}
      sx={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.common.white, 0.1)
          : theme.palette.grey[200],
        '& .MuiLinearProgress-bar': {
          backgroundColor: getScoreColor(value),
          borderRadius: height / 2
        }
      }}
    />
  );

  const getDetailedTooltip = (componentName: string): string => {
    switch (componentName.toLowerCase()) {
      case 'consistency':
        return `Consistency Score measures how well you stick to your established trading patterns:

• Pattern Adherence (40%): How closely your trades match your historical successful patterns
• Session Consistency (30%): Trading during your most profitable time periods
• Strategy Consistency (30%): Using your most successful trading strategies

Higher scores indicate better discipline in following proven patterns.`;

      case 'risk mgmt':
      case 'risk management':
        return `Risk Management Score evaluates your discipline in managing risk and position sizing:

• Position Sizing (35%): Consistency in risk per trade vs your target
• Stop Loss Usage (25%): Proper use of stop losses on trades
• Risk/Reward Ratio (25%): Achieving your target risk/reward ratios
• Drawdown Control (15%): Keeping drawdowns within acceptable limits

Higher scores indicate better risk control and capital preservation.`;

      case 'performance':
        return `Performance Score measures the consistency of your trading results vs historical patterns:

• Win Rate Consistency (40%): How close your win rate is to your historical average
• Profit Factor Stability (35%): Maintaining consistent profit factors over time
• Return Consistency (25%): Steady returns without extreme volatility

Higher scores indicate more predictable and stable trading performance.`;

      case 'discipline':
        return `Discipline Score evaluates your emotional control and trading discipline:

• Trade Frequency (30%): Avoiding overtrading or undertrading
• Plan Adherence (25%): Following your predetermined trading plan
• Emotional Control (25%): Avoiding revenge trading and FOMO
• Exit Discipline (20%): Taking profits and losses according to plan

Higher scores indicate better emotional control and systematic trading.`;

      default:
        return 'This score component measures specific aspects of your trading performance and discipline.';
    }
  };

  const scoreComponents = [
    {
      name: 'Consistency',
      value: score.consistency,
      icon: <Rule />,
      description: 'How well you stick to your trading patterns'
    },
    {
      name: 'Risk Mgmt',
      value: score.riskManagement,
      icon: <Shield />,
      description: 'Risk management and position sizing discipline'
    },
    {
      name: 'Performance',
      value: score.performance,
      icon: <Timeline />,
      description: 'Performance consistency vs historical patterns'
    },
    {
      name: 'Discipline',
      value: score.discipline,
      icon: <Psychology />,
      description: 'Trading discipline and emotional control'
    }
  ];

  if (compact) {
    return (
      <Card
        sx={{
          minWidth: 200,
          backgroundColor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.8)
            : theme.palette.background.paper,
          borderRadius: 2,
          boxShadow: theme.shadows[2],
          border: `1px solid ${theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.1)
            : alpha(theme.palette.common.black, 0.1)}`,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[4],
          }
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography
              variant="subtitle2"
              sx={{
                color: theme.palette.text.secondary,
                fontWeight: 500
              }}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)} Score
            </Typography>
            {getTrendIcon()}
          </Stack>

          <Typography
            variant="h4"
            sx={{
              color: getScoreColor(score.overall),
              fontWeight: 'bold',
              mb: 0.5
            }}
          >
            {isNaN(score.overall) ? '0' : score.overall.toFixed(0)}%
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: getTrendColor(),
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 1
            }}
          >
            {trend.charAt(0).toUpperCase() + trend.slice(1)}
          </Typography>

          <ProgressBar
            value={score.overall}
            height={6}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        backgroundColor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.8)
          : theme.palette.background.paper,
        borderRadius: 2,
        boxShadow: theme.shadows[2],
        border: `1px solid ${theme.palette.mode === 'dark'
          ? alpha(theme.palette.common.white, 0.1)
          : alpha(theme.palette.common.black, 0.1)}`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600
            }}
          >
            📊 {period.charAt(0).toUpperCase() + period.slice(1)} Trading Score
          </Typography>
          <Chip
            icon={getTrendIcon()}
            label={trend.charAt(0).toUpperCase() + trend.slice(1)}
            size="small"
            sx={{
              backgroundColor: alpha(getTrendColor(), 0.1),
              color: getTrendColor(),
              fontWeight: 500,
              border: `1px solid ${alpha(getTrendColor(), 0.3)}`,
              '& .MuiChip-icon': {
                color: getTrendColor()
              }
            }}
          />
        </Stack>

        {/* Overall Score */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography
            variant="h2"
            sx={{
              color: getScoreColor(score.overall),
              fontWeight: 'bold',
              mb: 1
            }}
          >
            {isNaN(score.overall) ? '0' : score.overall.toFixed(0)}%
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Overall Trading Score
          </Typography>

          <ProgressBar
            value={score.overall}
            height={8}
          />
        </Box>

        {/* Component Scores */}
        <Stack spacing={2}>
          {scoreComponents.map((component) => (
            <Box key={component.name}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ color: theme.palette.text.secondary }}>
                    {component.icon}
                  </Box>
                  <Typography variant="body2" fontWeight="medium">
                    {component.name}
                  </Typography>
                  {(['Risk Management', 'Performance', 'Discipline'].includes(component.name)) && (
                    <Tooltip
                      title={
                        <Box sx={{ p: 1, maxWidth: 400 }}>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                            {getDetailedTooltip(component.name)}
                          </Typography>
                        </Box>
                      }
                      placement="top"
                      arrow
                    >
                      <HelpOutline
                        sx={{
                          fontSize: 16,
                          color: theme.palette.text.secondary,
                          cursor: 'help',
                          '&:hover': {
                            color: theme.palette.primary.main
                          }
                        }}
                      />
                    </Tooltip>
                  )}
                </Stack>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  sx={{ color: getScoreColor(component.value) }}
                >
                  {isNaN(component.value) ? '0' : component.value.toFixed(0)}%
                </Typography>
              </Stack>
              <ProgressBar
                value={component.value}
                height={4}
              />
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ScoreCard;
