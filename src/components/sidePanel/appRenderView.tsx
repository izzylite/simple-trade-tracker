import React from 'react';
import {
  HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import { SidePanelView } from '../../contexts/SidePanelContext';
import FAQContent from '../faq/FAQContent';

export interface SidePanelViewConfig {
  title: string;
  icon?: React.ReactNode;
  component: React.ReactNode;
  stickyContent?: React.ReactNode;
  /** When true, suppress the back-arrow even if the nav stack has history. */
  hideBack?: boolean;
}

/**
 * App-level renderView for the global SidePanel. Each case maps a view id to
 * its title, icon, and a content component. Content components read what
 * they need from contexts (SelectedCalendarContext, etc.) — no prop drilling
 * from the page.
 *
 * Today only FAQ lives here; trade- and event-coupled panels remain on
 * their pages' local SidePanelProviders, coordinated with the global one
 * via PanelMutexContext.
 */
export const appRenderView = (view: SidePanelView): SidePanelViewConfig | null => {
  switch (view.id) {
    case 'faq':
      return {
        title: 'Help & FAQ',
        icon: <HelpOutlineIcon />,
        component: <FAQContent />,
      };

    default:
      return null;
  }
};
