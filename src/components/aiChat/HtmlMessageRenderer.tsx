/**
 * HTML Message Renderer Component
 * Safely renders HTML-formatted messages with proper styling
 * Supports inline trade and event cards via trade_id:xxx and event_id:xxx references
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import DOMPurify from 'dompurify';
import ImageZoomDialog, { ImageZoomProp } from '../ImageZoomDialog';
import TradeCard from './TradeCard';
import EventCard from './EventCard';
import type { Trade } from '../../types/trade';
import type { EconomicEvent } from '../../types/economicCalendar';

interface HtmlMessageRendererProps {
  html: string;
  textColor?: string;
  isUser?: boolean;
  // Embedded data for inline card replacement
  embeddedTrades?: Record<string, Trade>;
  embeddedEvents?: Record<string, EconomicEvent>;
  onTradeClick?: (tradeId: string, contextTrades: Trade[]) => void;
  onEventClick?: (event: EconomicEvent) => void;
}

const HtmlMessageRenderer: React.FC<HtmlMessageRendererProps> = ({
  html,
  textColor = 'text.primary',
  embeddedTrades,
  embeddedEvents,
  onTradeClick,
  onEventClick
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [imageZoomProp, setImageZoomProp] = useState<ImageZoomProp | null>(null);

  // Parse HTML into segments with inline cards
  const contentSegments = useMemo(() => {
    if (!embeddedTrades && !embeddedEvents) {
      // No inline cards needed, return single HTML segment
      return [{ type: 'html' as const, content: html }];
    }

    const segments: Array<{ type: 'html' | 'trade' | 'event'; content: string; id?: string }> = [];
    let lastIndex = 0;
    let workingHtml = html;

    // Find all inline references (HTML tags: <trade-ref id="xxx"/> or <trade-ref id="xxx"></trade-ref>)
    const references: Array<{ type: 'trade' | 'event'; id: string; index: number; length: number }> = [];

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
  }, [html, embeddedTrades, embeddedEvents]);

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
    console.log('[HtmlMessageRenderer] Extracted image URLs:', urls);
    return urls;
  }, [sanitizedHtml]);

  // Add click handlers to images and inject card components after render
  useEffect(() => {
    console.log('[HtmlMessageRenderer] useEffect triggered', {
      hasContainer: !!containerRef.current,
      imageUrlsLength: imageUrls.length,
      imageUrls
    });

    if (!containerRef.current) return;

    // Handle image clicks
    const images = containerRef.current.querySelectorAll('img');
    console.log('[HtmlMessageRenderer] Found images in DOM:', images.length);

    const handleImageClick = (index: number) => {
      console.log('[HtmlMessageRenderer] Image clicked:', index, imageUrls[index]);

      // Check if the clicked image is from QuickChart (AI-generated)
      const isAIChart = imageUrls[index]?.includes('quickchart.io');

      setImageZoomProp({
        selectetdImageIndex: index,
        allImages: imageUrls,
        useSolidBackground: isAIChart
      });
      setImageZoomOpen(true);
    };

    images.forEach((img, index) => {
      img.style.cursor = 'pointer';
      img.onclick = () => handleImageClick(index);
      console.log('[HtmlMessageRenderer] Added click handler to image', index);
    });

    // Cleanup
    return () => {
      images.forEach(img => {
        img.onclick = null;
      });
    };
  }, [sanitizedHtml, imageUrls]);

  // Create a style object for the HTML content
  const htmlStyles = `
    p {
      margin: 0.5rem 0;
      line-height: 1.5;
    }
    
    strong {
      font-weight: 600;
    }
    
    em {
      font-style: italic;
    }
    
    h1, h2, h3, h4, h5, h6 {
      margin: 1rem 0 0.5rem 0;
      font-weight: 600;
    }
    
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.25rem; }
    h3 { font-size: 1.1rem; }
    h4 { font-size: 1rem; }
    h5 { font-size: 0.95rem; }
    h6 { font-size: 0.9rem; }
    
    ul, ol {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }
    
    li {
      margin: 0.25rem 0;
    }
    
    blockquote {
      margin: 0.5rem 0;
      padding-left: 1rem;
      border-left: 3px solid currentColor;
      opacity: 0.8;
    }
    
    code {
      background-color: rgba(0, 0, 0, 0.1);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    
    pre {
      background-color: rgba(0, 0, 0, 0.05);
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0.5rem 0;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    a {
      color: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
    
    a:hover {
      opacity: 0.8;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1rem 0;
      display: block;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    sup {
      font-size: 0.8em;
      vertical-align: super;
    }
  `;

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
          borderRadius: 2,
          margin: '1rem 0',
          display: 'block',
          boxShadow: theme.shadows[2],
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
        {contentSegments.map((segment, index) => {
          if (segment.type === 'html') {
            return (
              <Typography
                key={`html-${index}`}
                component="div"
                sx={{
                  color: textColor,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  display: 'inline'
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(segment.content) }}
              />
            );
          } else if (segment.type === 'trade' && segment.id && embeddedTrades?.[segment.id]) {
            const trade = embeddedTrades[segment.id];
            const contextTrades = Object.values(embeddedTrades);
            return (
              <Box key={`trade-${index}`} sx={{ display: 'inline-block', my: 0.5, mx: 0.5 }}>
                <TradeCard
                  trade={trade}
                  onClick={() => onTradeClick?.(trade.id, contextTrades)}
                  compact={true}
                />
              </Box>
            );
          } else if (segment.type === 'event' && segment.id && embeddedEvents?.[segment.id]) {
            const event = embeddedEvents[segment.id];
            return (
              <Box key={`event-${index}`} sx={{ display: 'inline-block', my: 0.5, mx: 0.5 }}>
                <EventCard
                  eventId={segment.id}
                  eventData={event}
                  onClick={onEventClick}
                  compact={true}
                />
              </Box>
            );
          }
          return null;
        })}
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

