/**
 * API Key Settings Dialog
 * Allows users to configure their own Gemini API key for AI chat
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Link,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import {
  getApiKey,
  saveApiKey,
  removeApiKey,
  hasApiKey,
  isValidApiKeyFormat,
  maskApiKey,
  testApiKey
} from '../../services/apiKeyStorage';

import { Z_INDEX } from '../../styles/zIndex';

interface ApiKeySettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const ApiKeySettingsDialog: React.FC<ApiKeySettingsDialogProps> = ({ open, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  // Load existing key on mount
  useEffect(() => {
    if (open) {
      const existingKey = getApiKey();
      if (existingKey) {
        setApiKey(existingKey);
        setHasExistingKey(true);
      } else {
        setApiKey('');
        setHasExistingKey(false);
      }
      setTestResult(null);
      setShowApiKey(false);
    }
  }, [open]);

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestResult({ valid: false, error: 'Please enter an API key' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testApiKey(apiKey.trim());
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSave = () => {
    if (!apiKey.trim()) {
      setTestResult({ valid: false, error: 'Please enter an API key' });
      return;
    }

    if (!isValidApiKeyFormat(apiKey.trim())) {
      setTestResult({ valid: false, error: 'Invalid API key format. Expected format: AIza...' });
      return;
    }

    try {
      saveApiKey(apiKey.trim());
      onClose();
    } catch (error) {
      setTestResult({ valid: false, error: error instanceof Error ? error.message : 'Failed to save API key' });
    }
  };

  const handleRemove = () => {
    removeApiKey();
    setApiKey('');
    setHasExistingKey(false);
    setTestResult(null);
  };

  const handleClose = () => {
    setTestResult(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      sx={{
        zIndex: Z_INDEX.DIALOG, // Ensure it's above other layers
      }}
    >
      <DialogTitle>
        Gemini API Key Settings
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Use your own Google Gemini API key for unlimited AI chat usage. Your key is stored locally and never stored in our servers.
          </Typography>

          <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
            Don't have an API key?{' '}
            <Link
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              Get one free from Google AI Studio
              <OpenInNewIcon sx={{ fontSize: '0.875rem' }} />
            </Link>
          </Alert>

          <TextField
            label="Gemini API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type={showApiKey ? 'text' : 'password'}
            fullWidth
            placeholder="AIza..."
            helperText={hasExistingKey && !showApiKey ? `Current: ${maskApiKey(apiKey)}` : 'Starts with "AIza" and is 39 characters long'}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowApiKey(!showApiKey)}
                    edge="end"
                    size="small"
                  >
                    {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {testResult && (
            <Alert severity={testResult.valid ? (testResult.error ? 'warning' : 'success') : 'error'}>
              {testResult.valid && !testResult.error && 'API key is valid!'}
              {testResult.valid && testResult.error && testResult.error}
              {!testResult.valid && testResult.error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {hasExistingKey && (
          <Button onClick={handleRemove} color="error" sx={{ mr: 'auto' }}>
            Remove Key
          </Button>
        )}
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleTest}
          disabled={!apiKey.trim() || isTesting}
          startIcon={isTesting ? <CircularProgress size={16} /> : null}
        >
          {isTesting ? 'Testing...' : 'Test Key'}
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={!apiKey.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApiKeySettingsDialog;

