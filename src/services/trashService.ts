/**
 * Trash Service - Supabase Repository Pattern
 * Handles soft delete and trash management for calendars
 * All types use snake_case to match Supabase schema
 */

import { Calendar } from '../types/dualWrite';
import { logger } from '../utils/logger';
import { CalendarRepository } from './repository/repositories/CalendarRepository';

const calendarRepository = new CalendarRepository();
const TRASH_RETENTION_DAYS = 30;

export interface TrashCalendar extends Calendar {
  deleted_at: Date;
  deleted_by: string;
  auto_delete_at: Date;
}

/**
 * Move a calendar to trash (soft delete)
 * Marks the calendar as deleted and sets deletion timestamps
 */
export const moveCalendarToTrash = async (calendarId: string, userId: string): Promise<void> => {
  try {
    const now = new Date();
    const auto_delete_at = new Date(now.getTime() + (TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000));

    await calendarRepository.update(calendarId, {
      deleted_at: now,
      deleted_by: userId,
      auto_delete_at: auto_delete_at,
      updated_at: now
    });

    logger.log(`Calendar ${calendarId} moved to trash`);
  } catch (error) {
    logger.error('Error moving calendar to trash:', error);
    throw error;
  }
};

/**
 * Restore a calendar from trash
 * Removes deletion markers and restores the calendar
 */
export const restoreCalendarFromTrash = async (calendarId: string): Promise<void> => {
  try {
    const calendar = await calendarRepository.findById(calendarId);

    if (!calendar) {
      throw new Error('Calendar not found');
    }

    if (!calendar.deleted_at) {
      throw new Error('Calendar is not in trash');
    }

    // Remove deletion markers
    await calendarRepository.update(calendarId, {
      deleted_at: undefined,
      deleted_by: undefined,
      auto_delete_at: undefined,
      updated_at: new Date()
    });

    logger.log(`Calendar ${calendarId} restored from trash`);
  } catch (error) {
    logger.error('Error restoring calendar from trash:', error);
    throw error;
  }
};

/**
 * Permanently delete a calendar from trash
 * Marks the calendar for deletion
 * The webhook will handle actual cleanup and final deletion
 */
export const permanentlyDeleteCalendar = async (calendarId: string): Promise<void> => {
  try {
    const calendar = await calendarRepository.findById(calendarId);

    if (!calendar) {
      throw new Error('Calendar not found');
    }

    if (!calendar.deleted_at) {
      throw new Error('Calendar is not in trash');
    }

    // Mark for deletion - webhook will handle actual deletion
    await calendarRepository.delete(calendarId);

    logger.log(`Calendar ${calendarId} marked for permanent deletion`);
  } catch (error) {
    logger.error('Error marking calendar for permanent deletion:', error);
    throw error;
  }
};

/**
 * Get all calendars in trash for a user
 * Returns soft-deleted calendars that haven't been marked for final deletion
 */
export const getTrashCalendars = async (userId: string): Promise<TrashCalendar[]> => {
  try {
    const calendars = await calendarRepository.findTrashByUserId(userId);

    return calendars.map(cal => ({
      ...cal,
      deleted_at: cal.deleted_at!,
      deleted_by: cal.deleted_by || userId,
      auto_delete_at: cal.auto_delete_at || new Date()
    } as TrashCalendar));
  } catch (error) {
    logger.error('Error getting trash calendars:', error);
    throw error;
  }
};
 

/**
 * Get days remaining until permanent deletion
 */
export const getDaysUntilDeletion = (auto_delete_at: Date): number => {
  const now = new Date();
  const timeDiff = auto_delete_at.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return Math.max(0, daysDiff);
};
 
