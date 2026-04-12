import React, { useState } from 'react';
import { Tag as TagIcon, Add as AddIcon } from '@mui/icons-material';
import { IconButton, Tooltip, alpha, useTheme } from '@mui/material';
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
  const theme = useTheme();
  const [createFn, setCreateFn] = useState<(() => void) | null>(null);

  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Tag Management"
      icon={<TagIcon />}
      width={{ xs: '100%', sm: 500 }}
      headerVariant="enhanced"
      headerActions={
        !contentProps.isReadOnly ? (
          <Tooltip title="Create new tag">
            <IconButton
              color="primary"
              onClick={() => createFn?.()}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                },
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        ) : undefined
      }
    >
      <TagManagementContent
        {...contentProps}
        isActive={open}
        showFooter={false}
        onCreateReady={(fn) => setCreateFn(() => fn)}
      />
    </UnifiedDrawer>
  );
};

export default TagManagementDrawer;
