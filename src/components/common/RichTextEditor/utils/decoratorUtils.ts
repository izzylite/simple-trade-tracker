import React from 'react';
import { CompositeDecorator } from 'draft-js';
import { LinkComponent } from '../components/LinkComponent';
import { findLinkEntities } from './linkUtils';

/**
 * Create decorator factory for links with props
 */
export const createDecorator = (
  calendarId?: string, 
  trades?: Array<{ id: string; [key: string]: any }>, 
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void
) => {
  return new CompositeDecorator([
    {
      strategy: findLinkEntities,
      component: (props: any) => (
        React.createElement(LinkComponent, {
          ...props,
          calendarId,
          trades,
          onOpenGalleryMode
        })
      ),
    },
  ]);
};
