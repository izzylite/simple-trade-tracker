/**
 * Economic events analysis functionality for AI trading analysis
 */

import { Trade } from '../../../types/trade';
import { Calendar } from '../../../types/calendar';
import { logger } from '../../../utils/logger';
import { economicCalendarService } from '../../economicCalendarService';
import { Currency, ImpactLevel } from '../../../types/economicCalendar';
import { DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS } from '../../../components/economicCalendar/EconomicCalendarDrawer';
import { AnalyzeEconomicEventsParams, FetchEconomicEventsParams, TradingAnalysisResult } from './types';
import { 
  handleCacheKeyResult, 
  simpleTradeData, 
  calculateWinRate, 
  parseDateRange, 
  parseDateRangeForEvents 
} from './utils';
import { calculateEconomicEventStats } from './getTradeStatistics';

/**
 * Analyze economic events correlation with trading performance
 */
export async function analyzeEconomicEvents(
  trades: Trade[],
  params: AnalyzeEconomicEventsParams
): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested economic events analysis with params:', params);

    let tradesWithEvents = trades.filter(trade =>
      trade.economicEvents && trade.economicEvents.length > 0
    );

    let tradesWithoutEvents = trades.filter(trade =>
      !trade.economicEvents || trade.economicEvents.length === 0
    );

    // Apply filters
    if (params.impactLevel && params.impactLevel !== 'all') {
      tradesWithEvents = tradesWithEvents.filter(trade =>
        trade.economicEvents!.some(event => event.impact === params.impactLevel)
      );
    }

    if (params.currency && params.currency !== 'all') {
      tradesWithEvents = tradesWithEvents.filter(trade =>
        trade.economicEvents!.some(event => event.currency === params.currency)
      );
    }

    if (params.eventName) {
      const searchTerm = params.eventName.toLowerCase();
      tradesWithEvents = tradesWithEvents.filter(trade =>
        trade.economicEvents!.some(event =>
          event.name.toLowerCase().includes(searchTerm)
        )
      );
    }

    // Apply date range filter
    if (params.dateRange) {
      const dateFilter = parseDateRange(params.dateRange);
      if (dateFilter) {
        tradesWithEvents = tradesWithEvents.filter(trade =>
          trade.date >= dateFilter.start && trade.date <= dateFilter.end
        );
        tradesWithoutEvents = tradesWithoutEvents.filter(trade =>
          trade.date >= dateFilter.start && trade.date <= dateFilter.end
        );
      }
    }

    // Calculate detailed analysis
    const analysis: any = {
      tradesWithEvents: {
        count: tradesWithEvents.length,
        totalPnl: tradesWithEvents.reduce((sum, trade) => sum + trade.amount, 0),
        winRate: calculateWinRate(tradesWithEvents),
        avgPnl: tradesWithEvents.length > 0 ?
          tradesWithEvents.reduce((sum, trade) => sum + trade.amount, 0) / tradesWithEvents.length : 0
      },
      economicEventStats: calculateEconomicEventStats(tradesWithEvents, params.impactLevel),
      trades: simpleTradeData(tradesWithEvents)
    };

    // Include comparison with trades without events if requested
    if (params.compareWithoutEvents) {
      analysis.tradesWithoutEvents = {
        count: tradesWithoutEvents.length,
        totalPnl: tradesWithoutEvents.reduce((sum, trade) => sum + trade.amount, 0),
        winRate: calculateWinRate(tradesWithoutEvents),
        avgPnl: tradesWithoutEvents.length > 0 ?
          tradesWithoutEvents.reduce((sum, trade) => sum + trade.amount, 0) / tradesWithoutEvents.length : 0
      };

      // Add comparison metrics
      analysis.comparison = {
        winRateDifference: analysis.tradesWithEvents.winRate - analysis.tradesWithoutEvents.winRate,
        avgPnlDifference: analysis.tradesWithEvents.avgPnl - analysis.tradesWithoutEvents.avgPnl,
        totalPnlDifference: analysis.tradesWithEvents.totalPnl - analysis.tradesWithoutEvents.totalPnl
      };
    }

    return handleCacheKeyResult('analyzeEconomicEvents', analysis, params.returnCacheKey, simpleTradeData(tradesWithEvents));

  } catch (error) {
    logger.error('Error in analyzeEconomicEvents:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch economic events from Firebase
 */
export async function fetchEconomicEvents(
  calendar: Calendar | null,
  params: FetchEconomicEventsParams
): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested economic events fetch with params:', params);

    // Parse date range or use specific dates
    let startDate: Date;
    let endDate: Date;

    if (params.dateRange) {
      const dateRange = parseDateRangeForEvents(params.dateRange);
      if (!dateRange) {
        return {
          success: false,
          error: 'Invalid date range format'
        };
      }
      startDate = dateRange.start;
      endDate = dateRange.end;
    } else {
      // Use provided dates or default to next 7 days
      if (params.startDate) {
        // Check if it's a Unix timestamp (number) or date string
        const startTimestamp = parseInt(params.startDate);
        startDate = isNaN(startTimestamp) ? new Date(params.startDate) : new Date(startTimestamp);
      } else {
        startDate = new Date(); // Today
      }

      if (params.endDate) {
        const endTimestamp = parseInt(params.endDate);
        endDate = isNaN(endTimestamp) ? new Date(params.endDate) : new Date(endTimestamp);
      } else {
        endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // Next 7 days
      }
    }

    // Build filters
    const filters: {
      currencies?: Currency[];
      impacts?: ImpactLevel[];
      onlyUpcoming?: boolean;
    } = {};

    if (params.currency && params.currency !== 'all') {
      filters.currencies = [params.currency as Currency];
    }
    else {
      filters.currencies = calendar?.economicCalendarFilters?.currencies || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS.currencies;
    }

    // Only fetch High and Medium impact events to reduce costs and focus on relevant events
    if (params.impact && params.impact !== 'all') {
      filters.impacts = [params.impact as ImpactLevel];
    } else {
      // Default to High and Medium impact only
      filters.impacts = ['High', 'Medium'] as ImpactLevel[];
    }

    // For future events, set onlyUpcoming to true
    if (startDate > new Date()) {
      filters.onlyUpcoming = true;
    }

    // Set default limit to prevent expensive Firebase reads
    const defaultLimit = 50; // Reasonable default for chat responses
    const maxLimit = 300; // Maximum allowed limit
    const effectiveLimit = params.limit
      ? Math.min(params.limit, maxLimit)
      : defaultLimit;

    // Use pagination to limit Firebase reads
    const paginatedResult = await economicCalendarService.fetchEventsPaginated(
      { start: startDate, end: endDate },
      { pageSize: effectiveLimit },
      filters
    );

    const limitedEvents = paginatedResult.events;
    logger.log(`Fetched ${limitedEvents.length} economic events from Firebase`);

    // Sort by unixTimestamp if available, otherwise by time
    limitedEvents.sort((a, b) => {
      const timeA = a.unixTimestamp || new Date(a.timeUtc).getTime();
      const timeB = b.unixTimestamp || new Date(b.timeUtc).getTime();
      return timeA - timeB;
    });

    const resultData = {
      events: limitedEvents,
      count: limitedEvents.length,
      hasMore: paginatedResult.hasMore,
      limitApplied: effectiveLimit,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      filters: {
        currency: params.currency || 'all',
        impact: params.impact || 'all'
      }
    };

    // No trade IDs for economic events
    return handleCacheKeyResult('fetchEconomicEvents', resultData, params.returnCacheKey, limitedEvents);

  } catch (error) {
    logger.error('Error in fetchEconomicEvents:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
