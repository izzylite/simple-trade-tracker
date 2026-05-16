// src/components/common/PageActionBar.tsx
import React from 'react';
import { Box, Stack, useTheme, alpha } from '@mui/material';

interface PageActionBarProps {
  /** Optional inline actions rendered on the left (after where the selector used to sit). */
  inlineActions?: React.ReactNode;
  /** Right-aligned content (page-level chrome — breadcrumbs, share, edit, etc.). */
  rightContent?: React.ReactNode;
}

/**
 * Slim page sub-header used by pages that previously rendered
 * CalendarSelectorBar. The calendar trigger now lives in AppHeader, so this
 * bar only carries page-specific actions. Mirrors CalendarSelectorBar's
 * spacing/border treatment so the visual transition is invisible to users.
 */
const PageActionBar: React.FC<PageActionBarProps> = ({ inlineActions, rightContent }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: { xs: 2, sm: 3 },
        py: 1.25,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        bgcolor: 'background.paper',
        minHeight: 56,
      }}
    >
      {inlineActions}
      <Box sx={{ flexGrow: 1 }} />
      {rightContent && (
        <Stack direction="row" spacing={1} alignItems="center">
          {rightContent}
        </Stack>
      )}
    </Box>
  );
};

export default PageActionBar;
