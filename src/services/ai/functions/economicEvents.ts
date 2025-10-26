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
  calculateWinRate
} from './utils';
import { calculateEconomicEventStats } from './getTradeStatistics';
import { filterEconomicEventFields } from './dataConversion';

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
      trade.economic_events && trade.economic_events.length > 0
    );

    let tradesWithoutEvents = trades.filter(trade =>
      !trade.economic_events || trade.economic_events.length === 0
    );

    // Apply filters
    if (params.impactLevel && params.impactLevel !== 'all') {
      tradesWithEvents = tradesWithEvents.filter(trade =>
        trade.economic_events!.some(event => event.impact === params.impactLevel)
      );
    }

    if (params.currency && params.currency !== 'all') {
      tradesWithEvents = tradesWithEvents.filter(trade =>
        trade.economic_events!.some(event => event.currency === params.currency)
      );
    }

    if (params.eventName) {
      const searchTerm = params.eventName.toLowerCase();
      tradesWithEvents = tradesWithEvents.filter(trade =>
        trade.economic_events!.some(event =>
          event.name.toLowerCase().includes(searchTerm)
        )
      );
    }

    // Apply date range filter
    if (params.dateRange) {
      const startDate = new Date(params.dateRange.start);
      const endDate = new Date(params.dateRange.end);

      tradesWithEvents = tradesWithEvents.filter(trade =>
        trade.trade_date >= startDate && trade.trade_date <= endDate
      );
      tradesWithoutEvents = tradesWithoutEvents.filter(trade =>
        trade.trade_date >= startDate && trade.trade_date <= endDate
      );
    }

    // Calculate detailed analysis
    const analysis: any = {
      tradesWithEvents: {
        count: tradesWithEvents.length,
        total_pnl: tradesWithEvents.reduce((sum, trade) => sum + trade.amount, 0),
        win_rate: calculateWinRate(tradesWithEvents),
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
        total_pnl: tradesWithoutEvents.reduce((sum, trade) => sum + trade.amount, 0),
        win_rate: calculateWinRate(tradesWithoutEvents),
        avgPnl: tradesWithoutEvents.length > 0 ?
          tradesWithoutEvents.reduce((sum, trade) => sum + trade.amount, 0) / tradesWithoutEvents.length : 0
      };

      // Add comparison metrics
      analysis.comparison = {
        winRateDifference: analysis.tradesWithEvents.win_rate - analysis.tradesWithoutEvents.win_rate,
        avgPnlDifference: analysis.tradesWithEvents.avgPnl - analysis.tradesWithoutEvents.avgPnl,
        totalPnlDifference: analysis.tradesWithEvents.total_pnl - analysis.tradesWithoutEvents.total_pnl
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
      startDate = new Date(params.dateRange.start);
      endDate = new Date(params.dateRange.end);
    } else {
      // Default to next 7 days from now
      startDate = new Date(); // Today
      endDate = new Date();
      endDate.setDate(startDate.getDate() + 7);
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
      filters.currencies = calendar?.economic_calendar_filters?.currencies || DEFAULT_ECONOMIC_EVENT_FILTER_SETTINGS.currencies;
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

    // Apply field filtering based on request
    const eventsData = filterEconomicEventFields(limitedEvents, params.fields);

    const resultData = {
      events: eventsData,
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
      },
      includedFields: params.fields || ['all']
    };

    // No trade IDs for economic events
    return handleCacheKeyResult('fetchEconomicEvents', resultData, params.returnCacheKey, eventsData);

  } catch (error) {
    logger.error('Error in fetchEconomicEvents:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


