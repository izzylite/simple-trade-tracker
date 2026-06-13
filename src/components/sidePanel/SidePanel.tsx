// src/components/sidePanel/SidePanel.tsx
import React from 'react';
import { Box, useTheme } from '@mui/material';
import { useSidePanel, SidePanelView } from 'contexts/SidePanelContext';
import { useIsDesktop } from 'hooks/useResponsive';
import SidePanelHeader from 'components/sidePanel/SidePanelHeader';

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
  /**
   * Suppress the inner SidePanelHeader. Set by the mobile drawer host
   * (UnifiedDrawer already supplies its own title + close chrome), so the
   * panel doesn't render a second stacked header on phones.
   */
  hideHeader?: boolean;
}

const SidePanel: React.FC<SidePanelProps> = ({ renderView, hideHeader = false }) => {
  const theme = useTheme();
  const isDesktop = useIsDesktop();
  const { currentView, isOpen } = useSidePanel();

  const viewConfig = renderView(currentView);

  // Desktop: animate the inline panel between 0 and the clamped width.
  // Mobile (hosted inside a 100%-width UnifiedDrawer): fill the host, never
  // pin a 340px floor that would overflow a 320–360px phone.
  return (
    <Box
      sx={{
        width: isDesktop ? (isOpen ? PANEL_WIDTH : 0) : '100%',
        overflow: 'hidden',
        ...(isDesktop && {
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          borderLeft: isOpen ? `1px solid ${theme.palette.divider}` : 'none',
        }),
        flexShrink: 0,
        height: '100%',
        bgcolor: 'background.paper',
      }}
    >
      {viewConfig && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minWidth: isDesktop ? PANEL_WIDTH : 0,
            width: '100%',
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          {!hideHeader && (
            <SidePanelHeader
              title={viewConfig.title}
              icon={viewConfig.icon}
              hideBack={viewConfig.hideBack}
            />
          )}

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
