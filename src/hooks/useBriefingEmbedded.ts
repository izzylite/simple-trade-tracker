import { useEffect, useMemo, useRef, useState } from 'react';
import { getTradeRepository } from '../services/calendarService';
import { economicCalendarService } from '../services/economicCalendarService';
import { getNote } from 'features/notes/services/notesService';
import type { Trade } from '../types/trade';
import type { EconomicEvent } from '../types/economicCalendar';
import type { Note } from 'features/notes/types/note';
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

/**
 * Module-level cache, keyed by the same sorted-ID composite key the effect
 * uses for its in-flight guard. Survives hook unmount, so collapsing/re-
 * expanding (or remounting due to a route hop) doesn't refetch the same
 * trades/events/notes.
 */
type BriefingCacheEntry = {
  trades?: Record<string, Trade>;
  events?: Record<string, EconomicEvent>;
  notes?: Record<string, Note>;
};
const briefingEmbeddedCache = new Map<string, BriefingCacheEntry>();

function buildBriefingKey(
  tradeIds: string[],
  eventIds: string[],
  noteIds: string[]
): string {
  return [
    tradeIds.slice().sort().join(','),
    eventIds.slice().sort().join(','),
    noteIds.slice().sort().join(','),
  ].join('|');
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

  const initialKey = buildBriefingKey(tradeIds, eventIds, noteIds);
  const initialCached = briefingEmbeddedCache.get(initialKey);

  const [embeddedTrades, setEmbeddedTrades] = useState<Record<string, Trade> | undefined>(
    initialCached?.trades
  );
  const [embeddedEvents, setEmbeddedEvents] = useState<Record<string, EconomicEvent> | undefined>(
    initialCached?.events
  );
  const [embeddedNotes, setEmbeddedNotes] = useState<Record<string, Note> | undefined>(
    initialCached?.notes
  );
  const [loading, setLoading] = useState(false);
  const fetchedKeyRef = useRef<string | null>(initialCached ? initialKey : null);

  useEffect(() => {
    if (!enabled) return;

    const hasRefs =
      tradeIds.length > 0 || eventIds.length > 0 || noteIds.length > 0;
    if (!hasRefs) return;

    // Skip if we've already fetched the same set of IDs. The key intentionally
    // ignores order — new entries force a re-fetch, but re-mounting with the
    // same IDs won't. We mark the key as fetched only after the fetch
    // resolves; setting it pre-fetch races with StrictMode's mount→unmount→
    // remount cycle (first run sets the key + cancels its own promise, second
    // run sees the matching key and skips entirely → state never updates).
    const key = buildBriefingKey(tradeIds, eventIds, noteIds);
    if (fetchedKeyRef.current === key) return;

    let cancelled = false;
    // Silent revalidate when we already have cached data — only show shimmer
    // when there's nothing to display yet.
    if (!briefingEmbeddedCache.has(key)) {
      setLoading(true);
    }

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
        const tradesMap = tradeIds.length > 0
          ? Object.fromEntries(tradeEntries.filter(Boolean) as Array<readonly [string, Trade]>)
          : undefined;
        const eventsMap = eventIds.length > 0
          ? Object.fromEntries(eventEntries.filter(Boolean) as Array<readonly [string, EconomicEvent]>)
          : undefined;
        const notesMap = noteIds.length > 0
          ? Object.fromEntries(noteEntries.filter(Boolean) as Array<readonly [string, Note]>)
          : undefined;
        if (tradesMap) setEmbeddedTrades(tradesMap);
        if (eventsMap) setEmbeddedEvents(eventsMap);
        if (notesMap) setEmbeddedNotes(notesMap);
        briefingEmbeddedCache.set(key, {
          trades: tradesMap,
          events: eventsMap,
          notes: notesMap,
        });
        fetchedKeyRef.current = key;
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
