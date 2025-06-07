import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const CALENDARS_COLLECTION = 'calendars';

/**
 * Cloud function that runs daily to clean up expired calendars from trash
 * Calendars that have been in trash for more than 30 days are permanently deleted
 */
export const cleanupExpiredCalendars = functions.pubsub
  .schedule('every day 02:00')
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      functions.logger.info('Starting cleanup of expired calendars');

      const now = new Date();
      const q = db.collection(CALENDARS_COLLECTION)
        .where('isDeleted', '==', true)
        .where('autoDeleteAt', '<=', admin.firestore.Timestamp.fromDate(now));

      const querySnapshot = await q.get();
      let deletedCount = 0;
      const errors: string[] = [];

      functions.logger.info(`Found ${querySnapshot.docs.length} calendars ready for deletion`);

      // Process each expired calendar
      for (const calendarDoc of querySnapshot.docs) {
        try {
          const calendarData = calendarDoc.data();
          const calendarId = calendarDoc.id;

          functions.logger.info(`Deleting expired calendar: ${calendarId} (${calendarData.name})`);

          // Delete the calendar document
          await db.collection(CALENDARS_COLLECTION).doc(calendarId).delete();

          deletedCount++;
          functions.logger.info(`Successfully deleted calendar: ${calendarId}`);

        } catch (error) {
          const errorMsg = `Failed to delete calendar ${calendarDoc.id}: ${error}`;
          functions.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      functions.logger.info(`Cleanup completed: ${deletedCount} calendars permanently deleted`);

      if (errors.length > 0) {
        functions.logger.warn(`Cleanup completed with ${errors.length} errors:`, errors);
      }

      return {
        success: true,
        deletedCount,
        errors: errors.length,
        message: `Cleanup completed: ${deletedCount} calendars deleted, ${errors.length} errors`
      };

    } catch (error) {
      functions.logger.error('Error during calendar cleanup:', error);
      throw error;
    }
  });
