import React from 'react';
import { Tag as TagIcon } from '@mui/icons-material';
import UnifiedDrawer from './common/UnifiedDrawer';
import TagManagementContent, { TagManagementContentProps } from './sidePanel/content/TagManagementContent';

interface TagManagementDrawerProps extends TagManagementContentProps {
  open: boolean;
  onClose: () => void;
}

const TagManagementDrawer: React.FC<TagManagementDrawerProps> = ({
  open,
  onClose,
  ...contentProps
}) => {
  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Tag Management"
      icon={<TagIcon />}
      width={{ xs: '100%', sm: 500 }}
      contentSx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <TagManagementContent
        {...contentProps}
        isActive={open}
        showFooter
      />
    </UnifiedDrawer>
  );
};

export default TagManagementDrawer;
