// src/components/sidePanel/SidePanel.tsx
import React from 'react';
import { Box, alpha, useTheme } from '@mui/material';
import { useSidePanel, SidePanelView } from 'contexts/SidePanelContext';
import SidePanelHeader from 'components/sidePanel/SidePanelHeader';
import { isDarkMode } from 'utils/themeMode';

interface ViewConfig {
  title: string;
  icon?: React.ReactNode;
  component: React.ReactNode;
  /** Content rendered between header and main content (e.g. sticky reminders) */
  stickyContent?: React.ReactNode;
  /** When true, suppress the back-arrow even if the nav stack has history. */
  hideBack?: boolean;
}

// Matches the <lg drawer width (450px) so the panel feels the same on
// either side of the breakpoint. Floor at 340px for narrow lg viewports.
const PANEL_WIDTH = 'clamp(340px, 28vw, 450px)';

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
        width: isOpen ? PANEL_WIDTH : 0,
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
            minWidth: PANEL_WIDTH,
            overflow: 'hidden',
            bgcolor: isDarkMode(theme)
              ? alpha(theme.palette.background.paper, 0.4)
              : alpha(theme.palette.background.paper, 0.7),
          }}
        >
          <SidePanelHeader
            title={viewConfig.title}
            icon={viewConfig.icon}
            hideBack={viewConfig.hideBack}
          />

          {viewConfig.stickyContent}

          <Box
            sx={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overscrollBehavior: 'contain',
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
