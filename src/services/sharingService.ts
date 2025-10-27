/**
 * Sharing Service
 * Handles all share link operations using ShareRepository
 * Simplified design: share links are stored directly on trade and calendar documents
 */

import { Trade, Calendar } from '../types/dualWrite';
import { logger } from '../utils/logger';
import { shareRepository, ShareLinkResult, SharedTradeData, SharedCalendarData } from './repository/repositories/ShareRepository';
import { supabase } from '../config/supabase';

// Export types for use in components
export type { SharedTradeData, SharedCalendarData, ShareLinkResult };

/**
 * Generate a shareable link for a trade
 * Uses direct links - share link is stored on the trade document
 * This is the main function used by ShareTradeButton
 */
export const generateTradeShareLink = async (
  calendarId: string,
  tradeId: string
): Promise<ShareLinkResult> => {
  try {
    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await shareRepository.generateTradeShareLink(calendarId, tradeId, user.id);

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to generate share link');
    }

    logger.log('Trade share link generated successfully');
    return result.data!;
  } catch (error) {
    logger.error('Error generating trade share link:', error);
    throw error;
  }
};

/**
 * Generate a shareable link for a calendar
 * Uses direct links - share link is stored on the calendar document
 * This is the main function used by ShareCalendarButton
 */
export const generateCalendarShareLink = async (
  calendarId: string
): Promise<ShareLinkResult> => {
  try {
    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await shareRepository.generateCalendarShareLink(calendarId, user.id);

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to generate share link');
    }

    logger.log('Calendar share link generated successfully');
    return result.data!;
  } catch (error) {
    logger.error('Error generating calendar share link:', error);
    throw error;
  }
};

/**
 * Deactivate a shared trade (stop sharing)
 */
export const deactivateTradeShareLink = async (shareId: string): Promise<void> => {
  try {
    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await shareRepository.deactivateTradeShareLink(shareId, user.id);

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to deactivate trade share');
    }

    logger.log('Trade share deactivated successfully');
  } catch (error) {
    logger.error('Error deactivating trade share:', error);
    throw error;
  }
};

/**
 * Deactivate a shared calendar (stop sharing)
 */
export const deactivateCalendarShareLink = async (shareId: string): Promise<void> => {
  try {
    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const result = await shareRepository.deactivateCalendarShareLink(shareId, user.id);

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to deactivate calendar share');
    }

    logger.log('Calendar share deactivated successfully');
  } catch (error) {
    logger.error('Error deactivating calendar share:', error);
    throw error;
  }
};

/**
 * Get a shared trade by its share ID (for public viewing)
 * This uses the edge function for public access
 */
export const getSharedTrade = async (shareId: string): Promise<SharedTradeData | null> => {
  try {
    const result = await shareRepository.getSharedTrade(shareId);

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to load shared trade');
    }

    return result.data || null;
  } catch (error) {
    logger.error('Error getting shared trade:', error);
    throw error;
  }
};

/**
 * Get a shared calendar by its share ID (for public viewing)
 * This uses the edge function for public access
 */
export const getSharedCalendar = async (shareId: string): Promise<SharedCalendarData | null> => {
  try {
    const result = await shareRepository.getSharedCalendar(shareId);

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to load shared calendar');
    }

    return result.data || null;
  } catch (error) {
    logger.error('Error getting shared calendar:', error);
    throw error;
  }
};

/**
 * Get shared trades with calendar data
 * Wrapper function that transforms SharedCalendarData to match component expectations
 * Used by SharedCalendarPage component
 */
export const getSharedTradesWithCalendar = async (
  shareId: string
): Promise<{
  calendar: Calendar;
  trades: Trade[];
  shareInfo: {
    id: string;
    createdAt: Date;
    viewCount: number;
    userId: string;
  };
}> => {
  try {
    const data = await getSharedCalendar(shareId);

    if (!data) {
      throw new Error('Shared calendar not found');
    }

    return {
      calendar: data.calendar,
      trades: data.trades,
      shareInfo: {
        id: data.calendar.share_id || '',
        createdAt: data.shareInfo.sharedAt,
        viewCount: data.shareInfo.viewCount,
        userId: data.calendar.user_id || ''
      }
    };
  } catch (error) {
    logger.error('Error getting shared trades with calendar:', error);
    throw error;
  }
};