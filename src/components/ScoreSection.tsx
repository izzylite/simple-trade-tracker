import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Stack,
  Alert,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  CircularProgress
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Close } from '@mui/icons-material';
import { Trade } from '../types/trade';
import { ScoreSettings, ScoreAnalysis } from '../types/score';
import { Calendar } from '../types/calendar';
import { DynamicRiskSettings } from '../utils/dynamicRiskUtils';
import { scoreService } from '../services/scoreService';

import { scrollbarStyles } from '../styles/scrollbarStyles';
import ScoreCard from './scoring/ScoreCard';
import ScoreBreakdown from './scoring/ScoreBreakdown';
import ScoreHistory from './scoring/ScoreHistory';
import ScoreSettingsComponent from './scoring/ScoreSettings';
import TagPatternAnalysis from './TagPatternAnalysis';

interface ScoreSectionProps {
  trades: Trade[];
  selectedDate: Date;
  calendarId: string;
  scoreSettings?: ScoreSettings;
  onUpdateCalendarProperty?: (calendarId: string, updateCallback: (calendar: Calendar) => Calendar) => Promise<void>;
  // Dynamic risk settings
  accountBalance?: number;
  dynamicRiskSettings?: DynamicRiskSettings;
  allTags?: string[]; // Add allTags prop to receive calendar.tags
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

const ScoreSection: React.FC<ScoreSectionProps> = ({
  trades,
  selectedDate,
  calendarId,
  scoreSettings,
  onUpdateCalendarProperty,
  accountBalance,
  dynamicRiskSettings,
  allTags
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const scorePeriod = 'monthly';
  const [historyPeriod, setHistoryPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [settings, setSettings] = useState<ScoreSettings>(scoreSettings || scoreService.getSettings());
  const [selectedTags, setSelectedTags] = useState<string[]>(scoreSettings?.selectedTags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);


  const [scoreAnalysis, setScoreAnalysis] = useState<ScoreAnalysis | null>(null);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [multiPeriodScores, setMultiPeriodScores] = useState<any>(null);

  // State for breakdown modal
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [selectedBreakdownData, setSelectedBreakdownData] = useState<{
    analysis: ScoreAnalysis;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  } | null>(null);

  // Initialize settings from calendar props when they change
  useEffect(() => {
    if (scoreSettings) {
      setSettings(scoreSettings);
      setSelectedTags(scoreSettings.selectedTags || []);
    }
  }, [scoreSettings]);

  // Update score service settings when local settings change
  useEffect(() => {
    scoreService.updateSettings(settings);
  }, [settings]);

  // Update score service settings when selected tags change
  useEffect(() => {
    const updatedSettings = { ...settings, selectedTags };
    scoreService.updateSettings(updatedSettings);
  }, [selectedTags, settings]);

  // Update dynamic risk settings in score service
  useEffect(() => {
    if (accountBalance !== undefined) {
      scoreService.updateDynamicRiskSettings({
        accountBalance,
        riskPerTrade: dynamicRiskSettings?.riskPerTrade,
        dynamicRiskEnabled: dynamicRiskSettings?.dynamicRiskEnabled,
        increasedRiskPercentage: dynamicRiskSettings?.increasedRiskPercentage,
        profitThresholdPercentage: dynamicRiskSettings?.profitThresholdPercentage
      });
    }
  }, [accountBalance, dynamicRiskSettings]);

  // Calculate current score analysis
  useEffect(() => {
    if (trades.length === 0) {
      setScoreAnalysis(null);
      return;
    }

    const calculateScoreAnalysis = async () => {
      setIsCalculating(true);
      try {
        // Ensure score service has the latest settings before calculation
        const updatedSettings = { ...settings, selectedTags };
        scoreService.updateSettings(updatedSettings);
        const analysis = await scoreService.calculateScore(trades, scorePeriod, selectedDate, updatedSettings);
        setScoreAnalysis(analysis);
      } catch (error) {
        console.error('Error calculating score:', error);
        setScoreAnalysis(null);
      } finally {
        setIsCalculating(false);
      }
    };

    calculateScoreAnalysis();
  }, [trades, scorePeriod, selectedDate, selectedTags, settings]);

  // Calculate score history
  useEffect(() => {
    if (trades.length === 0) {
      setScoreHistory([]);
      return;
    }

    const calculateScoreHistory = async () => {
      try {
        // Ensure score service has the latest settings before calculation
        const updatedSettings = { ...settings, selectedTags };
        scoreService.updateSettings(updatedSettings);
        const history = await scoreService.getScoreHistory(trades, historyPeriod, 12, updatedSettings);
        setScoreHistory(history);
      } catch (error) {
        console.error('Error calculating score history:', error);
        setScoreHistory([]);
      }
    };

    calculateScoreHistory();
  }, [trades, historyPeriod, selectedTags, settings]);

  // Calculate multi-period scores for overview
  useEffect(() => {
    if (trades.length === 0) {
      setMultiPeriodScores(null);
      return;
    }

    const calculateMultiPeriodScores = async () => {
      try {
        // Ensure score service has the latest settings before calculation
        const updatedSettings = { ...settings, selectedTags };
        scoreService.updateSettings(updatedSettings);
        const scores = await scoreService.calculateMultiPeriodScore(trades, selectedDate, updatedSettings);
        setMultiPeriodScores(scores);
      } catch (error) {
        console.error('Error calculating multi-period scores:', error);
        setMultiPeriodScores(null);
      }
    };

    calculateMultiPeriodScores();
  }, [trades, selectedDate, selectedTags, settings]);
 



  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleHistoryPeriodChange = (newPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setHistoryPeriod(newPeriod);
  };

  // Handler for opening breakdown modal
  const handleScoreCardClick = (period: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    if (!multiPeriodScores) return;

    const analysis = multiPeriodScores[period];
    if (analysis) {
      setSelectedBreakdownData({ analysis, period });
      setBreakdownModalOpen(true);
    }
  };

  // Handler for closing breakdown modal
  const handleCloseBreakdownModal = () => {
    setBreakdownModalOpen(false);
    setSelectedBreakdownData(null);
  };

  const handleSettingsChange = (newSettings: ScoreSettings) => {
    setSettings(newSettings);
  };

  const handleSettingsSave = async (tagsOverride?: string[]) => {
    if (!onUpdateCalendarProperty) return;

    setIsSaving(true);
    try { 
      const updatedSettings = { ...settings, selectedTags: tagsOverride ?? selectedTags };
      await onUpdateCalendarProperty(calendarId, (calendar) => ({
        ...calendar,
        scoreSettings: updatedSettings
      }));
    } catch (error) {
      console.error('Error saving score settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagsChange = async (tags: string[]) => {
    setSelectedTags(tags);

    // Auto-save tags to calendar when they change
    if (onUpdateCalendarProperty) {
      // Pass the new tags directly to ensure they're saved
      await handleSettingsSave(tags);
    }
  };

  // Fallback to localStorage if no calendar settings are provided
  useEffect(() => {
    if (!scoreSettings && !onUpdateCalendarProperty) {
      const savedSettings = localStorage.getItem('scoreSettings');
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings);
          setSettings(parsedSettings);
          setSelectedTags(parsedSettings.selectedTags || []);
        } catch (error) {
          console.error('Error loading saved settings from localStorage:', error);
        }
      }
    }
  }, [scoreSettings, onUpdateCalendarProperty]);

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
      data-testid="score-section"
      sx={{
        p: 0,
        backgroundColor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.8)
          : theme.palette.background.paper,
        borderRadius: 2,
        boxShadow: theme.shadows[2],
        border: `1px solid ${theme.palette.mode === 'dark'
          ? 'rgba(204, 204, 204, 0.1)'
          : alpha(theme.palette.common.black, 0.1)}`
      }}
    >
      <Box sx={{ px: 3, pt: 3}}>
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
            label="Patterns"
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

      <Box sx={{ px: 3, pb: 3 }}>
        {/* Overview Tab */}
        <TabPanel value={activeTab} index={0}>
          <Stack spacing={4}>
            {/* Multi-period score cards */}
            {isCalculating ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 4
                }}
              >
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Calculating trading scores...
                </Typography>
              </Box>
            ) : multiPeriodScores ? (
              <Box>

                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    mb: 1,
                    fontStyle: 'italic'
                  }}
                >
                  Click on any score card to see detailed breakdown
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ flexWrap: 'wrap' }}>
                  <Box
                    onClick={() => handleScoreCardClick('daily')}
                    sx={{
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-2px)' },
                      flex: { xs: '1', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(25% - 12px)' }
                    }}
                  >
                    <ScoreCard
                      score={multiPeriodScores.daily.currentScore}
                      trend={multiPeriodScores.daily.trend}
                      period="daily"
                      compact
                    />
                  </Box>
                  <Box
                    onClick={() => handleScoreCardClick('weekly')}
                    sx={{
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-2px)' },
                      flex: { xs: '1', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(25% - 12px)' }
                    }}
                  >
                    <ScoreCard
                      score={multiPeriodScores.weekly.currentScore}
                      trend={multiPeriodScores.weekly.trend}
                      period="weekly"
                      compact
                    />
                  </Box>
                  <Box
                    onClick={() => handleScoreCardClick('monthly')}
                    sx={{
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-2px)' },
                      flex: { xs: '1', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(25% - 12px)' }
                    }}
                  >
                    <ScoreCard
                      score={multiPeriodScores.monthly.currentScore}
                      trend={multiPeriodScores.monthly.trend}
                      period="monthly"
                      compact
                    />
                  </Box>
                  <Box
                    onClick={() => handleScoreCardClick('yearly')}
                    sx={{
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': { transform: 'translateY(-2px)' },
                      flex: { xs: '1', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(25% - 12px)' }
                    }}
                  >
                    <ScoreCard
                      score={multiPeriodScores.yearly.currentScore}
                      trend={multiPeriodScores.yearly.trend}
                      period="yearly"
                      compact
                    />
                  </Box>
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

        {/* Score History Tab */}
        <TabPanel value={activeTab} index={1}>
          <ScoreHistory
            history={scoreHistory}
            period={historyPeriod}
            onPeriodChange={handleHistoryPeriodChange}
          />
        </TabPanel>

        {/* Pattern Analysis Tab */}
        <TabPanel value={activeTab} index={2}>
          <TagPatternAnalysis
            trades={trades}
            selectedDate={selectedDate}
            settings={settings}
          />
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={activeTab} index={3}>
          <Stack spacing={3}>
            <ScoreSettingsComponent
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onSave={handleSettingsSave}
              isSaving={isSaving}
              trades={trades}
              selectedTags={selectedTags}
              onTagsChange={handleTagsChange}
              allTags={allTags}
            />
          </Stack>
        </TabPanel>
      </Box>

      {/* Score Breakdown Modal */}
      <Dialog
        open={breakdownModalOpen}
        onClose={handleCloseBreakdownModal}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.95)
              : theme.palette.background.paper,
            borderRadius: 2,
            maxHeight: '90vh'
          },
          '& .MuiDialogContent-root': {
            ...scrollbarStyles(theme)
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {selectedBreakdownData ?
              `📊 ${selectedBreakdownData.period.charAt(0).toUpperCase() + selectedBreakdownData.period.slice(1)} Score Analysis`
              : 'Score Analysis'
            }
          </Typography>
          <IconButton
            onClick={handleCloseBreakdownModal}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.secondary, 0.1)
              }
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedBreakdownData && (
            <ScoreBreakdown
              breakdown={selectedBreakdownData.analysis.breakdown}
              pattern={selectedBreakdownData.analysis.pattern}
              recommendations={selectedBreakdownData.analysis.recommendations}
              strengths={selectedBreakdownData.analysis.strengths}
              weaknesses={selectedBreakdownData.analysis.weaknesses}
            />
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
};

export default ScoreSection;
