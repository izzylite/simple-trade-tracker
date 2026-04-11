import React from 'react';
import { Search as SearchIcon } from '@mui/icons-material';
import UnifiedDrawer from './common/UnifiedDrawer';
import SearchContent, { SearchContentProps } from './sidePanel/content/SearchContent';
import { scrollbarStyles } from '../styles/scrollbarStyles';
import { useTheme } from '@mui/material';

interface SearchDrawerProps extends SearchContentProps {
  open: boolean;
  onClose: () => void;
}

const SearchDrawer: React.FC<SearchDrawerProps> = ({
  open,
  onClose,
  ...contentProps
}) => {
  const theme = useTheme();

  return (
    <UnifiedDrawer
      open={open}
      onClose={onClose}
      title="Search & Filter Trades"
      subtitle="Find trades by tags, notes, or date ranges"
      icon={<SearchIcon />}
      width={{ xs: '100%', sm: 450 }}
      contentSx={{ ...scrollbarStyles(theme) }}
      headerVariant="enhanced"
    >
      <SearchContent {...contentProps} isActive={open} />
    </UnifiedDrawer>
  );
};

export default SearchDrawer;
