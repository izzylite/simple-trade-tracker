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
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab
} from '@mui/material';
import {
  Close as CloseIcon,
  Restore as RestoreIcon
} from '@mui/icons-material';

import {
  AIChatConfig,
  AIModelSettings,
  DEFAULT_AI_CHAT_CONFIG
} from '../../types/aiChat';
import { Calendar } from '../../types/calendar';
import {
  ModelSettingsTab,
  VectorMigrationTab
} from './tabs';


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

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: 2 } }
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
            <Tab label="AI Settings" />
            <Tab label="Vector Migration" />
          </Tabs>
        </Box>

        {/* AI Settings Tab */}
        <TabPanel value={tabValue} index={0}>
          <ModelSettingsTab
            modelSettings={localModelSettings}
            onModelSettingsChange={setLocalModelSettings}
            config={localConfig}
            onConfigChange={setLocalConfig}
          />
        </TabPanel>

        {/* Vector Migration Tab */}
        <TabPanel value={tabValue} index={1}>
          <VectorMigrationTab calendar={calendar} />
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
    </>
  );
};

export default AIChatSettingsDialog;
