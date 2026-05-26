import React from 'react';
import { Box, Divider, Stack } from '@mui/material';
import BaseDialog from 'components/common/BaseDialog';
import CustomToolsSection from './CustomToolsSection';
import SystemToolsSection from './SystemToolsSection';

interface Props {
  open: boolean;
  onClose: () => void;
}

const OrionSettingsDialog: React.FC<Props> = ({ open, onClose }) => {
  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title="Orion settings"
      subtitle="See what Orion can do and wire in your own webhooks"
      maxWidth="sm"
      fullWidth
      hideFooterCancelButton
    >
      <Stack spacing={3}>
        <SystemToolsSection />
        <Divider />
        <CustomToolsSection />
      </Stack>
    </BaseDialog>
  );
};

export default OrionSettingsDialog;
