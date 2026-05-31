import { format, parseISO, isSameDay } from 'date-fns';
import { economicCalendarService } from 'features/events/services/economicCalendarService';
import { TradeEconomicEvent } from 'features/calendar/types/dualWrite';
import { EconomicEvent, ImpactLevel, Currency } from 'features/events/types/economicCalendar';
import { logger } from 'utils/logger';
import { DEFAULT_FILTER_SETTINGS as DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from 'features/events/hooks/useEconomicCalendarFilters';
import { getSessionTimeRange, type TradingSession } from 'utils/sessionTimeUtils';
import { cleanEventNameForPinning } from 'features/events/utils/eventNameUtils';

/**
 * Service for fetching and managing economic events related to trades
 * Optimized to fetch only high/medium impact events and store minimal data
 */
export class TradeEconomicEventService {
  
  
  
  /**
   * Get session time ranges in UTC for a given trade date
   * Uses the shared session time utility for consistent DST handling
   */
  getSessionTimeRange(session: string, tradeDate: Date): { start: Date; end: Date } {
    return getSessionTimeRange(session as TradingSession, tradeDate);
  }

  /**
   * Check if an economic event falls within a trade's session range
   */
  private isEventInTradeSession(event: EconomicEvent, tradeDate: Date, session?: string): boolean {
    if (!session) {
      // If trade has no session, fall back to same day matching
      const eventDate = parseISO(event.event_date);
      return isSameDay(tradeDate, eventDate);
    }

    // Get the session time range for the trade
    const sessionRange = this.getSessionTimeRange(session, tradeDate);

    // Parse the event time (assuming it's in UTC)
    const eventTime = parseISO(event.time_utc || event.event_time);

    // Check if event time falls within the session range
    return eventTime >= sessionRange.start && eventTime <= sessionRange.end;
  }

  /**
   * Convert full EconomicEvent to simplified TradeEconomicEvent
   * Includes cleaned_name for efficient querying
   */
  private convertToTradeEvent(event: EconomicEvent): TradeEconomicEvent {
    return {
      name: event.event_name,
      cleaned_name: cleanEventNameForPinning(event.event_name).toLowerCase(),
      flag_code: event.flag_code,
      impact: event.impact,
      currency: event.currency,
      time_utc: event.time_utc || event.event_time
    };
  }

  /**
   * Fetch economic events for a specific trade session and date
   * Only fetches high and medium impact events to optimize performance
   * Filters events based on the currencies relevant to the trade's currency pairs
   */
  async fetchEventsForTrade(
    tradeDate: Date,
    session?: string, 
    currencies?: Currency[]
  ): Promise<TradeEconomicEvent[]> {
    try {
      // Determine which currencies to filter for
      let targetCurrencies: Currency[];

      if (currencies) {
        // Use explicitly provided currencies
        targetCurrencies = currencies;
      }   else {
        // Fallback to default currencies
        targetCurrencies = DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS.currencies;
      }

      // Calculate date range based on session
      let startDate: Date, endDate: Date;

      if (session) {
        const sessionRange = this.getSessionTimeRange(session, tradeDate);
        startDate = sessionRange.start;
        endDate = sessionRange.end;
      } else {
        // Fallback to full day range
        startDate = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(), 0, 0, 0);
        endDate = new Date(tradeDate.getFullYear(), tradeDate.getMonth(), tradeDate.getDate(), 23, 59, 59);
      }

      const dateRange = {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      };

      // Fetch only high and medium impact events for the relevant currencies
      const events = await economicCalendarService.fetchEvents(dateRange, {
        currencies: targetCurrencies,
        impacts: ['High', 'Medium'] as ImpactLevel[],
        limit: 100  // Reasonable limit for session range
      });

      // Filter events that fall within the trade session
      const sessionEvents = events.filter(event => 
        this.isEventInTradeSession(event, tradeDate, session)
      );

      // Convert to simplified trade events
      const tradeEvents = sessionEvents.map(event => this.convertToTradeEvent(event));

      logger.log(`📊 Fetched ${tradeEvents.length} economic events for trade session`, {
        date: format(tradeDate, 'yyyy-MM-dd'),
        session: session || 'full-day',
        currencies: targetCurrencies,
        totalEvents: events.length,
        sessionEvents: tradeEvents.length,
      });

      return tradeEvents;
    } catch (error) {
      logger.error('Failed to fetch economic events for trade:', error);
      // Return empty array on error to not block trade creation
      return [];
    }
  }

   
}

// Export singleton instance
export const tradeEconomicEventService = new TradeEconomicEventService();
