import { format, parseISO, isSameDay } from 'date-fns';
import { economicCalendarService } from './economicCalendarService';
import { TradeEconomicEvent } from '../types/dualWrite';
import { EconomicEvent, ImpactLevel, Currency } from '../types/economicCalendar';
import { logger } from '../utils/logger';
import { DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../components/economicCalendar/EconomicCalendarDrawer';
import { getSessionTimeRange, type TradingSession } from '../utils/sessionTimeUtils';
 

// Currency pair mapping interface
  interface CurrencyPairMapping {
    pair: string;
    currencies: Currency[];
    category: 'major' | 'minor' | 'exotic' | 'crypto' | 'commodity';
  }
  
  // Predefined currency pairs with their associated currencies for economic event filtering
  const CURRENCY_PAIR_MAPPINGS: CurrencyPairMapping[] = [
    // Major pairs
    { pair: 'EURUSD', currencies: ['EUR', 'USD'], category: 'major' },
    { pair: 'GBPUSD', currencies: ['GBP', 'USD'], category: 'major' },
    { pair: 'USDJPY', currencies: ['USD', 'JPY'], category: 'major' },
    { pair: 'AUDUSD', currencies: ['AUD', 'USD'], category: 'major' },
    { pair: 'USDCAD', currencies: ['USD', 'CAD'], category: 'major' },
    { pair: 'NZDUSD', currencies: ['NZD', 'USD'], category: 'major' },
    { pair: 'USDCHF', currencies: ['USD', 'CHF'], category: 'major' },
  
    // Cross pairs (EUR crosses)
    { pair: 'EURJPY', currencies: ['EUR', 'JPY'], category: 'minor' },
    { pair: 'EURGBP', currencies: ['EUR', 'GBP'], category: 'minor' },
    { pair: 'EURAUD', currencies: ['EUR', 'AUD'], category: 'minor' },
    { pair: 'EURCAD', currencies: ['EUR', 'CAD'], category: 'minor' },
    { pair: 'EURCHF', currencies: ['EUR', 'CHF'], category: 'minor' },
    { pair: 'EURNZD', currencies: ['EUR', 'NZD'], category: 'minor' },
  
    // Cross pairs (GBP crosses)
    { pair: 'GBPJPY', currencies: ['GBP', 'JPY'], category: 'minor' },
    { pair: 'GBPAUD', currencies: ['GBP', 'AUD'], category: 'minor' },
    { pair: 'GBPCAD', currencies: ['GBP', 'CAD'], category: 'minor' },
    { pair: 'GBPCHF', currencies: ['GBP', 'CHF'], category: 'minor' },
    { pair: 'GBPNZD', currencies: ['GBP', 'NZD'], category: 'minor' },
  
    // Cross pairs (JPY crosses)
    { pair: 'AUDJPY', currencies: ['AUD', 'JPY'], category: 'minor' },
    { pair: 'CADJPY', currencies: ['CAD', 'JPY'], category: 'minor' },
    { pair: 'CHFJPY', currencies: ['CHF', 'JPY'], category: 'minor' },
    { pair: 'NZDJPY', currencies: ['NZD', 'JPY'], category: 'minor' },
  
    // Other cross pairs
    { pair: 'AUDCAD', currencies: ['AUD', 'CAD'], category: 'minor' },
    { pair: 'AUDCHF', currencies: ['AUD', 'CHF'], category: 'minor' },
    { pair: 'AUDNZD', currencies: ['AUD', 'NZD'], category: 'minor' },
    { pair: 'CADCHF', currencies: ['CAD', 'CHF'], category: 'minor' },
    { pair: 'NZDCAD', currencies: ['NZD', 'CAD'], category: 'minor' },
    { pair: 'NZDCHF', currencies: ['NZD', 'CHF'], category: 'minor' },
  
    // Commodities (Gold/Silver vs USD)
    { pair: 'XAUUSD', currencies: ['USD'], category: 'commodity' },
    { pair: 'XAGUSD', currencies: ['USD'], category: 'commodity' },
  
    // Crypto (vs USD)
    { pair: 'BTCUSD', currencies: ['USD'], category: 'crypto' },
    { pair: 'ETHUSD', currencies: ['USD'], category: 'crypto' },
  ];
  
  // Extract just the pair names for the UI
  export const CURRENCY_PAIRS = CURRENCY_PAIR_MAPPINGS.map(mapping => mapping.pair);
  
  // Utility function to get currencies for a given pair
  export const getCurrenciesForPair = (pair: string): Currency[] => {
    const mapping = CURRENCY_PAIR_MAPPINGS.find(m => m.pair === pair);
    return mapping ? mapping.currencies : [];
  };
  
  // Utility function to extract currency pairs from trade tags
  export const extractCurrencyPairsFromTags = (tags: string[]): string[] => {
    const pairTags = tags.filter(tag => tag.startsWith('pair:'));
    return pairTags.map(tag => tag.replace('pair:', ''));
  };
  
  // Utility function to get all relevant currencies from trade tags
  export const getRelevantCurrenciesFromTags = (tags: string[]): Currency[] => {
    const pairs = extractCurrencyPairsFromTags(tags);
    const currencies = new Set<Currency>();
  
    pairs.forEach(pair => {
      const pairCurrencies = getCurrenciesForPair(pair);
      pairCurrencies.forEach(currency => currencies.add(currency));
    });
  
    return Array.from(currencies);
  };
  
  // Export the currency pair mappings for use in other components/services
  export const getCurrencyPairMappings = (): CurrencyPairMapping[] => {
    return CURRENCY_PAIR_MAPPINGS;
  };
  
  // Utility function to get pair category
  export const getPairCategory = (pair: string): string => {
    const mapping = CURRENCY_PAIR_MAPPINGS.find(m => m.pair === pair);
    return mapping ? mapping.category : 'unknown';
  };

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
      flag_code: event.flagCode,
      impact: event.impact,
      currency: event.currency,
      time_utc: event.timeUtc || event.time
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
