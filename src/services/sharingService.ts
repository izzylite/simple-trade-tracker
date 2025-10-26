/**
 * NOTE: This service has been migrated to Supabase Edge Functions.
 * All sharing functionality now uses supabaseEdgeFunctions in sharingService.ts
 * This file is kept for reference but is not used in production.
 */

import { httpsCallable } from 'firebase/functions';
// import { functions, db } from '../firebase/config';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { Trade } from '../types/dualWrite';
import { Calendar } from '../types/dualWrite';
import { logger } from '../utils/logger';
import { getCalendar, getAllTrades } from './calendarService';

/* eslint-disable */
// @ts-nocheck

const functions: any = null; // Placeholder for migration
const db: any = null; // Placeholder for migration

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

export interface SharedCalendar {
  id: string;
  calendarId: string;
  userId: string;
  calendar: Calendar;
  shareLink: string;
  createdAt: Date;
  isActive: boolean;
  viewCount: number;
}

export interface SharedTradeData {
  trade: Trade;
  viewCount: number;
  sharedAt: any; // Can be various timestamp formats from Firebase
}

/**
 * Get a shared trade by its share ID
 */
export const getSharedTrade = async (shareId: string): Promise<SharedTradeData> => {
  try {
    const getSharedTradeFunction = httpsCallable(functions, 'getSharedTradeV2');
    const result = await getSharedTradeFunction({ shareId });
    return result.data as SharedTradeData;
  } catch (error) {
    logger.error('Error getting shared trade:', error);
    throw new Error('Failed to load shared trade');
  }
};

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
    const generateShareLink = httpsCallable(functions, 'generateTradeShareLinkV2');

    const result = await generateShareLink({
      calendarId,
      tradeId
    });

    return result.data as { shareLink: string; shareId: string; directLink: string };
  } catch (error) {
    logger.error('Error generating share link:', error);
    throw new Error('Failed to generate share link');
  }
};

  

/**
 * Generate a shareable link for a calendar
 * Uses direct links (future-proof - Firebase Dynamic Links deprecated Aug 25, 2025)
 * This is the main function used by ShareCalendarButton
 */
export const generateCalendarShareLink = async (
  calendarId: string
): Promise<{ shareLink: string; shareId: string; directLink: string }> => {
  try {
    const generateShareLink = httpsCallable(functions, 'generateCalendarShareLinkV2');

    const result = await generateShareLink({
      calendarId
    });

    return result.data as { shareLink: string; shareId: string; directLink: string };
  } catch (error) {
    logger.error('Error generating calendar share link:', error);
    throw new Error('Failed to generate calendar share link');
  }
};
 
 
 
/**
 * Get shared trades with calendar using existing calendar service functions
 * This avoids code duplication and uses the established calendar data handling
 */
export const getSharedTradesWithCalendar = async (shareId: string) => {
  try {
    if (!shareId) {
      throw new Error('Missing shareId parameter');
    }

    // Get the shared calendar document
    const sharedCalendarRef = doc(db, 'sharedCalendars', shareId);
    const sharedCalendarDoc = await getDoc(sharedCalendarRef);

    if (!sharedCalendarDoc.exists()) {
      throw new Error('Shared calendar not found');
    }

    const sharedCalendarData = sharedCalendarDoc.data();

    // Check if the share is still active
    if (!sharedCalendarData?.isActive) {
      throw new Error('This shared calendar is no longer available');
    }

    // Get the actual calendar data using existing service
    const calendarId = sharedCalendarData.calendarId;
    const calendar = await getCalendar(calendarId);

    if (!calendar) {
      throw new Error('The shared calendar no longer exists');
    }

    // Get all trades using existing service
    const allTrades = await getAllTrades(calendarId);

    // Sort trades by date (newest first)
    const sortedTrades = allTrades.sort((a, b) => {
      const dateA = new Date(a.trade_date);
      const dateB = new Date(b.trade_date);
      return dateB.getTime() - dateA.getTime();
    });

    // Increment view count for the shared calendar
    await updateDoc(sharedCalendarRef, {
      viewCount: increment(1)
    });

    logger.info(`Shared calendar ${shareId} viewed (calendar: ${calendarId}, total trades: ${sortedTrades.length})`);

    return {
      calendar: {
        ...calendar,
        // Ensure required fields are present for frontend
        cachedTrades: [],
        loadedYears: []
      },
      trades: sortedTrades,
      shareInfo: {
        id: sharedCalendarData.id,
        createdAt: sharedCalendarData.createdAt?.toDate ? sharedCalendarData.createdAt.toDate().toISOString() : sharedCalendarData.createdAt,
        viewCount: (sharedCalendarData.viewCount || 0) + 1,
        userId: sharedCalendarData.userId
      }
    };

  } catch (error) {
    logger.error('Error getting shared trades with calendar:', error);
    throw error;
  }
};
 

/**
 * Deactivate a shared trade (stop sharing)
 */
export const deactivateTradeShareLink = async (shareId: string): Promise<void> => {
  try {
    const deactivateSharedTradeFunction = httpsCallable(functions, 'deactivateSharedTradeV2');
    await deactivateSharedTradeFunction({ shareId });
    logger.info('Trade share deactivated successfully');
  } catch (error) {
    logger.error('Error deactivating trade share:', error);
    throw new Error('Failed to deactivate trade share');
  }
};

/**
 * Deactivate a shared calendar (stop sharing)
 */
export const deactivateCalendarShareLink = async (shareId: string): Promise<void> => {
  try {
    const deactivateSharedCalendarFunction = httpsCallable(functions, 'deactivateSharedCalendarV2');
    await deactivateSharedCalendarFunction({ shareId });
    logger.info('Calendar share deactivated successfully');
  } catch (error) {
    logger.error('Error deactivating calendar share:', error);
    throw new Error('Failed to deactivate calendar share');
  }
};

// Note: shareTradeWithLink functionality is now handled directly in ShareTradeButton
// This simplifies the flow and uses cloud functions for all operations