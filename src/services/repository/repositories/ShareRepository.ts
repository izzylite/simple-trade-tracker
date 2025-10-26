/**
 * Share Repository
 * Handles all database operations for share link generation and management
 * Replaces edge functions with direct database operations
 */

import { supabase } from '../../../config/supabase';
import { RepositoryResult } from './BaseRepository';
import { Trade, Calendar } from '../../../types/dualWrite';
import { handleSupabaseError } from '../../../utils/supabaseErrorHandler';
import { logger } from '../../../utils/logger';

/**
 * Share link generation result
 */
export interface ShareLinkResult {
  shareLink: string;
  shareId: string;
  directLink: string;
}

/**
 * Shared trade data for public viewing
 */
export interface SharedTradeData {
  trade: Trade;
  viewCount: number;
  sharedAt: Date;
}

/**
 * Shared calendar data for public viewing
 */
export interface SharedCalendarData {
  calendar: Calendar;
  trades: Trade[];
  shareInfo: {
    viewCount: number;
    sharedAt: Date;
  };
}

/**
 * Generate a unique share ID
 * Matches the pattern from edge function utils
 */
function generateShareId(type: 'trade' | 'calendar', id: string): string {
  const prefix = type === 'trade' ? 'share' : 'calendar_share';
  return `${prefix}_${id}`;
}

/**
 * Share Repository - handles all share link operations
 */
export class ShareRepository {
  private readonly BASE_URL = process.env.REACT_APP_BASE_URL || 'https://tradetracker-30ec1.web.app';

  /**
   * Generate a share link for a trade
   */
  async generateTradeShareLink(
    calendarId: string,
    tradeId: string,
    userId: string
  ): Promise<RepositoryResult<ShareLinkResult>> {
    try {
      logger.log(`Generating share link for trade ${tradeId}`);

      // Verify calendar ownership
      const { data: calendar, error: calendarError } = await supabase
        .from('calendars')
        .select('user_id')
        .eq('id', calendarId)
        .single();

      if (calendarError || !calendar) {
        throw new Error('Calendar not found');
      }

      if (calendar.user_id !== userId) {
        throw new Error('Unauthorized access to calendar');
      }

      // Verify trade exists
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('id')
        .eq('id', tradeId)
        .eq('calendar_id', calendarId)
        .single();

      if (tradeError || !trade) {
        throw new Error('Trade not found in calendar');
      }

      // Generate share ID and link
      const shareId = generateShareId('trade', `${calendarId}_${tradeId}`);
      const shareLink = `${this.BASE_URL}/shared/${shareId}`;

      // Update trade with sharing information
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          share_id: shareId,
          share_link: shareLink,
          is_shared: true,
          shared_at: new Date().toISOString()
        })
        .eq('id', tradeId);

      if (updateError) {
        throw updateError;
      }

      logger.log(`Generated share link for trade ${tradeId}: ${shareLink}`);

      return {
        success: true,
        data: {
          shareLink,
          shareId,
          directLink: shareLink
        },
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Generating share link for trade ${tradeId}`,
        'generateTradeShareLink'
      );

      logger.error('Failed to generate trade share link:', supabaseError);

      return {
        success: false,
        error: supabaseError,
        operation: 'generateTradeShareLink',
        timestamp: new Date()
      };
    }
  }

  /**
   * Generate a share link for a calendar
   */
  async generateCalendarShareLink(
    calendarId: string,
    userId: string
  ): Promise<RepositoryResult<ShareLinkResult>> {
    try {
      logger.log(`Generating share link for calendar ${calendarId}`);

      // Verify calendar ownership
      const { data: calendar, error: calendarError } = await supabase
        .from('calendars')
        .select('user_id')
        .eq('id', calendarId)
        .single();

      if (calendarError || !calendar) {
        throw new Error('Calendar not found');
      }

      if (calendar.user_id !== userId) {
        throw new Error('Unauthorized access to calendar');
      }

      // Generate share ID and link
      const shareId = generateShareId('calendar', calendarId);
      const shareLink = `${this.BASE_URL}/shared-calendar/${shareId}`;

      // Update calendar with sharing information
      const { error: updateError } = await supabase
        .from('calendars')
        .update({
          share_id: shareId,
          share_link: shareLink,
          is_shared: true,
          shared_at: new Date().toISOString()
        })
        .eq('id', calendarId);

      if (updateError) {
        throw updateError;
      }

      logger.log(`Generated share link for calendar ${calendarId}: ${shareLink}`);

      return {
        success: true,
        data: {
          shareLink,
          shareId,
          directLink: shareLink
        },
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Generating share link for calendar ${calendarId}`,
        'generateCalendarShareLink'
      );

      logger.error('Failed to generate calendar share link:', supabaseError);

      return {
        success: false,
        error: supabaseError,
        operation: 'generateCalendarShareLink',
        timestamp: new Date()
      };
    }
  }

  /**
   * Deactivate a share link for a trade
   */
  async deactivateTradeShareLink(
    shareId: string,
    userId: string
  ): Promise<RepositoryResult<boolean>> {
    try {
      logger.log(`Deactivating trade share link ${shareId}`);

      // Get trade and verify ownership
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('id, calendar_id, calendars(user_id)')
        .eq('share_id', shareId)
        .single();

      if (tradeError || !trade) {
        throw new Error('Shared trade not found');
      }

      // @ts-ignore - Supabase join typing
      if (trade.calendars?.user_id !== userId) {
        throw new Error('You do not have permission to modify this shared trade');
      }

      // Clear sharing information
      const { error: updateError } = await supabase
        .from('trades')
        .update({
          share_id: null,
          share_link: null,
          is_shared: false,
          shared_at: null
        })
        .eq('share_id', shareId);

      if (updateError) {
        throw updateError;
      }

      logger.log(`Deactivated trade share link ${shareId}`);

      return {
        success: true,
        data: true,
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Deactivating trade share link ${shareId}`,
        'deactivateTradeShareLink'
      );

      logger.error('Failed to deactivate trade share link:', supabaseError);

      return {
        success: false,
        error: supabaseError,
        operation: 'deactivateTradeShareLink',
        timestamp: new Date()
      };
    }
  }

  /**
   * Deactivate a share link for a calendar
   */
  async deactivateCalendarShareLink(
    shareId: string,
    userId: string
  ): Promise<RepositoryResult<boolean>> {
    try {
      logger.log(`Deactivating calendar share link ${shareId}`);

      // Get calendar and verify ownership
      const { data: calendar, error: calendarError } = await supabase
        .from('calendars')
        .select('id, user_id')
        .eq('share_id', shareId)
        .single();

      if (calendarError || !calendar) {
        throw new Error('Shared calendar not found');
      }

      if (calendar.user_id !== userId) {
        throw new Error('You do not have permission to modify this shared calendar');
      }

      // Clear sharing information
      const { error: updateError } = await supabase
        .from('calendars')
        .update({
          share_id: null,
          share_link: null,
          is_shared: false,
          shared_at: null
        })
        .eq('share_id', shareId);

      if (updateError) {
        throw updateError;
      }

      logger.log(`Deactivated calendar share link ${shareId}`);

      return {
        success: true,
        data: true,
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Deactivating calendar share link ${shareId}`,
        'deactivateCalendarShareLink'
      );

      logger.error('Failed to deactivate calendar share link:', supabaseError);

      return {
        success: false,
        error: supabaseError,
        operation: 'deactivateCalendarShareLink',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get a shared trade by share ID (for public viewing)
   * This will be used by the public shared trade page
   */
  async getSharedTrade(shareId: string): Promise<RepositoryResult<SharedTradeData | null>> {
    try {
      logger.log(`Fetching shared trade ${shareId}`);

      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('share_id', shareId)
        .eq('is_shared', true)
        .single();

      if (error) {
        throw error;
      }

      if (!trade) {
        return {
          success: true,
          data: null,
          timestamp: new Date()
        };
      }

      return {
        success: true,
        data: {
          trade: trade as Trade,
          viewCount: 0, // We'll implement view counting later if needed
          sharedAt: new Date(trade.shared_at)
        },
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Fetching shared trade ${shareId}`,
        'getSharedTrade'
      );

      logger.error('Failed to get shared trade:', supabaseError);

      return {
        success: false,
        error: supabaseError,
        operation: 'getSharedTrade',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get a shared calendar by share ID (for public viewing)
   * This will be used by the public shared calendar page
   */
  async getSharedCalendar(shareId: string): Promise<RepositoryResult<SharedCalendarData | null>> {
    try {
      logger.log(`Fetching shared calendar ${shareId}`);

      // Get calendar
      const { data: calendar, error: calendarError } = await supabase
        .from('calendars')
        .select('*')
        .eq('share_id', shareId)
        .eq('is_shared', true)
        .single();

      if (calendarError) {
        throw calendarError;
      }

      if (!calendar) {
        return {
          success: true,
          data: null,
          timestamp: new Date()
        };
      }

      // Get all trades for this calendar
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('calendar_id', calendar.id)
        .order('trade_date', { ascending: false });

      if (tradesError) {
        throw tradesError;
      }

      return {
        success: true,
        data: {
          calendar: calendar as Calendar,
          trades: (trades || []) as Trade[],
          shareInfo: {
            viewCount: 0, // We'll implement view counting later if needed
            sharedAt: new Date(calendar.shared_at)
          }
        },
        timestamp: new Date()
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Fetching shared calendar ${shareId}`,
        'getSharedCalendar'
      );

      logger.error('Failed to get shared calendar:', supabaseError);

      return {
        success: false,
        error: supabaseError,
        operation: 'getSharedCalendar',
        timestamp: new Date()
      };
    }
  }
}

// Export singleton instance
export const shareRepository = new ShareRepository();
