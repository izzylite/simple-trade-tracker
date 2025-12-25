import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
  Stack,
  LinearProgress
} from '@mui/material';
import { useMediaQuery } from '@mui/material';

import { alpha } from '@mui/material/styles';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { format } from 'date-fns';
import { ScoreHistory as ScoreHistoryType } from '../../types/score';
import RoundedTabs from '../common/RoundedTabs';

interface ScoreHistoryProps {
  history: ScoreHistoryType[];
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  onPeriodChange: (period: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
  availablePeriods?: ('daily' | 'weekly' | 'monthly' | 'yearly')[]; // Available periods based on parent time filter
  isLoading?: boolean; // Loading state for showing progress indicator
}

const ScoreHistoryComponent: React.FC<ScoreHistoryProps> = ({
  history,
  period,
  onPeriodChange,
  availablePeriods = ['daily', 'weekly', 'monthly', 'yearly'], // Default to all periods
  isLoading = false
}) => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  // Define all possible period tabs
  const allPeriodTabs = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Yearly', value: 'yearly' }
  ];

  // Filter tabs based on available periods
  const periodTabs = useMemo(() => {
    return allPeriodTabs.filter(tab => availablePeriods.includes(tab.value as any));
  }, [availablePeriods]);

  // Convert string value to tab index for RoundedTabs
  const getPeriodTabIndex = (currentPeriod: string): number => {
    return periodTabs.findIndex(tab => tab.value === currentPeriod);
  };

  // Handle tab change for period
  const handlePeriodTabChange = (_: React.SyntheticEvent, newIndex: number) => {
    const newPeriod = periodTabs[newIndex]?.value as 'daily' | 'weekly' | 'monthly' | 'yearly';
    if (newPeriod) {
      onPeriodChange(newPeriod);
    }
  };

  const chartData = useMemo(() => {
    return history.map(entry => ({
      date: entry.date,
      dateLabel: format(entry.date,
        period === 'daily' ? 'MMM dd' :
        period === 'weekly' ? 'MMM dd' :
        period === 'monthly' ? 'MMM yyyy' :
        'yyyy'
      ),
      overall: entry.metrics.overall,
      consistency: entry.metrics.consistency,
      riskManagement: entry.metrics.riskManagement,
      performance: entry.metrics.performance,
      discipline: entry.metrics.discipline,
      tradeCount: entry.tradeCount
    }));
  }, [history, period]);

  const getScoreColor = (value: number) => {
    if (value >= 50) return theme.palette.success.main;
    if (value >= 30) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.95)
              : theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            p: 2,
            boxShadow: theme.shadows[8],
            backdropFilter: 'blur(10px)'
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {label}
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="body2">
              <strong>Overall Score:</strong> {data.overall.toFixed(0)}%
            </Typography>
            <Typography variant="body2">
              <strong>Trades:</strong> {data.tradeCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Consistency: {data.consistency.toFixed(0)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Risk Mgmt: {data.riskManagement.toFixed(0)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Performance: {data.performance.toFixed(0)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Discipline: {data.discipline.toFixed(0)}%
            </Typography>
          </Stack>
        </Box>
      );
    }
    return null;
  };

  const averageScore = useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData.reduce((sum, entry) => sum + entry.overall, 0) / chartData.length;
  }, [chartData]);

  const latestScore = chartData.length > 0 ? chartData[chartData.length - 1].overall : 0;
  const scoreChange = chartData.length > 1
    ? latestScore - chartData[chartData.length - 2].overall
    : 0;

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
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600
            }}
          >
            📈 Score History
          </Typography>

          <RoundedTabs
            tabs={periodTabs}
            activeTab={getPeriodTabIndex(period)}
            onTabChange={handlePeriodTabChange}
            size="small"
          />
        </Stack>

        {isLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mb: 2 }}>
            <LinearProgress
              sx={{
                width: { xs: '100%', sm: 'auto' },
                minWidth: { sm: 200 },
                borderRadius: 1,
                mb: 0.5
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.7rem'
              }}
            >
              Loading...
            </Typography>
          </Box>
        )}

        {chartData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Not enough data for {period} score history.
              <br />
              Complete more trades to see your score trends.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Summary Stats */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} mb={3}>
              <Box>
                <Typography variant="h4" sx={{ color: getScoreColor(latestScore), fontWeight: 'bold' }}>
                  {latestScore.toFixed(0)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Latest Score
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="h4"
                  sx={{
                    color: scoreChange >= 0 ? theme.palette.success.main : theme.palette.error.main,
                    fontWeight: 'bold'
                  }}
                >
                  {scoreChange >= 0 ? '+' : ''}{scoreChange.toFixed(0)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Change
                </Typography>
              </Box>
              <Box>
                <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                  {averageScore.toFixed(0)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Average
                </Typography>
              </Box>
            </Stack>

            {/* Main Chart */}
            <Box sx={{ height: { xs: 220, sm: 300 }, mb: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="overallGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={theme.palette.mode === 'dark' ? 0.4 : 0.3}/>
                      <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.1)
                      : theme.palette.divider
                    }
                  />
                  <XAxis
                    dataKey="dateLabel"
                    stroke={theme.palette.text.secondary}
                    fontSize={12}
                    tick={{ fill: theme.palette.text.secondary }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={theme.palette.text.secondary}
                    fontSize={12}
                    tick={{ fill: theme.palette.text.secondary }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="overall"
                    stroke={theme.palette.primary.main}
                    strokeWidth={3}
                    fill="url(#overallGradient)"
                    name="Overall Score"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>

            {/* Component Breakdown Chart */}
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Score Components
            </Typography>
            <Box sx={{ height: { xs: 160, sm: 200 } }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.1)
                      : theme.palette.divider
                    }
                  />
                  <XAxis
                    dataKey="dateLabel"
                    stroke={theme.palette.text.secondary}
                    fontSize={12}
                    tick={{ fill: theme.palette.text.secondary }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={theme.palette.text.secondary}
                    fontSize={12}
                    tick={{ fill: theme.palette.text.secondary }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="consistency"
                    stroke={theme.palette.info.main}
                    strokeWidth={2}
                    dot={false}
                    name="Consistency"
                  />
                  <Line
                    type="monotone"
                    dataKey="riskManagement"
                    stroke={theme.palette.success.main}
                    strokeWidth={2}
                    dot={false}
                    name="Risk Mgmt"
                  />
                  <Line
                    type="monotone"
                    dataKey="performance"
                    stroke={theme.palette.warning.main}
                    strokeWidth={2}
                    dot={false}
                    name="Performance"
                  />
                  <Line
                    type="monotone"
                    dataKey="discipline"
                    stroke={theme.palette.error.main}
                    strokeWidth={2}
                    dot={false}
                    name="Discipline"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ScoreHistoryComponent;
