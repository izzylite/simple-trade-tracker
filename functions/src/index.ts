import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as cors from 'cors';

admin.initializeApp();

// Helper function to handle trade date changes that result in year changes
async function handleTradeYearChanges(change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) {
  try {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const calendarId = context.params.calendarId;
    const yearId = context.params.yearId;

    if (!beforeData || !afterData) {
      console.log('No data in document');
      return;
    }

    // Extract trades from before and after
    const beforeTrades = beforeData.trades || [];
    const afterTrades = afterData.trades || [];

    // Create a map of all trades in the 'before' state for quick lookup
    const beforeTradesMap = new Map();
    beforeTrades.forEach((trade: any) => {
      if (trade && trade.id) {
        beforeTradesMap.set(trade.id, trade);
      }
    });

    // Create a map of all trades in the 'after' state for quick lookup
    const afterTradesMap = new Map();
    afterTrades.forEach((trade: any) => {
      if (trade && trade.id) {
        afterTradesMap.set(trade.id, trade);
      }
    });

    // Find trades that were updated with a date change
    const tradesWithDateChanges: Array<{id: string, newTrade: any}> = [];

    // Check trades that exist in both before and after
    beforeTradesMap.forEach((beforeTrade, tradeId) => {
      const afterTrade = afterTradesMap.get(tradeId);

      // If the trade exists in both states and the date has changed
      if (afterTrade) {
        const beforeDate = beforeTrade.date?.toDate ? beforeTrade.date.toDate() : new Date(beforeTrade.date);
        const afterDate = afterTrade.date?.toDate ? afterTrade.date.toDate() : new Date(afterTrade.date);

        const beforeYear = beforeDate.getFullYear();
        const afterYear = afterDate.getFullYear();

        // If the year has changed
        if (beforeYear !== afterYear) {
          tradesWithDateChanges.push({
            id: tradeId,
            newTrade: afterTrade
          });
        }
      }
    });

    // If there are no trades with date changes, return early
    if (tradesWithDateChanges.length === 0) {
      console.log('No trades with date changes that affect year');
      return;
    }

    console.log(`Found ${tradesWithDateChanges.length} trades with year changes`);

    // Process each trade with a date change
    for (const { id, newTrade } of tradesWithDateChanges) {
      const newDate = newTrade.date?.toDate ? newTrade.date.toDate() : new Date(newTrade.date);
      const newYear = newDate.getFullYear().toString();

      // Skip if the new year is the same as the current document (should not happen)
      if (newYear === yearId) {
        console.log(`Trade ${id} new year ${newYear} is the same as current year ${yearId}, skipping`);
        continue;
      }

      console.log(`Moving trade ${id} from year ${yearId} to year ${newYear}`);

      // Get the target year document
      const targetYearRef = admin.firestore().collection(`calendars/${calendarId}/years`).doc(newYear);
      const targetYearDoc = await targetYearRef.get();

      // Start a transaction to ensure data consistency
      await admin.firestore().runTransaction(async (transaction) => {
        // Get the current year document to remove the trade
        const currentYearRef = change.after.ref;
        const currentYearDoc = await transaction.get(currentYearRef);

        if (!currentYearDoc.exists) {
          console.error(`Current year document ${yearId} not found in transaction`);
          return;
        }

        // Get the current trades and remove the trade that's being moved
        const currentYearData = currentYearDoc.data();
        const currentTrades = currentYearData?.trades || [];
        const updatedCurrentTrades = currentTrades.filter((trade: any) => trade.id !== id);

        // If the target year document exists, add the trade to its trades array
        if (targetYearDoc.exists) {
          const targetYearData = targetYearDoc.data();
          const targetTrades = targetYearData?.trades || [];

          // Add the trade to the target year's trades
          targetTrades.push(newTrade);

          // Update the target year document
          transaction.update(targetYearRef, {
            trades: targetTrades,
            lastModified: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Create a new year document with the trade
          transaction.set(targetYearRef, {
            year: parseInt(newYear),
            trades: [newTrade],
            lastModified: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Update the current year document to remove the trade
        transaction.update(currentYearRef, {
          trades: updatedCurrentTrades,
          lastModified: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Removed trade ${id} from year ${yearId} (${currentTrades.length} -> ${updatedCurrentTrades.length} trades)`);
      });

      console.log(`Successfully moved trade ${id} to year ${newYear}`);
    }
  } catch (error) {
    console.error('Error in handleTradeYearChanges function:', error);
  }
}

// Helper function to check if an image exists in a specific calendar
async function imageExistsInCalendar(imageId: string, calendarId: string): Promise<boolean> {
  try {
    // Get all year documents from the calendar
    const yearsSnapshot = await admin.firestore().collection(`calendars/${calendarId}/years`).get();

    for (const yearDoc of yearsSnapshot.docs) {
      const yearData = yearDoc.data();
      const trades = yearData.trades || [];

      // Check if any trade in this year has the image
      for (const trade of trades) {
        if (trade.images && Array.isArray(trade.images)) {
          for (const image of trade.images) {
            if (image && image.id === imageId) {
              return true;
            }
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`Error checking if image ${imageId} exists in calendar ${calendarId}:`, error);
    return false; // Assume it doesn't exist if we can't check
  }
}

// Helper function to find all calendars that are duplicated from a source calendar
async function findDuplicatedCalendars(sourceCalendarId: string, userId: string): Promise<string[]> {
  try {
    const calendarsSnapshot = await admin.firestore()
      .collection('calendars')
      .where('userId', '==', userId)
      .where('duplicatedCalendar', '==', true)
      .where('sourceCalendarId', '==', sourceCalendarId)
      .get();

    return calendarsSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error(`Error finding duplicated calendars for source ${sourceCalendarId}:`, error);
    return [];
  }
}

// Helper function to check if an image can be safely deleted
async function canDeleteImage(imageId: string, currentCalendarId: string, userId: string): Promise<boolean> {
  try {
    // Get the current calendar data
    const currentCalendarDoc = await admin.firestore().collection('calendars').doc(currentCalendarId).get();
    if (!currentCalendarDoc.exists) {
      console.error(`Calendar ${currentCalendarId} not found`);
      return false;
    }

    const currentCalendarData = currentCalendarDoc.data();
    const isDuplicatedCalendar = currentCalendarData?.duplicatedCalendar === true;
    const sourceCalendarId = currentCalendarData?.sourceCalendarId;

    if (isDuplicatedCalendar && sourceCalendarId) {
      // Deletion from duplicated calendar
      console.log(`Checking deletion from duplicated calendar ${currentCalendarId}, source: ${sourceCalendarId}`);

      // Check if image exists in source calendar
      const existsInSource = await imageExistsInCalendar(imageId, sourceCalendarId);
      if (existsInSource) {
        console.log(`Image ${imageId} exists in source calendar ${sourceCalendarId}, cannot delete`);
        return false;
      }

      // Check if image exists in other duplicated calendars from the same source
      const otherDuplicatedCalendars = await findDuplicatedCalendars(sourceCalendarId, userId);
      for (const duplicatedCalendarId of otherDuplicatedCalendars) {
        if (duplicatedCalendarId !== currentCalendarId) {
          const existsInOtherDuplicate = await imageExistsInCalendar(imageId, duplicatedCalendarId);
          if (existsInOtherDuplicate) {
            console.log(`Image ${imageId} exists in other duplicated calendar ${duplicatedCalendarId}, cannot delete`);
            return false;
          }
        }
      }

      console.log(`Image ${imageId} safe to delete from duplicated calendar`);
      return true;
    } else {
      // Deletion from original calendar
      console.log(`Checking deletion from original calendar ${currentCalendarId}`);

      // Find all calendars duplicated from this one
      const duplicatedCalendars = await findDuplicatedCalendars(currentCalendarId, userId);

      // Check if image exists in any duplicated calendar
      for (const duplicatedCalendarId of duplicatedCalendars) {
        const existsInDuplicate = await imageExistsInCalendar(imageId, duplicatedCalendarId);
        if (existsInDuplicate) {
          console.log(`Image ${imageId} exists in duplicated calendar ${duplicatedCalendarId}, cannot delete`);
          return false;
        }
      }

      console.log(`Image ${imageId} safe to delete from original calendar`);
      return true;
    }
  } catch (error) {
    console.error(`Error checking if image ${imageId} can be deleted:`, error);
    return false; // Err on the side of caution
  }
}

// Helper function to clean up removed images
async function cleanupRemovedImagesHelper(change: functions.Change<functions.firestore.DocumentSnapshot>) {
  try {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    if (!beforeData || !afterData) {
      console.log('No data in document');
      return;
    }

    // Extract trades from before and after
    const beforeTrades = beforeData.trades || [];
    const afterTrades = afterData.trades || [];

    // Create a map of all images in the 'after' state for quick lookup
    const afterImagesMap = new Map();
    afterTrades.forEach((trade: any) => {
      if (trade.images && Array.isArray(trade.images)) {
        trade.images.forEach((image: any) => {
          if (image && image.id) {
            afterImagesMap.set(image.id, true);
          }
        });
      }
    });

    // Find images that were in the 'before' state but not in the 'after' state
    const imagesToDelete: string[] = [];
    beforeTrades.forEach((trade: any) => {
      if (trade.images && Array.isArray(trade.images)) {
        trade.images.forEach((image: any) => {
          if (image && image.id && !afterImagesMap.has(image.id)) {
            if(!image.calendarId || !trade.calendarId || image.calendarId === trade.calendarId){
              imagesToDelete.push(image.id);
            }

          }
        });
      }
    });

    // If there are no images to delete, return early
    if (imagesToDelete.length === 0) {
      console.log('No images to delete');
      return;
    }

    // Get the user ID from the document path
    const calendarId = change.after.ref.parent.parent?.id;
    if (!calendarId) {
      console.error('Could not determine calendar ID');
      return;
    }

    // Get the calendar document to find the owner and check if it's duplicated
    const calendarDoc = await admin.firestore().collection('calendars').doc(calendarId).get();
    if (!calendarDoc.exists) {
      console.error('Calendar document not found');
      return;
    }

    const calendarData = calendarDoc.data();
    if (!calendarData || !calendarData.userId) {
      console.error('Calendar document does not have a userId field');
      return;
    }

    const userId = calendarData.userId;

    // Filter images to delete using comprehensive logic
    const finalImagesToDelete: string[] = [];

    for (const imageId of imagesToDelete) {
      const canDelete = await canDeleteImage(imageId, calendarId, userId);
      if (canDelete) {
        finalImagesToDelete.push(imageId);
        console.log(`Image ${imageId} can be safely deleted`);
      } else {
        console.log(`Image ${imageId} cannot be deleted - exists in related calendars`);
      }
    }

    if (finalImagesToDelete.length === 0) {
      console.log('No images to delete after checking source calendar');
      return;
    }

    // Delete each image from storage
    const deletePromises = finalImagesToDelete.map(async (imageId) => {
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
    console.log(`Successfully deleted ${finalImagesToDelete.length} images`);
  } catch (error) {
    console.error('Error in cleanupRemovedImagesHelper function:', error);
  }
}

// Cloud function to handle year document updates - cleans up removed images and handles trade date changes
export const onTradeChanged = functions.firestore
  .document('calendars/{calendarId}/years/{yearId}')
  .onUpdate(async (change, context) => {
    try {
      // First, handle any removed images
      await cleanupRemovedImagesHelper(change);

      // Then, handle any trade date changes
      await handleTradeYearChanges(change, context);

      return null;
    } catch (error) {
      console.error('Error in cleanupRemovedImages function:', error);
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

      if (!calendarId || !oldTag || !newTag) {
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

      // Get all year documents for this calendar
      const yearsRef = admin.firestore().collection(`calendars/${calendarId}/years`);
      const yearsSnapshot = await yearsRef.get();

      if (yearsSnapshot.empty) {
        res.status(200).json({ success: true, tradesUpdated: 0 });
        return;
      }

      let totalTradesUpdated = 0;
      const batch = admin.firestore().batch();
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

      // Update the calendar's lastModified timestamp
      await calendarRef.update({
        lastModified: admin.firestore.FieldValue.serverTimestamp()
      });

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


