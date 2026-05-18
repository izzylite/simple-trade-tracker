import { useCallback, useEffect, useState } from 'react';
import { useAuthState } from 'contexts/AuthStateContext';
import { EconomicEvent } from 'features/events/types/economicCalendar';
import {
  EventCountKey,
  fetchUserTradeCountsByEventKey,
  makeEventCountKey,
} from 'features/events/services/userTradeEventCountsService';

interface UseUserTradeEventCountsResult {
  getCountForEvent: (ev: EconomicEvent) => number;
}

export function useUserTradeEventCounts(): UseUserTradeEventCountsResult {
  const { user } = useAuthState();
  const [countsMap, setCountsMap] = useState<Map<EventCountKey, number>>(new Map());

  useEffect(() => {
    if (!user?.id) return;
    fetchUserTradeCountsByEventKey(user.id).then(setCountsMap);
  }, [user?.id]);

  const getCountForEvent = useCallback(
    (ev: EconomicEvent) =>
      countsMap.get(makeEventCountKey(ev.event_name, ev.currency, ev.impact)) ?? 0,
    [countsMap]
  );

  return { getCountForEvent };
}
