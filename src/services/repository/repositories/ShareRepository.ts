/**
 * Share Repository
 * Thin client over the consolidated share-link edge functions:
 *   - generate-share-link    (auth required, type=trade|calendar|note)
 *   - get-shared-link        (public, type=trade|calendar|note)
 *   - deactivate-share-link  (auth required, type=trade|calendar|note)
 */

import { supabase, supabaseUrl } from '../../../config/supabase';
import { RepositoryResult } from './BaseRepository';
import { Trade, Calendar } from '../../../types/dualWrite';
import { handleSupabaseError } from '../../../utils/supabaseErrorHandler';
import { logger } from '../../../utils/logger';

export interface ShareLinkResult {
  shareLink: string;
  shareId: string;
  directLink: string;
}

export interface SharedTradeData {
  trade: Trade;
  viewCount: number;
  sharedAt: Date;
}

export interface SharedCalendarData {
  calendar: Calendar;
  trades: Trade[];
  shareInfo: {
    viewCount: number;
    sharedAt: Date;
  };
}

export interface SharedNoteData {
  title: string;
  content: string;
  cover_image: string | null;
  color: string | null;
  tags: string[];
  created_at: Date;
  shared_at: Date;
}

type ShareType = 'trade' | 'calendar' | 'note';

interface InvokeShareResult<T> {
  data?: T;
  success?: boolean;
  error?: string;
}

/**
 * Public (unauthenticated) edge-function read. Returns null on 404 so callers
 * can render a "link expired" state without throwing.
 */
async function fetchPublicShare<T>(payload: object): Promise<T | null> {
  const response = await fetch(`${supabaseUrl}/functions/v1/get-shared-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Edge function error: ${response.status}`);
  }

  const result = (await response.json()) as InvokeShareResult<T>;
  return (result.data ?? (result as unknown as T)) ?? null;
}

export class ShareRepository {
  async generateTradeShareLink(
    calendarId: string,
    tradeId: string,
    _userId: string,
  ): Promise<RepositoryResult<ShareLinkResult>> {
    try {
      logger.log(`Generating share link for trade ${tradeId}`);

      const { data, error } = await supabase.functions.invoke<
        InvokeShareResult<ShareLinkResult>
      >('generate-share-link', {
        body: { type: 'trade', calendarId, tradeId },
      });

      if (error) throw error;
      const payload = data?.data;
      if (!payload) throw new Error(data?.error || 'Failed to generate share link');

      return { success: true, data: payload, timestamp: new Date() };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Generating share link for trade ${tradeId}`,
        'generateTradeShareLink',
      );
      logger.error('Failed to generate trade share link:', supabaseError);
      return {
        success: false,
        error: supabaseError,
        operation: 'generateTradeShareLink',
        timestamp: new Date(),
      };
    }
  }

  async generateCalendarShareLink(
    calendarId: string,
    _userId: string,
  ): Promise<RepositoryResult<ShareLinkResult>> {
    try {
      logger.log(`Generating share link for calendar ${calendarId}`);

      const { data, error } = await supabase.functions.invoke<
        InvokeShareResult<ShareLinkResult>
      >('generate-share-link', {
        body: { type: 'calendar', calendarId },
      });

      if (error) throw error;
      const payload = data?.data;
      if (!payload) throw new Error(data?.error || 'Failed to generate share link');

      return { success: true, data: payload, timestamp: new Date() };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Generating share link for calendar ${calendarId}`,
        'generateCalendarShareLink',
      );
      logger.error('Failed to generate calendar share link:', supabaseError);
      return {
        success: false,
        error: supabaseError,
        operation: 'generateCalendarShareLink',
        timestamp: new Date(),
      };
    }
  }

  async generateNoteShareLink(
    noteId: string,
    _userId: string,
  ): Promise<RepositoryResult<ShareLinkResult>> {
    try {
      logger.log(`Generating share link for note ${noteId}`);

      const { data, error } = await supabase.functions.invoke<
        InvokeShareResult<ShareLinkResult>
      >('generate-share-link', {
        body: { type: 'note', noteId },
      });

      if (error) throw error;
      const payload = data?.data;
      if (!payload) throw new Error(data?.error || 'Failed to generate share link');

      return { success: true, data: payload, timestamp: new Date() };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Generating share link for note ${noteId}`,
        'generateNoteShareLink',
      );
      logger.error('Failed to generate note share link:', supabaseError);
      return {
        success: false,
        error: supabaseError,
        operation: 'generateNoteShareLink',
        timestamp: new Date(),
      };
    }
  }

  async deactivateTradeShareLink(
    shareId: string,
    _userId: string,
  ): Promise<RepositoryResult<boolean>> {
    return this.deactivateShare('trade', shareId, 'deactivateTradeShareLink');
  }

  async deactivateCalendarShareLink(
    shareId: string,
    _userId: string,
  ): Promise<RepositoryResult<boolean>> {
    return this.deactivateShare('calendar', shareId, 'deactivateCalendarShareLink');
  }

  async deactivateNoteShareLink(
    shareId: string,
    _userId: string,
  ): Promise<RepositoryResult<boolean>> {
    return this.deactivateShare('note', shareId, 'deactivateNoteShareLink');
  }

  private async deactivateShare(
    type: ShareType,
    shareId: string,
    operation: string,
  ): Promise<RepositoryResult<boolean>> {
    try {
      logger.log(`Deactivating ${type} share link ${shareId}`);

      const { error } = await supabase.functions.invoke('deactivate-share-link', {
        body: { type, shareId },
      });

      if (error) throw error;

      logger.log(`Deactivated ${type} share link ${shareId}`);
      return { success: true, data: true, timestamp: new Date() };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Deactivating ${type} share link ${shareId}`,
        operation,
      );
      logger.error(`Failed to deactivate ${type} share link:`, supabaseError);
      return {
        success: false,
        error: supabaseError,
        operation,
        timestamp: new Date(),
      };
    }
  }

  async getSharedTrade(shareId: string): Promise<RepositoryResult<SharedTradeData | null>> {
    try {
      logger.log(`Fetching shared trade ${shareId}`);
      const data = await fetchPublicShare<{
        trade: Trade;
        viewCount?: number;
        sharedAt: string;
      }>({ type: 'trade', shareId });

      if (!data) return { success: true, data: null, timestamp: new Date() };

      return {
        success: true,
        data: {
          trade: data.trade,
          viewCount: data.viewCount || 0,
          sharedAt: new Date(data.sharedAt),
        },
        timestamp: new Date(),
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Fetching shared trade ${shareId}`,
        'getSharedTrade',
      );
      logger.error('Failed to get shared trade:', supabaseError);
      return {
        success: false,
        error: supabaseError,
        operation: 'getSharedTrade',
        timestamp: new Date(),
      };
    }
  }

  async getSharedCalendar(
    shareId: string,
  ): Promise<RepositoryResult<SharedCalendarData | null>> {
    try {
      logger.log(`Fetching shared calendar ${shareId}`);
      const data = await fetchPublicShare<{
        calendar: Calendar;
        trades: Trade[];
        shareInfo: { viewCount: number; sharedAt: string };
      }>({ type: 'calendar', shareId });

      if (!data) return { success: true, data: null, timestamp: new Date() };

      return {
        success: true,
        data: {
          calendar: data.calendar,
          // Trades are also fetched lazily by useCalendarTrades; the edge
          // function returns the full list here so initial paint has data.
          trades: data.trades || [],
          shareInfo: {
            viewCount: data.shareInfo?.viewCount ?? 0,
            sharedAt: new Date(data.shareInfo?.sharedAt ?? data.calendar.shared_at),
          },
        },
        timestamp: new Date(),
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Fetching shared calendar ${shareId}`,
        'getSharedCalendar',
      );
      logger.error('Failed to get shared calendar:', supabaseError);
      return {
        success: false,
        error: supabaseError,
        operation: 'getSharedCalendar',
        timestamp: new Date(),
      };
    }
  }

  async getSharedNote(
    shareId: string,
  ): Promise<RepositoryResult<SharedNoteData | null>> {
    try {
      logger.log(`Fetching shared note ${shareId}`);
      const data = await fetchPublicShare<{
        title: string;
        content: string;
        cover_image: string | null;
        color: string | null;
        tags?: string[];
        created_at: string;
        shared_at: string;
      }>({ type: 'note', shareId });

      if (!data) return { success: true, data: null, timestamp: new Date() };

      return {
        success: true,
        data: {
          title: data.title,
          content: data.content,
          cover_image: data.cover_image,
          color: data.color,
          tags: data.tags || [],
          created_at: new Date(data.created_at),
          shared_at: new Date(data.shared_at),
        },
        timestamp: new Date(),
      };
    } catch (error: any) {
      const supabaseError = handleSupabaseError(
        error,
        `Fetching shared note ${shareId}`,
        'getSharedNote',
      );
      logger.error('Failed to get shared note:', supabaseError);
      return {
        success: false,
        error: supabaseError,
        operation: 'getSharedNote',
        timestamp: new Date(),
      };
    }
  }
}

export const shareRepository = new ShareRepository();
