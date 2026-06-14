// src/components/common/PageActionBar.tsx
import React from 'react';
import { Box, Stack, useTheme } from '@mui/material';
import { getShadow, getHairline } from 'styles/designTokens';

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
        px: { xs: 1, sm: 3 },
        py: 1.25,
        bgcolor: 'background.paper',
        minHeight: 56,
        // Header-chrome elevation: subtle downward separation over the
        // scrolling page content + a bottom hairline (matches AppHeader).
        borderBottom: `1px solid ${getHairline(theme)}`,
        boxShadow: getShadow(theme, 'sm'),
        position: 'relative',
        zIndex: 1,
      }}
    >
      {inlineActions}
      <Box sx={{ flexGrow: 1 }} />
      {rightContent && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {rightContent}
        </Stack>
      )}
    </Box>
  );
};

export default PageActionBar;
