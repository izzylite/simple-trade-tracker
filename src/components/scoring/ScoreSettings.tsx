import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Stack,
  TextField,
  Button,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormLabel,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ExpandMore,
  RestoreRounded,
  SaveRounded,
  InfoOutlined
} from '@mui/icons-material';
import { ScoreSettings } from '../../types/score';
import { Trade } from '../../types/trade';
import { DEFAULT_SCORE_SETTINGS } from '../../utils/scoreUtils';
import ExcludedTagsSelector from './ExcludedTagsSelector';
import TagSelector from './TagSelector';

interface ScoreSettingsProps {
  settings: ScoreSettings;
  onSettingsChange: (settings: ScoreSettings) => void;
  onSave?: () => void;
  isSaving?: boolean;
  trades: Trade[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  allTags?: string[]; // Add allTags prop to receive calendar.tags
}

const ScoreSettingsComponent: React.FC<ScoreSettingsProps> = ({
  settings,
  onSettingsChange,
  onSave,
  isSaving = false,
  trades,
  selectedTags,
  onTagsChange,
  allTags
}) => {
  const theme = useTheme();
  const [localSettings, setLocalSettings] = useState<ScoreSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  const handleWeightChange = (component: keyof ScoreSettings['weights']) => (
    event: Event,
    newValue: number | number[]
  ) => {
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    const newWeights = { ...localSettings.weights, [component]: value };
    
    // Ensure weights sum to 100
    const total = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);
    if (total !== 100) {
      // Adjust other weights proportionally
      const otherComponents = Object.keys(newWeights).filter(key => key !== component) as Array<keyof ScoreSettings['weights']>;
      const remaining = 100 - value;
      const otherTotal = otherComponents.reduce((sum, key) => sum + newWeights[key], 0);
      
      if (otherTotal > 0) {
        otherComponents.forEach(key => {
          newWeights[key] = (newWeights[key] / otherTotal) * remaining;
        });
      }
    }

    const newSettings = { ...localSettings, weights: newWeights };
    setLocalSettings(newSettings);
    setHasChanges(true);
    onSettingsChange(newSettings);
  };

  const handleThresholdChange = (threshold: keyof ScoreSettings['thresholds']) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseFloat(event.target.value) || 0;
    const newSettings = {
      ...localSettings,
      thresholds: { ...localSettings.thresholds, [threshold]: value }
    };
    setLocalSettings(newSettings);
    setHasChanges(true);
    onSettingsChange(newSettings);
  };

  const handleTargetChange = (target: keyof ScoreSettings['targets']) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseFloat(event.target.value) || 0;
    const newSettings = {
      ...localSettings,
      targets: { ...localSettings.targets, [target]: value }
    };
    setLocalSettings(newSettings);
    setHasChanges(true);
    onSettingsChange(newSettings);
  };

  const handleExcludedTagsChange = (excludedTags: string[]) => {
    const newSettings = { ...localSettings, excludedTagsFromPatterns: excludedTags };
    setLocalSettings(newSettings);
    setHasChanges(true);
    onSettingsChange(newSettings);
  };

  const handleTagsChangeWithSaveState = (tags: string[]) => {
    // Enable save button when tags change within the settings interface
    setHasChanges(true);
    // Call the original onTagsChange callback
    onTagsChange(tags);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SCORE_SETTINGS);
    setHasChanges(true);
    onSettingsChange(DEFAULT_SCORE_SETTINGS);
  };

  const handleSave = () => {
    if (onSave) {
      onSave();
    }
    setHasChanges(false);
  };

  const weightTotal = Object.values(localSettings.weights).reduce((sum, weight) => sum + weight, 0);

  return (
    <Card
      sx={{
        backgroundColor: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.8)
          : theme.palette.background.paper,
        borderRadius: 3,
        boxShadow: theme.shadows[2],
        border: `1px solid ${theme.palette.mode === 'dark'
          ? alpha(theme.palette.common.white, 0.1)
          : alpha(theme.palette.common.black, 0.1)}`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: theme.shadows[4],
        }
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
            ⚙️ Score Settings
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<RestoreRounded />}
              onClick={handleReset}
              size="small"
              variant="outlined"
              sx={{
                borderColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.3)
                  : theme.palette.primary.main,
                color: theme.palette.mode === 'dark'
                  ? theme.palette.common.white
                  : theme.palette.primary.main,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: alpha(theme.palette.primary.main, 0.05)
                }
              }}
            >
              Reset
            </Button>
            {onSave && (
              <Button
                startIcon={<SaveRounded />}
                onClick={handleSave}
                size="small"
                variant="contained"
                disabled={!hasChanges || isSaving}
                sx={{
                  backgroundColor: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark
                  },
                  '&:disabled': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.common.white, 0.1)
                      : theme.palette.grey[300]
                  }
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            )}
          </Stack>
        </Stack>

        {hasChanges && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You have unsaved changes. Click Save to apply them permanently.
          </Alert>
        )}

        <Stack>
          {/* Score Component Weights */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">
                Score Component Weights
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 2 }}>
                Adjust how much each component contributes to your overall score. 
                Total must equal 100%.
              </Alert>
              
              <Stack spacing={3}>
                <Box>
                  <FormLabel>Consistency ({localSettings.weights.consistency.toFixed(0)}%)</FormLabel>
                  <Box sx={{ px: 2 }}>
                    <Slider
                      value={localSettings.weights.consistency}
                      onChange={handleWeightChange('consistency')}
                      min={0}
                      max={100}
                      step={5}
                      marks={[
                        { value: 0, label: '0%' },
                        { value: 50, label: '50%' },
                        { value: 100, label: '100%' }
                      ]}
                      sx={{
                        '& .MuiSlider-markLabel': {
                          fontSize: '0.75rem'
                        },
                        '& .MuiSlider-markLabel[data-index="0"]': {
                          transform: 'translateX(0%)'
                        },
                        '& .MuiSlider-markLabel[data-index="2"]': {
                          transform: 'translateX(-100%)'
                        }
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    How well you stick to your trading patterns
                  </Typography>
                </Box>

                <Box>
                  <FormLabel>Risk Management ({localSettings.weights.riskManagement.toFixed(0)}%)</FormLabel>
                  <Box sx={{ px: 2 }}>
                    <Slider
                      value={localSettings.weights.riskManagement}
                      onChange={handleWeightChange('riskManagement')}
                      min={0}
                      max={100}
                      step={5}
                      marks={[
                        { value: 0, label: '0%' },
                        { value: 50, label: '50%' },
                        { value: 100, label: '100%' }
                      ]}
                      sx={{
                        '& .MuiSlider-markLabel': {
                          fontSize: '0.75rem'
                        },
                        '& .MuiSlider-markLabel[data-index="0"]': {
                          transform: 'translateX(0%)'
                        },
                        '& .MuiSlider-markLabel[data-index="2"]': {
                          transform: 'translateX(-100%)'
                        }
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Risk management and position sizing discipline
                  </Typography>
                </Box>

                <Box>
                  <FormLabel>Performance ({localSettings.weights.performance.toFixed(0)}%)</FormLabel>
                  <Box sx={{ px: 2 }}>
                    <Slider
                      value={localSettings.weights.performance}
                      onChange={handleWeightChange('performance')}
                      min={0}
                      max={100}
                      step={5}
                      marks={[
                        { value: 0, label: '0%' },
                        { value: 50, label: '50%' },
                        { value: 100, label: '100%' }
                      ]}
                      sx={{
                        '& .MuiSlider-markLabel': {
                          fontSize: '0.75rem'
                        },
                        '& .MuiSlider-markLabel[data-index="0"]': {
                          transform: 'translateX(0%)'
                        },
                        '& .MuiSlider-markLabel[data-index="2"]': {
                          transform: 'translateX(-100%)'
                        }
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Performance consistency vs historical patterns
                  </Typography>
                </Box>

                <Box>
                  <FormLabel>Discipline ({localSettings.weights.discipline.toFixed(0)}%)</FormLabel>
                  <Box sx={{ px: 2 }}>
                    <Slider
                      value={localSettings.weights.discipline}
                      onChange={handleWeightChange('discipline')}
                      min={0}
                      max={100}
                      step={5}
                      marks={[
                        { value: 0, label: '0%' },
                        { value: 50, label: '50%' },
                        { value: 100, label: '100%' }
                      ]}
                      sx={{
                        '& .MuiSlider-markLabel': {
                          fontSize: '0.75rem'
                        },
                        '& .MuiSlider-markLabel[data-index="0"]': {
                          transform: 'translateX(0%)'
                        },
                        '& .MuiSlider-markLabel[data-index="2"]': {
                          transform: 'translateX(-100%)'
                        }
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Trading discipline and emotional control
                  </Typography>
                </Box>

                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: weightTotal === 100 ? 'success.main' : 'error.main',
                    fontWeight: 'medium'
                  }}
                >
                  Total: {weightTotal.toFixed(0)}% {weightTotal !== 100 && '(Must equal 100%)'}
                </Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Calculation Thresholds */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">
                Calculation Thresholds
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                <TextField
                  label="Min Trades for Score"
                  type="number"
                  value={localSettings.thresholds.minTradesForScore}
                  onChange={handleThresholdChange('minTradesForScore')}
                  fullWidth
                  size="small"
                  helperText="Minimum trades needed to calculate score"
                />
                <TextField
                  label="Lookback Period (days)"
                  type="number"
                  value={localSettings.thresholds.lookbackPeriod}
                  onChange={handleThresholdChange('lookbackPeriod')}
                  fullWidth
                  size="small"
                  helperText="Days to look back for pattern analysis"
                />
                <TextField
                  label="Consistency Tolerance (%)"
                  type="number"
                  value={localSettings.thresholds.consistencyTolerance}
                  onChange={handleThresholdChange('consistencyTolerance')}
                  fullWidth
                  size="small"
                  helperText="Acceptable deviation from patterns"
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Performance Targets */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">
                Performance Targets
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                <TextField
                  label="Target Win Rate (%)"
                  type="number"
                  value={localSettings.targets.winRate}
                  onChange={handleTargetChange('winRate')}
                  fullWidth
                  size="small"
                  helperText="Your target win rate percentage"
                />
                <TextField
                  label="Target Profit Factor"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={localSettings.targets.profitFactor}
                  onChange={handleTargetChange('profitFactor')}
                  fullWidth
                  size="small"
                  helperText="Your target profit factor"
                />
                <TextField
                  label="Max Drawdown (%)"
                  type="number"
                  value={localSettings.targets.maxDrawdown}
                  onChange={handleTargetChange('maxDrawdown')}
                  fullWidth
                  size="small"
                  helperText="Maximum acceptable drawdown"
                />
                <TextField
                  label="Avg Risk/Reward Ratio"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={localSettings.targets.avgRiskReward}
                  onChange={handleTargetChange('avgRiskReward')}
                  fullWidth
                  size="small"
                  helperText="Your target risk/reward ratio"
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Common Strategies Tracking */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">
                Common Strategies Tracking
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TagSelector
                trades={trades}
                selectedTags={selectedTags}
                onTagsChange={handleTagsChangeWithSaveState}
                allTags={allTags}
              />
            </AccordionDetails>
          </Accordion>

          {/* Pattern Analysis Settings */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" fontWeight="medium">
                Pattern Analysis Settings
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <ExcludedTagsSelector
                trades={trades}
                excludedTags={localSettings.excludedTagsFromPatterns || []}
                onExcludedTagsChange={handleExcludedTagsChange}
                allTags={allTags}
              />
            </AccordionDetails>
          </Accordion>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ScoreSettingsComponent;
