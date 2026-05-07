import React from 'react';
import { Insights as StatsIcon } from '@mui/icons-material';

import UnifiedDrawer from './common/UnifiedDrawer';
import StatsContent, {
  StatsContentProps,
} from './sidePanel/content/StatsContent';

interface StatsDrawerProps extends StatsContentProps {
  open: boolean;
  onClose: () => void;
}

/**
 * <lg fallback for the 'stats' SidePanelView. Mirrors the panel content
 * inside the shared UnifiedDrawer chrome.
 */
const StatsDrawer: React.FC<StatsDrawerProps> = ({
  open,
  onClose,
  ...contentProps
}) => {
  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Stats"
      icon={<StatsIcon />}
      width={{ xs: '100%', sm: 540 }}
      keepMounted={false}
      contentSx={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <StatsContent {...contentProps} />
    </UnifiedDrawer>
  );
};

export default StatsDrawer;
