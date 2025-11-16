/**
 * Note Repository
 * Handles Supabase operations for simple notes
 */

import {
  AbstractBaseRepository,
  RepositoryConfig
} from './BaseRepository';
import { Note } from '../../../types/note';
import { logger } from '../../../utils/logger';
import { supabase } from '../../../config/supabase';
import { supabaseAuthService } from '../../supabaseAuthService';

/**
 * Query options for filtering and pagination
 */
export interface NoteQueryOptions {
  isPinned?: boolean;
  isArchived?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query result with pagination info
 */
export interface NoteQueryResult {
  notes: Note[];
  total: number;
  hasMore: boolean;
}

/**
 * Safely parse a date value
 */
const parseDate = (dateValue: any, fallback: Date = new Date()): Date => {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? fallback : parsed;
};

/**
 * Transform Supabase note data to Note type
 */
const transformSupabaseNote = (data: any): Note => {
  return {
    ...data,
    created_at: parseDate(data.created_at),
    updated_at: parseDate(data.updated_at),
    archived_at: data.archived_at ? parseDate(data.archived_at) : null,
  } as Note;
};

export class NoteRepository extends AbstractBaseRepository<Note> {
  constructor(config?: Partial<RepositoryConfig>) {
    super(config);
  }

  // READ OPERATIONS

  async findById(id: string): Promise<Note | null> {
    try {
      await supabaseAuthService.ensureValidSession();

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Error finding note by ID:', error);
        return null;
      }

      return data ? transformSupabaseNote(data) : null;
    } catch (error) {
      logger.error('Error finding note by ID:', error);
      return null;
    }
  }

  async findByUserId(userId: string): Promise<Note[]> {
    try {
      await supabaseAuthService.ensureValidSession();

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('Error finding notes by user ID:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseNote(item)) : [];
    } catch (error) {
      logger.error('Exception finding notes by user ID:', error);
      return [];
    }
  }

  /**
   * Query notes by user ID with filtering, search, and pagination
   */
  async queryByUserId(userId: string, options: NoteQueryOptions = {}): Promise<NoteQueryResult> {
    try {
      await supabaseAuthService.ensureValidSession();

      const {
        isPinned,
        isArchived,
        searchQuery,
        limit = 20,
        offset = 0
      } = options;

      // Build the query
      let query = supabase
        .from('notes')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply filters
      if (isPinned !== undefined) {
        query = query.eq('is_pinned', isPinned);
      }
      if (isArchived !== undefined) {
        query = query.eq('is_archived', isArchived);
      }

      // Apply search (search in title and content)
      if (searchQuery && searchQuery.trim() !== '') {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }

      // Apply ordering, pagination
      query = query
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error querying notes by user ID:', error);
        return { notes: [], total: 0, hasMore: false };
      }

      const notes = data ? data.map(item => transformSupabaseNote(item)) : [];
      const total = count || 0;
      const hasMore = offset + limit < total;

      return { notes, total, hasMore };
    } catch (error) {
      logger.error('Exception querying notes by user ID:', error);
      return { notes: [], total: 0, hasMore: false };
    }
  }

  async findByCalendarId(calendarId: string): Promise<Note[]> {
    try {
      await supabaseAuthService.ensureValidSession();

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('Error finding notes by calendar ID:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseNote(item)) : [];
    } catch (error) {
      logger.error('Exception finding notes by calendar ID:', error);
      return [];
    }
  }

  /**
   * Query notes by calendar ID with filtering, search, and pagination
   */
  async queryByCalendarId(calendarId: string, options: NoteQueryOptions = {}): Promise<NoteQueryResult> {
    try {
      await supabaseAuthService.ensureValidSession();

      const {
        isPinned,
        isArchived,
        searchQuery,
        limit = 20,
        offset = 0
      } = options;

      // Build the query
      let query = supabase
        .from('notes')
        .select('*', { count: 'exact' })
        .eq('calendar_id', calendarId);

      // Apply filters
      if (isPinned !== undefined) {
        query = query.eq('is_pinned', isPinned);
      }
      if (isArchived !== undefined) {
        query = query.eq('is_archived', isArchived);
      }

      // Apply search (search in title and content)
      if (searchQuery && searchQuery.trim() !== '') {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }

      // Apply ordering, pagination
      query = query
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error querying notes by calendar ID:', error);
        return { notes: [], total: 0, hasMore: false };
      }

      const notes = data ? data.map(item => transformSupabaseNote(item)) : [];
      const total = count || 0;
      const hasMore = offset + limit < total;

      return { notes, total, hasMore };
    } catch (error) {
      logger.error('Exception querying notes by calendar ID:', error);
      return { notes: [], total: 0, hasMore: false };
    }
  }

  async findAll(): Promise<Note[]> {
    try {
      await supabaseAuthService.ensureValidSession();

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        logger.error('Error finding all notes:', error);
        return [];
      }

      return data ? data.map(item => transformSupabaseNote(item)) : [];
    } catch (error) {
      logger.error('Error finding all notes:', error);
      return [];
    }
  }

  // ARCHIVE OPERATIONS

  /**
   * Archive a note (soft delete)
   */
  async archiveNote(noteId: string): Promise<boolean> {
    try {
      await supabaseAuthService.ensureValidSession();

      const { error } = await supabase
        .from('notes')
        .update({
          is_archived: true,
          updated_at: new Date()
        })
        .eq('id', noteId);

      if (error) {
        logger.error('Error archiving note:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Exception archiving note:', error);
      return false;
    }
  }

  /**
   * Unarchive a note
   */
  async unarchiveNote(noteId: string): Promise<boolean> {
    try {
      await supabaseAuthService.ensureValidSession();

      const { error } = await supabase
        .from('notes')
        .update({
          is_archived: false,
          updated_at: new Date()
        })
        .eq('id', noteId);

      if (error) {
        logger.error('Error unarchiving note:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Exception unarchiving note:', error);
      return false;
    }
  }

  // MOVE OPERATIONS

  /**
   * Move a note to a different calendar
   */
  async moveNoteToCalendar(noteId: string, calendarId: string): Promise<boolean> {
    try {
      await supabaseAuthService.ensureValidSession();

      const { error } = await supabase
        .from('notes')
        .update({
          calendar_id: calendarId,
          updated_at: new Date()
        })
        .eq('id', noteId);

      if (error) {
        logger.error('Error moving note to calendar:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Exception moving note to calendar:', error);
      return false;
    }
  }

  // PIN OPERATIONS

  /**
   * Pin a note
   */
  async pinNote(noteId: string): Promise<boolean> {
    try {
      await supabaseAuthService.ensureValidSession();

      const { error } = await supabase
        .from('notes')
        .update({
          is_pinned: true,
          updated_at: new Date()
        })
        .eq('id', noteId);

      if (error) {
        logger.error('Error pinning note:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Exception pinning note:', error);
      return false;
    }
  }

  /**
   * Unpin a note
   */
  async unpinNote(noteId: string): Promise<boolean> {
    try {
      await supabaseAuthService.ensureValidSession();

      const { error } = await supabase
        .from('notes')
        .update({
          is_pinned: false,
          updated_at: new Date()
        })
        .eq('id', noteId);

      if (error) {
        logger.error('Error unpinning note:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Exception unpinning note:', error);
      return false;
    }
  }

  // SUPABASE OPERATIONS

  protected async createInSupabase(entity: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    const now = new Date();
    const noteWithTimestamps = {
      ...entity,
      title: entity.title || 'Untitled',
      content: entity.content || '',
      is_archived: false,
      is_pinned: false,
      archived_at: null,
      created_at: now,
      updated_at: now,
    } as Note;

    const { data, error } = await supabase
      .from('notes')
      .insert(noteWithTimestamps)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return transformSupabaseNote(data);
  }

  protected async updateInSupabase(id: string, updates: Partial<Note>): Promise<Note> {
    const updatesWithTimestamp = {
      ...updates,
      updated_at: new Date()
    };

    const { data, error } = await supabase
      .from('notes')
      .update(updatesWithTimestamp)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return transformSupabaseNote(data);
  }

  protected async deleteInSupabase(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }
}
