import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';

const db = admin.firestore();
const CALENDARS_COLLECTION = 'calendars';

/**
 * Cloud function that runs daily to clean up expired calendars from trash
 * Calendars that have been in trash for more than 30 days are permanently deleted
 */
export const cleanupExpiredCalendarsV2 = onSchedule('0 2 * * *', async (event) => {
    try {
      logger.info('Starting cleanup of expired calendars');

      const now = new Date();
      const q = db.collection(CALENDARS_COLLECTION)
        .where('isDeleted', '==', true)
        .where('autoDeleteAt', '<=', admin.firestore.Timestamp.fromDate(now));

      const querySnapshot = await q.get();
      let deletedCount = 0;
      const errors: string[] = [];

      logger.info(`Found ${querySnapshot.docs.length} calendars ready for deletion`);

      // Process each expired calendar
      for (const calendarDoc of querySnapshot.docs) {
        try {
          const calendarData = calendarDoc.data();
          const calendarId = calendarDoc.id;

          logger.info(`Deleting expired calendar: ${calendarId} (${calendarData.name})`);

          // Delete the calendar document
          await db.collection(CALENDARS_COLLECTION).doc(calendarId).delete();

          deletedCount++;
          logger.info(`Successfully deleted calendar: ${calendarId}`);

        } catch (error) {
          const errorMsg = `Failed to delete calendar ${calendarDoc.id}: ${error}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      logger.info(`Cleanup completed: ${deletedCount} calendars permanently deleted`);

      if (errors.length > 0) {
        logger.warn(`Cleanup completed with ${errors.length} errors:`, errors);
      }

    } catch (error) {
      logger.error('Error during calendar cleanup:', error);
      throw error;
    }
  });
