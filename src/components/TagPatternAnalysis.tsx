import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Chip,
  Stack,
  LinearProgress,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ExpandMore,
  TrendingUp,
  TrendingDown,
  Warning,
  Info,
  HelpOutline
} from '@mui/icons-material';
import { Trade } from '../types/trade';
import { TagPatternInsight, ScoreSettings } from '../types/score';
import { tagPatternService } from '../services/tagPatternService';
import { getTagChipStyles, formatTagForDisplay } from '../utils/tagColors';

interface TagPatternAnalysisProps {
  trades: Trade[];
  selectedDate?: Date;
  settings?: ScoreSettings;
}

const TagPatternAnalysis: React.FC<TagPatternAnalysisProps> = ({
  trades,
  selectedDate = new Date(),
  settings
}) => {
  const theme = useTheme();

  // Calculate tag pattern analysis
  const analysis = useMemo(() => {
    if (trades.length < 10) return null;
    return tagPatternService.analyzeTagPatterns(trades, selectedDate, settings);
  }, [trades, selectedDate, settings]);

  const getInsightIcon = (type: TagPatternInsight['type']) => {
    switch (type) {
      case 'high_performance':
        return <TrendingUp sx={{ color: theme.palette.success.main }} />;
      case 'declining_pattern':
        return <TrendingDown sx={{ color: theme.palette.error.main }} />;
      case 'market_condition':
        return <Warning sx={{ color: theme.palette.warning.main }} />;
      default:
        return <Info sx={{ color: theme.palette.info.main }} />;
    }
  };

  const getSeverityColor = (severity: TagPatternInsight['severity']) => {
    switch (severity) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.info.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 70) return theme.palette.success.main;
    if (winRate >= 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const formatWinRate = (winRate: number) => {
    return `${winRate.toFixed(1)}%`;
  };

  if (!analysis || trades.length < 10) {
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
          <Typography variant="h6" gutterBottom>
            🏷️ Tag Pattern Analysis
          </Typography>
          <Alert severity="info">
            Add more trades to see tag pattern analysis. We need at least 10 trades to identify meaningful patterns and trends.
          </Alert>
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
          : alpha(theme.palette.common.black, 0.1)}`
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            🏷️ Tag Pattern Analysis
          </Typography>
          <Tooltip title="Analysis of tag combinations to identify high-performing patterns and declining trends">
            <IconButton size="small">
              <HelpOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Key Insights */}
        {analysis.insights.length > 0 && (
          <Box mb={3}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
              💡 Key Insights
            </Typography>
            <Stack spacing={2}>
              {analysis.insights.slice(0, 3).map((insight, index) => (
                <Alert
                  key={index}
                  severity={
                    insight.type === 'high_performance' ? 'success' :
                    insight.type === 'declining_pattern' ? 'error' : 'warning'
                  }
                  icon={getInsightIcon(insight.type)}
                  sx={{
                    backgroundColor: alpha(getSeverityColor(insight.severity), 0.1),
                    border: `1px solid ${alpha(getSeverityColor(insight.severity), 0.2)}`,
                    '& .MuiAlert-icon': {
                      color: getSeverityColor(insight.severity)
                    }
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    {insight.title}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    {insight.description}
                  </Typography>
                  <Box sx={{ mt: 1, mb: 1 }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {insight.tagCombination.map(tag => (
                        <Chip
                          key={tag}
                          label={formatTagForDisplay(tag)}
                          size="small"
                          sx={getTagChipStyles(tag, theme)}
                        />
                      ))}
                    </Stack>
                  </Box>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    💡 {insight.recommendation}
                  </Typography>
                </Alert>
              ))}
            </Stack>
          </Box>
        )}

        {/* Top Performing Combinations */}
        {analysis.topCombinations.length > 0 && (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                🏆 Top Performing Tag Combinations
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {analysis.topCombinations.slice(0, 5).map((combo, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: theme.palette.mode === 'dark'
                        ? alpha(theme.palette.background.paper, 0.4)
                        : alpha(theme.palette.background.paper, 0.8),
                      border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {combo.tags.map(tag => (
                          <Chip
                            key={tag}
                            label={formatTagForDisplay(tag)}
                            size="small"
                            sx={getTagChipStyles(tag, theme)}
                          />
                        ))}
                      </Stack>
                      <Typography
                        variant="h6"
                        sx={{
                          color: getWinRateColor(combo.winRate),
                          fontWeight: 'bold'
                        }}
                      >
                        {formatWinRate(combo.winRate)}
                      </Typography>
                    </Stack>
                    
                    <LinearProgress
                      variant="determinate"
                      value={combo.winRate}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: theme.palette.mode === 'dark'
                          ? alpha(theme.palette.common.white, 0.1)
                          : theme.palette.grey[200],
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getWinRateColor(combo.winRate),
                          borderRadius: 3
                        }
                      }}
                    />
                    
                    <Stack direction="row" spacing={3} mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        <strong>Trades:</strong> {combo.totalTrades}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        <strong>W/L:</strong> {combo.wins}/{combo.losses}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        <strong>Avg P&L:</strong> {combo.avgPnL > 0 ? '+' : ''}{combo.avgPnL.toFixed(2)}
                      </Typography>
                      {combo.trend !== 'stable' && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: combo.trend === 'improving' 
                              ? theme.palette.success.main 
                              : theme.palette.error.main,
                            fontWeight: 600
                          }}
                        >
                          {combo.trend === 'improving' ? '📈 Improving' : '📉 Declining'}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Declining Patterns */}
        {analysis.decliningCombinations.length > 0 && (
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.error.main }}>
                📉 Declining Patterns
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {analysis.decliningCombinations.map((combo, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.error.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {combo.tags.map(tag => (
                          <Chip
                            key={tag}
                            label={formatTagForDisplay(tag)}
                            size="small"
                            sx={getTagChipStyles(tag, theme)}
                          />
                        ))}
                      </Stack>
                      <Stack alignItems="flex-end">
                        <Typography variant="caption" color="text.secondary">
                          {formatWinRate(combo.historicalWinRate)} → {formatWinRate(combo.recentWinRate)}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: theme.palette.error.main, fontWeight: 600 }}
                        >
                          -{(combo.historicalWinRate - combo.recentWinRate).toFixed(1)}%
                        </Typography>
                      </Stack>
                    </Stack>
                    
                    <Typography variant="body2" color="text.secondary">
                      This combination has declined from {formatWinRate(combo.historicalWinRate)} to {formatWinRate(combo.recentWinRate)} win rate recently.
                      Consider reviewing your approach or market conditions.
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        {/* No significant patterns found */}
        {analysis.insights.length === 0 && analysis.topCombinations.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              📊 Building Pattern Database
            </Typography>
            <Typography variant="body2">
              Continue trading to build a larger dataset. More trades will help identify stronger patterns and trends in your tag combinations.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default TagPatternAnalysis;
