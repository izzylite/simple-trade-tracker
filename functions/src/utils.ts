
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions'; 

// Helper function to handle trade date changes that result in year changes
export async function handleTradeYearChanges(change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) {
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
    const tradesWithDateChanges: Array<{ id: string, newTrade: any }> = [];

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
export async function imageExistsInCalendar(imageId: string, calendarId: string): Promise<boolean> {
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
export async function findDuplicatedCalendars(sourceCalendarId: string, userId: string): Promise<string[]> {
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
export async function canDeleteImage(imageId: string, currentCalendarId: string, userId: string): Promise<boolean> {
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
export async function cleanupRemovedImagesHelper(change: functions.Change<functions.firestore.DocumentSnapshot>) {
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
            if (!image.calendarId || !trade.calendarId || image.calendarId === trade.calendarId) {
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


// Helper function to extract all unique tags from trades
export function extractTagsFromTrades(trades: any[]): string[] {
  const tagSet = new Set<string>();

  trades.forEach((trade: any) => {
    if (trade.tags && Array.isArray(trade.tags)) {
      trade.tags.forEach((tag: string) => {
        if (tag && tag.trim()) {
          tagSet.add(tag.trim());
        }
      });
    }
  });

  return Array.from(tagSet).sort();
}

// Helper function to extract tags from trades in a year document
export function extractTagsFromYearData(yearData: any): Set<string> {
  const tagSet = new Set<string>();
  const trades = yearData?.trades || [];

  trades.forEach((trade: any) => {
    if (trade.tags && Array.isArray(trade.tags)) {
      trade.tags.forEach((tag: string) => {
        if (tag && tag.trim()) {
          tagSet.add(tag.trim());
        }
      });
    }
  });

  return tagSet;
}

// Helper function to check if tags have changed between before and after data
export function haveTagsChanged(beforeData: any, afterData: any): boolean {
  const beforeTags = extractTagsFromYearData(beforeData);
  const afterTags = extractTagsFromYearData(afterData);

  // Check if the sets are different
  if (beforeTags.size !== afterTags.size) {
    return true;
  }

  // Check if all tags in beforeTags exist in afterTags
  for (const tag of beforeTags) {
    if (!afterTags.has(tag)) {
      return true;
    }
  }

  return false;
}

// Helper function to update calendar tags
export async function updateCalendarTags(calendarId: string): Promise<void> {
  try {
    // Get all year documents for this calendar
    const yearsSnapshot = await admin.firestore().collection(`calendars/${calendarId}/years`).get();

    const allTrades: any[] = [];

    // Collect all trades from all years
    for (const yearDoc of yearsSnapshot.docs) {
      const yearData = yearDoc.data();
      const trades = yearData.trades || [];
      allTrades.push(...trades);
    }

    // Extract unique tags
    const uniqueTags = extractTagsFromTrades(allTrades);

    // Update the calendar document with the tags
    // Note: We do NOT automatically clean up requiredTagGroups here
    // Required tag groups should only be modified by explicit user actions or group name changes
    await admin.firestore().collection('calendars').doc(calendarId).update({
      tags: uniqueTags,
      lastModified: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Updated calendar ${calendarId} with ${uniqueTags.length} unique tags`);
  } catch (error) {
    console.error(`Error updating calendar tags for ${calendarId}:`, error);
    throw error;
  }
}