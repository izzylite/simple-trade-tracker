import { TimePeriod } from '../utils/chartDataUtils';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

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

  // Calculate all performance metrics using PostgreSQL RPC function
  // Supports both single calendar and multiple calendars
  public async calculatePerformanceMetrics(
    calendarIds: string | string[],
    selectedDate: Date,
    timePeriod: TimePeriod,
    accountBalance: number,
    comparisonTags: string[] = [], 
  ): Promise<PerformanceCalculationResult> {
    try {
       

      // Normalize calendarIds to array
      const calendarIdsArray = Array.isArray(calendarIds) ? calendarIds : [calendarIds];

      // Call appropriate RPC function based on number of calendars
      const { data, error } = calendarIdsArray.length === 1
        ? await supabase.rpc('calculate_performance_metrics', {
            p_calendar_id: calendarIdsArray[0],
            p_time_period: timePeriod,
            p_selected_date: selectedDate.toISOString(),
            p_comparison_tags: comparisonTags
          })
        : await supabase.rpc('calculate_performance_metrics_multi', {
            p_calendar_ids: calendarIdsArray,
            p_time_period: timePeriod,
            p_selected_date: selectedDate.toISOString(),
            p_comparison_tags: comparisonTags
          });

      if (error) {
        logger.error('Error calling calculate_performance_metrics RPC:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from calculate_performance_metrics');
      }

      logger.log('Performance metrics calculated successfully:', {
        totalTrades: data.winLossStats?.total_trades,
        winRate: data.winLossStats?.win_rate,
        tagCount: data.tagStats?.length,
        calculatedAt: data.calculatedAt
      });

      // Transform session stats to include pnl_percentage (calculated client-side with account balance)
      const sessionStats = (data.sessionStats || []).map((s: any) => ({
        ...s,
        pnl_percentage: accountBalance > 0 ? (s.total_pnl / accountBalance) * 100 : 0
      }));

      // Transform daily summary data to match component expectations
      const dailySummaryData = (data.dailySummaryData || []).map((day: any) => ({
        trade_date: day.date, // Component expects trade_date, not date
        pnl: day.total_pnl, // Component expects pnl, not total_pnl
        trades: day.total_trades, // Component expects trades, not total_trades
        session: null, // Daily summary doesn't have session info (a day can have multiple sessions)
        wins: day.wins,
        losses: day.losses,
        breakevens: day.breakevens,
        win_rate: day.win_rate,
        cumulative_pnl: day.cumulative_pnl
      }));

      // Calculate win/loss distribution data for pie chart
      const { winners, losers, breakevens } = data.winLossStats || { winners: { total: 0 }, losers: { total: 0 }, breakevens: { total: 0 } };
      const winLossData = [
        { name: 'Wins', value: winners.total },
        { name: 'Losses', value: losers.total },
        { name: 'Breakeven', value: breakevens?.total || 0 }
      ].filter(item => item.value > 0);

      // Ensure riskRewardStats has proper structure with non-null data array
      const riskRewardStats = data.riskRewardStats || { average: 0, max: 0, data: [] };
      if (!riskRewardStats.data || !Array.isArray(riskRewardStats.data)) {
        riskRewardStats.data = [];
      }

      return {
        winLossStats: data.winLossStats,
        tagStats: data.tagStats || [],
        dailySummaryData,
        riskRewardStats,
        sessionStats,
        comparisonWinLossData: data.comparisonWinLossData || null,
        allTags: data.allTags || [],
        winLossData
      };
    } catch (error) {
      logger.error('Error in calculatePerformanceMetrics:', error);
      throw error;
    }
  }



  // Calculate tag performance using PostgreSQL RPC function
  // Supports both single calendar and multiple calendars
  public async calculateTagPerformanceRPC(
    calendarIds: string | string[],
    primaryTags: string[],
    secondaryTags: string[],
    timePeriod: TimePeriod,
    selectedDate: Date
  ): Promise<any[]> {
    try {
      // If no tags selected, return empty array
      if (primaryTags.length === 0) {
        return [];
      }

      // Normalize calendarIds to array
      const calendarIdsArray = Array.isArray(calendarIds) ? calendarIds : [calendarIds];

      // Call appropriate RPC function based on number of calendars
      const { data, error } = calendarIdsArray.length === 1
        ? await supabase.rpc('calculate_tag_performance', {
            p_calendar_id: calendarIdsArray[0],
            p_primary_tags: primaryTags,
            p_secondary_tags: secondaryTags,
            p_time_period: timePeriod,
            p_selected_date: selectedDate.toISOString()
          })
        : await supabase.rpc('calculate_tag_performance_multi', {
            p_calendar_ids: calendarIdsArray,
            p_primary_tags: primaryTags,
            p_secondary_tags: secondaryTags,
            p_time_period: timePeriod,
            p_selected_date: selectedDate.toISOString()
          });

      if (error) {
        logger.error('Error calling calculate_tag_performance RPC:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error in calculateTagPerformanceRPC:', error);
      throw error;
    }
  }

  // Calculate economic event correlations using PostgreSQL RPC function
  // Supports both single calendar and multiple calendars
  public async calculateEconomicEventCorrelations(
    calendarIds: string | string[],
    selectedCurrency: string,
    selectedImpact: string,
    timePeriod: TimePeriod,
    selectedDate: Date,
    onProgress?: (progress: CalculationProgress) => void
  ): Promise<{
    losingTradeCorrelations: any[];
    winningTradeCorrelations: any[];
    correlationStats: any;
  }> {
    try {
      onProgress?.({ step: 'Fetching economic event correlations from database...', progress: 1, total: 1 });

      // Normalize calendarIds to array
      const calendarIdsArray = Array.isArray(calendarIds) ? calendarIds : [calendarIds];

      // Call appropriate RPC function based on number of calendars
      const { data, error } = calendarIdsArray.length === 1
        ? await supabase.rpc('calculate_economic_event_correlations', {
            p_calendar_id: calendarIdsArray[0],
            p_selected_currency: selectedCurrency,
            p_selected_impact: selectedImpact,
            p_time_period: timePeriod,
            p_selected_date: selectedDate.toISOString()
          })
        : await supabase.rpc('calculate_economic_event_correlations_multi', {
            p_calendar_ids: calendarIdsArray,
            p_selected_currency: selectedCurrency,
            p_selected_impact: selectedImpact,
            p_time_period: timePeriod,
            p_selected_date: selectedDate.toISOString()
          });

      if (error) {
        logger.error('Error calling calculate_economic_event_correlations RPC:', error);
        throw error;
      }

      return {
        losingTradeCorrelations: data?.losingCorrelations || [],
        winningTradeCorrelations: data?.winningCorrelations || [],
        correlationStats: data?.stats || {
          totalLosingTrades: 0,
          totalWinningTrades: 0,
          losingTradesWithEvents: 0,
          winningTradesWithEvents: 0,
          anyEventLossCorrelationRate: 0,
          anyEventWinCorrelationRate: 0,
          mostCommonEventTypes: [],
          impactDistribution: {}
        }
      };
    } catch (error) {
      logger.error('Error in calculateEconomicEventCorrelations:', error);
      throw error;
    }
  }


}

export const performanceCalculationService = PerformanceCalculationService.getInstance();
