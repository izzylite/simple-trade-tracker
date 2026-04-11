// src/components/sidePanel/SidePanelHeader.tsx
import React from 'react';
import { Box, IconButton, Typography, alpha, useTheme } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ChevronRight as CollapseIcon,
} from '@mui/icons-material';
import { useSidePanel } from '../../contexts/SidePanelContext';

interface SidePanelHeaderProps {
  title: string;
  icon?: React.ReactNode;
}

const SidePanelHeader: React.FC<SidePanelHeaderProps> = ({ title, icon }) => {
  const theme = useTheme();
  const { canGoBack, popPanel, setOpen } = useSidePanel();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        minHeight: 48,
        borderBottom: `1px solid ${alpha(
          theme.palette.divider,
          0.08
        )}`,
        flexShrink: 0,
      }}
    >
      {canGoBack && (
        <IconButton
          onClick={popPanel}
          size="small"
          sx={{ mr: 0.5 }}
          aria-label="Go back"
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
      )}

      {icon && (
        <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
          {icon}
        </Box>
      )}

      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </Typography>

      <IconButton
        onClick={() => setOpen(false)}
        size="small"
        aria-label="Collapse panel"
        sx={{
          color: 'text.secondary',
          '&:hover': {
            color: 'text.primary',
          },
        }}
      >
        <CollapseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};

export default SidePanelHeader;
