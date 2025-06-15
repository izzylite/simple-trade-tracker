import { getFunctions, httpsCallable } from 'firebase/functions';
import { Trade } from '../types/trade';

// Simplified sharing service - all operations now handled by cloud functions
// This provides better security, consistency, and reduces client-side complexity

export interface SharedTrade {
  id: string;
  tradeId: string;
  calendarId: string;
  userId: string;
  trade: Trade;
  shareLink: string;
  createdAt: Date;
  isActive: boolean;
  viewCount: number;
}

/**
 * Generate a shareable link for a trade
 * Uses direct links (future-proof - Firebase Dynamic Links deprecated Aug 25, 2025)
 * This is the main function used by ShareTradeButton
 */
export const generateTradeShareLink = async (
  calendarId: string,
  tradeId: string
): Promise<{ shareLink: string; shareId: string; directLink: string }> => {
  try {
    const functions = getFunctions();
    const generateShareLink = httpsCallable(functions, 'generateTradeShareLinkV2');

    const result = await generateShareLink({
      calendarId,
      tradeId
    });

    return result.data as { shareLink: string; shareId: string; directLink: string };
  } catch (error) {
    console.error('Error generating share link:', error);
    throw new Error('Failed to generate share link');
  }
};

// Note: createSharedTrade is now handled by the cloud function
// This keeps the frontend simpler and more secure

// Note: getSharedTrade is now handled by the cloud function
// This provides better security and automatic view count incrementing

// Note: incrementShareViewCount is now handled automatically by the cloud function
// when getSharedTradeV2 is called

// Note: deactivateSharedTrade is now handled by the cloud function
// This provides better security and proper user permission checking

/**
 * Check if a trade already has a share link
 */
export const getExistingShareLink = (trade: Trade): string | null => {
  return trade.shareLink || null;
};

// Note: shareTradeWithLink functionality is now handled directly in ShareTradeButton
// This simplifies the flow and uses cloud functions for all operations
