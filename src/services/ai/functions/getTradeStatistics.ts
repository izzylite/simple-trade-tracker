/**
 * Trade statistics functionality for AI trading analysis
 */

import { Trade } from '../../../types/trade';
import { logger } from '../../../utils/logger';
import { GetStatisticsParams, TradingAnalysisResult } from './types';
import { 
  handleCacheKeyResult, 
  simpleTradeData, 
  calculateWinRate, 
  getBestTrade, 
  getWorstTrade, 
  groupTradesByPeriod 
} from './utils';

/**
 * Calculate economic event statistics for trades
 */
export function calculateEconomicEventStats(trades: Trade[], impactFilter?: string): any {
  const tradesWithEvents = trades.filter(trade =>
    trade.economicEvents && trade.economicEvents.length > 0
  );

  if (tradesWithEvents.length === 0) {
    return {
      totalTradesWithEvents: 0,
      percentageWithEvents: 0,
      eventImpactBreakdown: {},
      eventCurrencyBreakdown: {},
      mostCommonEvents: []
    };
  }

  // Filter by impact if specified
  let eventsToAnalyze = tradesWithEvents;
  if (impactFilter && impactFilter !== 'all') {
    eventsToAnalyze = tradesWithEvents.filter(trade =>
      trade.economicEvents!.some(event => event.impact === impactFilter)
    );
  }

  // Calculate impact breakdown
  const impactBreakdown: { [key: string]: { count: number; winRate: number; avgPnl: number } } = {};
  const currencyBreakdown: { [key: string]: { count: number; winRate: number; avgPnl: number } } = {};
  const eventNameCounts: { [key: string]: number } = {};

  eventsToAnalyze.forEach(trade => {
    trade.economicEvents!.forEach(event => {
      // Impact breakdown
      if (!impactBreakdown[event.impact]) {
        impactBreakdown[event.impact] = { count: 0, winRate: 0, avgPnl: 0 };
      }
      impactBreakdown[event.impact].count++;

      // Currency breakdown
      if (!currencyBreakdown[event.currency]) {
        currencyBreakdown[event.currency] = { count: 0, winRate: 0, avgPnl: 0 };
      }
      currencyBreakdown[event.currency].count++;

      // Event name counts
      eventNameCounts[event.name] = (eventNameCounts[event.name] || 0) + 1;
    });
  });

  // Calculate win rates and average P&L for each category
  Object.keys(impactBreakdown).forEach(impact => {
    const tradesForImpact = eventsToAnalyze.filter(trade =>
      trade.economicEvents!.some(event => event.impact === impact)
    );
    impactBreakdown[impact].winRate = calculateWinRate(tradesForImpact);
    impactBreakdown[impact].avgPnl = tradesForImpact.reduce((sum, trade) => sum + trade.amount, 0) / tradesForImpact.length;
  });

  Object.keys(currencyBreakdown).forEach(currency => {
    const tradesForCurrency = eventsToAnalyze.filter(trade =>
      trade.economicEvents!.some(event => event.currency === currency)
    );
    currencyBreakdown[currency].winRate = calculateWinRate(tradesForCurrency);
    currencyBreakdown[currency].avgPnl = tradesForCurrency.reduce((sum, trade) => sum + trade.amount, 0) / tradesForCurrency.length;
  });

  // Get most common events
  const mostCommonEvents = Object.entries(eventNameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    totalTradesWithEvents: tradesWithEvents.length,
    percentageWithEvents: (tradesWithEvents.length / trades.length) * 100,
    eventImpactBreakdown: impactBreakdown,
    eventCurrencyBreakdown: currencyBreakdown,
    mostCommonEvents,
    winRateWithEvents: calculateWinRate(tradesWithEvents),
    winRateWithoutEvents: calculateWinRate(trades.filter(trade =>
      !trade.economicEvents || trade.economicEvents.length === 0
    ))
  };
}

/**
 * Get statistical analysis of trades
 */
export async function getTradeStatistics(
  trades: Trade[],
  params: GetStatisticsParams
): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested trade statistics with params:', params);

    let tradesToAnalyze = [...trades];

    // Filter by specific trade IDs if provided
    if (params.tradeIds && params.tradeIds.length > 0) {
      tradesToAnalyze = tradesToAnalyze.filter(trade =>
        params.tradeIds!.includes(trade.id)
      );
      logger.log(`Filtered to ${tradesToAnalyze.length} trades by trade IDs:`, params.tradeIds);
    }

    // Filter by trade type if specified
    if (params.tradeType && params.tradeType !== 'all') {
      tradesToAnalyze = tradesToAnalyze.filter(trade => {
        if (params.tradeType === 'win') return trade.type === 'win';
        if (params.tradeType === 'loss') return trade.type === 'loss';
        if (params.tradeType === 'breakeven') return trade.type === 'breakeven';
        return true;
      });
    }

    const stats = {
      totalTrades: tradesToAnalyze.length,
      totalPnl: tradesToAnalyze.reduce((sum, trade) => sum + trade.amount, 0),
      winRate: calculateWinRate(tradesToAnalyze),
      averagePnl: tradesToAnalyze.length > 0 ?
        tradesToAnalyze.reduce((sum, trade) => sum + trade.amount, 0) / tradesToAnalyze.length : 0,
      bestTrade: getBestTrade(tradesToAnalyze),
      worstTrade: getWorstTrade(tradesToAnalyze),
      groupedData: groupTradesByPeriod(tradesToAnalyze, params.groupBy || 'month'),
      ...(params.includeEconomicEventStats && {
        economicEventStats: calculateEconomicEventStats(tradesToAnalyze, params.economicEventImpact)
      })
    };

    return handleCacheKeyResult('getTradeStatistics', stats, params.returnCacheKey, simpleTradeData(tradesToAnalyze));

  } catch (error) {
    logger.error('Error in getTradeStatistics:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
