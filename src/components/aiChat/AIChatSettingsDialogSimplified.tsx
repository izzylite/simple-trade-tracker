/**
 * Simplified AI Chat Settings Dialog for Firebase AI Logic
 * Allows users to configure AI chat behavior and model settings
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Switch,
  TextField,
  Select,
  MenuItem,
  Box,
  Typography,
  Card,
  CardContent,
  Slider,
  Tooltip,
  IconButton,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  Close as CloseIcon,
  Restore as RestoreIcon,
  Info as InfoIcon
} from '@mui/icons-material';

import {
  AIChatConfig,
  AIModelSettings,
  AI_PROVIDERS,
  DEFAULT_AI_CHAT_CONFIG
} from '../../types/aiChat';
import VectorMigrationDialog from '../VectorMigrationDialog';
import { Calendar } from '../../types/calendar';


interface AIChatSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  config: AIChatConfig;
  modelSettings?: AIModelSettings;
  onConfigChange: (config: AIChatConfig, modelSettings?: AIModelSettings) => void;
  calendar?: Calendar;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AIChatSettingsDialog: React.FC<AIChatSettingsDialogProps> = ({
  open,
  onClose,
  config,
  modelSettings,
  onConfigChange,
  calendar
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [localConfig, setLocalConfig] = useState<AIChatConfig>(config);
  const [localModelSettings, setLocalModelSettings] = useState<AIModelSettings>(
    modelSettings || {
      model: config.defaultModel,
      settings: {
        temperature: 0.7,
        maxTokens: 2000,
        topP: 1
      }
    }
  );
  const [showVectorMigration, setShowVectorMigration] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
    if (modelSettings) {
      setLocalModelSettings(modelSettings);
    }
  }, [config, modelSettings]);

  const handleSave = () => {
    onConfigChange(localConfig, localModelSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_AI_CHAT_CONFIG);
    setLocalModelSettings({
      model: DEFAULT_AI_CHAT_CONFIG.defaultModel,
      settings: {
        temperature: 0.7,
        maxTokens: 2000,
        topP: 1
      }
    });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const availableModels = AI_PROVIDERS['firebase-ai'].models;

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6">AI Chat Settings</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Model Settings" />
            <Tab label="Chat Preferences" />
            <Tab label="Context Settings" />
            <Tab label="Vector Migration" />
          </Tabs>
        </Box>

        {/* Model Settings Tab */}
        <TabPanel value={tabValue} index={0}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Firebase AI Logic Model
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure the Gemini model and generation parameters
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <FormLabel>Model</FormLabel>
                <Select
                  value={localModelSettings.model}
                  onChange={(e) => setLocalModelSettings(prev => ({
                    ...prev,
                    model: e.target.value
                  }))}
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

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Temperature: {localModelSettings.settings?.temperature || 0.7}
                  <Tooltip title="Controls randomness. Lower values make responses more focused and deterministic.">
                    <InfoIcon sx={{ fontSize: 16, ml: 0.5, color: 'text.secondary' }} />
                  </Tooltip>
                </Typography>
                <Slider
                  value={localModelSettings.settings?.temperature || 0.7}
                  onChange={(_, value) => setLocalModelSettings(prev => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      temperature: value as number
                    }
                  }))}
                  min={0}
                  max={2}
                  step={0.1}
                  marks={[
                    { value: 0, label: 'Focused' },
                    { value: 1, label: 'Balanced' },
                    { value: 2, label: 'Creative' }
                  ]}
                />
              </Box>

              <TextField
                label="Max Tokens"
                type="number"
                value={localModelSettings.settings?.maxTokens || 2000}
                onChange={(e) => setLocalModelSettings(prev => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    maxTokens: parseInt(e.target.value) || 2000
                  }
                }))}
                size="small"
                fullWidth
                sx={{ mb: 2 }}
                inputProps={{ min: 100, max: 8000 }}
              />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Top P: {localModelSettings.settings?.topP || 1}
                  <Tooltip title="Controls diversity via nucleus sampling. Lower values focus on more likely tokens.">
                    <InfoIcon sx={{ fontSize: 16, ml: 0.5, color: 'text.secondary' }} />
                  </Tooltip>
                </Typography>
                <Slider
                  value={localModelSettings.settings?.topP || 1}
                  onChange={(_, value) => setLocalModelSettings(prev => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      topP: value as number
                    }
                  }))}
                  min={0.1}
                  max={1}
                  step={0.1}
                  marks={[
                    { value: 0.1, label: 'Focused' },
                    { value: 0.5, label: 'Balanced' },
                    { value: 1, label: 'Diverse' }
                  ]}
                />
              </Box>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Chat Preferences Tab */}
        <TabPanel value={tabValue} index={1}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Vector Search is Always Enabled:</strong>
            </Typography>
            <Typography variant="caption" component="div">
              • Finds trades by meaning, not just keywords<br/>
              • Faster AI responses with focused context<br/>
              • Better insights from relevant trade patterns<br/>
              • Works great with queries like "profitable EUR/USD trades"
            </Typography>
          </Alert>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Chat Behavior
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.autoScroll}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      autoScroll: e.target.checked
                    }))}
                  />
                }
                label="Auto-scroll to new messages"
                sx={{ mb: 1 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.showTokenCount}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      showTokenCount: e.target.checked
                    }))}
                  />
                }
                label="Show token count in messages"
                sx={{ mb: 1 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.enableSyntaxHighlighting}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      enableSyntaxHighlighting: e.target.checked
                    }))}
                  />
                }
                label="Enable syntax highlighting"
                sx={{ mb: 1 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.autoSaveSessions}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      autoSaveSessions: e.target.checked
                    }))}
                  />
                }
                label="Auto-save chat sessions"
              />
            </CardContent>
          </Card>
        </TabPanel>

        {/* Context Settings Tab */}
        <TabPanel value={tabValue} index={2}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trading Data Context
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Configure what trading data to include in AI analysis
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.includeDetailedTrades}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      includeDetailedTrades: e.target.checked
                    }))}
                  />
                }
                label="Include detailed trade information"
                sx={{ mb: 1 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.includeTagAnalysis}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      includeTagAnalysis: e.target.checked
                    }))}
                  />
                }
                label="Include tag analysis"
                sx={{ mb: 1 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.includeEconomicEvents}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      includeEconomicEvents: e.target.checked
                    }))}
                  />
                }
                label="Include economic events correlation"
                sx={{ mb: 1 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.includeRecentTrades}
                    onChange={(e) => setLocalConfig(prev => ({
                      ...prev,
                      includeRecentTrades: e.target.checked
                    }))}
                  />
                }
                label="Include recent performance trends"
                sx={{ mb: 2 }}
              />

              <TextField
                label="Max Context Trades"
                type="number"
                value={localConfig.maxContextTrades}
                onChange={(e) => setLocalConfig(prev => ({
                  ...prev,
                  maxContextTrades: parseInt(e.target.value) || 100
                }))}
                size="small"
                fullWidth
                inputProps={{ min: 10, max: 500 }}
                helperText="Maximum number of trades to include in context (affects performance)"
              />
            </CardContent>
          </Card>
        </TabPanel>

        {/* Vector Migration Tab */}
        <TabPanel value={tabValue} index={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Economic Events Vector Migration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Regenerate vector embeddings to include economic events data in both embedded content and structured database fields.
              </Typography>

              <Alert severity="info" sx={{ mb: 2 }}>
                This migration adds economic events to the Supabase database and regenerates all embeddings.
                Economic events will be stored as structured JSONB data and included in searchable content,
                enabling better AI analysis of trades correlated with economic news.
              </Alert>

              <Button
                variant="contained"
                onClick={() => setShowVectorMigration(true)}
                disabled={!calendar}
                fullWidth
              >
                Run Vector Migration
              </Button>

              {!calendar && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Calendar is required to run migration
                </Typography>
              )}
            </CardContent>
          </Card>
        </TabPanel>

      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleReset}
          startIcon={<RestoreIcon />}
          color="inherit"
        >
          Reset to Defaults
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained">
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>

    {/* Vector Migration Dialog */}
    <VectorMigrationDialog
      open={showVectorMigration}
      onClose={() => setShowVectorMigration(false)}
      calendar={calendar}
    />
    </>
  );
};

export default AIChatSettingsDialog;
