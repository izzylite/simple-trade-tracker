/**
 * Embed Data Fetcher
 * Extracts trade_id and event_id references from AI response and fetches full data
 */

import { createClient } from 'supabase';
import type { Trade, EconomicEvent } from './types.ts';

export interface EmbeddedData {
  trades: Map<string, Trade>;
  events: Map<string, EconomicEvent>;
}

export interface InlineReference {
  type: 'trade' | 'event';
  id: string;
  position: number;
}

/**
 * Extract inline references from AI response text
 * Looks for patterns like:
 * - HTML tags (preferred): <trade-ref id="abc-123"/>, <event-ref id="xyz-789"/>
 * - HTML tags (legacy): <trade-ref id="abc-123"></trade-ref>, <event-ref id="xyz-789"></event-ref>
 * - Legacy format: trade_id:abc-123-def, event_id:xyz-789
 */
export function extractInlineReferences(text: string): InlineReference[] {
  const references: InlineReference[] = [];

  // Pattern 1: HTML tags (primary format)
  // Matches: <trade-ref id="uuid"/> (preferred) or <trade-ref id="uuid"></trade-ref> (legacy)
  const tradeTagPattern = /<trade-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/trade-ref>)?/gi;
  const eventTagPattern = /<event-ref\s+id="([a-zA-Z0-9-_]+)"(?:\s*\/)?>(?:<\/event-ref>)?/gi;

  let match;

  // Extract trade references from HTML tags
  while ((match = tradeTagPattern.exec(text)) !== null) {
    references.push({
      type: 'trade',
      id: match[1],
      position: match.index
    });
  }

  // Extract event references from HTML tags
  while ((match = eventTagPattern.exec(text)) !== null) {
    references.push({
      type: 'event',
      id: match[1],
      position: match.index
    });
  }

  // Pattern 2: Legacy format (for backwards compatibility)
  // Matches: trade_id:uuid or event_id:uuid
  const inlinePattern = /(trade_id|event_id):([a-zA-Z0-9-_]+)/gi;
  while ((match = inlinePattern.exec(text)) !== null) {
    const [fullMatch, typePrefix, id] = match;
    const type = typePrefix.toLowerCase() === 'trade_id' ? 'trade' : 'event';

    references.push({
      type,
      id,
      position: match.index
    });
  }

  return references;
}

/**
 * Fetch trade data from database using Supabase service key
 */
async function fetchTrades(
  tradeIds: string[],
  supabaseUrl: string,
  serviceKey: string,
  userId: string
): Promise<Map<string, Trade>> {
  const tradeMap = new Map<string, Trade>();

  if (tradeIds.length === 0) return tradeMap;

  try {
    console.log('[embedDataFetcher] Fetching trades:', tradeIds);

    // Create Supabase client with service key (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch trades directly from database
    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .in('id', tradeIds);

    if (error) {
      console.error('[embedDataFetcher] Error fetching trades:', error);
      return tradeMap;
    }

    if (trades) {
      console.log('[embedDataFetcher] Fetched trades count:', trades.length);
      // Map trades by ID
      trades.forEach((trade: Trade) => {
        if (trade.id) {
          tradeMap.set(trade.id, trade);
        }
      });
    }
  } catch (error) {
    console.error('[embedDataFetcher] Error fetching trades:', error);
  }

  return tradeMap;
}

/**
 * Fetch economic event data from database using Supabase service key
 */
async function fetchEconomicEvents(
  eventIds: string[],
  supabaseUrl: string,
  serviceKey: string
): Promise<Map<string, EconomicEvent>> {
  const eventMap = new Map<string, EconomicEvent>();

  if (eventIds.length === 0) return eventMap;

  try {
    console.log('[embedDataFetcher] Fetching events:', eventIds);

    // Create Supabase client with service key
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch events directly from database
    const { data: events, error } = await supabase
      .from('economic_events')
      .select('*')
      .in('id', eventIds);

    if (error) {
      console.error('[embedDataFetcher] Error fetching events:', error);
      return eventMap;
    }

    if (events) {
      console.log('[embedDataFetcher] Fetched events count:', events.length);
      // Map events by ID (types already match database schema in snake_case)
      events.forEach((event: EconomicEvent) => {
        if (event.id) {
          eventMap.set(event.id, event);
        }
      });
    }
  } catch (error) {
    console.error('[embedDataFetcher] Error fetching events:', error);
  }

  return eventMap;
}

/**
 * Main function: Extract references and fetch all embedded data
 */
export async function fetchEmbeddedData(
  responseText: string,
  supabaseUrl: string,
  serviceKey: string,
  userId: string
): Promise<EmbeddedData> {
  console.log('[embedDataFetcher] Input text:', responseText.substring(0, 200));

  // Extract all inline references
  const references = extractInlineReferences(responseText);
  console.log('[embedDataFetcher] Extracted references:', references);

  // Separate trade IDs and event IDs
  const tradeIds = references
    .filter(ref => ref.type === 'trade')
    .map(ref => ref.id);

  const eventIds = references
    .filter(ref => ref.type === 'event')
    .map(ref => ref.id);

  // Remove duplicates
  const uniqueTradeIds = [...new Set(tradeIds)];
  const uniqueEventIds = [...new Set(eventIds)];

  // Fetch data in parallel using direct Supabase client
  const [trades, events] = await Promise.all([
    fetchTrades(uniqueTradeIds, supabaseUrl, serviceKey, userId),
    fetchEconomicEvents(uniqueEventIds, supabaseUrl, serviceKey)
  ]);

  return {
    trades,
    events
  };
}
