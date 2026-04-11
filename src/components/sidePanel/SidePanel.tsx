// src/components/sidePanel/SidePanel.tsx
import React from 'react';
import { Box, alpha, useTheme } from '@mui/material';
import { useSidePanel, SidePanelView } from '../../contexts/SidePanelContext';
import SidePanelHeader from './SidePanelHeader';

interface ViewConfig {
  title: string;
  icon?: React.ReactNode;
  component: React.ReactNode;
}

interface SidePanelProps {
  /**
   * Maps the current view to a title, icon, and rendered component.
   * Called with the top of the navigation stack.
   */
  renderView: (view: SidePanelView) => ViewConfig | null;
}

const SidePanel: React.FC<SidePanelProps> = ({ renderView }) => {
  const theme = useTheme();
  const { currentView, isOpen } = useSidePanel();

  const viewConfig = renderView(currentView);

  return (
    <Box
      sx={{
        width: isOpen ? 'clamp(300px, 25vw, 420px)' : 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0,
        height: '100%',
        borderLeft: isOpen
          ? `1px solid ${alpha(theme.palette.divider, 0.08)}`
          : 'none',
      }}
    >
      {viewConfig && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minWidth: 'clamp(300px, 25vw, 420px)',
          }}
        >
          <SidePanelHeader
            title={viewConfig.title}
            icon={viewConfig.icon}
          />

          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {viewConfig.component}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default SidePanel;
