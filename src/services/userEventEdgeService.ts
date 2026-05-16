/**
 * User-level "event edge" lookup.
 *
 * For a given economic-event signature (cleaned name + currency + impact),
 * fetch all trades the user has logged that touch that event across ALL of
 * their calendars, and compute an aggregate Avg R, win rate, and trade
 * count. Powers the "Historical edge" sidebar card on the Events page.
 *
 * RLS on `trades` already restricts to the authenticated user via
 * `user_id = auth.uid()::text`, so we can query the table directly without
 * joining through calendars.
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { cleanEventNameForPinning } from '../utils/eventNameUtils';
import { PinnedEvent } from '../types/dualWrite';

export interface EventEdgeStats {
  /** Pin's event_id (what the caller passed in). */
  eventId: string;
  /** Display name (cleaned). */
  eventName: string;
  /** Total trades from this user that overlap the event signature. */
  tradeCount: number;
  /** Wins / (wins + losses). 0 when no win/loss trades. */
  winRate: number;
  /** Average signed R across trades; sign(pnl) * risk_to_reward. */
  avgR: number | null;
  /** Average signed P&L. */
  avgPnl: number | null;
}

interface MinimalTradeRow {
  pnl: number | null;
  risk_to_reward: number | null;
  trade_type: 'win' | 'loss' | 'breakeven' | string | null;
}

/**
 * Fetch edge stats for every pinned event in parallel. Returns one row per
 * pin; entries with zero matching trades come back with `tradeCount: 0` and
 * `avgR: null` so the UI can show "no data yet" without filtering them out.
 */
export async function fetchEventEdgeForPins(
  pins: PinnedEvent[]
): Promise<EventEdgeStats[]> {
  if (pins.length === 0) return [];

  const results = await Promise.all(
    pins.map(async (pin): Promise<EventEdgeStats> => {
      const eventName = pin.event;
      const cleanedName = cleanEventNameForPinning(eventName).toLowerCase();
      const currency = pin.currency;
      const impact = pin.impact;

      // Need cleaned_name + currency + impact to match a trade's
      // economic_events JSONB entry. If any are missing on the pin we can
      // still partially match by cleaned_name, but the result is fuzzier.
      const eventFilter: Record<string, string> = {
        cleaned_name: cleanedName,
      };
      if (currency) eventFilter.currency = currency;
      if (impact) eventFilter.impact = impact;

      try {
        const { data, error } = await supabase
          .from('trades')
          .select('pnl, risk_to_reward, trade_type')
          .filter('economic_events', 'cs', JSON.stringify([eventFilter]));

        if (error) {
          logger.warn(
            `fetchEventEdgeForPins: query failed for ${eventName}`,
            error
          );
          return emptyRow(pin, eventName);
        }

        const trades = (data ?? []) as MinimalTradeRow[];
        return aggregate(pin, eventName, trades);
      } catch (err) {
        logger.error('fetchEventEdgeForPins error', err);
        return emptyRow(pin, eventName);
      }
    })
  );

  return results;
}

function emptyRow(pin: PinnedEvent, eventName: string): EventEdgeStats {
  return {
    eventId: pin.event_id,
    eventName,
    tradeCount: 0,
    winRate: 0,
    avgR: null,
    avgPnl: null,
  };
}

function aggregate(
  pin: PinnedEvent,
  eventName: string,
  trades: MinimalTradeRow[]
): EventEdgeStats {
  if (trades.length === 0) return emptyRow(pin, eventName);

  let pnlSum = 0;
  let pnlCount = 0;
  let rSum = 0;
  let rCount = 0;
  let wins = 0;
  let losses = 0;

  for (const t of trades) {
    if (t.pnl != null) {
      pnlSum += Number(t.pnl);
      pnlCount += 1;
    }
    if (t.risk_to_reward != null && t.pnl != null) {
      const sign = Number(t.pnl) >= 0 ? 1 : -1;
      rSum += sign * Number(t.risk_to_reward);
      rCount += 1;
    }
    if (t.trade_type === 'win') wins += 1;
    else if (t.trade_type === 'loss') losses += 1;
  }

  const denom = wins + losses;
  return {
    eventId: pin.event_id,
    eventName,
    tradeCount: trades.length,
    winRate: denom > 0 ? wins / denom : 0,
    avgR: rCount > 0 ? rSum / rCount : null,
    avgPnl: pnlCount > 0 ? pnlSum / pnlCount : null,
  };
}
