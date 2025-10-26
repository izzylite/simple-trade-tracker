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
exports.deactivateSharedTradeV2 = exports.getSharedTradeV2 = exports.generateTradeShareLinkV2 = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const _1 = require(".");
const db = admin.firestore();
/**
 * Helper function to find a trade by ID in a calendar's year documents
 */
async function findTradeInCalendar(calendarId, tradeId) {
    try {
        // Get all year documents for this calendar
        const yearsSnapshot = await db.collection(`calendars/${calendarId}/years`).get();
        for (const yearDoc of yearsSnapshot.docs) {
            const yearData = yearDoc.data();
            const trades = yearData.trades || [];
            // Find the trade with matching ID
            const trade = trades.find((t) => t.id === tradeId);
            if (trade) {
                return trade;
            }
        }
        return null;
    }
    catch (error) {
        v2_1.logger.error(`Error finding trade ${tradeId} in calendar ${calendarId}:`, error);
        return null;
    }
}
/**
 * Generate a shareable link for a trade
 * Uses direct links instead of Firebase Dynamic Links (which will be deprecated Aug 25, 2025)
 * This creates a simple, reliable shareable link that works on any device
 */
exports.generateTradeShareLinkV2 = (0, https_1.onCall)({
    cors: true,
    enforceAppCheck: true, // Enable App Check verification
}, async (request) => {
    try {
        // Ensure App Check is valid
        await (0, _1.enforceAppCheck)(request);
        // Ensure user is authenticated
        if (!request.auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = request.auth.uid;
        const { calendarId, tradeId } = request.data;
        // Validate input data
        if (!calendarId || !tradeId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing required parameters: calendarId or tradeId');
        }
        // Verify the trade exists and the user has access to it
        const calendarRef = db.collection('calendars').doc(calendarId);
        const calendarDoc = await calendarRef.get();
        if (!calendarDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Calendar not found');
        }
        const calendarData = calendarDoc.data();
        if (!calendarData || calendarData.userId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Unauthorized access to calendar');
        }
        // Verify the trade exists in the calendar
        const trade = await findTradeInCalendar(calendarId, tradeId);
        if (!trade) {
            throw new https_1.HttpsError('not-found', 'Trade not found in calendar');
        }
        // Generate a unique share ID using modern approach (avoiding deprecated substr)
        const shareId = `share_${tradeId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        // Create the shared trade document (store only IDs, not the full trade)
        const sharedTradeData = {
            id: shareId,
            tradeId,
            calendarId,
            userId: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isActive: true,
            viewCount: 0
        };
        // Save the shared trade document
        await db.collection('sharedTrades').doc(shareId).set(sharedTradeData);
        // Generate direct share link (no Firebase Dynamic Links dependency)
        const baseUrl = 'https://tradetracker-30ec1.web.app'; // Your app's domain
        const shareLink = `${baseUrl}/shared/${shareId}`;
        v2_1.logger.info(`Generated share link for trade ${tradeId}: ${shareLink}`);
        return {
            shareLink,
            shareId,
            directLink: shareLink // Same as shareLink now
        };
    }
    catch (error) {
        v2_1.logger.error('Error generating trade share link:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to generate share link');
    }
});
/**
 * Get a shared trade by share ID (public function - no auth required)
 */
exports.getSharedTradeV2 = (0, https_1.onCall)({
    cors: true,
    enforceAppCheck: true, // Enable App Check verification
}, async (request) => {
    try {
        // Ensure App Check is valid
        await (0, _1.enforceAppCheck)(request);
        const { shareId } = request.data;
        if (!shareId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing shareId parameter');
        }
        // Get the shared trade document
        const sharedTradeRef = db.collection('sharedTrades').doc(shareId);
        const sharedTradeDoc = await sharedTradeRef.get();
        if (!sharedTradeDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Shared trade not found');
        }
        const sharedTradeData = sharedTradeDoc.data();
        // Check if the share is still active
        if (!(sharedTradeData === null || sharedTradeData === void 0 ? void 0 : sharedTradeData.isActive)) {
            throw new https_1.HttpsError('permission-denied', 'This shared trade is no longer available');
        }
        // Get the actual trade data from the calendar
        const calendarId = sharedTradeData.calendarId;
        const tradeId = sharedTradeData.tradeId;
        // Find the trade in the calendar's year documents
        const trade = await findTradeInCalendar(calendarId, tradeId);
        if (!trade) {
            throw new https_1.HttpsError('not-found', 'The shared trade no longer exists');
        }
        // Increment view count
        await sharedTradeRef.update({
            viewCount: admin.firestore.FieldValue.increment(1)
        });
        // Return the trade data (without sensitive information)
        return {
            trade: Object.assign({}, trade),
            viewCount: (sharedTradeData.viewCount || 0) + 1,
            sharedAt: sharedTradeData.createdAt
        };
    }
    catch (error) {
        v2_1.logger.error('Error getting shared trade:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to get shared trade');
    }
});
/**
 * Deactivate a shared trade (stop sharing) by deleting the shared trade document
 */
exports.deactivateSharedTradeV2 = (0, https_1.onCall)({
    cors: true,
    enforceAppCheck: true, // Enable App Check verification
}, async (request) => {
    try {
        // Ensure App Check is valid
        await (0, _1.enforceAppCheck)(request);
        // Ensure user is authenticated
        if (!request.auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = request.auth.uid;
        const { shareId } = request.data;
        if (!shareId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing shareId parameter');
        }
        // Get the shared trade document
        const sharedTradeRef = db.collection('sharedTrades').doc(shareId);
        const sharedTradeDoc = await sharedTradeRef.get();
        if (!sharedTradeDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Shared trade not found');
        }
        const sharedTradeData = sharedTradeDoc.data();
        // Verify the user owns this shared trade
        if ((sharedTradeData === null || sharedTradeData === void 0 ? void 0 : sharedTradeData.userId) !== uid) {
            throw new https_1.HttpsError('permission-denied', 'You do not have permission to modify this shared trade');
        }
        // Delete the shared trade document completely
        await sharedTradeRef.delete();
        v2_1.logger.info(`Deleted shared trade ${shareId} by user ${uid}`);
        return { success: true };
    }
    catch (error) {
        v2_1.logger.error('Error deactivating shared trade:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to deactivate shared trade');
    }
});
//# sourceMappingURL=sharing.js.map