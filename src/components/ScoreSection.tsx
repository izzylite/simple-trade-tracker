import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Stack,
  Alert,
  CircularProgress,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Trade } from '../types/trade';
import { ScoreSettings } from '../types/score';
import { scoreService } from '../services/scoreService';
import ScoreCard from './scoring/ScoreCard';
import ScoreBreakdown from './scoring/ScoreBreakdown';
import ScoreHistory from './scoring/ScoreHistory';
import ScoreSettingsComponent from './scoring/ScoreSettings';

interface ScoreSectionProps {
  trades: Trade[];
  selectedDate: Date;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`score-tabpanel-${index}`}
      aria-labelledby={`score-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
};

const ScoreSection: React.FC<ScoreSectionProps> = ({ trades, selectedDate }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const scorePeriod = 'weekly';
  const [historyPeriod, setHistoryPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [settings, setSettings] = useState<ScoreSettings>(scoreService.getSettings());
  const [isLoading, setIsLoading] = useState(false);

  // Update score service settings when local settings change
  useEffect(() => {
    scoreService.updateSettings(settings);
  }, [settings]);

  // Calculate current score analysis
  const scoreAnalysis = useMemo(() => {
    if (trades.length === 0) return null;

    try {
      setIsLoading(true);
      const analysis = scoreService.calculateScore(trades, scorePeriod, selectedDate);
      setIsLoading(false);
      return analysis;
    } catch (error) {
      console.error('Error calculating score:', error);
      setIsLoading(false);
      return null;
    }
  }, [trades, scorePeriod, selectedDate]);

  // Calculate score history
  const scoreHistory = useMemo(() => {
    if (trades.length === 0) return [];

    try {
      return scoreService.getScoreHistory(trades, historyPeriod, 12);
    } catch (error) {
      console.error('Error calculating score history:', error);
      return [];
    }
  }, [trades, historyPeriod]);

  // Calculate multi-period scores for overview
  const multiPeriodScores = useMemo(() => {
    if (trades.length === 0) return null;

    try {
      return scoreService.calculateMultiPeriodScore(trades, selectedDate);
    } catch (error) {
      console.error('Error calculating multi-period scores:', error);
      return null;
    }
  }, [trades, selectedDate]);



  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleHistoryPeriodChange = (newPeriod: 'daily' | 'weekly' | 'monthly') => {
    setHistoryPeriod(newPeriod);
  };

  const handleSettingsChange = (newSettings: ScoreSettings) => {
    setSettings(newSettings);
  };

  const handleSettingsSave = () => {
    // In a real app, you might want to save settings to localStorage or backend
    localStorage.setItem('scoreSettings', JSON.stringify(settings));
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('scoreSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      } catch (error) {
        console.error('Error loading saved settings:', error);
      }
    }
  }, []);

  if (trades.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          📊 Trading Score
        </Typography>
        <Alert severity="info">
          Start adding trades to see your trading score and performance analysis.
          The scoring system will evaluate your consistency, risk management, performance, and discipline.
        </Alert>
      </Paper>
    );
  }

  if (trades.length < settings.thresholds.minTradesForScore) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          📊 Trading Score
        </Typography>
        <Alert severity="warning">
          You need at least {settings.thresholds.minTradesForScore} trades to calculate your score.
          Current trades: {trades.length}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 0,
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
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600
            }}
          >
            📊 Trading Score Analysis
          </Typography>

          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              minHeight: 40,
              backgroundColor: theme.palette.mode === 'light'
                ? '#f0f0f0'
                : alpha(theme.palette.background.paper, 0.4),
              borderRadius: '20px',
              padding: '4px',
              '& .MuiTabs-flexContainer': {
                gap: '4px'
              },
              '& .MuiTabs-indicator': {
                display: 'none'
              }
            }}
          >
          <Tab
            label="Overview"
            sx={{
              minHeight: 32,
              my: 0.2,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'text.secondary',
              borderRadius: '16px',
              padding: '6px 18px',
              '&.Mui-selected': {
                color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                backgroundColor: 'primary.main',
                boxShadow: theme.shadows[1]
              },
              '&:hover:not(.Mui-selected)': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                color: 'primary.main'
              }
            }}
          />
          <Tab
            label="Analysis"
            sx={{
              minHeight: 32,
              my: 0.2,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'text.secondary',
              borderRadius: '16px',
              padding: '6px 18px',
              '&.Mui-selected': {
                color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                backgroundColor: 'primary.main',
                boxShadow: theme.shadows[1]
              },
              '&:hover:not(.Mui-selected)': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                color: 'primary.main'
              }
            }}
          />
          <Tab
            label="History"
            sx={{
              minHeight: 32,
              my: 0.2,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'text.secondary',
              borderRadius: '16px',
              padding: '6px 18px',
              '&.Mui-selected': {
                color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                backgroundColor: 'primary.main',
                boxShadow: theme.shadows[1]
              },
              '&:hover:not(.Mui-selected)': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                color: 'primary.main'
              }
            }}
          />
          <Tab
            label="Settings"
            sx={{
              minHeight: 32,
              my: 0.2,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'text.secondary',
              borderRadius: '16px',
              padding: '6px 18px',
              '&.Mui-selected': {
                color: theme.palette.mode === 'dark' ? 'white' : 'background.paper',
                backgroundColor: 'primary.main',
                boxShadow: theme.shadows[1]
              },
              '&:hover:not(.Mui-selected)': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                color: 'primary.main'
              }
            }}
          />
        </Tabs>
        </Stack>
      </Box>

      <Box sx={{ p: 3 }}>
        {/* Overview Tab */}
        <TabPanel value={activeTab} index={0}>
          <Stack spacing={4}>
            {/* Multi-period score cards */}
            {multiPeriodScores ? (
              <Box>
                <Typography
                  variant="subtitle1"
                  gutterBottom
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    mb: 2
                  }}
                >
                  📊 Score Overview
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                  <ScoreCard
                    score={multiPeriodScores.daily.currentScore}
                    trend={multiPeriodScores.daily.trend}
                    period="daily"
                    compact
                  />
                  <ScoreCard
                    score={multiPeriodScores.weekly.currentScore}
                    trend={multiPeriodScores.weekly.trend}
                    period="weekly"
                    compact
                  />
                  <ScoreCard
                    score={multiPeriodScores.monthly.currentScore}
                    trend={multiPeriodScores.monthly.trend}
                    period="monthly"
                    compact
                  />
                </Stack>
              </Box>
            ) : (
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  📊 No Score Data Available
                </Typography>
                <Typography variant="body2">
                  Unable to calculate multi-period scores. This could be because:
                  <br />• No trades found for the current periods
                  <br />• Insufficient trade data for analysis
                  <br />• All trades are outside the selected date range
                </Typography>
              </Alert>
            )}

            {/* Main score card */}
            {scoreAnalysis ? (
              <Box>
                <Typography
                  variant="subtitle1"
                  gutterBottom
                  sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    mb: 2
                  }}
                >
                  📈 Detailed Weekly Score
                </Typography>
                <ScoreCard
                  score={scoreAnalysis.currentScore}
                  trend={scoreAnalysis.trend}
                  period={scorePeriod}
                />
              </Box>
            ) : (
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  📈 Weekly Score Unavailable
                </Typography>
                <Typography variant="body2">
                  No trades found for the current week. Add some trades for this week to see your detailed score analysis.
                </Typography>
              </Alert>
            )}

            {/* Quick recommendations */}
            {scoreAnalysis && scoreAnalysis.recommendations.length > 0 && (
              <Alert
                severity="info"
                sx={{
                  backgroundColor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.info.main, 0.1)
                    : alpha(theme.palette.info.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  borderRadius: 2,
                  '& .MuiAlert-icon': {
                    color: theme.palette.info.main
                  }
                }}
              >
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  💡 Quick Tip
                </Typography>
                <Typography variant="body2">
                  {scoreAnalysis.recommendations[0]}
                </Typography>
              </Alert>
            )}

            {/* No content fallback */}
            {!multiPeriodScores && !scoreAnalysis && (
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  🎯 Get Started with Scoring
                </Typography>
                <Typography variant="body2">
                  To see your trading score analysis:
                  <br />• Add at least {settings.thresholds.minTradesForScore} trades
                  <br />• Ensure trades have dates within the current periods
                  <br />• Include session, tags, and risk/reward data for better analysis
                </Typography>
              </Alert>
            )}
          </Stack>
        </TabPanel>

        {/* Detailed Analysis Tab */}
        <TabPanel value={activeTab} index={1}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : scoreAnalysis ? (
            <ScoreBreakdown
              breakdown={scoreAnalysis.breakdown}
              pattern={scoreAnalysis.pattern}
              recommendations={scoreAnalysis.recommendations}
              strengths={scoreAnalysis.strengths}
              weaknesses={scoreAnalysis.weaknesses}
            />
          ) : (
            <Alert severity="error">
              Unable to calculate detailed score analysis. Please try again.
            </Alert>
          )}
        </TabPanel>

        {/* Score History Tab */}
        <TabPanel value={activeTab} index={2}>
          <ScoreHistory
            history={scoreHistory}
            period={historyPeriod}
            onPeriodChange={handleHistoryPeriodChange}
          />
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={activeTab} index={3}>
          <ScoreSettingsComponent
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onSave={handleSettingsSave}
          />
        </TabPanel>
      </Box>
    </Paper>
  );
};

export default ScoreSection;
