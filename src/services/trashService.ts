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
 * This action cannot be undone
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

    // Permanently delete the calendar
    await calendarRepository.delete(calendarId);

    logger.log(`Calendar ${calendarId} permanently deleted`);
  } catch (error) {
    logger.error('Error permanently deleting calendar:', error);
    throw error;
  }
};

/**
 * Get all calendars in trash for a user
 */
export const getTrashCalendars = async (userId: string): Promise<TrashCalendar[]> => {
  try {
    const calendars = await calendarRepository.findByUserId(userId);

    // Filter for deleted calendars
    return calendars
      .filter(cal => cal.deleted_at !== undefined && cal.deleted_at !== null)
      .map(cal => ({
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
 * Get calendars that are ready for automatic deletion
 * Used by cleanup functions
 */
export const getCalendarsReadyForDeletion = async (): Promise<TrashCalendar[]> => {
  try {
    const now = new Date();
    const allCalendars = await calendarRepository.findAll();

    // Filter for deleted calendars that are ready for deletion
    return allCalendars
      .filter(cal =>
        cal.deleted_at !== undefined &&
        cal.deleted_at !== null &&
        cal.auto_delete_at !== undefined &&
        cal.auto_delete_at !== null &&
        new Date(cal.auto_delete_at) <= now
      )
      .map(cal => ({
        ...cal,
        deleted_at: cal.deleted_at!,
        deleted_by: cal.deleted_by || '',
        auto_delete_at: cal.auto_delete_at!
      } as TrashCalendar));
  } catch (error) {
    logger.error('Error getting calendars ready for deletion:', error);
    throw error;
  }
};

/**
 * Clean up expired calendars from trash
 * This should be called periodically (e.g., by a Supabase Edge Function)
 */
export const cleanupExpiredCalendars = async (): Promise<number> => {
  try {
    const expiredCalendars = await getCalendarsReadyForDeletion();
    let deletedCount = 0;

    for (const calendar of expiredCalendars) {
      try {
        await permanentlyDeleteCalendar(calendar.id);
        deletedCount++;
        logger.log(`Auto-deleted expired calendar: ${calendar.id} (${calendar.name})`);
      } catch (err) {
        logger.error(`Failed to auto-delete calendar ${calendar.id}:`, err);
      }
    }

    logger.log(`Cleanup completed: ${deletedCount} calendars permanently deleted`);
    return deletedCount;
  } catch (err) {
    logger.error('Error during cleanup:', err);
    throw err;
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

/**
 * Check if a calendar is in trash
 */
export const isCalendarInTrash = async (calendarId: string): Promise<boolean> => {
  try {
    const calendar = await calendarRepository.findById(calendarId);

    if (!calendar) {
      return false;
    }

    return calendar.deleted_at !== undefined && calendar.deleted_at !== null;
  } catch (error) {
    logger.error('Error checking if calendar is in trash:', error);
    return false;
  }
};
