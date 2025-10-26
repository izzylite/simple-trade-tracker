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
exports.cleanupExpiredCalendarsV2 = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const db = admin.firestore();
const CALENDARS_COLLECTION = 'calendars';
/**
 * Cloud function that runs daily to clean up expired calendars from trash
 * Calendars that have been in trash for more than 30 days are permanently deleted
 */
exports.cleanupExpiredCalendarsV2 = (0, scheduler_1.onSchedule)('0 2 * * *', async (event) => {
    try {
        v2_1.logger.info('Starting cleanup of expired calendars');
        const now = new Date();
        const q = db.collection(CALENDARS_COLLECTION)
            .where('isDeleted', '==', true)
            .where('autoDeleteAt', '<=', admin.firestore.Timestamp.fromDate(now));
        const querySnapshot = await q.get();
        let deletedCount = 0;
        const errors = [];
        v2_1.logger.info(`Found ${querySnapshot.docs.length} calendars ready for deletion`);
        // Process each expired calendar
        for (const calendarDoc of querySnapshot.docs) {
            try {
                const calendarData = calendarDoc.data();
                const calendarId = calendarDoc.id;
                v2_1.logger.info(`Deleting expired calendar: ${calendarId} (${calendarData.name})`);
                // Delete the calendar document
                await db.collection(CALENDARS_COLLECTION).doc(calendarId).delete();
                deletedCount++;
                v2_1.logger.info(`Successfully deleted calendar: ${calendarId}`);
            }
            catch (error) {
                const errorMsg = `Failed to delete calendar ${calendarDoc.id}: ${error}`;
                v2_1.logger.error(errorMsg);
                errors.push(errorMsg);
            }
        }
        v2_1.logger.info(`Cleanup completed: ${deletedCount} calendars permanently deleted`);
        if (errors.length > 0) {
            v2_1.logger.warn(`Cleanup completed with ${errors.length} errors:`, errors);
        }
    }
    catch (error) {
        v2_1.logger.error('Error during calendar cleanup:', error);
        throw error;
    }
});
//# sourceMappingURL=cleanupExpiredCalendars.js.map