import { 
  collection, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  Timestamp,
  runTransaction,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Calendar, calendarConverter } from '../types/calendar';
import { log, error, logger } from '../utils/logger';

const CALENDARS_COLLECTION = 'calendars';
const TRASH_RETENTION_DAYS = 30;

export interface TrashCalendar extends Calendar {
  deletedAt: Date;
  deletedBy: string;
  autoDeleteAt: Date;
}

/**
 * Move a calendar to trash (soft delete)
 * Marks the calendar as deleted and sets deletion timestamps
 */
export const moveCalendarToTrash = async (calendarId: string, userId: string): Promise<void> => {
  try {
    const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
    const now = new Date();
    const autoDeleteAt = new Date(now.getTime() + (TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000));

    await updateDoc(calendarRef, {
      isDeleted: true,
      deletedAt: Timestamp.fromDate(now),
      deletedBy: userId,
      autoDeleteAt: Timestamp.fromDate(autoDeleteAt),
      lastModified: Timestamp.fromDate(now)
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
    const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);

    await runTransaction(db, async (transaction) => {
      const calendarDoc = await transaction.get(calendarRef);
      
      if (!calendarDoc.exists()) {
        throw new Error('Calendar not found');
      }

      const calendarData = calendarDoc.data();
      if (!calendarData.isDeleted) {
        throw new Error('Calendar is not in trash');
      }

      // Remove deletion markers
      transaction.update(calendarRef, {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        autoDeleteAt: null,
        lastModified: Timestamp.fromDate(new Date())
      });
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
    const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);

    await runTransaction(db, async (transaction) => {
      const calendarDoc = await transaction.get(calendarRef);
      
      if (!calendarDoc.exists()) {
        throw new Error('Calendar not found');
      }

      const calendarData = calendarDoc.data();
      if (!calendarData.isDeleted) {
        throw new Error('Calendar is not in trash');
      }

      // Permanently delete the calendar document
      transaction.delete(calendarRef);
    });

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
    const q = query(
      collection(db, CALENDARS_COLLECTION), 
      where("userId", "==", userId),
      where("isDeleted", "==", true)
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const calendar = calendarConverter.fromJson(doc);
      const data = doc.data();
      
      return {
        ...calendar,
        deletedAt: data.deletedAt.toDate(),
        deletedBy: data.deletedBy,
        autoDeleteAt: data.autoDeleteAt.toDate()
      } as TrashCalendar;
    });
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
    const q = query(
      collection(db, CALENDARS_COLLECTION),
      where("isDeleted", "==", true),
      where("autoDeleteAt", "<=", Timestamp.fromDate(now))
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const calendar = calendarConverter.fromJson(doc);
      const data = doc.data();
      
      return {
        ...calendar,
        deletedAt: data.deletedAt.toDate(),
        deletedBy: data.deletedBy,
        autoDeleteAt: data.autoDeleteAt.toDate()
      } as TrashCalendar;
    });
  } catch (error) {
    logger.error('Error getting calendars ready for deletion:', error);
    throw error;
  }
};

/**
 * Clean up expired calendars from trash
 * This should be called periodically (e.g., by a cloud function)
 */
export const cleanupExpiredCalendars = async (): Promise<number> => {
  try {
    const expiredCalendars = await getCalendarsReadyForDeletion();
    let deletedCount = 0;

    for (const calendar of expiredCalendars) {
      try {
        await permanentlyDeleteCalendar(calendar.id);
        deletedCount++;
        log(`Auto-deleted expired calendar: ${calendar.id} (${calendar.name})`);
      } catch (err) {
        error(`Failed to auto-delete calendar ${calendar.id}:`, err);
      }
    }

    log(`Cleanup completed: ${deletedCount} calendars permanently deleted`);
    return deletedCount;
  } catch (err) {
    error('Error during cleanup:', err);
    throw err;
  }
};

/**
 * Get days remaining until permanent deletion
 */
export const getDaysUntilDeletion = (autoDeleteAt: Date): number => {
  const now = new Date();
  const timeDiff = autoDeleteAt.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return Math.max(0, daysDiff);
};

/**
 * Check if a calendar is in trash
 */
export const isCalendarInTrash = async (calendarId: string): Promise<boolean> => {
  try {
    const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
    const calendarDoc = await getDoc(calendarRef);
    
    if (!calendarDoc.exists()) {
      return false;
    }
    
    const data = calendarDoc.data();
    return data.isDeleted === true;
  } catch (error) {
    logger.error('Error checking if calendar is in trash:', error);
    return false;
  }
};
