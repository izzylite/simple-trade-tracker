
import * as admin from 'firebase-admin';

// Helper function to handle trade date changes that result in year changes
export async function handleTradeYearChanges(event: any) {
  try {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    const calendarId = event.params.calendarId;
    const yearId = event.params.yearId;

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
        const currentYearRef = event.data?.after.ref;
        const currentYearDoc = await transaction.get(currentYearRef) as any;

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

// Helper function to check if an image exists in a specific calendar using provided years data
export function imageExistsInYears(imageId: string, yearsSnapshot: admin.firestore.QuerySnapshot<admin.firestore.DocumentData>): boolean {
  try {
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
    console.error(`Error checking if image ${imageId} exists in years:`, error);
    return false; // Assume it doesn't exist if we can't check
  }
}

// Type for the query cache callback
type QueryCacheCallback = (calendarId: string) => Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>>;

// Helper function to check if an image exists in a specific calendar
export async function imageExistsInCalendar(imageId: string, calendarId: string, getYearsSnapshot: QueryCacheCallback): Promise<boolean> {
  try {
    const yearsSnapshot = await getYearsSnapshot(calendarId);
    return imageExistsInYears(imageId, yearsSnapshot);
  } catch (error) {
    console.error(`Error checking if image ${imageId} exists in calendar ${calendarId}:`, error);
    return false; // Assume it doesn't exist if we can't check
  }
}
// Helper function to find all calendars that are duplicated from a source calendar
export async function findDuplicatedCalendarsQuery(sourceCalendarId: string, userId: string): Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>> {
  return await admin.firestore()
    .collection('calendars')
    .where('userId', '==', userId)
    .where('duplicatedCalendar', '==', true)
    .where('sourceCalendarId', '==', sourceCalendarId)
    .get();
}
// Helper function to find all calendars that are duplicated from a source calendar
export async function findDuplicatedCalendars(sourceCalendarId: string,
  calendarsSnapshot: admin.firestore.QuerySnapshot<admin.firestore.DocumentData>
): Promise<string[]> {
  try {
    return calendarsSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error(`Error finding duplicated calendars for source ${sourceCalendarId}:`, error);
    return [];
  }
}

// Helper function to check if an image can be safely deleted
export async function canDeleteImage(
  imageId: string,
  currentCalendarId: string,
  currentCalendarData: admin.firestore.DocumentData,
  getYearsSnapshot: QueryCacheCallback,
  getDuplicatedCalendarsSnapshot: () => Promise<admin.firestore.QuerySnapshot<admin.firestore.DocumentData>>
): Promise<boolean> {
  try {
    if (!currentCalendarData) {
      console.error(`Calendar data for ${currentCalendarId} not found`);
      return false;
    }

    const isDuplicatedCalendar = currentCalendarData?.duplicatedCalendar === true;
    const sourceCalendarId = currentCalendarData?.sourceCalendarId;

    if (isDuplicatedCalendar && sourceCalendarId) {
      // Deletion from duplicated calendar
      console.log(`Checking deletion from duplicated calendar ${currentCalendarId}, source: ${sourceCalendarId}`);

      // Check if image exists in source calendar
      const existsInSource = await imageExistsInCalendar(imageId, sourceCalendarId, getYearsSnapshot);
      if (existsInSource) {
        console.log(`Image ${imageId} exists in source calendar ${sourceCalendarId}, cannot delete`);
        return false;
      }

      // Check if image exists in other duplicated calendars from the same source
      const duplicatedCalendarsSnapshot = await getDuplicatedCalendarsSnapshot();
      const otherDuplicatedCalendars = await findDuplicatedCalendars(sourceCalendarId, duplicatedCalendarsSnapshot);

      for (const duplicatedCalendarId of otherDuplicatedCalendars) {
        if (duplicatedCalendarId !== currentCalendarId) {
          const existsInOtherDuplicate = await imageExistsInCalendar(imageId, duplicatedCalendarId, getYearsSnapshot);
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
      const duplicatedCalendarsSnapshot = await getDuplicatedCalendarsSnapshot();
      const duplicatedCalendars = await findDuplicatedCalendars(currentCalendarId, duplicatedCalendarsSnapshot);

      // Check if image exists in any duplicated calendar
      for (const duplicatedCalendarId of duplicatedCalendars) {
        const existsInDuplicate = await imageExistsInCalendar(imageId, duplicatedCalendarId, getYearsSnapshot);
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
export async function cleanupRemovedImagesHelper(event: any) {
  try {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

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
    const calendarId = event.data?.after.ref.parent.parent?.id;
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

    // Filter images to delete using comprehensive logic with caching
    const finalImagesToDelete: string[] = [];

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

    for (const imageId of imagesToDelete) {
      const canDelete = await canDeleteImage(
        imageId,
        calendarId,
        calendarData,
        getYearsSnapshot,
        getDuplicatedCalendarsSnapshot
      );
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

/**
 * Utility function to update tags in an array, handling group name changes
 * @param tags - Array of tags to update
 * @param oldTag - The old tag being replaced
 * @param newTag - The new tag to replace with
 * @returns Updated array of tags
 */
export function updateTagsWithGroupNameChange(tags: string[], oldTag: string, newTag: string): string[] {
  // Check if this is a group name change
  const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null;
  const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null;
  const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup;

  if (isGroupNameChange) {
    // Group name changed - update all tags in the old group
    return tags.map((tag: string) => {
      if (tag === oldTag) {
        // Direct match - replace with new tag
        return newTag;
      } else if (tag.includes(':') && tag.split(':')[0] === oldGroup) {
        // Same group - update group name but keep tag name
        const tagName = tag.split(':')[1];
        return `${newGroup}:${tagName}`;
      } else {
        // Different group or ungrouped - keep as is
        return tag;
      }
    }).filter(tag => tag !== ''); // Remove empty tags
  } else {
    // Not a group name change - just replace the specific tag
    return tags.map((tag: string) => tag === oldTag ? newTag : tag).filter(tag => tag !== '');
  }
}

/**
 * Utility function to update tags in a trade object, handling group name changes
 * @param trade - Trade object with tags array
 * @param oldTag - The old tag being replaced
 * @param newTag - The new tag to replace with
 * @returns Object with updated: boolean and updatedCount: number
 */
export function updateTradeTagsWithGroupNameChange(trade: any, oldTag: string, newTag: string): { updated: boolean; updatedCount: number } {
  if (!trade.tags || !Array.isArray(trade.tags)) {
    return { updated: false, updatedCount: 0 };
  }

  // Check if this is a group name change
  const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null;
  const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null;
  const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup;

  let updatedCount = 0;
  let updated = false;

  if (isGroupNameChange) {
    // Group name change - update all tags in the old group
    for (let j = 0; j < trade.tags.length; j++) {
      const tag = trade.tags[j];
      if (tag === oldTag) {
        // Direct match - replace with new tag
        if (newTag.trim() === '') {
          trade.tags.splice(j, 1);
          j--; // Adjust index after removal
        } else {
          trade.tags[j] = newTag.trim();
        }
        updated = true;
        updatedCount++;
      } else if (tag.includes(':') && tag.split(':')[0] === oldGroup) {
        // Same group - update group name but keep tag name
        const tagName = tag.split(':')[1];
        trade.tags[j] = `${newGroup}:${tagName}`;
        updated = true;
        updatedCount++;
      }
    }
  } else {
    // Not a group name change - just replace the specific tag
    if (trade.tags.includes(oldTag)) {
      const tagIndex = trade.tags.indexOf(oldTag);
      if (newTag.trim() === '') {
        trade.tags.splice(tagIndex, 1);
      } else {
        trade.tags[tagIndex] = newTag.trim();
      }
      updated = true;
      updatedCount++;
    }
  }

  return { updated, updatedCount };
}

/**
 * Updates calendar tags when trades change - maintains proper tag consistency
 * @param calendarId - The calendar ID to update
 * @param beforeData - The year document data before changes
 * @param afterData - The year document data after changes
 * @param yearId - The year document ID (optional, for optimization)
 */
export async function updateCalendarTagsFromTradeChanges(calendarId: string, beforeData: any, afterData: any, yearId?: string): Promise<void> {
  try {
    // Get the calendar document
    const calendarDoc = await admin.firestore().collection('calendars').doc(calendarId).get();
    if (!calendarDoc.exists) {
      console.log(`Calendar ${calendarId} not found, skipping tag update`);
      return;
    }

    const calendarData = calendarDoc.data();
    if (!calendarData?.tags || !Array.isArray(calendarData.tags) || calendarData.tags.length === 0) {
      console.log(`Calendar ${calendarId} has empty tags, using updateCalendarTags to rebuild`);
      await updateCalendarTags(calendarId);
      return;
    }

    // Extract tags from before and after data
    const beforeTrades = beforeData?.trades || [];
    const afterTrades = afterData?.trades || [];

    const beforeTags = new Set<string>();
    const afterTags = new Set<string>();

    // Collect tags from before trades
    beforeTrades.forEach((trade: any) => {
      if (trade.tags && Array.isArray(trade.tags)) {
        trade.tags.forEach((tag: string) => beforeTags.add(tag));
      }
    });

    // Collect tags from after trades
    afterTrades.forEach((trade: any) => {
      if (trade.tags && Array.isArray(trade.tags)) {
        trade.tags.forEach((tag: string) => afterTags.add(tag));
      }
    });

    // Find new tags that were added
    const newTags = Array.from(afterTags).filter(tag => !beforeTags.has(tag));

    // Find tags that were removed
    const removedTags = Array.from(beforeTags).filter(tag => !afterTags.has(tag));

    if (newTags.length === 0 && removedTags.length === 0) {
      console.log(`No tag changes detected in calendar ${calendarId}`);
      return;
    }

    console.log(`Calendar ${calendarId} tag changes - Added: ${newTags.length}, Removed: ${removedTags.length}`);

    // Update calendar tags by adding new ones and keeping existing ones
    // We don't remove tags here because they might exist in other years
    let updatedTags = [...calendarData.tags];
    let hasChanges = false;

    // Add new tags
    newTags.forEach(tag => {
      if (!updatedTags.includes(tag)) {
        updatedTags.push(tag);
        hasChanges = true;
      }
    });

    // For removed tags, we need to check if they exist in other years before removing
    if (removedTags.length > 0) {
      // Get all year documents to check if removed tags exist elsewhere
      const yearsSnapshot = await admin.firestore().collection(`calendars/${calendarId}/years`).get();
      const allOtherTags = new Set<string>();

      for (const yearDoc of yearsSnapshot.docs) {
        if (yearId && yearDoc.id === yearId) continue; // Skip the current year document

        const yearData = yearDoc.data();
        const trades = yearData.trades || [];

        trades.forEach((trade: any) => {
          if (trade.tags && Array.isArray(trade.tags)) {
            trade.tags.forEach((tag: string) => allOtherTags.add(tag));
          }
        });
      }

      // Remove tags that don't exist in any other year
      removedTags.forEach(tag => {
        if (!allOtherTags.has(tag) && updatedTags.includes(tag)) {
          updatedTags = updatedTags.filter(t => t !== tag);
          hasChanges = true;
        }
      });
    }

    if (hasChanges) {
      await admin.firestore().collection('calendars').doc(calendarId).update({
        tags: updatedTags.sort(),
        lastModified: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Updated calendar ${calendarId} tags: ${updatedTags.length} total tags`);
    }
  } catch (error) {
    console.error(`Error updating calendar tags for ${calendarId}:`, error);
    throw error;
  }
}

// Helper function to update calendar tags - only runs when calendar.tags is empty or missing
export async function updateCalendarTags(calendarId: string): Promise<void> {
  try {
    // First check if calendar.tags is already populated
    const calendarDoc = await admin.firestore().collection('calendars').doc(calendarId).get();
    if (!calendarDoc.exists) {
      console.log(`Calendar ${calendarId} not found, skipping tag update`);
      return;
    }

    const calendarData = calendarDoc.data();
    if (calendarData?.tags && Array.isArray(calendarData.tags) && calendarData.tags.length > 0) {
      console.log(`Calendar ${calendarId} already has ${calendarData.tags.length} tags, skipping automatic update`);
      return;
    }

    console.log(`Calendar ${calendarId} has empty or missing tags, rebuilding from trades...`);

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