/**
 * HTML Message Renderer Component
 * Safely renders HTML-formatted messages with proper styling.
 *
 * Inline references (<trade-ref/>, <event-ref/>, <note-ref/>, <tag-chip>) are
 * converted to placeholder <span data-orion-ref-*> elements before sanitize,
 * the whole HTML is rendered once via dangerouslySetInnerHTML, and React
 * chips are mounted into those spans via createPortal. This preserves true
 * inline flow — a chip mid-paragraph stays mid-paragraph, with surrounding
 * punctuation untouched. The previous "split at chip → emit a block per
 * slice" approach broke paragraphs whenever a chip appeared inline.
 */

import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Note as NoteIcon
} from '@mui/icons-material';
import DOMPurify from 'dompurify';
import ImageZoomDialog, { ImageZoomProp } from '../ImageZoomDialog';
import type { Trade } from '../../types/trade';
import type { EconomicEvent } from '../../types/economicCalendar';
import type { Note } from '../../types/note';
import { getTagChipStyles } from '../../utils/tagColors';

// Convert inline reference tags to placeholder <span> elements that survive
// DOMPurify and can host React chips via createPortal. Spans render as
// inline (zero width when empty) so they sit naturally between surrounding
// prose words — chips appear exactly where Orion placed them.
const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const preprocessRefs = (html: string): string => {
  return html
    .replace(
      /<trade-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/trade-ref>)?/g,
      (_, id) => `<span data-orion-ref-type="trade" data-orion-ref-id="${escapeAttr(id)}"></span>`
    )
    .replace(
      /<event-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/event-ref>)?/g,
      (_, id) => `<span data-orion-ref-type="event" data-orion-ref-id="${escapeAttr(id)}"></span>`
    )
    .replace(
      /<note-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/note-ref>)?/g,
      (_, id) => `<span data-orion-ref-type="note" data-orion-ref-id="${escapeAttr(id)}"></span>`
    )
    .replace(
      /<tag-chip>([\s\S]*?)<\/tag-chip>/g,
      (_, name) => {
        const tagName = name.replace(/<[^>]*>/g, '').trim();
        if (!tagName) return '';
        return `<span data-orion-ref-type="tag" data-orion-ref-name="${escapeAttr(tagName)}"></span>`;
      }
    );
};

interface PlaceholderInfo {
  el: HTMLElement;
  type: 'trade' | 'event' | 'note' | 'tag';
  id?: string;
  name?: string;
}

interface HtmlMessageRendererProps {
  html: string;
  textColor?: string;
  embeddedTrades?: Record<string, Trade>;
  embeddedEvents?: Record<string, EconomicEvent>;
  embeddedNotes?: Record<string, Note>;
  onTradeClick?: (tradeId: string, contextTrades: Trade[]) => void;
  onEventClick?: (event: EconomicEvent) => void;
  onNoteClick?: (noteId: string) => void;
  trades?: Trade[];
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
  // Defensive default for legacy briefings saved before content_html was
  // made non-null (otherwise this throws inside replace()).
  const safeHtml = typeof html === 'string' ? html : '';
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [imageZoomProp, setImageZoomProp] = useState<ImageZoomProp | null>(null);
  const [placeholders, setPlaceholders] = useState<PlaceholderInfo[]>([]);

  // Live trades take precedence over embedded snapshots so chips reflect edits.
  const liveTradesMap = useMemo(() => {
    const map = new Map<string, Trade>();
    trades.forEach(trade => map.set(trade.id, trade));
    return map;
  }, [trades]);

  const mergedEmbeddedTrades = useMemo(() => {
    if (!embeddedTrades) return undefined;
    const merged: Record<string, Trade> = {};
    Object.entries(embeddedTrades).forEach(([tradeId, embeddedTrade]) => {
      const liveTrade = liveTradesMap.get(tradeId);
      merged[tradeId] = liveTrade || embeddedTrade;
    });
    return merged;
  }, [embeddedTrades, liveTradesMap]);

  // Preprocess refs → sanitize once. This single string is the rendered HTML.
  // ADD_ATTR (vs ALLOWED_ATTR) extends the default allowlist instead of
  // replacing it, and ALLOW_DATA_ATTR is set explicitly so the data-* attrs
  // on our placeholder spans aren't stripped under any DOMPurify defaults.
  const sanitizedHtml = useMemo(() => {
    const purify = DOMPurify(window);
    return purify.sanitize(preprocessRefs(safeHtml), {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'span', 'div', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption'
      ],
      ADD_ATTR: ['data-orion-ref-type', 'data-orion-ref-id', 'data-orion-ref-name'],
      ALLOW_DATA_ATTR: true,
      KEEP_CONTENT: true
    });
  }, [safeHtml]);

  // Stable object so React's dangerouslySetInnerHTML doesn't re-apply
  // innerHTML when only `placeholders` state changes — re-application
  // would destroy the placeholder DOM nodes our portals are mounted into.
  const dangerousHtml = useMemo(
    () => ({ __html: sanitizedHtml }),
    [sanitizedHtml]
  );

  // After every html change, re-find placeholder spans so portals can mount
  // into the freshly inserted DOM. dangerouslySetInnerHTML replaces the
  // subtree, so old placeholder refs are stale — we have to re-query.
  // useLayoutEffect runs synchronously after DOM mutation but before paint,
  // which avoids any flicker between the spans appearing and chips mounting.
  useLayoutEffect(() => {
    if (!containerRef.current) {
      setPlaceholders([]);
      return;
    }
    const els = containerRef.current.querySelectorAll<HTMLElement>(
      '[data-orion-ref-type]'
    );
    const found: PlaceholderInfo[] = Array.from(els).map(el => ({
      el,
      type: el.getAttribute('data-orion-ref-type') as PlaceholderInfo['type'],
      id: el.getAttribute('data-orion-ref-id') ?? undefined,
      name: el.getAttribute('data-orion-ref-name') ?? undefined,
    }));
    setPlaceholders(found);
  }, [sanitizedHtml]);

  // Image URLs for the zoom dialog — parse from the same sanitized output
  // so the indexes stay aligned with the DOM the user clicks.
  const imageUrls = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedHtml, 'text/html');
    const images = doc.querySelectorAll('img');
    return Array.from(images).map(img => img.src);
  }, [sanitizedHtml]);

  // Image-click delegation. One handler on the container survives image
  // re-renders; we walk imageUrls by index to find which one was clicked.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        e.preventDefault();
        e.stopPropagation();
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
    container.addEventListener('click', handleContainerClick);
    return () => container.removeEventListener('click', handleContainerClick);
  }, [imageUrls]);

  // Pointer/select styling on rendered images.
  useEffect(() => {
    if (!containerRef.current) return;
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;
      const images = containerRef.current.querySelectorAll('img');
      images.forEach(img => {
        (img as HTMLImageElement).style.cursor = 'pointer';
        (img as HTMLImageElement).style.userSelect = 'none';
      });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [sanitizedHtml]);

  // Build the chip element for a placeholder. Returns null when the
  // referenced data isn't embedded (matches the previous behaviour where
  // missing refs simply rendered nothing).
  const renderChipFor = (p: PlaceholderInfo): React.ReactNode => {
    if (p.type === 'trade' && p.id && mergedEmbeddedTrades?.[p.id]) {
      const trade = mergedEmbeddedTrades[p.id];
      const contextTrades = Object.values(mergedEmbeddedTrades);
      const isWin = trade.trade_type === 'win';
      const isLoss = trade.trade_type === 'loss';
      const pnlColor = isWin ? '#4caf50' : isLoss ? '#f44336' : theme.palette.text.secondary;
      const bgColor = isWin
        ? alpha('#4caf50', 0.15)
        : isLoss
          ? alpha('#f44336', 0.15)
          : alpha(theme.palette.text.primary, 0.08);

      return (
        <Chip
          icon={isWin
            ? <TrendingUpIcon sx={{ fontSize: '0.85rem !important', color: `${pnlColor} !important` }} />
            : isLoss
              ? <TrendingDownIcon sx={{ fontSize: '0.85rem !important', color: `${pnlColor} !important` }} />
              : undefined}
          label={`${trade.name || 'Trade'} ${isLoss ? '-' : '+'}$${Math.abs(trade.amount).toLocaleString()}`}
          size="small"
          onClick={() => onTradeClick?.(trade.id, contextTrades)}
          sx={{
            display: 'inline-flex',
            verticalAlign: 'middle',
            height: 22,
            fontSize: '0.75rem',
            fontWeight: 600,
            mx: 0.25,
            backgroundColor: bgColor,
            color: pnlColor,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: isWin
                ? alpha('#4caf50', 0.25)
                : isLoss
                  ? alpha('#f44336', 0.25)
                  : alpha(theme.palette.text.primary, 0.15),
            },
            '& .MuiChip-icon': {
              marginLeft: '4px',
            },
          }}
        />
      );
    }

    if (p.type === 'event' && p.id && embeddedEvents?.[p.id]) {
      const event = embeddedEvents[p.id];
      const impactColor = event.impact === 'High'
        ? '#f44336'
        : event.impact === 'Medium'
          ? '#ff9800'
          : '#4caf50';
      return (
        <Chip
          label={
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              {event.flag_url && (
                <img
                  src={event.flag_url}
                  alt={event.currency}
                  className="event-chip-flag"
                  style={{
                    width: 14,
                    height: 10,
                    minHeight: 'unset',
                    maxHeight: 10,
                    borderRadius: 1,
                    objectFit: 'cover',
                    display: 'inline-block',
                    backgroundColor: 'transparent',
                  }}
                />
              )}
              <span>{event.event_name}</span>
            </Box>
          }
          size="small"
          onClick={() => onEventClick?.(event)}
          sx={{
            display: 'inline-flex',
            verticalAlign: 'middle',
            height: 22,
            fontSize: '0.75rem',
            fontWeight: 600,
            mx: 0.25,
            backgroundColor: alpha(impactColor, 0.12),
            color: impactColor,
            cursor: 'pointer',
            '&:hover': { backgroundColor: alpha(impactColor, 0.22) },
          }}
        />
      );
    }

    if (p.type === 'note' && p.id && embeddedNotes?.[p.id]) {
      const note = embeddedNotes[p.id];
      return (
        <Chip
          icon={<NoteIcon sx={{ fontSize: '0.85rem !important', color: 'inherit !important' }} />}
          label={note.title || 'Note'}
          size="small"
          onClick={() => onNoteClick?.(p.id!)}
          sx={{
            display: 'inline-flex',
            verticalAlign: 'middle',
            height: 22,
            fontSize: '0.75rem',
            fontWeight: 600,
            mx: 0.25,
            backgroundColor: alpha(theme.palette.info.main, 0.12),
            color: theme.palette.info.main,
            cursor: 'pointer',
            '&:hover': { backgroundColor: alpha(theme.palette.info.main, 0.22) },
            '& .MuiChip-icon': { marginLeft: '4px' },
          }}
        />
      );
    }

    if (p.type === 'tag' && p.name) {
      return (
        <Chip
          label={p.name}
          size="small"
          sx={{
            ...getTagChipStyles(p.name, theme),
            display: 'inline-flex',
            verticalAlign: 'middle',
            height: 20,
            fontSize: '0.75rem',
            mx: 0.25,
            cursor: 'default',
          }}
        />
      );
    }

    return null;
  };

  return (
    <>
      <Box
        ref={containerRef}
        sx={{
          fontSize: '0.92rem',
          lineHeight: 1.8,
          color: textColor,
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          '& p': {
            margin: '0.75rem 0',
            lineHeight: 1.8
          },
          '& strong': { fontWeight: 600 },
          '& em': { fontStyle: 'italic' },
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
            margin: '0.75rem 0',
            paddingLeft: '1.5rem'
          },
          '& li': {
            margin: '0.5rem 0',
            lineHeight: 1.8
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
            '&:hover': { opacity: 0.8 }
          },
          '& img:not(.event-chip-flag)': {
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
          },
          '& table': {
            width: '100%',
            borderCollapse: 'collapse',
            margin: '0.75rem 0',
            fontSize: '0.88em'
          },
          '& th, & td': {
            padding: '0.4rem 0.6rem',
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
            textAlign: 'left',
            verticalAlign: 'top'
          },
          '& th': {
            fontWeight: 600,
            backgroundColor: alpha(theme.palette.text.primary, 0.04)
          },
          // Empty placeholder spans should be inline & take no space until
          // the React chip portal mounts inside them.
          '& span[data-orion-ref-type]': {
            display: 'inline'
          }
        }}
        dangerouslySetInnerHTML={dangerousHtml}
      />

      {/* Mount each chip into its placeholder span via portal so the chip
          sits inside the original paragraph and stays inline with the
          surrounding text. */}
      {placeholders.map((p, i) => {
        const chip = renderChipFor(p);
        if (!chip) return null;
        return <React.Fragment key={`portal-${i}`}>{createPortal(chip, p.el)}</React.Fragment>;
      })}

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
