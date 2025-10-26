"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCalendarTags = exports.updateCalendarTagsFromTradeChanges = exports.updateTradeTagsWithGroupNameChange = exports.updateTagsWithGroupNameChange = exports.haveTagsChanged = exports.extractTagsFromYearData = exports.extractTagsFromTrades = exports.cleanupRemovedImagesHelper = exports.canDeleteImage = exports.findDuplicatedCalendars = exports.findDuplicatedCalendarsQuery = exports.imageExistsInCalendar = exports.imageExistsInYears = exports.handleTradeYearChanges = void 0;
const admin = __importStar(require("firebase-admin"));
// Helper function to handle trade date changes that result in year changes
async function handleTradeYearChanges(event) {
    var _a, _b, _c;
    try {
        const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
        const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
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
        beforeTrades.forEach((trade) => {
            if (trade && trade.id) {
                beforeTradesMap.set(trade.id, trade);
            }
        });
        // Create a map of all trades in the 'after' state for quick lookup
        const afterTradesMap = new Map();
        afterTrades.forEach((trade) => {
            if (trade && trade.id) {
                afterTradesMap.set(trade.id, trade);
            }
        });
        // Find trades that were updated with a date change
        const tradesWithDateChanges = [];
        // Check trades that exist in both before and after
        beforeTradesMap.forEach((beforeTrade, tradeId) => {
            var _a, _b;
            const afterTrade = afterTradesMap.get(tradeId);
            // If the trade exists in both states and the date has changed
            if (afterTrade) {
                const beforeDate = ((_a = beforeTrade.date) === null || _a === void 0 ? void 0 : _a.toDate) ? beforeTrade.date.toDate() : new Date(beforeTrade.date);
                const afterDate = ((_b = afterTrade.date) === null || _b === void 0 ? void 0 : _b.toDate) ? afterTrade.date.toDate() : new Date(afterTrade.date);
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
            const newDate = ((_c = newTrade.date) === null || _c === void 0 ? void 0 : _c.toDate) ? newTrade.date.toDate() : new Date(newTrade.date);
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
                var _a;
                // Get the current year document to remove the trade
                const currentYearRef = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after.ref;
                const currentYearDoc = await transaction.get(currentYearRef);
                if (!currentYearDoc.exists) {
                    console.error(`Current year document ${yearId} not found in transaction`);
                    return;
                }
                // Get the current trades and remove the trade that's being moved
                const currentYearData = currentYearDoc.data();
                const currentTrades = (currentYearData === null || currentYearData === void 0 ? void 0 : currentYearData.trades) || [];
                const updatedCurrentTrades = currentTrades.filter((trade) => trade.id !== id);
                // If the target year document exists, add the trade to its trades array
                if (targetYearDoc.exists) {
                    const targetYearData = targetYearDoc.data();
                    const targetTrades = (targetYearData === null || targetYearData === void 0 ? void 0 : targetYearData.trades) || [];
                    // Add the trade to the target year's trades
                    targetTrades.push(newTrade);
                    // Update the target year document
                    transaction.update(targetYearRef, {
                        trades: targetTrades,
                        lastModified: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                else {
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
    }
    catch (error) {
        console.error('Error in handleTradeYearChanges function:', error);
    }
}
exports.handleTradeYearChanges = handleTradeYearChanges;
// Helper function to check if an image exists in a specific calendar using provided years data
function imageExistsInYears(imageId, yearsSnapshot) {
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
    }
    catch (error) {
        console.error(`Error checking if image ${imageId} exists in years:`, error);
        return false; // Assume it doesn't exist if we can't check
    }
}
exports.imageExistsInYears = imageExistsInYears;
// Helper function to check if an image exists in a specific calendar
async function imageExistsInCalendar(imageId, calendarId, getYearsSnapshot) {
    try {
        const yearsSnapshot = await getYearsSnapshot(calendarId);
        return imageExistsInYears(imageId, yearsSnapshot);
    }
    catch (error) {
        console.error(`Error checking if image ${imageId} exists in calendar ${calendarId}:`, error);
        return false; // Assume it doesn't exist if we can't check
    }
}
exports.imageExistsInCalendar = imageExistsInCalendar;
// Helper function to find all calendars that are duplicated from a source calendar
async function findDuplicatedCalendarsQuery(sourceCalendarId, userId) {
    return await admin.firestore()
        .collection('calendars')
        .where('userId', '==', userId)
        .where('duplicatedCalendar', '==', true)
        .where('sourceCalendarId', '==', sourceCalendarId)
        .get();
}
exports.findDuplicatedCalendarsQuery = findDuplicatedCalendarsQuery;
// Helper function to find all calendars that are duplicated from a source calendar
async function findDuplicatedCalendars(sourceCalendarId, calendarsSnapshot) {
    try {
        return calendarsSnapshot.docs.map(doc => doc.id);
    }
    catch (error) {
        console.error(`Error finding duplicated calendars for source ${sourceCalendarId}:`, error);
        return [];
    }
}
exports.findDuplicatedCalendars = findDuplicatedCalendars;
// Helper function to check if an image can be safely deleted
async function canDeleteImage(imageId, currentCalendarId, currentCalendarData, getYearsSnapshot, getDuplicatedCalendarsSnapshot) {
    try {
        if (!currentCalendarData) {
            console.error(`Calendar data for ${currentCalendarId} not found`);
            return false;
        }
        const isDuplicatedCalendar = (currentCalendarData === null || currentCalendarData === void 0 ? void 0 : currentCalendarData.duplicatedCalendar) === true;
        const sourceCalendarId = currentCalendarData === null || currentCalendarData === void 0 ? void 0 : currentCalendarData.sourceCalendarId;
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
        }
        else {
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
    }
    catch (error) {
        console.error(`Error checking if image ${imageId} can be deleted:`, error);
        return false; // Err on the side of caution
    }
}
exports.canDeleteImage = canDeleteImage;
// Helper function to clean up removed images
async function cleanupRemovedImagesHelper(event) {
    var _a, _b, _c, _d;
    try {
        const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
        const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
        if (!beforeData || !afterData) {
            console.log('No data in document');
            return;
        }
        // Extract trades from before and after
        const beforeTrades = beforeData.trades || [];
        const afterTrades = afterData.trades || [];
        // Create a map of all images in the 'after' state for quick lookup
        const afterImagesMap = new Map();
        afterTrades.forEach((trade) => {
            if (trade.images && Array.isArray(trade.images)) {
                trade.images.forEach((image) => {
                    if (image && image.id) {
                        afterImagesMap.set(image.id, true);
                    }
                });
            }
        });
        // Find images that were in the 'before' state but not in the 'after' state
        const imagesToDelete = [];
        beforeTrades.forEach((trade) => {
            if (trade.images && Array.isArray(trade.images)) {
                trade.images.forEach((image) => {
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
        const calendarId = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after.ref.parent.parent) === null || _d === void 0 ? void 0 : _d.id;
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
        const finalImagesToDelete = [];
        // Create cache for years snapshots to avoid duplicate queries
        const yearsSnapshotCache = new Map();
        let duplicatedCalendarsSnapshot = null;
        // Callback function to get years snapshot with caching
        const getYearsSnapshot = async (calendarId) => {
            if (!yearsSnapshotCache.has(calendarId)) {
                const snapshot = await admin.firestore().collection(`calendars/${calendarId}/years`).get();
                yearsSnapshotCache.set(calendarId, snapshot);
            }
            return yearsSnapshotCache.get(calendarId);
        };
        // Callback function to get duplicated calendars snapshot with caching
        const getDuplicatedCalendarsSnapshot = async () => {
            if (!duplicatedCalendarsSnapshot) {
                duplicatedCalendarsSnapshot = await findDuplicatedCalendarsQuery(calendarId, userId);
            }
            return duplicatedCalendarsSnapshot;
        };
        for (const imageId of imagesToDelete) {
            const canDelete = await canDeleteImage(imageId, calendarId, calendarData, getYearsSnapshot, getDuplicatedCalendarsSnapshot);
            if (canDelete) {
                finalImagesToDelete.push(imageId);
                console.log(`Image ${imageId} can be safely deleted`);
            }
            else {
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
            }
            catch (error) {
                console.error(`Error deleting image ${imageId}:`, error);
                // Continue with other deletions even if one fails
            }
        });
        await Promise.all(deletePromises);
        console.log(`Successfully deleted ${finalImagesToDelete.length} images`);
    }
    catch (error) {
        console.error('Error in cleanupRemovedImagesHelper function:', error);
    }
}
exports.cleanupRemovedImagesHelper = cleanupRemovedImagesHelper;
// Helper function to extract all unique tags from trades
function extractTagsFromTrades(trades) {
    const tagSet = new Set();
    trades.forEach((trade) => {
        if (trade.tags && Array.isArray(trade.tags)) {
            trade.tags.forEach((tag) => {
                if (tag && tag.trim()) {
                    tagSet.add(tag.trim());
                }
            });
        }
    });
    return Array.from(tagSet).sort();
}
exports.extractTagsFromTrades = extractTagsFromTrades;
// Helper function to extract tags from trades in a year document
function extractTagsFromYearData(yearData) {
    const tagSet = new Set();
    const trades = (yearData === null || yearData === void 0 ? void 0 : yearData.trades) || [];
    trades.forEach((trade) => {
        if (trade.tags && Array.isArray(trade.tags)) {
            trade.tags.forEach((tag) => {
                if (tag && tag.trim()) {
                    tagSet.add(tag.trim());
                }
            });
        }
    });
    return tagSet;
}
exports.extractTagsFromYearData = extractTagsFromYearData;
// Helper function to check if tags have changed between before and after data
function haveTagsChanged(beforeData, afterData) {
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
exports.haveTagsChanged = haveTagsChanged;
/**
 * Utility function to update tags in an array, handling group name changes
 * @param tags - Array of tags to update
 * @param oldTag - The old tag being replaced
 * @param newTag - The new tag to replace with
 * @returns Updated array of tags
 */
function updateTagsWithGroupNameChange(tags, oldTag, newTag) {
    // Check if this is a group name change
    const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null;
    const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null;
    const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup;
    if (isGroupNameChange) {
        // Group name changed - update all tags in the old group
        return tags.map((tag) => {
            if (tag === oldTag) {
                // Direct match - replace with new tag
                return newTag;
            }
            else if (tag.includes(':') && tag.split(':')[0] === oldGroup) {
                // Same group - update group name but keep tag name
                const tagName = tag.split(':')[1];
                return `${newGroup}:${tagName}`;
            }
            else {
                // Different group or ungrouped - keep as is
                return tag;
            }
        }).filter(tag => tag !== ''); // Remove empty tags
    }
    else {
        // Not a group name change - just replace the specific tag
        return tags.map((tag) => tag === oldTag ? newTag : tag).filter(tag => tag !== '');
    }
}
exports.updateTagsWithGroupNameChange = updateTagsWithGroupNameChange;
/**
 * Utility function to update tags in a trade object, handling group name changes
 * @param trade - Trade object with tags array
 * @param oldTag - The old tag being replaced
 * @param newTag - The new tag to replace with
 * @returns Object with updated: boolean and updatedCount: number
 */
function updateTradeTagsWithGroupNameChange(trade, oldTag, newTag) {
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
                }
                else {
                    trade.tags[j] = newTag.trim();
                }
                updated = true;
                updatedCount++;
            }
            else if (tag.includes(':') && tag.split(':')[0] === oldGroup) {
                // Same group - update group name but keep tag name
                const tagName = tag.split(':')[1];
                trade.tags[j] = `${newGroup}:${tagName}`;
                updated = true;
                updatedCount++;
            }
        }
    }
    else {
        // Not a group name change - just replace the specific tag
        if (trade.tags.includes(oldTag)) {
            const tagIndex = trade.tags.indexOf(oldTag);
            if (newTag.trim() === '') {
                trade.tags.splice(tagIndex, 1);
            }
            else {
                trade.tags[tagIndex] = newTag.trim();
            }
            updated = true;
            updatedCount++;
        }
    }
    return { updated, updatedCount };
}
exports.updateTradeTagsWithGroupNameChange = updateTradeTagsWithGroupNameChange;
/**
 * Updates calendar tags when trades change - maintains proper tag consistency
 * @param calendarId - The calendar ID to update
 * @param beforeData - The year document data before changes
 * @param afterData - The year document data after changes
 * @param yearId - The year document ID (optional, for optimization)
 */
async function updateCalendarTagsFromTradeChanges(calendarId, beforeData, afterData, yearId) {
    try {
        // Get the calendar document
        const calendarDoc = await admin.firestore().collection('calendars').doc(calendarId).get();
        if (!calendarDoc.exists) {
            console.log(`Calendar ${calendarId} not found, skipping tag update`);
            return;
        }
        const calendarData = calendarDoc.data();
        if (!(calendarData === null || calendarData === void 0 ? void 0 : calendarData.tags) || !Array.isArray(calendarData.tags) || calendarData.tags.length === 0) {
            console.log(`Calendar ${calendarId} has empty tags, using updateCalendarTags to rebuild`);
            await updateCalendarTags(calendarId);
            return;
        }
        // Extract tags from before and after data
        const beforeTrades = (beforeData === null || beforeData === void 0 ? void 0 : beforeData.trades) || [];
        const afterTrades = (afterData === null || afterData === void 0 ? void 0 : afterData.trades) || [];
        const beforeTags = new Set();
        const afterTags = new Set();
        // Collect tags from before trades
        beforeTrades.forEach((trade) => {
            if (trade.tags && Array.isArray(trade.tags)) {
                trade.tags.forEach((tag) => beforeTags.add(tag));
            }
        });
        // Collect tags from after trades
        afterTrades.forEach((trade) => {
            if (trade.tags && Array.isArray(trade.tags)) {
                trade.tags.forEach((tag) => afterTags.add(tag));
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
            const allOtherTags = new Set();
            for (const yearDoc of yearsSnapshot.docs) {
                if (yearId && yearDoc.id === yearId)
                    continue; // Skip the current year document
                const yearData = yearDoc.data();
                const trades = yearData.trades || [];
                trades.forEach((trade) => {
                    if (trade.tags && Array.isArray(trade.tags)) {
                        trade.tags.forEach((tag) => allOtherTags.add(tag));
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
    }
    catch (error) {
        console.error(`Error updating calendar tags for ${calendarId}:`, error);
        throw error;
    }
}
exports.updateCalendarTagsFromTradeChanges = updateCalendarTagsFromTradeChanges;
// Helper function to update calendar tags - only runs when calendar.tags is empty or missing
async function updateCalendarTags(calendarId) {
    try {
        // First check if calendar.tags is already populated
        const calendarDoc = await admin.firestore().collection('calendars').doc(calendarId).get();
        if (!calendarDoc.exists) {
            console.log(`Calendar ${calendarId} not found, skipping tag update`);
            return;
        }
        const calendarData = calendarDoc.data();
        if ((calendarData === null || calendarData === void 0 ? void 0 : calendarData.tags) && Array.isArray(calendarData.tags) && calendarData.tags.length > 0) {
            console.log(`Calendar ${calendarId} already has ${calendarData.tags.length} tags, skipping automatic update`);
            return;
        }
        console.log(`Calendar ${calendarId} has empty or missing tags, rebuilding from trades...`);
        // Get all year documents for this calendar
        const yearsSnapshot = await admin.firestore().collection(`calendars/${calendarId}/years`).get();
        const allTrades = [];
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
    }
    catch (error) {
        console.error(`Error updating calendar tags for ${calendarId}:`, error);
        throw error;
    }
}
exports.updateCalendarTags = updateCalendarTags;
//# sourceMappingURL=utils.js.map