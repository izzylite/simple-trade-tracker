import { Trade, Calendar } from '../types/dualWrite';
import {
  calculateWinLossStatsAsync,
  calculateTagStatsAsync,
  calculateDailySummaryDataAsync,
  calculateRiskRewardStatsAsync,
  calculateSessionStatsAsync,
  calculateComparisonWinLossDataAsync,
  calculateAllTagsAsync,
  getFilteredTrades,
  TimePeriod
} from '../utils/chartDataUtils';
import { cleanEventNameForPinning } from '../utils/eventNameUtils';

// Helper function to get flag URL
const getFlagUrl = (flagCode?: string, size: string = 'w40'): string => {
  if (!flagCode) return '';
  return `https://flagcdn.com/${size}/${flagCode.toLowerCase()}.png`;
};

export interface PerformanceCalculationResult {
  winLossStats: any;
  tagStats: any[];
  dailySummaryData: any[];
  riskRewardStats: any;
  sessionStats: any[];
  comparisonWinLossData: any[] | null;
  allTags: string[];
  winLossData: any[];
}

export interface CalculationProgress {
  step: string;
  progress: number;
  total: number;
}

export class PerformanceCalculationService {
  private static instance: PerformanceCalculationService;

  public static getInstance(): PerformanceCalculationService {
    if (!PerformanceCalculationService.instance) {
      PerformanceCalculationService.instance = new PerformanceCalculationService();
    }
    return PerformanceCalculationService.instance;
  }

  // Calculate all performance metrics asynchronously with progress reporting
  public async calculatePerformanceMetrics(
    trades: Trade[],
    selectedDate: Date,
    timePeriod: TimePeriod,
    accountBalance: number,
    comparisonTags: string[] = [],
    onProgress?: (progress: CalculationProgress) => void
  ): Promise<PerformanceCalculationResult> {
    const totalSteps = 7;
    let currentStep = 0;

    const reportProgress = (step: string) => {
      currentStep++;
      onProgress?.({ step, progress: currentStep, total: totalSteps });
    };

    // Filter trades first
    const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);

    // Calculate win/loss statistics
    reportProgress('Calculating win/loss statistics...');
    const winLossStats = await calculateWinLossStatsAsync(filteredTrades);

    // Calculate tag statistics
    reportProgress('Analyzing tag performance...');
    const tagStats = await calculateTagStatsAsync(filteredTrades);

    // Calculate daily summary data
    reportProgress('Processing daily summaries...');
    const dailySummaryData = await calculateDailySummaryDataAsync(filteredTrades);

    // Calculate risk to reward statistics
    reportProgress('Computing risk/reward metrics...');
    const riskRewardStats = await calculateRiskRewardStatsAsync(filteredTrades, timePeriod);

    // Calculate session statistics
    reportProgress('Analyzing session performance...');
    const sessionStats = await calculateSessionStatsAsync(filteredTrades, accountBalance);

    // Calculate comparison win/loss data
    reportProgress('Processing comparison data...');
    const comparisonWinLossData = await calculateComparisonWinLossDataAsync(filteredTrades, comparisonTags);

    // Calculate all unique tags
    reportProgress('Finalizing calculations...');
    const allTags = await calculateAllTagsAsync(trades);

    // Calculate win/loss distribution data for pie chart
    const { winners, losers, breakevens } = winLossStats;
    const winLossData = [
      { name: 'Wins', value: winners.total },
      { name: 'Losses', value: losers.total },
      { name: 'Breakeven', value: breakevens?.total || 0 }
    ].filter(item => item.value > 0); // Only include categories with values > 0

    return {
      winLossStats,
      tagStats,
      dailySummaryData,
      riskRewardStats,
      sessionStats,
      comparisonWinLossData,
      allTags,
      winLossData
    };
  }

  // Calculate filtered trades for tag analysis
  public async calculateFilteredTradesForTags(
    trades: Trade[],
    primaryTags: string[],
    secondaryTags: string[]
  ): Promise<Trade[]> {
    // Yield control to prevent UI blocking
    await new Promise(resolve => setTimeout(resolve, 0));

    // If no tags selected, return empty array
    if (primaryTags.length === 0) {
      return [];
    }

    // Filter trades by selected tags
    return trades.filter(trade => {
      // Check if trade has tags
      if (!trade.tags || trade.tags.length === 0) {
        return false;
      }

      // Check if trade has any of the primary tags
      const hasPrimaryTag = primaryTags.some(tag => trade.tags?.includes(tag));
      if (!hasPrimaryTag) {
        return false;
      }

      // If secondary tags are selected, check if trade has all of them
      if (secondaryTags.length > 0) {
        return secondaryTags.every(tag => trade.tags?.includes(tag));
      }

      return true;
    });
  }

  // Calculate economic event correlations asynchronously
  public async calculateEconomicEventCorrelations(
    trades: Trade[],
    selectedCurrency: string,
    selectedImpact: string,
    onProgress?: (progress: CalculationProgress) => void
  ): Promise<{
    losingTradeCorrelations: any[];
    winningTradeCorrelations: any[];
    correlationStats: any;
  }> {
    const totalSteps = 4;
    let currentStep = 0;

    const reportProgress = (step: string) => {
      currentStep++;
      onProgress?.({ step, progress: currentStep, total: totalSteps });
    };

    // Get losing and winning trades
    reportProgress('Filtering trades by outcome...');
    const losingTrades = trades.filter(trade => trade.trade_type === 'loss');
    const winningTrades = trades.filter(trade => trade.trade_type === 'win');

    // Yield control
    await new Promise(resolve => setTimeout(resolve, 0));

    // Helper function to filter events by selected currency
    const filterEventsByCurrency = (events: any[]): any[] => {
      if (selectedCurrency === 'ALL') {
        return events.filter(event => event.impact === selectedImpact);
      }
      return events.filter(event => event.currency === selectedCurrency && event.impact === selectedImpact);
    };

    // Calculate losing trade correlations
    reportProgress('Calculating losing trade correlations...');
    const losingTradeCorrelations = losingTrades.map(trade => {
      const allTradeEvents = trade.economic_events || [];
      const tradeEvents = filterEventsByCurrency(allTradeEvents);

      return {
        trade,
        economic_events: tradeEvents,
        hasHighImpactEvents: tradeEvents.length > 0,
        hasMediumImpactEvents: tradeEvents.length > 0,
        eventCount: tradeEvents.length
      };
    });

    // Yield control
    await new Promise(resolve => setTimeout(resolve, 0));

    // Calculate winning trade correlations
    reportProgress('Calculating winning trade correlations...');
    const winningTradeCorrelations = winningTrades.map(trade => {
      const allTradeEvents = trade.economic_events || [];
      const tradeEvents = filterEventsByCurrency(allTradeEvents);

      return {
        trade,
        economic_events: tradeEvents,
        hasHighImpactEvents: tradeEvents.length > 0,
        hasMediumImpactEvents: tradeEvents.length > 0,
        eventCount: tradeEvents.length
      };
    });

    // Calculate correlation statistics
    reportProgress('Computing correlation statistics...');
    const totalLosingTrades = losingTradeCorrelations.length;
    const totalWinningTrades = winningTradeCorrelations.length;

    if (totalLosingTrades === 0 && totalWinningTrades === 0) {
      return {
        losingTradeCorrelations,
        winningTradeCorrelations,
        correlationStats: {
          totalLosingTrades: 0,
          totalWinningTrades: 0,
          highImpactLossCorrelationRate: 0,
          mediumImpactLossCorrelationRate: 0,
          anyEventLossCorrelationRate: 0,
          highImpactWinCorrelationRate: 0,
          mediumImpactWinCorrelationRate: 0,
          anyEventWinCorrelationRate: 0,
          avgLossWithEvents: 0,
          avgLossWithoutEvents: 0,
          avgWinWithEvents: 0,
          avgWinWithoutEvents: 0,
          mostCommonEventTypes: [],
          impactDistribution: { 'Low': 0, 'Medium': 0, 'High': 0, 'Holiday': 0, 'Non-Economic': 0 }
        }
      };
    }

    // Calculate correlation rates
    const losingTradesWithEvents = losingTradeCorrelations.filter(tc => tc.eventCount > 0);
    const losingTradesWithoutEvents = losingTradeCorrelations.filter(tc => tc.eventCount === 0);
    const winningTradesWithEvents = winningTradeCorrelations.filter(tc => tc.eventCount > 0);
    const winningTradesWithoutEvents = winningTradeCorrelations.filter(tc => tc.eventCount === 0);

    // Calculate most common event types with detailed trade information
    const eventTypeMap = new Map<string, {
      losingTrades: Trade[];
      winningTrades: Trade[];
      totalLoss: number;
      totalWin: number;
      economicEventDetails?: {
        flagCode?: string;
        flagUrl?: string;
      };
    }>();

    // Process losing trades
    losingTradeCorrelations.forEach(tc => {
      tc.economic_events.forEach((event: any) => {
        const existing = eventTypeMap.get(cleanEventNameForPinning(event.name)) || {
          losingTrades: [],
          winningTrades: [],
          totalLoss: 0,
          totalWin: 0
        };
        existing.losingTrades.push(tc.trade);
        existing.totalLoss += Math.abs(tc.trade.amount);

        // Store economic event details (use first occurrence)
        if (!existing.economicEventDetails) {
          existing.economicEventDetails = {
            flagCode: event.flagCode,
            flagUrl: getFlagUrl(event.flagCode)
          };
        }

        eventTypeMap.set(cleanEventNameForPinning(event.name), existing);
      });
    });

    // Process winning trades
    winningTradeCorrelations.forEach(tc => {
      tc.economic_events.forEach((event: any) => {
        const existing = eventTypeMap.get(cleanEventNameForPinning(event.name)) || {
          losingTrades: [],
          winningTrades: [],
          totalLoss: 0,
          totalWin: 0
        };
        existing.winningTrades.push(tc.trade);
        existing.totalWin += tc.trade.amount;

        // Store economic event details (use first occurrence)
        if (!existing.economicEventDetails) {
          existing.economicEventDetails = {
            flagCode: event.flagCode,
            flagUrl: getFlagUrl(event.flagCode)
          };
        }

        eventTypeMap.set(cleanEventNameForPinning(event.name), existing);
      });
    });

    const mostCommonEventTypes = Array.from(eventTypeMap.entries())
      .map(([event, data]) => {
        const totalTrades = data.losingTrades.length + data.winningTrades.length;
        const winRate = totalTrades > 0 ? (data.winningTrades.length / totalTrades) * 100 : 0;

        return {
          event,
          losingTrades: data.losingTrades,
          winningTrades: data.winningTrades,
          totalLoss: data.totalLoss,
          totalWin: data.totalWin,
          avg_loss: data.losingTrades.length > 0 ? data.totalLoss / data.losingTrades.length : 0,
          avg_win: data.winningTrades.length > 0 ? data.totalWin / data.winningTrades.length : 0,
          count: totalTrades,
          winRate,
          economicEventDetails: data.economicEventDetails
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 9);

    // Calculate impact distribution
    const impactDistribution: Record<string, number> = {
      'Low': 0, 'Medium': 0, 'High': 0, 'Holiday': 0, 'Non-Economic': 0
    };

    [...losingTradeCorrelations, ...winningTradeCorrelations].forEach(tc => {
      tc.economic_events.forEach((event: any) => {
        impactDistribution[event.impact]++;
      });
    });

    const correlationStats = {
      totalLosingTrades,
      totalWinningTrades,
      losingTradesWithHighImpact: losingTradesWithEvents.length,
      losingTradesWithMediumImpact: losingTradesWithEvents.length,
      losingTradesWithAnyEvents: losingTradesWithEvents.length,
      winningTradesWithHighImpact: winningTradesWithEvents.length,
      winningTradesWithMediumImpact: winningTradesWithEvents.length,
      winningTradesWithAnyEvents: winningTradesWithEvents.length,
      highImpactLossCorrelationRate: totalLosingTrades > 0 ? (losingTradesWithEvents.length / totalLosingTrades) * 100 : 0,
      mediumImpactLossCorrelationRate: totalLosingTrades > 0 ? (losingTradesWithEvents.length / totalLosingTrades) * 100 : 0,
      anyEventLossCorrelationRate: totalLosingTrades > 0 ? (losingTradesWithEvents.length / totalLosingTrades) * 100 : 0,
      highImpactWinCorrelationRate: totalWinningTrades > 0 ? (winningTradesWithEvents.length / totalWinningTrades) * 100 : 0,
      mediumImpactWinCorrelationRate: totalWinningTrades > 0 ? (winningTradesWithEvents.length / totalWinningTrades) * 100 : 0,
      anyEventWinCorrelationRate: totalWinningTrades > 0 ? (winningTradesWithEvents.length / totalWinningTrades) * 100 : 0,
      avgLossWithEvents: losingTradesWithEvents.length > 0
        ? losingTradesWithEvents.reduce((sum, tc) => sum + Math.abs(tc.trade.amount), 0) / losingTradesWithEvents.length
        : 0,
      avgLossWithoutEvents: losingTradesWithoutEvents.length > 0
        ? losingTradesWithoutEvents.reduce((sum, tc) => sum + Math.abs(tc.trade.amount), 0) / losingTradesWithoutEvents.length
        : 0,
      avgWinWithEvents: winningTradesWithEvents.length > 0
        ? winningTradesWithEvents.reduce((sum, tc) => sum + tc.trade.amount, 0) / winningTradesWithEvents.length
        : 0,
      avgWinWithoutEvents: winningTradesWithoutEvents.length > 0
        ? winningTradesWithoutEvents.reduce((sum, tc) => sum + tc.trade.amount, 0) / winningTradesWithoutEvents.length
        : 0,
      mostCommonEventTypes,
      impactDistribution
    };

    return {
      losingTradeCorrelations,
      winningTradeCorrelations,
      correlationStats
    };
  }
}

export const performanceCalculationService = PerformanceCalculationService.getInstance();
