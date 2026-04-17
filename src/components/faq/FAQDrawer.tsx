import React from 'react';
import { HelpOutline as HelpOutlineIcon } from '@mui/icons-material';

import UnifiedDrawer from '../common/UnifiedDrawer';
import FAQContent from './FAQContent';

interface FAQDrawerProps {
  open: boolean;
  onClose: () => void;
}

const FAQDrawer: React.FC<FAQDrawerProps> = ({ open, onClose }) => {
  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="FAQs"
      subtitle="Answers to common questions about the app"
      icon={<HelpOutlineIcon />}
      width={{ xs: '100%', sm: 520 }}
      keepMounted={false}
      contentSx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <FAQContent />
    </UnifiedDrawer>
  );
};

export default FAQDrawer;
