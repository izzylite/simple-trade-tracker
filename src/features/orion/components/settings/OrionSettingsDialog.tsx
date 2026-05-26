import React from 'react';
import { Box } from '@mui/material';
import BaseDialog from 'components/common/BaseDialog';
import CustomToolsSection from './CustomToolsSection';

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
      subtitle="Customize how Orion works for you"
      maxWidth="sm"
      fullWidth
      hideFooterCancelButton
    >
      <Box>
        <CustomToolsSection />
      </Box>
    </BaseDialog>
  );
};

export default OrionSettingsDialog;
