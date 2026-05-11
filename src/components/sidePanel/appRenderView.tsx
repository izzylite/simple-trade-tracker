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
}

/**
 * App-level renderView for the global SidePanel. Each case maps a view id to
 * its title, icon, and a content component. Content components read what they
 * need from contexts (SelectedCalendarContext, TradesContext, etc.) — no prop
 * drilling from the page.
 *
 * Migrated panel-by-panel from TradeCalendarPage / EconomicEventsPage.
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
