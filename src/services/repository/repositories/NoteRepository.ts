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
