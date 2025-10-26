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
import { getTagChipStyles } from '../../utils/tagColors';

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
  const [expanded, setExpanded] = useState<string | false>('');

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const getScoreColor = (value: number) => {
    if (value >= 50) return theme.palette.success.main;
    if (value >= 30) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getScoreIcon = (value: number) => {
    if (value >= 50) return <CheckCircle sx={{ color: theme.palette.success.main }} />;
    if (value >= 30) return <Warning sx={{ color: theme.palette.warning.main }} />;
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

• Session Consistency (25%): % of trades in your top 2 preferred sessions
• Tag Consistency (25%): % of trades using your top 5 common strategies
• Timing Consistency (25%): % of trades on your preferred trading days
• Size Consistency (25%): Deviation from historical average position size

Calculation: Average of all four factors. Uses 30-day lookback for historical patterns.
Higher scores indicate better discipline in following proven patterns.`;

      case 'risk management':
        return `Risk Management Score evaluates your discipline in managing risk and position sizing:

• Risk/Reward Ratio (25%): Deviation from target R:R settings
• Position Sizing (25%): Variance in trade sizes (coefficient of variation)
• Max Drawdown Adherence (25%): Staying within drawdown limits
• Stop Loss Usage (25%): Win/loss ratio indicating stop discipline

Calculation: Average of all four factors. Uses normalized amounts for dynamic risk.
Higher scores indicate better risk control and capital preservation.`;

      case 'performance':
        return `Performance Score measures the consistency of your trading results vs historical patterns:

• Win Rate Consistency (25%): Deviation from historical win rate
• Profit Factor Stability (25%): Deviation from historical profit factor
• Returns Consistency (25%): Variance in trade returns (coefficient of variation)
• Volatility Control (25%): Current vs historical maximum drawdown

Calculation: Average of all four factors. Uses normalized amounts for dynamic risk.
Higher scores indicate more predictable and stable trading performance.`;

      case 'discipline':
        return `Discipline Score evaluates your emotional control and trading discipline:

• Trading Plan Adherence (25%): Average of session and tag adherence
• Emotional Control (25%): Position size variance (coefficient of variation)
• Overtrading (25%): Current vs historical trading frequency
• Rule Following (25%): % of trades with complete data entry

Calculation: Average of all four factors. Uses normalized amounts for emotional control.
Higher scores indicate better emotional control and systematic trading.`;

      default:
        return 'This score component measures specific aspects of your trading performance and discipline.';
    }
  };

  const getFactorTooltip = (categoryName: string, factorKey: string): string => {
    if (categoryName.toLowerCase() === 'discipline') {
      switch (factorKey.toLowerCase()) {
        case 'overtrading':
          return 'Measures if you are taking too many trades relative to your historical average.\n\nCalculation: Compares your current trading frequency (trades per day) to your historical pattern. Score = 100 if frequency ratio ≤ 1.5x, then decreases as ratio increases.\n\nHigher scores = appropriate frequency (better). Lower scores = overtrading detected (worse).';
        case 'emotionalcontrol':
          return 'Evaluates your ability to stick to your trading plan without letting emotions drive decisions.\n\nCalculation: Measures variance in your position sizes (normalized for dynamic risk). Uses coefficient of variation: StdDev/Average. Score = 100 - (coefficient × 200).\n\nHigher scores = good emotional control (better). Lower scores = emotional trading patterns (worse).';
        case 'tradingplanadhrence':
        case 'tradingplanadherence':
        case 'planadhrence':
        case 'plan_adherence':
          return 'Measures how well you follow your predetermined trading rules and strategies.\n\nCalculation: Average of session adherence (% of trades in your preferred sessions) and tag adherence (% of trades using your common strategies).\n\nHigher scores = better plan execution (better). Lower scores = poor discipline (worse).';
        case 'rulefollowing':
        case 'rule_following':
          return 'Evaluates how consistently you fill out required trade information.\n\nCalculation: Percentage of trades that have session, tags, and risk/reward data filled out (breakeven trades exempt from risk/reward requirement).\n\nHigher scores = complete data entry (better). Lower scores = incomplete records (worse).';
        case 'exitdiscipline':
        case 'exit_discipline':
          return 'Evaluates your ability to take profits and cut losses according to your plan.\n\nCalculation: Analyzes exit timing patterns and adherence to predetermined exit rules.\n\nHigher scores = good exit discipline (better). Lower scores = poor exit timing (worse).';
        default:
          return 'This factor measures a specific aspect of your trading discipline and emotional control.';
      }
    }

    if (categoryName.toLowerCase() === 'consistency') {
      switch (factorKey.toLowerCase()) {
        case 'sessionconsistency':
        case 'session_consistency':
          return 'Measures how consistently you trade during your most profitable sessions.\n\nCalculation: (Trades in preferred sessions / Total trades with session data) × 100. Preferred sessions are your top 2 most-traded sessions from historical data.\n\nHigher scores = better session discipline (better). Lower scores = inconsistent timing (worse).';
        case 'tagconsistency':
        case 'tag_consistency':
          return 'Evaluates how consistently you use your most successful trading strategies and setups.\n\nCalculation: (Trades using common tags / Total trades with tags) × 100. Common tags are your top 5 most-used strategy tags from historical data.\n\nHigher scores = sticking to proven patterns (better). Lower scores = random experimentation (worse).';
        case 'timingconsistency':
        case 'timing_consistency':
          return 'Measures how consistently you trade on your preferred days of the week.\n\nCalculation: (Trades on preferred days / Total trades) × 100. Preferred days are determined from your historical trading pattern (days with significant activity).\n\nHigher scores = following established schedule (better). Lower scores = impulsive trading (worse).';
        case 'sizeconsistency':
        case 'size_consistency':
          return 'Evaluates the consistency of your position sizes relative to your historical average.\n\nCalculation: Compares current average trade size to historical pattern. Score = 100 - (deviation percentage × 100). Uses normalized amounts for dynamic risk.\n\nHigher scores = disciplined sizing (better). Lower scores = emotional deviations (worse).';
        default:
          return 'This factor measures a specific aspect of your trading consistency and pattern adherence.';
      }
    }

    if (categoryName.toLowerCase() === 'risk management') {
      switch (factorKey.toLowerCase()) {
        case 'riskrewardratio':
        case 'risk_reward_ratio':
          return 'Measures how well your actual risk/reward ratios match your target settings.\n\nCalculation: Compares average R:R of trades with R:R data to your target R:R setting. Score = 100 - (deviation percentage × 100).\n\nHigher scores = better adherence to targets (better). Lower scores = deviation from targets (worse).';
        case 'positionsizing':
        case 'position_sizing':
          return 'Measures how consistent your trade sizes are relative to each other.\n\nCalculation: Uses coefficient of variation (StdDev/Average) of trade sizes. Score = 100 - (coefficient × 100). Uses normalized amounts for dynamic risk.\n\nHigher scores = consistent position sizing (better risk control). Lower scores = highly variable trade sizes (poor risk management).';
        case 'maxdrawdownadherence':
        case 'max_drawdown_adherence':
          return 'Measures how well you stay within your maximum drawdown limits.\n\nCalculation: Tracks running P&L to find maximum drawdown percentage. Score = 100 if ≤ target, then decreases by 10 points per 1% over target. Uses normalized amounts for dynamic risk.\n\nHigher scores = better capital preservation (better). Lower scores = excessive drawdown risk (worse).';
        case 'stoplossusage':
        case 'stop_loss_usage':
          return 'Approximates your use of stop losses by analyzing the ratio between average wins and losses.\n\nCalculation: (Average win / Average loss) × 50, capped at 100. Uses normalized amounts for dynamic risk. Assumes good stop loss discipline creates reasonable win/loss ratios.\n\nHigher scores = better stop loss discipline (better). Lower scores = poor risk control (worse).';
        default:
          return 'This factor measures a specific aspect of your risk management and capital preservation.';
      }
    }

    if (categoryName.toLowerCase() === 'performance') {
      switch (factorKey.toLowerCase()) {
        case 'winrateconsistency':
        case 'win_rate_consistency':
          return 'Measures how consistent your current win rate is compared to your historical average.\n\nCalculation: Compares current win rate (wins/total trades) to historical pattern. Score = 100 - (deviation percentage × 100).\n\nHigher scores = maintaining consistent win rate (better). Lower scores = declining or volatile win rate (worse).';
        case 'profitfactorstability':
        case 'profit_factor_stability':
          return 'Evaluates how stable your profit factor is compared to your historical pattern.\n\nCalculation: Profit factor = Total profits / Total losses. Compares current to historical pattern. Score = 100 - (deviation percentage × 100). Uses normalized amounts for dynamic risk.\n\nHigher scores = stable profitability (better). Lower scores = declining profit factor (worse).';
        case 'returnsconsistency':
        case 'returns_consistency':
          return 'Measures the consistency of your trade returns by analyzing the variance in your trade amounts.\n\nCalculation: Uses coefficient of variation (StdDev/Average) of trade returns. Score = 100 - (coefficient × 50). Uses normalized amounts for dynamic risk.\n\nHigher scores = consistent returns (better). Lower scores = erratic performance (worse).';
        case 'volatilitycontrol':
        case 'volatility_control':
          return 'Evaluates your ability to control drawdowns and maintain stable equity curves compared to your historical patterns.\n\nCalculation: Compares current maximum drawdown to historical pattern. Score = 100 if within 120% of historical, then decreases by 5 points per 1% excess. Uses normalized amounts for dynamic risk.\n\nHigher scores = good volatility control (better). Lower scores = excessive volatility (worse).';
        default:
          return 'This factor measures a specific aspect of your trading performance consistency.';
      }
    }

    return 'This factor contributes to your overall score in this category.';
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
                    {isNaN(category.score) ? '0' : category.score.toFixed(0)}%
                  </Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <LinearProgress
                  variant="determinate"
                  value={isNaN(category.score) ? 0 : category.score}
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
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2">
                            {formatFactorName(factorKey)}
                          </Typography>
                          {(['discipline', 'risk management', 'consistency', 'performance'].includes(category.name.toLowerCase())) && (
                            <Tooltip
                              title={
                                <Box sx={{ p: 1, maxWidth: 300 }}>
                                  <Typography variant="body2">
                                    {getFactorTooltip(category.name, factorKey)}
                                  </Typography>
                                </Box>
                              }
                              placement="top"
                              arrow
                            >
                              <HelpOutline
                                sx={{
                                  fontSize: 14,
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
                          fontWeight="medium"
                          sx={{ color: getScoreColor(factorValue as number) }}
                        >
                          {isNaN(factorValue as number) ? '0' : (factorValue as number).toFixed(0)}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={isNaN(factorValue as number) ? 0 : (factorValue as number)}
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
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                color: theme.palette.text.primary,
                fontWeight: 600
              }}
            >
              📈 Your Trading Pattern
            </Typography>
            <Tooltip
              title={
                <Box sx={{ p: 1, maxWidth: 380 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                    How Your Trading Pattern is Established:
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Preferred Sessions:</strong> Your top 2 most frequently traded sessions based on historical data
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Common Strategies:</strong> Your top 5 most-used tags/strategies from past trades
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Trading Frequency:</strong> Average trades per week calculated from your trading history
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Win Rate & Profit Factor:</strong> Historical averages used as benchmarks for consistency scoring
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1, color: 'warning.main' }}>
                    • <strong>Lookback Period:</strong> Pattern is based on trades from the last 30 days to reflect your current trading style
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 1 }}>
                    Patterns are automatically updated as you add more trades. Requires minimum 3 trades for reliable pattern detection.
                  </Typography>
                </Box>
              }
              placement="top"
              arrow
            >
              <HelpOutline
                sx={{
                  fontSize: 18,
                  color: theme.palette.text.secondary,
                  cursor: 'help',
                  '&:hover': {
                    color: theme.palette.primary.main
                  }
                }}
              />
            </Tooltip>
          </Stack>
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              <strong style={{ color: theme.palette.text.primary }}>Preferred Sessions:</strong> {pattern.preferredSessions.join(', ') || 'Not established'}
            </Typography>
            <Box>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                <strong style={{ color: theme.palette.text.primary }}>Common Strategies:</strong>
              </Typography>
              {pattern.commonTags.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {pattern.commonTags.slice(0, 5).map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      size="small"
                      sx={getTagChipStyles(tag, theme)}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
                  Not established
                </Typography>
              )}
            </Box>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              <strong style={{ color: theme.palette.text.primary }}>Trading Frequency:</strong> {isNaN(pattern.avgTradesPerWeek) ? '0.0' : pattern.avgTradesPerWeek.toFixed(1)} trades/week
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              <strong style={{ color: theme.palette.text.primary }}>Win Rate:</strong> {isNaN(pattern.winRate) ? '0.0' : pattern.winRate.toFixed(1)}%
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              <strong style={{ color: theme.palette.text.primary }}>Profit Factor:</strong> {isNaN(pattern.profitFactor) ? '0.00' : pattern.profitFactor.toFixed(2)}
            </Typography>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ScoreBreakdown;
