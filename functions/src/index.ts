import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as cors from 'cors';
import { handleTradeYearChanges, canDeleteImage, cleanupRemovedImagesHelper, updateCalendarTags, haveTagsChanged } from './utils';

admin.initializeApp();

// Export the cleanup function
export { cleanupExpiredCalendars } from './cleanupExpiredCalendars';

 

// Cloud function to handle year document updates - cleans up removed images and handles trade date changes
export const onTradeChanged = functions.firestore
  .document('calendars/{calendarId}/years/{yearId}')
  .onUpdate(async (change, context) => {
    try {
      // First, handle any removed images
      await cleanupRemovedImagesHelper(change);

      // Then, handle any trade date changes
      await handleTradeYearChanges(change, context);

      // Check if tags have changed before updating calendar tags
      const beforeData = change.before.data();
      const afterData = change.after.data();

      if (haveTagsChanged(beforeData, afterData)) {
        console.log(`Tags changed in calendar ${context.params.calendarId}, updating calendar tags`);
        await updateCalendarTags(context.params.calendarId);
      } else {
        console.log(`No tag changes detected in calendar ${context.params.calendarId}, skipping calendar tags update`);
      }

      return null;
    } catch (error) {
      console.error('Error in onTradeChanged function:', error);
      return null;
    }
  });


// Cloud function to delete all trades and images when a calendar is deleted
export const cleanupDeletedCalendar = functions.firestore
  .document('calendars/{calendarId}')
  .onDelete(async (snapshot) => {
    try {
      const calendarData = snapshot.data();
      if (!calendarData) {
        console.log('No data in deleted calendar document');
        return null;
      }

      const calendarId = snapshot.id;
      const userId = calendarData.userId;

      if (!userId) {
        console.error('Calendar document does not have a userId field');
        return null;
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

      // 3. Filter images using comprehensive logic
      const imageIdsToDelete = new Set();

      for (const imageId of imageIdsToCheck) {
        const canDelete = await canDeleteImage(imageId as string, calendarId, userId);
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
      return null;
    } catch (error) {
      console.error('Error in cleanupDeletedCalendar function:', error);
      return null;
    }
  });

// Configure CORS middleware
const corsHandler = cors({ origin: true });

// Cloud function to update a tag across all trades in a calendar
export const updateTag = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      // Only allow POST requests
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
      }

      // Get data from request body
      const data = req.body;

      // Get authorization token from header
      const authHeader = req.headers.authorization;
      const idToken = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split('Bearer ')[1]
        : null;

      // Validate input data
      const { calendarId, oldTag, newTag } = data;

      if (!calendarId || !oldTag || newTag === undefined || newTag === null) {
        res.status(400).json({ error: 'Missing required parameters: calendarId, oldTag, or newTag' });
        return;
      }

      // Ensure user is authenticated
      if (!idToken) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Verify the ID token
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        res.status(401).json({ error: 'Invalid authentication token' });
        return;
      }

      const uid = decodedToken.uid;

      // Get the calendar document to verify ownership
      const calendarRef = admin.firestore().collection('calendars').doc(calendarId);
      const calendarDoc = await calendarRef.get();

      if (!calendarDoc.exists) {
        res.status(404).json({ error: 'Calendar not found' });
        return;
      }

      const calendarData = calendarDoc.data();
      if (!calendarData || calendarData.userId !== uid) {
        res.status(403).json({ error: 'Unauthorized access to calendar' });
        return;
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
        updateData.tags = calendarData.tags.map((tag: string) => tag === oldTag ? newTag : tag);
      }
      if (calendarData.scoreSettings?.excludedTagsFromPatterns) {
        updateData['scoreSettings.excludedTagsFromPatterns'] = calendarData.scoreSettings.excludedTagsFromPatterns.map((tag: string) => tag === oldTag ? newTag : tag).filter((tag : string)=> tag !== '');
      }
      if (calendarData.scoreSettings?.selectedTags) {
        updateData['scoreSettings.selectedTags'] = calendarData.scoreSettings.selectedTags.map((tag: string) => tag === oldTag ? newTag : tag).filter((tag : string)=> tag !== '');
      }

      await calendarDoc.ref.update(updateData);




      // Get all year documents for this calendar
      const yearsRef = admin.firestore().collection(`calendars/${calendarId}/years`);
      const yearsSnapshot = await yearsRef.get();

      if (yearsSnapshot.empty) {
        res.status(200).json({ success: true, tradesUpdated: 0 });
        return;
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

        // Check each trade for the tag
        for (let i = 0; i < trades.length; i++) {
          const trade = trades[i];
          if (trade.tags && Array.isArray(trade.tags) && trade.tags.includes(oldTag)) {
            // Replace the old tag with the new tag
            const tagIndex = trade.tags.indexOf(oldTag);
            if (newTag.trim() === '') {
              trade.tags.splice(tagIndex, 1);
            } else {
              trade.tags[tagIndex] = newTag.trim();
            }
            yearUpdated = true;
            totalTradesUpdated++;
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

       

      res.status(200).json({
        success: true,
        tradesUpdated: totalTradesUpdated
      });
    } catch (error) {
      console.error('Error in updateTag function:', error);
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'An unknown error occurred' });
      }
    }
  });
});


 
 



