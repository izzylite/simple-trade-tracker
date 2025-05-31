import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Stack,
  Chip,
  useTheme,
  Alert,
  List,
  ListItem,
  ListItemText,
  Tooltip
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ExpandMore,
  CheckCircle,
  Warning,
  Error,
  TrendingUp,
  Psychology,
  Shield,
  Timeline,
  Rule,
  HelpOutline
} from '@mui/icons-material';
import { ScoreBreakdown as ScoreBreakdownType, TradingPattern } from '../../types/score';

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdownType;
  pattern: TradingPattern;
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
}

const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({
  breakdown,
  pattern,
  recommendations,
  strengths,
  weaknesses
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | false>('consistency');

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const getScoreColor = (value: number) => {
    if (value >= 80) return theme.palette.success.main;
    if (value >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getScoreIcon = (value: number) => {
    if (value >= 80) return <CheckCircle sx={{ color: theme.palette.success.main }} />;
    if (value >= 60) return <Warning sx={{ color: theme.palette.warning.main }} />;
    return <Error sx={{ color: theme.palette.error.main }} />;
  };

  const scoreCategories = [
    {
      id: 'consistency',
      name: 'Consistency',
      icon: <Rule />,
      score: breakdown.consistency.score,
      factors: breakdown.consistency.factors,
      description: 'How well you stick to your established trading patterns'
    },
    {
      id: 'riskManagement',
      name: 'Risk Management',
      icon: <Shield />,
      score: breakdown.riskManagement.score,
      factors: breakdown.riskManagement.factors,
      description: 'Your discipline in managing risk and position sizing'
    },
    {
      id: 'performance',
      name: 'Performance',
      icon: <Timeline />,
      score: breakdown.performance.score,
      factors: breakdown.performance.factors,
      description: 'Consistency of performance vs your historical patterns'
    },
    {
      id: 'discipline',
      name: 'Discipline',
      icon: <Psychology />,
      score: breakdown.discipline.score,
      factors: breakdown.discipline.factors,
      description: 'Trading discipline and emotional control'
    }
  ];

  const formatFactorName = (factorKey: string): string => {
    return factorKey
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const getScoreTooltip = (categoryName: string): string => {
    switch (categoryName.toLowerCase()) {
      case 'consistency':
        return `Consistency Score measures how well you stick to your established trading patterns:

• Pattern Adherence (40%): How closely your trades match your historical successful patterns
• Session Consistency (30%): Trading during your most profitable time periods
• Strategy Consistency (30%): Using your most successful trading strategies

Higher scores indicate better discipline in following proven patterns.`;

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
          : alpha(theme.palette.common.black, 0.1)}`
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
            mb: 3
          }}
        >
          🔍 Score Breakdown & Analysis
        </Typography>

        {/* Recommendations and Insights */}
        <Stack spacing={2} mb={3}>
          {recommendations.length > 0 && (
            <Alert severity="info" icon={<TrendingUp />}>
              <Typography variant="subtitle2" gutterBottom>
                Key Recommendations
              </Typography>
              <List dense>
                {recommendations.slice(0, 3).map((rec, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemText primary={rec} />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {strengths.length > 0 && (
            <Alert severity="success" icon={<CheckCircle />}>
              <Typography variant="subtitle2" gutterBottom>
                Your Strengths
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {strengths.map((strength, index) => (
                  <Chip
                    key={index}
                    label={strength}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Alert>
          )}

          {weaknesses.length > 0 && (
            <Alert severity="warning" icon={<Warning />}>
              <Typography variant="subtitle2" gutterBottom>
                Areas for Improvement
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {weaknesses.map((weakness, index) => (
                  <Chip
                    key={index}
                    label={weakness}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Alert>
          )}
        </Stack>

        {/* Detailed Score Breakdown */}
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
          Detailed Analysis
        </Typography>

        {scoreCategories.map((category) => (
          <Box
            key={category.id}
            sx={{
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.6)
                : alpha(theme.palette.background.paper, 0.8),
              borderRadius: 3,
              border: `1px solid ${theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.white, 0.1)
                : alpha(theme.palette.common.black, 0.1)}`,
              overflow: 'hidden',
              transition: 'all 0.2s ease-in-out',
              mb: 2,
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: theme.shadows[3],
              }
            }}
          >
            <Accordion
              expanded={expanded === category.id}
              onChange={handleChange(category.id)}
              sx={{
                backgroundColor: 'transparent',
                boxShadow: 'none',
                '&:before': { display: 'none' },
                '& .MuiAccordionSummary-root': {
                  borderRadius: 3,
                }
              }}
            >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                <Box sx={{ color: theme.palette.text.secondary }}>
                  {category.icon}
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="subtitle2" fontWeight="medium">
                      {category.name}
                    </Typography>
                    {(['Risk Management', 'Performance', 'Discipline'].includes(category.name)) && (
                      <Tooltip
                        title={
                          <Box sx={{ p: 1, maxWidth: 400 }}>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                              {getScoreTooltip(category.name)}
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
                  <Typography variant="caption" color="text.secondary">
                    {category.description}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {getScoreIcon(category.score)}
                  <Typography
                    variant="h6"
                    sx={{ color: getScoreColor(category.score), fontWeight: 'bold' }}
                  >
                    {category.score.toFixed(0)}%
                  </Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <LinearProgress
                  variant="determinate"
                  value={category.score}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.1)
                      : theme.palette.grey[200],
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: getScoreColor(category.score),
                      borderRadius: 4
                    }
                  }}
                />
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Factor Breakdown:
                </Typography>
                
                <Stack spacing={1}>
                  {Object.entries(category.factors).map(([factorKey, factorValue]) => (
                    <Box key={factorKey}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="body2">
                          {formatFactorName(factorKey)}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          sx={{ color: getScoreColor(factorValue as number) }}
                        >
                          {(factorValue as number).toFixed(0)}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={factorValue as number}
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: theme.palette.mode === 'dark'
                            ? alpha(theme.palette.common.white, 0.1)
                            : theme.palette.grey[200],
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getScoreColor(factorValue as number),
                            borderRadius: 2
                          }
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </AccordionDetails>
          </Accordion>
          </Box>
        ))}

        {/* Trading Pattern Summary */}
        <Box
          sx={{
            mt: 3,
            p: 2,
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.4)
              : theme.palette.grey[50],
            borderRadius: 2,
            border: `1px solid ${theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.1)
              : alpha(theme.palette.common.black, 0.1)}`
          }}
        >
          <Typography
            variant="subtitle2"
            gutterBottom
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600
            }}
          >
            📈 Your Trading Pattern
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              <strong style={{ color: theme.palette.text.primary }}>Preferred Sessions:</strong> {pattern.preferredSessions.join(', ') || 'Not established'}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              <strong style={{ color: theme.palette.text.primary }}>Common Strategies:</strong> {pattern.commonTags.slice(0, 3).join(', ') || 'Not established'}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              <strong style={{ color: theme.palette.text.primary }}>Trading Frequency:</strong> {pattern.avgTradesPerWeek.toFixed(1)} trades/week
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              <strong style={{ color: theme.palette.text.primary }}>Win Rate:</strong> {pattern.winRate.toFixed(1)}%
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              <strong style={{ color: theme.palette.text.primary }}>Profit Factor:</strong> {pattern.profitFactor.toFixed(2)}
            </Typography>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ScoreBreakdown;
