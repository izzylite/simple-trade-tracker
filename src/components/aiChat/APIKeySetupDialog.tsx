/**
 * API Key Setup Dialog
 * Allows users to configure their AI provider API keys
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  Chip,
  IconButton,
  Collapse,
  Card,
  CardContent,
  CircularProgress,
  Tooltip,
  InputAdornment
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error as ErrorIcon,
  Info as InfoIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import {
  AIProvider,
  APIKeySettings,
  AI_PROVIDERS
} from '../../types/aiChat';
import { apiKeyService } from '../../services/apiKeyService';
import { logger } from '../../utils/logger';

interface APIKeySetupDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (provider: AIProvider) => void;
  initialProvider?: AIProvider;
}

const APIKeySetupDialog: React.FC<APIKeySetupDialogProps> = ({
  open,
  onClose,
  onSave,
  initialProvider = 'openai'
}) => {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(initialProvider);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; error?: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2000);

  // Load existing settings when provider changes
  useEffect(() => {
    if (open) {
      const settings = apiKeyService.getAPIKey(selectedProvider);
      setApiKey(settings.apiKey || '');
      setModel(settings.model || AI_PROVIDERS[selectedProvider]?.models[0]?.id || '');
      setBaseUrl(settings.baseUrl || '');
      setTemperature(settings.settings?.temperature || 0.7);
      setMaxTokens(settings.settings?.maxTokens || 2000);
      setValidationResult(null);
    }
  }, [selectedProvider, open]);

  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setValidationResult(null);
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setValidationResult({ isValid: false, error: 'API key is required' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await apiKeyService.testAPIKey(selectedProvider, apiKey, baseUrl || undefined);
      setValidationResult(result);
      
      if (result.isValid) {
        logger.log(`API key validated successfully for ${selectedProvider}`);
      }
    } catch (error) {
      logger.error('Error testing API key:', error);
      setValidationResult({ 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setValidationResult({ isValid: false, error: 'API key is required' });
      return;
    }

    try {
      const settings: Partial<APIKeySettings> = {
        apiKey,
        model,
        baseUrl: baseUrl || undefined,
        settings: {
          temperature,
          maxTokens,
          topP: 1,
          frequencyPenalty: 0,
          presencePenalty: 0
        }
      };

      await apiKeyService.updateAPIKey(selectedProvider, settings);
      onSave(selectedProvider);
      onClose();
    } catch (error) {
      logger.error('Error saving API key:', error);
      setValidationResult({ 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Failed to save API key' 
      });
    }
  };

  const handleClose = () => {
    setApiKey('');
    setModel('');
    setBaseUrl('');
    setValidationResult(null);
    setShowAdvanced(false);
    onClose();
  };

  const providerConfig = AI_PROVIDERS[selectedProvider];
  const availableModels = providerConfig?.models || [];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            minHeight: 500
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6" component="div">
          AI Provider Setup
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure your AI provider to start analyzing your trading data. Your API keys are stored securely in your browser.
          </Typography>

          {/* Provider Selection */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            {Object.entries(AI_PROVIDERS).map(([key, config]) => {
              const provider = key as AIProvider;
              const isSelected = selectedProvider === provider;
              const existingSettings = apiKeyService.getAPIKey(provider);
              const hasValidKey = existingSettings.isValid && existingSettings.apiKey;

              return (
                <Box key={provider} sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(25% - 12px)' } }}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: isSelected ? 2 : 1,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: 2
                      },
                      position: 'relative'
                    }}
                    onClick={() => handleProviderChange(provider)}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {config.name}
                        </Typography>
                        {hasValidKey && (
                          <Tooltip title="API key configured">
                            <CheckCircle color="success" sx={{ fontSize: 16 }} />
                          </Tooltip>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {config.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
          </Box>

          {/* API Key Configuration */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="API Key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${providerConfig?.name} API key`}
              sx={{ mb: 2 }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowApiKey(!showApiKey)}
                        edge="end"
                        size="small"
                      >
                        {showApiKey ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />

            {/* Model Selection */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Model</InputLabel>
              <Select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                label="Model"
              >
                {availableModels.map((modelOption) => (
                  <MenuItem key={modelOption.id} value={modelOption.id}>
                    <Box>
                      <Typography variant="body2">{modelOption.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {modelOption.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Custom Base URL for custom provider */}
            {selectedProvider === 'custom' && (
              <TextField
                fullWidth
                label="Base URL"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                sx={{ mb: 2 }}
              />
            )}

            {/* Test Connection Button */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
              <Button
                variant="outlined"
                onClick={handleTestConnection}
                disabled={!apiKey.trim() || isValidating}
                startIcon={isValidating ? <CircularProgress size={16} /> : undefined}
              >
                {isValidating ? 'Testing...' : 'Test Connection'}
              </Button>

              <Button
                variant="text"
                size="small"
                startIcon={<SettingsIcon />}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                Advanced Settings
              </Button>
            </Box>

            {/* Validation Result */}
            {validationResult && (
              <Alert 
                severity={validationResult.isValid ? 'success' : 'error'}
                sx={{ mb: 2 }}
                icon={validationResult.isValid ? <CheckCircle /> : <ErrorIcon />}
              >
                {validationResult.isValid 
                  ? 'API key is valid and working!' 
                  : validationResult.error || 'API key validation failed'
                }
              </Alert>
            )}

            {/* Advanced Settings */}
            <Collapse in={showAdvanced}>
              <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Advanced Settings
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      fullWidth
                      label="Temperature"
                      type="number"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      slotProps={{ htmlInput: { min: 0, max: 2, step: 0.1 } }}
                      helperText="Controls randomness (0-2)"
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      fullWidth
                      label="Max Tokens"
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                      slotProps={{ htmlInput: { min: 100, max: 4000, step: 100 } }}
                      helperText="Maximum response length"
                    />
                  </Box>
                </Box>
              </Card>
            </Collapse>

            {/* Info Alert */}
            <Alert severity="info" icon={<InfoIcon />}>
              Your API keys are stored locally in your browser and never sent to our servers. 
              They are only used to communicate directly with your chosen AI provider.
            </Alert>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!apiKey.trim() || (validationResult ? !validationResult.isValid : false)}
        >
          Save Configuration
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default APIKeySetupDialog;
