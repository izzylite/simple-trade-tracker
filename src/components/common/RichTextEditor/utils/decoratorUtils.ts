import React from 'react';
import { CompositeDecorator } from 'draft-js';
import { LinkComponent } from 'components/common/RichTextEditor/components/LinkComponent';
import TagChipComponent from 'components/common/RichTextEditor/components/TagChipComponent';
import { findLinkEntities } from 'components/common/RichTextEditor/utils/linkUtils';
import { findTagEntities } from 'components/common/RichTextEditor/utils/tagEntityUtils';
import NoteLinkComponent from 'components/common/RichTextEditor/components/NoteLinkComponent';
import { findNoteLinkEntities } from 'components/common/RichTextEditor/utils/noteEntityUtils';
import EventLinkComponent from 'components/common/RichTextEditor/components/EventLinkComponent';
import { findEventLinkEntities } from 'components/common/RichTextEditor/utils/eventEntityUtils';
import TradeLinkComponent from 'components/common/RichTextEditor/components/TradeLinkComponent';
import { findTradeLinkEntities } from 'components/common/RichTextEditor/utils/tradeEntityUtils';
import type { ImpactLevel, Currency } from 'features/events/types/economicCalendar';

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
    {
      strategy: findTradeLinkEntities,
      component: (props: any) =>
        React.createElement(TradeLinkComponent, {
          ...props,
          onSharedTradeClick,
        }),
    },
  ]);
};
