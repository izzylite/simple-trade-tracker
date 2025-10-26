import React from 'react';
import { useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { ContentState } from 'draft-js';
import { isInternalTradeLink } from '../utils/linkUtils';

interface LinkProps {
  contentState: ContentState;
  entityKey: string;
  children: React.ReactNode;
  calendarId?: string;
  trades?: Array<{ id: string; [key: string]: any }>;
  onOpenGalleryMode?: (trades: any[], initialTradeId?: string, title?: string) => void;
}

export const LinkComponent = ({ 
  contentState, 
  entityKey, 
  children, 
  calendarId, 
  trades, 
  onOpenGalleryMode 
}: LinkProps) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { url } = contentState.getEntity(entityKey).getData();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const linkInfo = isInternalTradeLink(url);

    if (linkInfo.type === 'calendar' && linkInfo.calendarId) {
      // If we have trades and gallery mode function, and this is the current calendar
      if (trades && onOpenGalleryMode && linkInfo.calendarId === calendarId && trades.length > 0) {
        // Open in gallery mode with all trades
        onOpenGalleryMode(trades, undefined, 'All Trades');
      } else {
        // Navigate to the calendar
        navigate(`/calendar/${linkInfo.calendarId}`);
      }
    } else if (linkInfo.type === 'shared' && linkInfo.tradeId) {
      // Check if the trade exists in the current calendar
      const tradeInCurrentCalendar = trades?.find(trade => trade.id === linkInfo.tradeId);

      if (tradeInCurrentCalendar && onOpenGalleryMode && trades) {
        // Trade found in current calendar - open gallery mode directly
        onOpenGalleryMode(trades, linkInfo.tradeId, 'Shared Trade');
      } else {
        // Trade not in current calendar or no gallery mode available - navigate to shared page
        // Add referrer info to help with back navigation
        const currentPath = window.location.pathname;
        navigate(`/shared/${linkInfo.id}`, {
          state: {
            referrer: currentPath,
            referrerCalendarId: calendarId
          }
        });
      }
    } else if (linkInfo.type === 'shared' && linkInfo.id) {
      // Fallback for shared links without extractable tradeId
      navigate(`/shared/${linkInfo.id}`, {
        state: {
          referrer: window.location.pathname,
          referrerCalendarId: calendarId
        }
      });
    } else {
      // For external links, open in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent editor from handling this
  };

  const linkInfo = isInternalTradeLink(url);
  const isInternal = linkInfo.type !== 'external';

  return (
    <span
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      className="rich-editor-link"
      title={isInternal ? `Click to open: ${url}` : `Click to open in new tab: ${url}`}
      style={{
        color: theme.palette.primary.main,
        textDecoration: 'underline',
        textDecorationColor: alpha(theme.palette.primary.main, 0.5),
        textUnderlineOffset: '2px',
        transition: 'all 0.2s ease-in-out',
        cursor: 'pointer',
      }}
    >
      {children}
    </span>
  );
};
