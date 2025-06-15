import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

const db = admin.firestore();

/**
 * Helper function to find a trade by ID in a calendar's year documents
 */
async function findTradeInCalendar(calendarId: string, tradeId: string): Promise<any | null> {
  try {
    // Get all year documents for this calendar
    const yearsSnapshot = await db.collection(`calendars/${calendarId}/years`).get();

    for (const yearDoc of yearsSnapshot.docs) {
      const yearData = yearDoc.data();
      const trades = yearData.trades || [];

      // Find the trade with matching ID
      const trade = trades.find((t: any) => t.id === tradeId);
      if (trade) {
        return trade;
      }
    }

    return null;
  } catch (error) {
    logger.error(`Error finding trade ${tradeId} in calendar ${calendarId}:`, error);
    return null;
  }
}

interface ShareLinkRequest {
  calendarId: string;
  tradeId: string;
}

/**
 * Generate a shareable link for a trade
 * Uses direct links instead of Firebase Dynamic Links (which will be deprecated Aug 25, 2025)
 * This creates a simple, reliable shareable link that works on any device
 */
export const generateTradeShareLinkV2 = onCall({
  cors: true, // Enable CORS for web requests
}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = request.auth.uid;
    const { calendarId, tradeId } = request.data as ShareLinkRequest;

    // Validate input data
    if (!calendarId || !tradeId) {
      throw new HttpsError('invalid-argument', 'Missing required parameters: calendarId or tradeId');
    }

    // Verify the trade exists and the user has access to it
    const calendarRef = db.collection('calendars').doc(calendarId);
    const calendarDoc = await calendarRef.get();

    if (!calendarDoc.exists) {
      throw new HttpsError('not-found', 'Calendar not found');
    }

    const calendarData = calendarDoc.data();
    if (!calendarData || calendarData.userId !== uid) {
      throw new HttpsError('permission-denied', 'Unauthorized access to calendar');
    }

    // Verify the trade exists in the calendar
    const trade = await findTradeInCalendar(calendarId, tradeId);
    if (!trade) {
      throw new HttpsError('not-found', 'Trade not found in calendar');
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

    logger.info(`Generated share link for trade ${tradeId}: ${shareLink}`);

    return {
      shareLink,
      shareId,
      directLink: shareLink // Same as shareLink now
    };

  } catch (error) {
    logger.error('Error generating trade share link:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to generate share link');
  }
});

/**
 * Get a shared trade by share ID (public function - no auth required)
 */
export const getSharedTradeV2 = onCall({
  cors: true, // Enable CORS for web requests
}, async (request) => {
  try {
    const { shareId } = request.data;

    if (!shareId) {
      throw new HttpsError('invalid-argument', 'Missing shareId parameter');
    }

    // Get the shared trade document
    const sharedTradeRef = db.collection('sharedTrades').doc(shareId);
    const sharedTradeDoc = await sharedTradeRef.get();

    if (!sharedTradeDoc.exists) {
      throw new HttpsError('not-found', 'Shared trade not found');
    }

    const sharedTradeData = sharedTradeDoc.data();

    // Check if the share is still active
    if (!sharedTradeData?.isActive) {
      throw new HttpsError('permission-denied', 'This shared trade is no longer available');
    }

    // Get the actual trade data from the calendar
    const calendarId = sharedTradeData.calendarId;
    const tradeId = sharedTradeData.tradeId;

    // Find the trade in the calendar's year documents
    const trade = await findTradeInCalendar(calendarId, tradeId);

    if (!trade) {
      throw new HttpsError('not-found', 'The shared trade no longer exists');
    }

    // Increment view count
    await sharedTradeRef.update({
      viewCount: admin.firestore.FieldValue.increment(1)
    });

    // Return the trade data (without sensitive information)
    return {
      trade: {
        ...trade,
        // Remove any sensitive fields if needed
      },
      viewCount: (sharedTradeData.viewCount || 0) + 1,
      sharedAt: sharedTradeData.createdAt
    };

  } catch (error) {
    logger.error('Error getting shared trade:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to get shared trade');
  }
});

/**
 * Deactivate a shared trade (stop sharing) by deleting the shared trade document
 */
export const deactivateSharedTradeV2 = onCall({
  cors: true, // Enable CORS for web requests
}, async (request) => {
  try {
    // Ensure user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = request.auth.uid;
    const { shareId } = request.data;

    if (!shareId) {
      throw new HttpsError('invalid-argument', 'Missing shareId parameter');
    }

    // Get the shared trade document
    const sharedTradeRef = db.collection('sharedTrades').doc(shareId);
    const sharedTradeDoc = await sharedTradeRef.get();

    if (!sharedTradeDoc.exists) {
      throw new HttpsError('not-found', 'Shared trade not found');
    }

    const sharedTradeData = sharedTradeDoc.data();

    // Verify the user owns this shared trade
    if (sharedTradeData?.userId !== uid) {
      throw new HttpsError('permission-denied', 'You do not have permission to modify this shared trade');
    }

    // Delete the shared trade document completely
    await sharedTradeRef.delete();

    logger.info(`Deleted shared trade ${shareId} by user ${uid}`);

    return { success: true };

  } catch (error) {
    logger.error('Error deactivating shared trade:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to deactivate shared trade');
  }
});
