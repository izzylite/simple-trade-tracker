import { useEffect, useMemo, useRef, useState } from 'react';
import { getTradeRepository } from '../services/calendarService';
import { economicCalendarService } from '../services/economicCalendarService';
import { getNote } from '../services/notesService';
import type { Trade } from '../types/trade';
import type { EconomicEvent } from '../types/economicCalendar';
import type { Note } from '../types/note';
import { logger } from '../utils/logger';

/**
 * Parse <trade-ref>, <event-ref>, <note-ref> IDs out of a briefing's stored
 * HTML and fetch the referenced entities lazily. Used by TaskResultCard so
 * briefings render rich inline chips (name + P&L + click-through) the same
 * way chat does, but with *fresh* data — briefings live in the DB and the
 * referenced trades/notes may have been edited since.
 *
 * Fetch is gated on `enabled` so collapsed cards don't cost a round-trip
 * until the user opens them. Results are memoised against the parsed IDs,
 * so toggling the same briefing open/closed doesn't re-fetch.
 */

const TRADE_REF_RE = /<trade-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/trade-ref>)?/g;
const EVENT_REF_RE = /<event-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/event-ref>)?/g;
const NOTE_REF_RE = /<note-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/note-ref>)?/g;

function extractIds(html: string, pattern: RegExp): string[] {
  const ids = new Set<string>();
  // Reset lastIndex — the regex is defined at module scope with /g so it
  // retains state between calls. Missing this gave us intermittent empty
  // results when the same pattern was used twice in quick succession.
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

export interface UseBriefingEmbeddedResult {
  embeddedTrades?: Record<string, Trade>;
  embeddedEvents?: Record<string, EconomicEvent>;
  embeddedNotes?: Record<string, Note>;
  loading: boolean;
}

export function useBriefingEmbedded(
  html: string,
  enabled: boolean
): UseBriefingEmbeddedResult {
  const { tradeIds, eventIds, noteIds } = useMemo(
    () => ({
      tradeIds: extractIds(html, TRADE_REF_RE),
      eventIds: extractIds(html, EVENT_REF_RE),
      noteIds: extractIds(html, NOTE_REF_RE),
    }),
    [html]
  );

  const [embeddedTrades, setEmbeddedTrades] = useState<Record<string, Trade>>();
  const [embeddedEvents, setEmbeddedEvents] = useState<Record<string, EconomicEvent>>();
  const [embeddedNotes, setEmbeddedNotes] = useState<Record<string, Note>>();
  const [loading, setLoading] = useState(false);
  const fetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const hasRefs =
      tradeIds.length > 0 || eventIds.length > 0 || noteIds.length > 0;
    if (!hasRefs) return;

    // Skip if we've already fetched the same set of IDs. The key intentionally
    // ignores order — new entries force a re-fetch, but re-mounting with the
    // same IDs won't.
    const key = [
      tradeIds.slice().sort().join(','),
      eventIds.slice().sort().join(','),
      noteIds.slice().sort().join(','),
    ].join('|');
    if (fetchedKeyRef.current === key) return;
    fetchedKeyRef.current = key;

    let cancelled = false;
    setLoading(true);

    const tradeRepo = getTradeRepository();

    const tradesP = Promise.all(
      tradeIds.map(async (id) => {
        try {
          const trade = await tradeRepo.findById(id);
          return trade ? ([id, trade] as const) : null;
        } catch (err) {
          logger.warn(`Failed to fetch trade ${id}:`, err);
          return null;
        }
      })
    );

    const eventsP = Promise.all(
      eventIds.map(async (id) => {
        try {
          const event = await economicCalendarService.getEventById(id);
          return event ? ([id, event] as const) : null;
        } catch (err) {
          logger.warn(`Failed to fetch event ${id}:`, err);
          return null;
        }
      })
    );

    const notesP = Promise.all(
      noteIds.map(async (id) => {
        try {
          const note = await getNote(id);
          return note ? ([id, note] as const) : null;
        } catch (err) {
          logger.warn(`Failed to fetch note ${id}:`, err);
          return null;
        }
      })
    );

    Promise.all([tradesP, eventsP, notesP])
      .then(([tradeEntries, eventEntries, noteEntries]) => {
        if (cancelled) return;
        if (tradeIds.length > 0) {
          setEmbeddedTrades(Object.fromEntries(tradeEntries.filter(Boolean) as Array<readonly [string, Trade]>));
        }
        if (eventIds.length > 0) {
          setEmbeddedEvents(Object.fromEntries(eventEntries.filter(Boolean) as Array<readonly [string, EconomicEvent]>));
        }
        if (noteIds.length > 0) {
          setEmbeddedNotes(Object.fromEntries(noteEntries.filter(Boolean) as Array<readonly [string, Note]>));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, tradeIds, eventIds, noteIds]);

  return { embeddedTrades, embeddedEvents, embeddedNotes, loading };
}
