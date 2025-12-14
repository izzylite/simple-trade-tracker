import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Box,
  Divider,
  Chip,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import { loggerControls, LogLevel } from '../../utils/logger';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface DebugPanelProps {
  open: boolean;
  onClose: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const [config, setConfig] = useState(loggerControls.getConfig());

  useEffect(() => {
    if (open) {
      setConfig(loggerControls.getConfig());
    }
  }, [open]);

  const handleEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    if (enabled) {
      loggerControls.enable();
    } else {
      loggerControls.disable();
    }
    setConfig(loggerControls.getConfig());
  };

  const handleLevelChange = (event: any) => {
    const level = event.target.value as LogLevel;
    loggerControls.setLevel(level);
    setConfig(loggerControls.getConfig());
  };

  const handlePrefixChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const prefix = event.target.value;
    loggerControls.setPrefix(prefix);
    setConfig(loggerControls.getConfig());
  };

  const handleTimestampChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const timestamp = event.target.checked;
    loggerControls.setTimestamp(timestamp);
    setConfig(loggerControls.getConfig());
  };

  const handleReset = () => {
    loggerControls.reset();
    setConfig(loggerControls.getConfig());
  };

  const testLogs = () => {
    const { debug, info, warn, error } = require('../../utils/logger');
    debug('This is a debug message');
    info('This is an info message');
    warn('This is a warning message');
    error('This is an error message');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Debug Panel - Logger Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Current Status */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Current Status
            </Typography>
            <Chip 
              label={config.enabled ? 'Logging Enabled' : 'Logging Disabled'} 
              color={config.enabled ? 'success' : 'default'}
              size="small"
            />
          </Box>

          <Divider />

          {/* Enable/Disable Logging */}
          <FormControlLabel
            control={
              <Switch
                checked={config.enabled}
                onChange={handleEnabledChange}
                color="primary"
              />
            }
            label="Enable Logging"
          />

          {/* Log Level */}
          <FormControl fullWidth disabled={!config.enabled}>
            <InputLabel>Log Level</InputLabel>
            <Select
              value={config.level}
              label="Log Level"
              onChange={handleLevelChange}
            >
              <MenuItem value="debug">Debug (All messages)</MenuItem>
              <MenuItem value="info">Info (Info, Warn, Error)</MenuItem>
              <MenuItem value="warn">Warn (Warn, Error only)</MenuItem>
              <MenuItem value="error">Error (Error only)</MenuItem>
            </Select>
          </FormControl>

          {/* Log Prefix */}
          <TextField
            fullWidth
            label="Log Prefix"
            value={config.prefix || ''}
            onChange={handlePrefixChange}
            disabled={!config.enabled}
            helperText="Prefix to add to all log messages"
          />

          {/* Timestamp */}
          <FormControlLabel
            control={
              <Switch
                checked={config.timestamp}
                onChange={handleTimestampChange}
                color="primary"
                disabled={!config.enabled}
              />
            }
            label="Include Timestamps"
          />

          <Divider />

          {/* Test Logs */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Test Logging
            </Typography>
            <Button
              variant="outlined"
              onClick={testLogs}
              disabled={!config.enabled}
              size="small"
            >
              Send Test Messages
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Check browser console to see the test messages
            </Typography>
          </Box>

          {/* Instructions */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Browser Console Access
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You can also control logging from the browser console:
            </Typography>
            <Box component="pre" sx={{ 
              fontSize: '0.75rem', 
              bgcolor: 'grey.100', 
              p: 1, 
              borderRadius: 1,
              mt: 1,
              overflow: 'auto'
            }}>
{`// Enable/disable logging
logger.setEnabled(true);
logger.setEnabled(false);

// Change log level
logger.setLevel('debug');

// Check current config
logger.getConfig();

// Or use shortcuts
loggerControls.enable();
loggerControls.disable();`}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} color="warning">
          Reset to Defaults
        </Button>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DebugPanel;
