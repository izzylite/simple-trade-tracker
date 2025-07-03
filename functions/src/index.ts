import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { handleTradeYearChanges, canDeleteImage, cleanupRemovedImagesHelper, haveTagsChanged, updateTagsWithGroupNameChange, updateTradeTagsWithGroupNameChange, updateCalendarTagsFromTradeChanges, findDuplicatedCalendarsQuery } from './utils';

admin.initializeApp();

// Enforce App Check on all callable functions
export const enforceAppCheck = async (context: any) => {
  if (context.app == undefined) {
    throw new HttpsError(
      'failed-precondition',
      'The function must be called from an App Check verified app.'
    );
  }
};

// Export the cleanup function
export { cleanupExpiredCalendarsV2 } from './cleanupExpiredCalendars';

// Export the sharing functions
export { generateTradeShareLinkV2, getSharedTradeV2, deactivateSharedTradeV2 } from './sharing';

// Export the economic calendar functions
export { autoRefreshEconomicCalendarV2, processHtmlEconomicEvents, refreshEconomicCalendar } from './economicCalendar';

 

// Cloud function to handle year document updates - cleans up removed images and handles trade date changes
export const onTradeChangedV2 = onDocumentUpdated('calendars/{calendarId}/years/{yearId}', async (event) => {
  try {
    // First, handle any removed images
    await cleanupRemovedImagesHelper(event);

    // Then, handle any trade date changes
    await handleTradeYearChanges(event);

    // Check if tags have changed before updating calendar tags
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (haveTagsChanged(beforeData, afterData)) {
      console.log(`Tags changed in calendar ${event.params.calendarId}, updating calendar tags`);
      await updateCalendarTagsFromTradeChanges(event.params.calendarId, beforeData, afterData, event.params.yearId);
    } else {
      console.log(`No tag changes detected in calendar ${event.params.calendarId}, skipping calendar tags update`);
    }
  } catch (error) {
    console.error('Error in onTradeChanged function:', error);
  }
});


// Cloud function to delete all trades and images when a calendar is deleted
export const cleanupDeletedCalendarV2 = onDocumentDeleted('calendars/{calendarId}', async (event) => {
  try {
    
    const calendarData = {...event.data?.data()};
    if (!calendarData) {
      console.log('No data in deleted calendar document');
      return;
    }

    const calendarId = event.params.calendarId;
    const userId = calendarData.userId;

      if (!userId) {
        console.error('Calendar document does not have a userId field');
        return;
      }

      console.log(`Processing deletion of calendar ${calendarId} for user ${userId}`);

      // 1. Get all year documents
      const yearsSnapshot = await admin.firestore().collection(`calendars/${calendarId}/years`).get();

      // Track all image IDs to potentially delete
      const imageIdsToCheck = new Set();

      // 2. Process each year document to find trades with images
      for (const yearDoc of yearsSnapshot.docs) {
        const yearData = yearDoc.data();
        const trades = yearData.trades || [];

        // Extract image IDs from all trades
        trades.forEach((trade: any) => {
          if (trade.images && Array.isArray(trade.images)) {
            trade.images.forEach((image: any) => {
              if (image && image.id) {
                imageIdsToCheck.add(image.id);
              }
            });
          }
        });
      }

      console.log(`Found ${imageIdsToCheck.size} images to check for deletion`);

      // 3. Filter images using comprehensive logic with caching
      const imageIdsToDelete = new Set();

      // Create cache for years snapshots to avoid duplicate queries
      const yearsSnapshotCache = new Map<string, admin.firestore.QuerySnapshot<admin.firestore.DocumentData>>();
      let duplicatedCalendarsSnapshot: admin.firestore.QuerySnapshot<admin.firestore.DocumentData> | null = null;

      // Callback function to get years snapshot with caching
      const getYearsSnapshot = async (calendarId: string) => {
        if (!yearsSnapshotCache.has(calendarId)) {
          const snapshot = await admin.firestore().collection(`calendars/${calendarId}/years`).get();
          yearsSnapshotCache.set(calendarId, snapshot);
        }
        return yearsSnapshotCache.get(calendarId)!;
      };

      // Callback function to get duplicated calendars snapshot with caching
      const getDuplicatedCalendarsSnapshot = async () => {
        if (!duplicatedCalendarsSnapshot) {
          duplicatedCalendarsSnapshot = await findDuplicatedCalendarsQuery(calendarId, userId);
        }
        return duplicatedCalendarsSnapshot;
      };

      for (const imageId of imageIdsToCheck) {
        const canDelete = await canDeleteImage(
          imageId as string, calendarId, calendarData,
          getYearsSnapshot, getDuplicatedCalendarsSnapshot
        );
        if (canDelete) {
          imageIdsToDelete.add(imageId);
          console.log(`Image ${imageId} can be safely deleted`);
        } else {
          console.log(`Image ${imageId} cannot be deleted - exists in related calendars`);
        }
      }

      console.log(`Will delete ${imageIdsToDelete.size} images`);

      // 4. Delete filtered images from storage
      const deletePromises = Array.from(imageIdsToDelete).map(async (imageId) => {
        try {
          const imageRef = admin.storage().bucket().file(`users/${userId}/trade-images/${imageId}`);
          await imageRef.delete();
          console.log(`Successfully deleted image: ${imageId}`);
        } catch (error) {
          console.error(`Error deleting image ${imageId}:`, error);
          // Continue with other deletions even if one fails
        }
      });

      await Promise.all(deletePromises);

      // 5. Delete all year documents
      const yearDeletePromises = yearsSnapshot.docs.map(async (yearDoc) => {
        await yearDoc.ref.delete();
        console.log(`Deleted year document: ${yearDoc.id}`);
      });

      await Promise.all(yearDeletePromises);

      console.log(`Successfully cleaned up calendar ${calendarId}`);
    } catch (error) {
      console.error('Error in cleanupDeletedCalendar function:', error);
    }
  });

// Cloud function to update a tag across all trades in a calendar (v2)
export const updateTagV2 = onCall({
  cors: true, // Enable CORS for web requests
  enforceAppCheck: true, // Enable App Check verification
}, async (request) => {
  try {
    // Ensure App Check is valid
    await enforceAppCheck(request);
    
    // Ensure user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = request.auth.uid;

    // Validate input data
    const { calendarId, oldTag, newTag } = request.data;
    console.log('Extracted parameters:', { calendarId, oldTag, newTag });

    if (!calendarId || !oldTag || newTag === undefined || newTag === null) {
      console.log('Validation failed:', { calendarId: !!calendarId, oldTag: !!oldTag, newTag: newTag !== undefined && newTag !== null });
      throw new HttpsError('invalid-argument', 'Missing required parameters: calendarId, oldTag, or newTag');
    }

    // If oldTag and newTag are the same, no update needed
    if (oldTag === newTag) {
      console.log('oldTag and newTag are identical, no update needed');
      return { success: true, tradesUpdated: 0 };
    }

    // Get the calendar document to verify ownership
    const calendarRef = admin.firestore().collection('calendars').doc(calendarId);
    const calendarDoc = await calendarRef.get();

    if (!calendarDoc.exists) {
      throw new HttpsError('not-found', 'Calendar not found');
    }

    const calendarData = calendarDoc.data();
    if (!calendarData || calendarData.userId !== uid) {
      throw new HttpsError('permission-denied', 'Unauthorized access to calendar');
    }

        const updateData: any = {
        lastModified: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (calendarData.requiredTagGroups) {
        // Update required tag groups when a group name changes
        // If oldTag is "Strategy:Long" and newTag is "NewStrategy:Long", update "Strategy" to "NewStrategy"
        // If oldTag is "Strategy:Long" and newTag is "Strategy:Short", no change needed
        // If newTag is empty (tag deletion), remove the group if no other tags use it 
        const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null;
        const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null;

        if (oldGroup && newGroup && oldGroup !== newGroup) {
          // Group name changed, update it in requiredTagGroups
          updateData.requiredTagGroups = calendarData.requiredTagGroups.map((group: string) =>
            group === oldGroup ? newGroup : group
          );
        } else if (oldGroup && !newTag.trim()) {
          // Tag is being deleted, we'll handle group cleanup in updateCalendarTags
          // For now, keep the requiredTagGroups as is
          updateData.requiredTagGroups = calendarData.requiredTagGroups;
        } else {
          // No group change needed
          updateData.requiredTagGroups = calendarData.requiredTagGroups;
        }
      }
      if (calendarData.tags) {
        updateData.tags = updateTagsWithGroupNameChange(calendarData.tags, oldTag, newTag);
      }
      if (calendarData.scoreSettings?.excludedTagsFromPatterns) {
        updateData['scoreSettings.excludedTagsFromPatterns'] = updateTagsWithGroupNameChange(calendarData.scoreSettings.excludedTagsFromPatterns, oldTag, newTag);
      }
      if (calendarData.scoreSettings?.selectedTags) {
        updateData['scoreSettings.selectedTags'] = updateTagsWithGroupNameChange(calendarData.scoreSettings.selectedTags, oldTag, newTag);
      }

      await calendarDoc.ref.update(updateData);




      // Get all year documents for this calendar
      const yearsRef = admin.firestore().collection(`calendars/${calendarId}/years`);
      const yearsSnapshot = await yearsRef.get();

    if (yearsSnapshot.empty) {
      return { success: true, tradesUpdated: 0 };
    }
      console.log(`updating old tag : ${oldTag} to new tag: ${newTag}`)
      let totalTradesUpdated = 0;
      let batch = admin.firestore().batch();
      const batchPromises = [];
      let currentBatchSize = 0;
      const MAX_BATCH_SIZE = 500; // Firestore limit
 
      // Process each year document
      for (const yearDoc of yearsSnapshot.docs) {
        const yearData = yearDoc.data();
        const trades = yearData.trades || [];
        let yearUpdated = false;

        // Check each trade for tags that need updating
        for (let i = 0; i < trades.length; i++) {
          const trade = trades[i];
          const result = updateTradeTagsWithGroupNameChange(trade, oldTag, newTag);

          if (result.updated) {
            yearUpdated = true;
            totalTradesUpdated += result.updatedCount;
          }
        }

        // If any trades in this year were updated, update the year document
        if (yearUpdated) {
          batch.update(yearDoc.ref, {
            trades: trades,
            lastModified: admin.firestore.FieldValue.serverTimestamp()
          });
          currentBatchSize++;

          // If batch is full, commit it and start a new one
          if (currentBatchSize >= MAX_BATCH_SIZE) {
            batchPromises.push(batch.commit());
            batch = admin.firestore().batch();
            currentBatchSize = 0;
          }
        }
      }

      // Commit any remaining batched operations
      if (currentBatchSize > 0) {
        batchPromises.push(batch.commit());
      }

      // Wait for all batch operations to complete
      await Promise.all(batchPromises);

    return {
      success: true,
      tradesUpdated: totalTradesUpdated
    };
  } catch (error) {
    console.error('Error in updateTag function:', error);
    if (error instanceof HttpsError) {
      throw error;
    } else if (error instanceof Error) {
      throw new HttpsError('internal', error.message);
    } else {
      throw new HttpsError('internal', 'An unknown error occurred');
    }
  }
});


 
 



