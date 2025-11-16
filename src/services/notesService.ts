/**
 * Notes Service
 * Simple service for Notion-style notes
 */

import { Note, CreateNoteInput, UpdateNoteInput } from '../types/note';
import { logger } from '../utils/logger';
import { NoteRepository, NoteQueryOptions, NoteQueryResult } from './repository/repositories/NoteRepository';

const noteRepository = new NoteRepository();

// Re-export types for convenience
export type { NoteQueryOptions, NoteQueryResult };

/**
 * Get all notes for a user
 */
export const getUserNotes = async (userId: string): Promise<Note[]> => {
  try {
    return await noteRepository.findByUserId(userId);
  } catch (error) {
    logger.error('Error getting user notes:', error);
    return [];
  }
};

/**
 * Query notes for a user with filtering, search, and pagination
 */
export const queryUserNotes = async (
  userId: string,
  options: NoteQueryOptions = {}
): Promise<NoteQueryResult> => {
  try {
    return await noteRepository.queryByUserId(userId, options);
  } catch (error) {
    logger.error('Error querying user notes:', error);
    return { notes: [], total: 0, hasMore: false };
  }
};

/**
 * Get all notes for a calendar
 */
export const getCalendarNotes = async (calendarId: string): Promise<Note[]> => {
  try {
    return await noteRepository.findByCalendarId(calendarId);
  } catch (error) {
    logger.error('Error getting calendar notes:', error);
    return [];
  }
};

/**
 * Query notes for a calendar with filtering, search, and pagination
 */
export const queryCalendarNotes = async (
  calendarId: string,
  options: NoteQueryOptions = {}
): Promise<NoteQueryResult> => {
  try {
    return await noteRepository.queryByCalendarId(calendarId, options);
  } catch (error) {
    logger.error('Error querying calendar notes:', error);
    return { notes: [], total: 0, hasMore: false };
  }
};

/**
 * Get a single note by ID
 */
export const getNote = async (noteId: string): Promise<Note | null> => {
  try {
    return await noteRepository.findById(noteId);
  } catch (error) {
    logger.error('Error getting note:', error);
    return null;
  }
};

/**
 * Create a new note
 */
export const createNote = async (noteInput: CreateNoteInput): Promise<Note> => {
  try {
    const noteData = {
      ...noteInput,
      title: noteInput.title || 'Untitled',
      content: noteInput.content || '',
      cover_image: noteInput.cover_image ?? null,
      is_archived: false,
      is_pinned: false,
      archived_at: null,
    };
    const result = await noteRepository.create(noteData);
    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to create note');
    }
    return  result.data as Note;
  } catch (error) {
    logger.error('Error creating note:', error);
    throw error;
  }
};

/**
 * Update an existing note
 */
export const updateNote = async (
  noteId: string,
  updates: UpdateNoteInput
): Promise<void> => {
  try {
    const result = await noteRepository.update(noteId, updates);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to update note');
    }
  } catch (error) {
    logger.error('Error updating note:', error);
    throw error;
  }
};

/**
 * Delete a note (hard delete)
 */
export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    const result = await noteRepository.delete(noteId);
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to delete note');
    }
  } catch (error) {
    logger.error('Error deleting note:', error);
    throw error;
  }
};

/**
 * Archive a note (soft delete)
 */
export const archiveNote = async (noteId: string): Promise<void> => {
  try {
    const success = await noteRepository.archiveNote(noteId);
    if (!success) {
      throw new Error('Failed to archive note');
    }
  } catch (error) {
    logger.error('Error archiving note:', error);
    throw error;
  }
};

/**
 * Unarchive a note
 */
export const unarchiveNote = async (noteId: string): Promise<void> => {
  try {
    const success = await noteRepository.unarchiveNote(noteId);
    if (!success) {
      throw new Error('Failed to unarchive note');
    }
  } catch (error) {
    logger.error('Error unarchiving note:', error);
    throw error;
  }
};

/**
 * Pin a note
 */
export const pinNote = async (noteId: string): Promise<void> => {
  try {
    const success = await noteRepository.pinNote(noteId);
    if (!success) {
      throw new Error('Failed to pin note');
    }
  } catch (error) {
    logger.error('Error pinning note:', error);
    throw error;
  }
};

/**
 * Unpin a note
 */
export const unpinNote = async (noteId: string): Promise<void> => {
  try {
    const success = await noteRepository.unpinNote(noteId);
    if (!success) {
      throw new Error('Failed to unpin note');
    }
  } catch (error) {
    logger.error('Error unpinning note:', error);
    throw error;
  }
};

/**
 * Move a note to a different calendar
 */
export const moveNoteToCalendar = async (
  noteId: string,
  calendarId: string
): Promise<void> => {
  try {
    const success = await noteRepository.moveNoteToCalendar(noteId, calendarId);
    if (!success) {
      throw new Error('Failed to move note to calendar');
    }
  } catch (error) {
    logger.error('Error moving note to calendar:', error);
    throw error;
  }
};
