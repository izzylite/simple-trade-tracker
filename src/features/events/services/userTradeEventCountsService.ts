/**
 * Fetches trade counts per economic event across all of a user's calendars.
 *
 * One query selects only the economic_events JSONB column for the user's
 * trades; aggregation runs client-side. The key is
 * `${cleanedName}|${currency}|${impact}` to mirror the matching logic used
 * by eventMatchV3 and isEventPinned.
 */

import { supabase } from 'config/supabase';
import { cleanEventNameForPinning } from 'features/events/utils/eventNameUtils';

export type EventCountKey = string; // `${cleanedName.toLowerCase()}|${currency}|${impact}`

export function makeEventCountKey(
  eventName: string,
  currency: string,
  impact: string
): EventCountKey {
  return `${cleanEventNameForPinning(eventName).toLowerCase()}|${currency}|${impact}`;
}

export async function fetchUserTradeCountsByEventKey(
  userId: string
): Promise<Map<EventCountKey, number>> {
  const { data, error } = await supabase
    .from('trades')
    .select('economic_events')
    .eq('user_id', userId)
    .not('economic_events', 'is', null);

  if (error || !data) return new Map();

  const counts = new Map<EventCountKey, number>();
  for (const row of data) {
    const events = row.economic_events as Array<{
      cleaned_name?: string;
      currency?: string;
      impact?: string;
    }> | null;
    if (!Array.isArray(events)) continue;
    for (const ev of events) {
      if (!ev.cleaned_name || !ev.currency || !ev.impact) continue;
      const key: EventCountKey = `${ev.cleaned_name.toLowerCase()}|${ev.currency}|${ev.impact}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
