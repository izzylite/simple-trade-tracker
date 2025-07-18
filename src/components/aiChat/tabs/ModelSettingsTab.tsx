/**
 * Model Settings Tab Component
 * Handles Firebase AI Logic model configuration, temperature, max tokens, top P settings, and chat behavior
 */

import React from 'react';
import {
  FormControl,
  FormControlLabel,
  FormLabel,
  TextField,
  Select,
  MenuItem,
  Box,
  Typography,
  Card,
  CardContent,
  Slider,
  Tooltip,
  Switch
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

import {
  AIModelSettings,
  AIChatConfig,
  AI_PROVIDERS
} from '../../../types/aiChat';

interface ModelSettingsTabProps {
  modelSettings: AIModelSettings;
  onModelSettingsChange: (settings: AIModelSettings) => void;
  config: AIChatConfig;
  onConfigChange: (config: AIChatConfig) => void;
}

const ModelSettingsTab: React.FC<ModelSettingsTabProps> = ({
  modelSettings,
  onModelSettingsChange,
  config,
  onConfigChange
}) => {
  const availableModels = AI_PROVIDERS['firebase-ai'].models;

  const handleModelChange = (model: string) => {
    onModelSettingsChange({
      ...modelSettings,
      model
    });
  };

  const handleSettingChange = (key: string, value: number) => {
    onModelSettingsChange({
      ...modelSettings,
      settings: {
        ...modelSettings.settings,
        [key]: value
      }
    });
  };

  const handleConfigChange = (key: keyof AIChatConfig, value: boolean) => {
    onConfigChange({
      ...config,
      [key]: value
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Model Configuration Section */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Logic Model
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure the Gemini model and generation parameters
          </Typography>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <FormLabel>Model</FormLabel>
          <Select
            value={modelSettings.model}
            onChange={(e) => handleModelChange(e.target.value)}
            size="small"
          >
            {availableModels.map((model) => (
              <MenuItem key={model.id} value={model.id}>
                <Box>
                  <Typography variant="body2">{model.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {model.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ mb: 2, px: 2 }}>
          <Typography variant="body2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            Temperature: {modelSettings.settings?.temperature || 0.7}
            <Tooltip title="Controls randomness. Lower values make responses more focused and deterministic.">
              <InfoIcon sx={{ fontSize: 16, ml: 0.5, color: 'text.secondary' }} />
            </Tooltip>
          </Typography>
          <Box sx={{ px: 1 }}>
            <Slider
              value={modelSettings.settings?.temperature || 0.7}
              onChange={(_, value) => handleSettingChange('temperature', value as number)}
              min={0}
              max={2}
              step={0.1}
              marks={[
                { value: 0, label: 'Focused' },
                { value: 1, label: 'Balanced' },
                { value: 2, label: 'Creative' }
              ]}
              sx={{ width: '100%' }}
            />
          </Box>
        </Box>

        <TextField
          label="Max Tokens"
          type="number"
          value={modelSettings.settings?.maxTokens || 2000}
          onChange={(e) => handleSettingChange('maxTokens', parseInt(e.target.value) || 2000)}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
          slotProps={{
            htmlInput: { min: 100, max: 8000 }
          }}
        />

        <Box sx={{ mb: 2, px: 1 }}>
          <Typography variant="body2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            Top P: {modelSettings.settings?.topP || 1}
            <Tooltip title="Controls diversity via nucleus sampling. Lower values focus on more likely tokens.">
              <InfoIcon sx={{ fontSize: 16, ml: 0.5, color: 'text.secondary' }} />
            </Tooltip>
          </Typography>
          <Box sx={{ px: 2 }}>
            <Slider
              value={modelSettings.settings?.topP || 1}
              onChange={(_, value) => handleSettingChange('topP', value as number)}
              min={0.1}
              max={1}
              step={0.1}
              marks={[
                { value: 0.1, label: 'Focused' },
                { value: 0.5, label: 'Balanced' },
                { value: 1, label: 'Diverse' }
              ]}
              sx={{ width: '100%' }}
            />
          </Box>
        </Box>
        </CardContent>
      </Card>

      {/* Chat Behavior Section */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Chat Behavior
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={config.autoScroll}
                onChange={(e) => handleConfigChange('autoScroll', e.target.checked)}
              />
            }
            label="Auto-scroll to new messages"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={config.showTokenCount}
                onChange={(e) => handleConfigChange('showTokenCount', e.target.checked)}
              />
            }
            label="Show token count in messages"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={config.enableSyntaxHighlighting}
                onChange={(e) => handleConfigChange('enableSyntaxHighlighting', e.target.checked)}
              />
            }
            label="Enable syntax highlighting"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={config.autoSaveSessions}
                onChange={(e) => handleConfigChange('autoSaveSessions', e.target.checked)}
              />
            }
            label="Auto-save chat sessions"
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default ModelSettingsTab;
