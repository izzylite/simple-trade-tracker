/**
 * Calendar information functionality for AI trading analysis
 */

import { Calendar } from '../../../types/calendar';
import { logger } from '../../../utils/logger';
import { GetUserCalendarParams, TradingAnalysisResult } from './types';
import { handleCacheKeyResult } from './utils';
import { sanitizeCalendarNote, sanitizeDaysNotes } from '../../../utils/textSanitizer';

/**
 * Get comprehensive information about the current user's trading calendar
 */
export async function getUserCalendar(
  calendar: Calendar | null,
  params: GetUserCalendarParams
): Promise<TradingAnalysisResult> {
  try {
    logger.log('AI requested current calendar information with params:', params);

    if (!calendar) {
      return {
        success: false,
        error: 'No calendar data available'
      };
    }

    // Determine which fields to include based on parameters
    const includeStatistics = params.includeStatistics !== false; // Default to true
    const includeTargets = params.includeTargets !== false; // Default to true
    const includeRiskManagement = params.includeRiskManagement !== false; // Default to true
    const includeConfiguration = params.includeConfiguration !== false; // Default to true
    const includeNotes = params.includeNotes !== false; // Default to true

    // Build the calendar data based on requested fields
    let calendarData: any = {
      id: calendar.id,
      name: calendar.name,
      createdAt: calendar.createdAt.toISOString(),
      lastModified: calendar.lastModified.toISOString()
    };

    // Apply field filtering if specific fields are requested
    if (params.fields && params.fields.length > 0 && !params.fields.includes('all')) {
      const requestedFields = params.fields;
      const filteredData: any = {};

      // Add requested fields (no automatic inclusion of id)
      requestedFields.forEach((field: string) => {
        switch (field) {
          case 'name':
            filteredData.name = calendar.name;
            break;
          case 'accountBalance':
            filteredData.accountBalance = calendar.accountBalance;
            break;
          case 'currentBalance':
            filteredData.currentBalance = calendar.currentBalance || calendar.accountBalance;
            break;
          case 'maxDailyDrawdown':
            filteredData.maxDailyDrawdown = calendar.maxDailyDrawdown;
            break;
          case 'weeklyTarget':
            filteredData.weeklyTarget = calendar.weeklyTarget;
            break;
          case 'monthlyTarget':
            filteredData.monthlyTarget = calendar.monthlyTarget;
            break;
          case 'yearlyTarget':
            filteredData.yearlyTarget = calendar.yearlyTarget;
            break;
          case 'riskPerTrade':
            filteredData.riskPerTrade = calendar.riskPerTrade;
            break;
          case 'dynamicRiskEnabled':
            filteredData.dynamicRiskEnabled = calendar.dynamicRiskEnabled;
            break;
          case 'increasedRiskPercentage':
            filteredData.increasedRiskPercentage = calendar.increasedRiskPercentage;
            break;
          case 'profitThresholdPercentage':
            filteredData.profitThresholdPercentage = calendar.profitThresholdPercentage;
            break;
          case 'winRate':
            filteredData.winRate = calendar.winRate;
            break;
          case 'profitFactor':
            filteredData.profitFactor = calendar.profitFactor;
            break;
          case 'maxDrawdown':
            filteredData.maxDrawdown = calendar.maxDrawdown;
            break;
          case 'totalTrades':
            filteredData.totalTrades = calendar.totalTrades;
            break;
          case 'totalPnL':
            filteredData.totalPnL = calendar.totalPnL;
            break;
          case 'avgWin':
            filteredData.avgWin = calendar.avgWin;
            break;
          case 'avgLoss':
            filteredData.avgLoss = calendar.avgLoss;
            break;
          case 'winCount':
            filteredData.winCount = calendar.winCount;
            break;
          case 'lossCount':
            filteredData.lossCount = calendar.lossCount;
            break;
          case 'drawdownRecoveryNeeded':
            filteredData.drawdownRecoveryNeeded = calendar.drawdownRecoveryNeeded;
            break;
          case 'drawdownDuration':
            filteredData.drawdownDuration = calendar.drawdownDuration;
            break;
          case 'weeklyPnL':
            filteredData.weeklyPnL = calendar.weeklyPnL;
            filteredData.weeklyPnLPercentage = calendar.weeklyPnLPercentage;
            break;
          case 'monthlyPnL':
            filteredData.monthlyPnL = calendar.monthlyPnL;
            filteredData.monthlyPnLPercentage = calendar.monthlyPnLPercentage;
            break;
          case 'yearlyPnL':
            filteredData.yearlyPnL = calendar.yearlyPnL;
            filteredData.yearlyPnLPercentage = calendar.yearlyPnLPercentage;
            break;
          case 'weeklyProgress':
            filteredData.weeklyProgress = calendar.weeklyProgress;
            break;
          case 'monthlyProgress':
            filteredData.monthlyProgress = calendar.monthlyProgress;
            break;
          case 'targetProgress':
            filteredData.targetProgress = calendar.targetProgress;
            break;
          case 'note':
            filteredData.note = calendar.note ? sanitizeCalendarNote(calendar.note) : '';
            break;
          case 'daysNotes':
            filteredData.daysNotes = calendar.daysNotes ? sanitizeDaysNotes(calendar.daysNotes) : {};
            break;
        }
      });

      calendarData = filteredData;
    } else {
      // Include all data based on category flags
      
      // Basic account information (always included)
      calendarData.accountBalance = calendar.accountBalance;
      calendarData.currentBalance = calendar.currentBalance || calendar.accountBalance;

      // Statistics
      if (includeStatistics) {
        calendarData.statistics = {
          winRate: calendar.winRate || 0,
          profitFactor: calendar.profitFactor || 0,
          maxDrawdown: calendar.maxDrawdown || 0,
          totalTrades: calendar.totalTrades || 0,
          winCount: calendar.winCount || 0,
          lossCount: calendar.lossCount || 0,
          totalPnL: calendar.totalPnL || 0,
          avgWin: calendar.avgWin || 0,
          avgLoss: calendar.avgLoss || 0,
          pnlPerformance: calendar.pnlPerformance || 0,
          drawdownStartDate: calendar.drawdownStartDate?.toISOString(),
          drawdownEndDate: calendar.drawdownEndDate?.toISOString(),
          drawdownRecoveryNeeded: calendar.drawdownRecoveryNeeded || 0,
          drawdownDuration: calendar.drawdownDuration || 0
        };
      }

      // Targets and progress
      if (includeTargets) {
        calendarData.targets = {
          weeklyTarget: calendar.weeklyTarget,
          monthlyTarget: calendar.monthlyTarget,
          yearlyTarget: calendar.yearlyTarget,
          weeklyPnL: calendar.weeklyPnL || 0,
          monthlyPnL: calendar.monthlyPnL || 0,
          yearlyPnL: calendar.yearlyPnL || 0,
          weeklyPnLPercentage: calendar.weeklyPnLPercentage || 0,
          monthlyPnLPercentage: calendar.monthlyPnLPercentage || 0,
          yearlyPnLPercentage: calendar.yearlyPnLPercentage || 0,
          weeklyProgress: calendar.weeklyProgress || 0,
          monthlyProgress: calendar.monthlyProgress || 0,
          targetProgress: calendar.targetProgress || 0
        };
      }

      // Risk management
      if (includeRiskManagement) {
        calendarData.riskManagement = {
          maxDailyDrawdown: calendar.maxDailyDrawdown,
          riskPerTrade: calendar.riskPerTrade,
          dynamicRiskEnabled: calendar.dynamicRiskEnabled || false,
          increasedRiskPercentage: calendar.increasedRiskPercentage,
          profitThresholdPercentage: calendar.profitThresholdPercentage
        };
      }

      // Configuration
      if (includeConfiguration) {
        calendarData.configuration = {
          tags: calendar.tags || [],
          requiredTagGroups: calendar.requiredTagGroups || [],
          scoreSettings: calendar.scoreSettings,
          economicCalendarFilters: calendar.economicCalendarFilters,
          pinnedEvents: calendar.pinnedEvents || [],
          isShared: calendar.isShared || false,
          shareLink: calendar.shareLink
        };
      }

      // Notes and content
      if (includeNotes) {
        calendarData.notes = {
          note: calendar.note ? sanitizeCalendarNote(calendar.note) : '',
          heroImageUrl: calendar.heroImageUrl,
          heroImageAttribution: calendar.heroImageAttribution,
          daysNotes: calendar.daysNotes ? sanitizeDaysNotes(calendar.daysNotes) : {}
        };
      }
    }

    // Add metadata
    calendarData.metadata = {
      loadedYears: calendar.loadedYears || [],
      cachedTradesCount: calendar.cachedTrades?.length || 0,
      lastModified: calendar.lastModified.toISOString(),
      createdAt: calendar.createdAt.toISOString(),
      includedSections: {
        statistics: includeStatistics,
        targets: includeTargets,
        riskManagement: includeRiskManagement,
        configuration: includeConfiguration,
        notes: includeNotes
      },
      requestedFields: params.fields || ['all']
    };

    const resultData = {
      calendar: calendarData,
      summary: {
        name: calendar.name,
        totalTrades: calendar.totalTrades || 0,
        totalPnL: calendar.totalPnL || 0,
        currentBalance: calendar.currentBalance || calendar.accountBalance,
        winRate: calendar.winRate || 0,
        profitFactor: calendar.profitFactor || 0
      }
    };

    return handleCacheKeyResult('getUserCalendar', resultData, params.returnCacheKey, calendarData);

  } catch (error) {
    logger.error('Error in getUserCalendar:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
