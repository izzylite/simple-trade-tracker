/**
 * Expandable Card List Component
 * Reusable component for displaying a collapsible list with scroll capability
 */

import React, { useState, useEffect } from 'react';
import { Box, Button, useTheme, alpha } from '@mui/material';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface ExpandableCardListProps {
  items: React.ReactNode[];
  defaultVisibleCount?: number;
  itemType: string; // e.g., "trades", "events"
}

const ExpandableCardList: React.FC<ExpandableCardListProps> = ({
  items,
  defaultVisibleCount = 4,
  itemType
}) => {
  const theme = useTheme();
  const [visibleCount, setVisibleCount] = useState(0);

  const totalCount = items.length;

  // Keep visibility in sync with available items
  useEffect(() => {
    if (totalCount === 0) {
      setVisibleCount(0);
      return;
    }

    setVisibleCount(prev => {
      if (prev === 0) {
        return Math.min(defaultVisibleCount, totalCount);
      }
      return Math.min(prev, totalCount);
    });
  }, [totalCount, defaultVisibleCount]);

  // No items to display
  if (totalCount === 0) {
    return null;
  }

  const visibleItems = items.slice(0, visibleCount);
  const isExpanded = visibleCount >= totalCount;
  const enableScrollable = totalCount > defaultVisibleCount && isExpanded;

  return (
    <>
      <Box
        sx={{
          mt: 1,
          ...(enableScrollable
            ? {
                maxHeight: 350,
                overflowY: 'auto',
                pr: 1,
                border: '1px solid',
                borderColor: alpha(theme.palette.divider, 0.3),
                borderRadius: 0.5,
                backgroundColor: alpha(theme.palette.primary.main, 0.02),
                p: 1.5,
                ...scrollbarStyles(theme)
              }
            : {})
        }}
      >
        {visibleItems}
      </Box>

      {totalCount > defaultVisibleCount && visibleCount > 0 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              setVisibleCount(isExpanded ? defaultVisibleCount : totalCount)
            }
          >
            {isExpanded
              ? `Collapse ${itemType}`
              : `Load ${totalCount - visibleCount} more ${itemType}`}
          </Button>
        </Box>
      )}
    </>
  );
};

export default ExpandableCardList;
