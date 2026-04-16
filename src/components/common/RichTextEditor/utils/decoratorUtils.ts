import React from 'react';
import { CompositeDecorator } from 'draft-js';
import { LinkComponent } from '../components/LinkComponent';
import TagChipComponent from '../components/TagChipComponent';
import { findLinkEntities } from './linkUtils';
import { findTagEntities } from './tagEntityUtils';
import NoteLinkComponent from '../components/NoteLinkComponent';
import { findNoteLinkEntities } from './noteEntityUtils';
import EventLinkComponent from '../components/EventLinkComponent';
import { findEventLinkEntities } from './eventEntityUtils';
import type { ImpactLevel, Currency } from '../../../../types/economicCalendar';

/**
 * Create decorator factory for links and tag chips with props
 */
export const createDecorator = (
  calendarId?: string,
  trades?: Array<{ id: string; [key: string]: any }>,
  onOpenGalleryMode?: (
    trades: any[], initialTradeId?: string, title?: string
  ) => void,
  onNoteLinkClick?: (noteId: string, noteTitle: string) => void,
  onEventLinkClick?: (
    eventId: string,
    eventName: string,
    currency: Currency,
    impact: ImpactLevel
  ) => void,
  onSharedTradeClick?: (shareId: string, tradeId: string) => void
) => {
  return new CompositeDecorator([
    {
      strategy: findLinkEntities,
      component: (props: any) => (
        React.createElement(LinkComponent, {
          ...props,
          calendarId,
          trades,
          onOpenGalleryMode,
          onSharedTradeClick
        })
      ),
    },
    {
      strategy: findTagEntities,
      component: TagChipComponent,
    },
    {
      strategy: findNoteLinkEntities,
      component: (props: any) =>
        React.createElement(NoteLinkComponent, {
          ...props,
          onNoteLinkClick,
        }),
    },
    {
      strategy: findEventLinkEntities,
      component: (props: any) =>
        React.createElement(EventLinkComponent, {
          ...props,
          onEventLinkClick,
        }),
    },
  ]);
};
