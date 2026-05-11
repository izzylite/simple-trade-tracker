import React from 'react';
import { SidePanelView } from '../../contexts/SidePanelContext';

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
    // TODO: each case added in its own task — see plan Task 5+.
    default:
      return null;
  }
};
