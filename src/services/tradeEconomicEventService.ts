import { format, parseISO, isSameDay } from 'date-fns';
import { economicCalendarService } from './economicCalendarService';
import { TradeEconomicEvent } from '../types/trade';
import { EconomicEvent, ImpactLevel, Currency } from '../types/economicCalendar';
import { logger } from '../utils/logger';
import { DEFAULT_FILTER_SETTINGS } from '../components/economicCalendar/EconomicCalendarDrawer';

/**
 * Service for fetching and managing economic events related to trades
 * Optimized to fetch only high/medium impact events and store minimal data
 */
export class TradeEconomicEventService {
  
  /**
   * Get session time ranges in UTC for a given trade date
   */
  private getSessionTimeRange(session: string, tradeDate: Date): { start: Date; end: Date } {
    const year = tradeDate.getFullYear();
    const month = tradeDate.getMonth();
    const day = tradeDate.getDate();

    // Determine if it's daylight saving time (approximate: March-October)
    const isDST = month >= 2 && month <= 9;

    let startHour: number, endHour: number;

    switch (session) {
      case 'London':
        startHour = isDST ? 7 : 8;  // 7:00 AM UTC (summer) / 8:00 AM UTC (winter)
        endHour = isDST ? 16 : 17;  // 4:00 PM UTC (summer) / 5:00 PM UTC (winter)
        break;
      case 'NY AM':
        startHour = isDST ? 12 : 13; // 12:00 PM UTC (summer) / 1:00 PM UTC (winter)
        endHour = isDST ? 17 : 18;   // 5:00 PM UTC (summer) / 6:00 PM UTC (winter)
        break;
      case 'NY PM':
        startHour = isDST ? 17 : 18; // 5:00 PM UTC (summer) / 6:00 PM UTC (winter)
        endHour = isDST ? 21 : 22;   // 9:00 PM UTC (summer) / 10:00 PM UTC (winter)
        break;
      case 'Asia':
        // Asia session spans midnight, so we need to handle day boundaries
        const asiaStartHour = isDST ? 22 : 23; // 10:00 PM UTC (summer) / 11:00 PM UTC (winter)
        const asiaEndHour = isDST ? 7 : 8;     // 7:00 AM UTC (summer) / 8:00 AM UTC (winter)

        // Start time is on the previous day
        const startDate = new Date(year, month, day - 1, asiaStartHour, 0, 0);
        const endDate = new Date(year, month, day, asiaEndHour, 0, 0);
        return { start: startDate, end: endDate };
      default:
        // Default to full day range if session is unknown
        startHour = 0;
        endHour = 23;
    }

    const start = new Date(year, month, day, startHour, 0, 0);
    const end = new Date(year, month, day, endHour, 59, 59);

    return { start, end };
  }

  /**
   * Check if an economic event falls within a trade's session range
   */
  private isEventInTradeSession(event: EconomicEvent, tradeDate: Date, session?: string): boolean {
    if (!session) {
      // If trade has no session, fall back to same day matching
      const eventDate = parseISO(event.date);
      return isSameDay(tradeDate, eventDate);
    }

    // Get the session time range for the trade
    const sessionRange = this.getSessionTimeRange(session, tradeDate);

    // Parse the event time (assuming it's in UTC)
    const eventTime = parseISO(event.timeUtc || event.time);

    // Check if event time falls within the session range
    return eventTime >= sessionRange.start && eventTime <= sessionRange.end;
  }

  /**
   * Convert full EconomicEvent to simplified TradeEconomicEvent
   */
  private convertToTradeEvent(event: EconomicEvent): TradeEconomicEvent {
    return {
      name: event.event,
      flagCode: event.flagCode,
      impact: event.impact,
      currency: event.currency,
      timeUtc: event.timeUtc || event.time
    };
  }

  /**
   * Fetch economic events for a specific trade session and date
   * Only fetches high and medium impact events to optimize performance
   */
  async fetchEventsForTrade(
    tradeDate: Date, 
    session?: string,
    currencies: Currency[] = DEFAULT_FILTER_SETTINGS.currencies
  ): Promise<TradeEconomicEvent[]> {
    try {
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

      // Fetch only high and medium impact events
      const events = await economicCalendarService.fetchEvents(dateRange, {
        currencies,
        impacts: ['High', 'Medium'] as ImpactLevel[]
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
        totalEvents: events.length,
        sessionEvents: tradeEvents.length
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
