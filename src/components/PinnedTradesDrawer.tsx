import React from 'react';
import { PushPin as PushPinIcon } from '@mui/icons-material';
import UnifiedDrawer from './common/UnifiedDrawer';
import PinnedContent, { PinnedContentProps } from './sidePanel/content/PinnedContent';

interface PinnedTradesDrawerProps extends PinnedContentProps {
  open: boolean;
  onClose: () => void;
}

const PinnedTradesDrawer: React.FC<PinnedTradesDrawerProps> = ({
  open,
  onClose,
  ...contentProps
}) => {
  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Pinned"
      icon={<PushPinIcon />}
      width={{ xs: '100%', sm: 400 }}
      headerVariant="enhanced"
    >
      <PinnedContent {...contentProps} isActive={open} />
    </UnifiedDrawer>
  );
};

export default PinnedTradesDrawer;
