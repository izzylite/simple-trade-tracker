/**
 * HTML Message Renderer Component
 * Safely renders HTML-formatted messages with proper styling
 * Supports inline trade, event, and note cards via HTML tags: <trade-ref id="xxx"/>, <event-ref id="xxx"/>, <note-ref id="xxx"/>
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha
} from '@mui/material';
import DOMPurify from 'dompurify';
import ImageZoomDialog, { ImageZoomProp } from '../ImageZoomDialog';
import TradeCard from './TradeCard';
import EventCard from './EventCard';
import { NoteListItem } from '../notes/NoteListItem';
import ExpandableCardList from './ExpandableCardList';
import type { Trade } from '../../types/trade';
import type { EconomicEvent } from '../../types/economicCalendar';
import type { Note } from '../../types/note';
import { TradeEconomicEvent } from '../../types/dualWrite';
import { eventMatchV3 } from '../../utils/eventNameUtils';

interface HtmlMessageRendererProps {
  html: string;
  textColor?: string;
  // Embedded data for inline card replacement
  embeddedTrades?: Record<string, Trade>;
  embeddedEvents?: Record<string, EconomicEvent>;
  embeddedNotes?: Record<string, Note>;
  onTradeClick?: (tradeId: string, contextTrades: Trade[]) => void;
  onEventClick?: (event: EconomicEvent) => void;
  onNoteClick?: (noteId: string) => void;
  trades?: Trade[]; // All trades for calculating event trade counts
}

const HtmlMessageRenderer: React.FC<HtmlMessageRendererProps> = ({
  html,
  textColor = 'text.primary',
  embeddedTrades,
  embeddedEvents,
  embeddedNotes,
  onTradeClick,
  onEventClick,
  onNoteClick,
  trades = []
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [imageZoomProp, setImageZoomProp] = useState<ImageZoomProp | null>(null);

  // Create a map of live trades for O(1) lookup
  const liveTradesMap = useMemo(() => {
    const map = new Map<string, Trade>();
    trades.forEach(trade => {
      map.set(trade.id, trade);
    });
    return map;
  }, [trades]);

  // Merge embedded trades with live data - live data takes precedence
  // This ensures trade cards update when trades are edited
  const mergedEmbeddedTrades = useMemo(() => {
    if (!embeddedTrades) return undefined;

    const merged: Record<string, Trade> = {};
    Object.entries(embeddedTrades).forEach(([tradeId, embeddedTrade]) => {
      // Use live trade data if available, otherwise fall back to embedded snapshot
      const liveTrade = liveTradesMap.get(tradeId);
      merged[tradeId] = liveTrade || embeddedTrade;
    });
    return merged;
  }, [embeddedTrades, liveTradesMap]);

  // Calculate trade count for each embedded event
  const eventTradeCountMap = useMemo(() => {
    const countMap = new Map<string, number>();

    if (!embeddedEvents || trades.length === 0) {
      return countMap;
    }

    Object.entries(embeddedEvents).forEach(([eventId, event]) => {
      const tradeCount = trades.filter(trade => {
        if (!trade.economic_events || trade.economic_events.length === 0) {
          return false;
        }
        return trade.economic_events.some((tradeEvent: TradeEconomicEvent) => {
          return eventMatchV3(tradeEvent, event);
        });
      }).length;

      countMap.set(eventId, tradeCount);
    });

    return countMap;
  }, [embeddedEvents, trades]);

  // Parse HTML into segments with inline cards
  const contentSegments = useMemo(() => {
    if (!embeddedTrades && !embeddedEvents && !embeddedNotes) {
      // No inline cards needed, return single HTML segment
      return [{ type: 'html' as const, content: html }];
    }

    const segments: Array<{ type: 'html' | 'trade' | 'event' | 'note'; content: string; id?: string }> = [];
    let lastIndex = 0;
    let workingHtml = html;

    // Find all inline references (HTML tags: <trade-ref id="xxx"/>, <event-ref id="xxx"/>, <note-ref id="xxx"/>)
    const references: Array<{ type: 'trade' | 'event' | 'note'; id: string; index: number; length: number }> = [];

    // Find trade reference tags (self-closing or with closing tag)
    const tradePattern = /<trade-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/trade-ref>)?/g;
    let match;
    while ((match = tradePattern.exec(workingHtml)) !== null) {
      const tradeId = match[1];
      if (embeddedTrades?.[tradeId]) {
        references.push({
          type: 'trade',
          id: tradeId,
          index: match.index,
          length: match[0].length
        });
      }
    }

    // Find event reference tags
    const eventPattern = /<event-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/event-ref>)?/g;
    while ((match = eventPattern.exec(workingHtml)) !== null) {
      const eventId = match[1];
      if (embeddedEvents?.[eventId]) {
        references.push({
          type: 'event',
          id: eventId,
          index: match.index,
          length: match[0].length
        });
      }
    }

    // Find note reference tags
    const notePattern = /<note-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/note-ref>)?/g;
    while ((match = notePattern.exec(workingHtml)) !== null) {
      const noteId = match[1];
      if (embeddedNotes?.[noteId]) {
        references.push({
          type: 'note',
          id: noteId,
          index: match.index,
          length: match[0].length
        });
      }
    }

    // Sort references by index
    references.sort((a, b) => a.index - b.index);

    // Build segments
    references.forEach(ref => {
      // Add HTML before this reference
      if (ref.index > lastIndex) {
        const htmlSegment = workingHtml.substring(lastIndex, ref.index);
        if (htmlSegment.trim()) {
          segments.push({ type: 'html', content: htmlSegment });
        }
      }

      // Add card segment
      segments.push({
        type: ref.type,
        content: '',
        id: ref.id
      });

      lastIndex = ref.index + ref.length;
    });

    // Add remaining HTML
    if (lastIndex < workingHtml.length) {
      const htmlSegment = workingHtml.substring(lastIndex);
      if (htmlSegment.trim()) {
        segments.push({ type: 'html', content: htmlSegment });
      }
    }

    return segments.length > 0 ? segments : [{ type: 'html' as const, content: html }];
  }, [html, embeddedTrades, embeddedEvents, embeddedNotes]);

  // Sanitize HTML segments
  const sanitizeHtml = (htmlContent: string) => {
    const purify = DOMPurify(window);
    return purify.sanitize(htmlContent, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'span', 'div', 'img'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'width', 'height'],
      KEEP_CONTENT: true
    });
  };

  // Extract image URLs for all HTML segments
  const sanitizedHtml = useMemo(() => {
    return contentSegments
      .filter(seg => seg.type === 'html')
      .map(seg => sanitizeHtml(seg.content))
      .join('');
  }, [contentSegments]);

  // Extract image URLs from sanitized HTML
  const imageUrls = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedHtml, 'text/html');
    const images = doc.querySelectorAll('img');
    const urls = Array.from(images).map(img => img.src);
    return urls;
  }, [sanitizedHtml]);

  // Use event delegation - attach ONE handler to container instead of individual images
  // This way the handler persists even when images are re-rendered
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Handler attached to container that delegates to images
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if clicked element is an image
      if (target.tagName === 'IMG') {
        e.preventDefault();
        e.stopPropagation();

        // Find the index of this image
        const images = container.querySelectorAll('img');
        const index = Array.from(images).indexOf(target as HTMLImageElement);

        if (index !== -1) {
          const isAIChart = imageUrls[index]?.includes('quickchart.io');
          setImageZoomProp({
            selectetdImageIndex: index,
            allImages: imageUrls,
            useSolidBackground: isAIChart
          });
          setImageZoomOpen(true);
        }
      }
    };

    // Attach single handler to container
    container.addEventListener('click', handleContainerClick);

    // Cleanup - remove handler when component unmounts
    return () => {
      container.removeEventListener('click', handleContainerClick);
    };
  }, [imageUrls]); // Only re-attach if imageUrls change

  // Style images with cursor pointer
  useEffect(() => {
    if (!containerRef.current) return;

    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;

      const images = containerRef.current.querySelectorAll('img');
      images.forEach((img) => {
        (img as HTMLImageElement).style.cursor = 'pointer';
        (img as HTMLImageElement).style.userSelect = 'none';
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [sanitizedHtml]);

  const renderContentSegments = () => {
    const nodes: React.ReactNode[] = [];
    let currentTradeNodes: React.ReactNode[] = [];

    const flushTrades = () => {
      if (currentTradeNodes.length === 0) return;

      nodes.push(
        <ExpandableCardList
          key={`trade-list-${nodes.length}`}
          items={currentTradeNodes}
          itemType="trades"
        />
      );

      currentTradeNodes = [];
    };

    const hasTextContent = (htmlSegment: string) => {
      const textOnly = htmlSegment
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim();
      return textOnly.length > 0;
    };

    contentSegments.forEach((segment, index) => {
      if (segment.type === 'trade' && segment.id && mergedEmbeddedTrades?.[segment.id]) {
        const trade = mergedEmbeddedTrades[segment.id];
        const contextTrades = Object.values(mergedEmbeddedTrades);

        currentTradeNodes.push(
          <Box key={`trade-${index}`} sx={{ my: 1 }}>
            <TradeCard
              trade={trade}
              showTags={true}
              onClick={() => onTradeClick?.(trade.id, contextTrades)}
            />
          </Box>
        );

        return;
      }

      if (segment.type === 'html') {
        const hasText = hasTextContent(segment.content);

        // Only flush trades when this HTML has actual text content (e.g. section headers).
        // Decorative HTML like <br> or empty <p> tags should not split trade groups.
        if (hasText) {
          flushTrades();
        }

        // Skip rendering segments that have no visible text content to avoid
        // large blank gaps between sections.
        if (!hasText) {
          return;
        }

        nodes.push(
          <Typography
            key={`html-${index}`}
            component="div"
            sx={{
              color: textColor,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere'
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(segment.content) }}
          />
        );
        return;
      }

      if (segment.type === 'event' && segment.id && embeddedEvents?.[segment.id]) {
        // Events should be rendered as their own block, separate from any trade group
        flushTrades();

        const event = embeddedEvents[segment.id];
        const tradeCount = eventTradeCountMap.get(segment.id) || 0;
        nodes.push(
          <Box key={`event-${index}`} sx={{ my: 1 }}>
            <EventCard
              eventId={segment.id}
              eventData={event}
              onClick={onEventClick}
              compact={false}
              tradeCount={tradeCount}
            />
          </Box>
        );
      }

      if (segment.type === 'note' && segment.id && embeddedNotes?.[segment.id]) {
        // Notes should be rendered as their own block, separate from any trade group
        flushTrades();

        const note = embeddedNotes[segment.id];
        nodes.push(
          <Box key={`note-${index}`} sx={{ my: 1 }}>
            <NoteListItem
              note={note}
              onClick={() => onNoteClick?.(segment.id!)}
            />
          </Box>
        );
      }
    });

    // Flush any remaining trades at the end
    flushTrades();

    return nodes;
  };

  return (
    <>
      <Box
        ref={containerRef}
        sx={{
          '& p': {
            margin: '0.5rem 0',
            lineHeight: 1.5
          },
          '& strong': {
            fontWeight: 600
          },
          '& em': {
            fontStyle: 'italic'
          },
          '& h1, & h2, & h3, & h4, & h5, & h6': {
            margin: '1rem 0 0.5rem 0',
            fontWeight: 600
          },
          '& h1': { fontSize: '1.5rem' },
          '& h2': { fontSize: '1.25rem' },
          '& h3': { fontSize: '1.1rem' },
          '& h4': { fontSize: '1rem' },
          '& h5': { fontSize: '0.95rem' },
          '& h6': { fontSize: '0.9rem' },
          '& ul, & ol': {
            margin: '0.5rem 0',
            paddingLeft: '1.5rem'
          },
          '& li': {
            margin: '0.25rem 0'
          },
          '& blockquote': {
            margin: '0.5rem 0',
            paddingLeft: '1rem',
            borderLeft: `3px solid ${alpha(theme.palette.text.primary, 0.3)}`,
            opacity: 0.8
          },
          '& code': {
            backgroundColor: alpha(theme.palette.text.primary, 0.1),
            padding: '2px 4px',
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.9em'
          },
          '& pre': {
            backgroundColor: alpha(theme.palette.text.primary, 0.05),
            padding: '1rem',
            borderRadius: 1,
            overflowX: 'auto',
            margin: '0.5rem 0'
          },
          '& pre code': {
            backgroundColor: 'transparent',
            padding: 0
          },
          '& a': {
            color: 'primary.main',
            textDecoration: 'underline',
            cursor: 'pointer',
            '&:hover': {
              opacity: 0.8
            }
          },
          '& img': {
            maxWidth: '100%',
            height: 'auto',
            minHeight: 100,
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.paper, 0.8)
              : alpha(theme.palette.grey[100], 0.8),
            maxHeight: '300px',
            borderRadius: 2,
            display: 'block',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'scale(1.02)',
              boxShadow: theme.shadows[4]
            }
          },
          '& sup': {
            fontSize: '0.8em',
            verticalAlign: 'super'
          }
        }}
      >
        {/* Render segments (HTML and cards mixed) */}
        {renderContentSegments()}
      </Box>

      {/* Image Zoom Dialog */}
      {imageZoomProp && (
        <ImageZoomDialog
          open={imageZoomOpen}
          onClose={() => setImageZoomOpen(false)}
          imageProp={imageZoomProp}
        />
      )}
    </>
  );
};

export default HtmlMessageRenderer;

