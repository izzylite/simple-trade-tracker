import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
  DocumentData,
  setDoc,
  getDoc,
  writeBatch,
  runTransaction,
  deleteField
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { isSameWeek, isSameMonth } from 'date-fns';
import { auth, db } from '../firebase/config';
import { Calendar, calendarConverter } from '../types/calendar';
import { Trade, tradeConverter } from '../types/trade';
import { YearlyTrades, yearlyTradesConverter } from '../types/yearlyTrades';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';
import { TradeImage } from '../components/trades/TradeForm';
import { logger } from '../utils/logger'; 
import { vectorSearchService } from './ai/vectorSearchService';
import { embeddingService } from './ai/embeddingService';
import { getAuth } from '@firebase/auth';

const CALENDARS_COLLECTION = 'calendars';
const YEARS_SUBCOLLECTION = 'years';

// Vector sync helper functions
const syncTradeToVectors = async (
  trade: Trade,
  calendarId: string, 
  operation: 'add' | 'update' | 'delete'
): Promise<void> => {
  try {
    const userId =  getAuth().currentUser!.uid
    if (operation === 'delete') {
      // Delete the embedding
      await vectorSearchService.deleteTradeEmbedding(trade.id, userId, calendarId);
      logger.log(`Deleted vector embedding for trade ${trade.id}`);
    } else {
      // Generate and store embedding
      const { embedding, content } = await embeddingService.generateTradeEmbedding(trade);
      await vectorSearchService.storeTradeEmbedding(trade, embedding, content, userId, calendarId);
      logger.log(`${operation === 'add' ? 'Added' : 'Updated'} vector embedding for trade ${trade.id}`);
    }
  } catch (error) {
    logger.error(`Failed to sync trade ${trade.id} to vectors:`, error);
    // Don't throw here - vector sync failure shouldn't break the main operation
  }
};

const syncMultipleTradesToVectors = async (
  trades: Trade[],
  calendarId: string, 
  operation: 'add' | 'update' | 'delete'
): Promise<void> => {
  try {
    const userId =  getAuth().currentUser!.uid
    if (operation === 'delete') {
      // Delete multiple embeddings individually
      const deletePromises = trades.map(trade =>
        vectorSearchService.deleteTradeEmbedding(trade.id, userId, calendarId)
      );
      await Promise.allSettled(deletePromises);
      logger.log(`Deleted vector embeddings for ${trades.length} trades`);
    } else {
      // Generate and store multiple embeddings
      const tradeEmbeddings = await embeddingService.generateTradeEmbeddings(trades);
      await vectorSearchService.storeTradeEmbeddings(tradeEmbeddings, userId, calendarId);
      logger.log(`${operation === 'add' ? 'Added' : 'Updated'} vector embeddings for ${trades.length} trades`);
    }
  } catch (error) {
    logger.error(`Failed to sync ${trades.length} trades to vectors:`, error);
    // Don't throw here - vector sync failure shouldn't break the main operation
  }
};



// Interface for calendar statistics
interface CalendarStats {
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  targetProgress: number;
  pnlPerformance: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  totalPnL: number;
  drawdownStartDate: Date | null;
  drawdownEndDate: Date | null;
  drawdownRecoveryNeeded: number;
  drawdownDuration: number;
  avgWin: number;
  avgLoss: number;
  currentBalance: number;
  weeklyPnL?: number;
  monthlyPnL?: number;
  yearlyPnL?: number;
  weeklyPnLPercentage?: number;
  monthlyPnLPercentage?: number;
  yearlyPnLPercentage?: number;
  weeklyProgress?: number;
  monthlyProgress?: number;
}

// Calculate calendar statistics
export const calculateCalendarStats = (trades: Trade[], calendar: Calendar): CalendarStats => {
  const currentDate = new Date();

  // Default values if no trades
  if (trades.length === 0) {
    return {
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      targetProgress: 0,
      pnlPerformance: 0,
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      totalPnL: 0,
      drawdownStartDate: null,
      drawdownEndDate: null,
      drawdownRecoveryNeeded: 0,
      drawdownDuration: 0,
      avgWin: 0,
      avgLoss: 0,
      currentBalance: calendar.accountBalance,
      weeklyPnL: 0,
      monthlyPnL: 0,
      yearlyPnL: 0,
      weeklyPnLPercentage: 0,
      monthlyPnLPercentage: 0,
      yearlyPnLPercentage: 0,
      weeklyProgress: 0,
      monthlyProgress: 0
    };
  }

  // Calculate win rate
  const winCount = trades.filter(trade => trade.type === 'win').length;
  const lossCount = trades.filter(trade => trade.type === 'loss').length;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

  // Calculate profit factor and average win/loss
  const winningTrades = trades.filter(t => t.type === 'win');
  const losingTrades = trades.filter(t => t.type === 'loss');
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.amount, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.amount, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : winCount > 0 ? 999 : 0;

  // Calculate average win and loss
  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length * -1 : 0; // Make avgLoss negative

  // Calculate total P&L
  const totalPnL = trades.reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate max drawdown and related statistics
  let runningBalance = calendar.accountBalance;
  let maxBalance = runningBalance;
  let maxDrawdown = 0;
  let drawdownStartDate: Date | null = null;
  let drawdownEndDate: Date | null = null;
  let currentDrawdownStart: Date | null = null;
  let currentDrawdown = 0;

  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  sortedTrades.forEach(trade => {
    runningBalance += trade.amount;
    if (runningBalance > maxBalance) {
      maxBalance = runningBalance;
      currentDrawdown = 0;
      currentDrawdownStart = null;
    } else {
      const drawdown = maxBalance > 0 ? ((maxBalance - runningBalance) / maxBalance) * 100 : 0;
      if (drawdown > currentDrawdown) {
        currentDrawdown = drawdown;
        if (!currentDrawdownStart) {
          currentDrawdownStart = new Date(trade.date);
        }
      }
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        drawdownStartDate = currentDrawdownStart;
        drawdownEndDate = new Date(trade.date);
      }
    }
  });

  // Calculate drawdown recovery needed
  const drawdownRecoveryNeeded = maxDrawdown > 0 && runningBalance > 0 ?
    ((maxBalance - runningBalance) / runningBalance) * 100 : 0;

  // Calculate drawdown duration
  const drawdownDuration = (() => {
    if (drawdownStartDate === null || drawdownEndDate === null) {
      return 0;
    }
    const start = drawdownStartDate as Date;
    const end = drawdownEndDate as Date;
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  })();

  // Calculate weekly, monthly, and yearly PnL
  const weeklyPnL = trades
    .filter(trade => isSameWeek(new Date(trade.date), currentDate, { weekStartsOn: 1 }))
    .reduce((sum, trade) => sum + trade.amount, 0);

  const monthlyPnL = trades
    .filter(trade => isSameMonth(new Date(trade.date), currentDate))
    .reduce((sum, trade) => sum + trade.amount, 0);

  const yearlyPnL = trades
    .filter(trade => new Date(trade.date).getFullYear() === currentDate.getFullYear())
    .reduce((sum, trade) => sum + trade.amount, 0);

  // Calculate PnL percentages
  const weeklyPnLPercentage = calendar.accountBalance > 0 ? (weeklyPnL / calendar.accountBalance * 100) : 0;
  const monthlyPnLPercentage = calendar.accountBalance > 0 ? (monthlyPnL / calendar.accountBalance * 100) : 0;
  const yearlyPnLPercentage = calendar.accountBalance > 0 ? (yearlyPnL / calendar.accountBalance * 100) : 0;

  // Calculate target progress
  const yearlyTarget = calendar.yearlyTarget || 0;
  const targetProgress = yearlyTarget > 0 && calendar.accountBalance > 0 ?
    Math.min(100, (totalPnL / (calendar.accountBalance * yearlyTarget / 100)) * 100) : 0;

  // Calculate weekly and monthly progress
  const weeklyProgress = calendar.weeklyTarget && calendar.weeklyTarget > 0 ?
    Math.min(100, (weeklyPnLPercentage / calendar.weeklyTarget) * 100) : 0;

  const monthlyProgress = calendar.monthlyTarget && calendar.monthlyTarget > 0 ?
    Math.min(100, (monthlyPnLPercentage / calendar.monthlyTarget) * 100) : 0;

  // Calculate P&L performance (percentage of account balance)
  const pnlPerformance = calendar.accountBalance > 0 ? (totalPnL / calendar.accountBalance) * 100 : 0;

  // Current balance after all trades
  const currentBalance = calendar.accountBalance + totalPnL;

  return {
    winRate,
    profitFactor,
    maxDrawdown,
    targetProgress,
    pnlPerformance,
    totalTrades,
    winCount,
    lossCount,
    totalPnL,
    drawdownStartDate,
    drawdownEndDate,
    drawdownRecoveryNeeded,
    drawdownDuration,
    avgWin,
    avgLoss,
    currentBalance,
    weeklyPnL,
    monthlyPnL,
    yearlyPnL,
    weeklyPnLPercentage,
    monthlyPnLPercentage,
    yearlyPnLPercentage,
    weeklyProgress,
    monthlyProgress
  };
};







// Helper function to get trades (either from cache or Firestore)
const getTrades = async (calendarId: string, cachedTrades: Trade[] = []): Promise<Trade[]> => {
  if (cachedTrades.length > 0) {
    // Use cached trades if provided
    return cachedTrades;
  } else {
    // Fallback to fetching all trades from Firestore
    return await getAllTrades(calendarId);
  }
};

const getUpdateCalendarData = (stats: CalendarStats): Record<string, any> => {
  // Create the base object with required fields
  const baseData = {
    lastModified: Timestamp.fromDate(new Date()),
    winRate: stats.winRate,
    profitFactor: stats.profitFactor,
    maxDrawdown: stats.maxDrawdown,
    targetProgress: stats.targetProgress,
    pnlPerformance: stats.pnlPerformance,
    totalTrades: stats.totalTrades,
    winCount: stats.winCount,
    lossCount: stats.lossCount,
    totalPnL: stats.totalPnL,
    drawdownStartDate: stats.drawdownStartDate ? Timestamp.fromDate(stats.drawdownStartDate) : null,
    drawdownEndDate: stats.drawdownEndDate ? Timestamp.fromDate(stats.drawdownEndDate) : null,
    drawdownRecoveryNeeded: stats.drawdownRecoveryNeeded,
    drawdownDuration: stats.drawdownDuration,
    avgWin: stats.avgWin,
    avgLoss: stats.avgLoss,
    currentBalance: stats.currentBalance,

  };

  // Add optional fields only if they are not undefined
  const optionalFields = {
    ...(stats.weeklyPnL !== undefined && { weeklyPnL: stats.weeklyPnL }),
    ...(stats.monthlyPnL !== undefined && { monthlyPnL: stats.monthlyPnL }),
    ...(stats.yearlyPnL !== undefined && { yearlyPnL: stats.yearlyPnL }),
    ...(stats.weeklyPnLPercentage !== undefined && { weeklyPnLPercentage: stats.weeklyPnLPercentage }),
    ...(stats.monthlyPnLPercentage !== undefined && { monthlyPnLPercentage: stats.monthlyPnLPercentage }),
    ...(stats.yearlyPnLPercentage !== undefined && { yearlyPnLPercentage: stats.yearlyPnLPercentage }),
    ...(stats.weeklyProgress !== undefined && { weeklyProgress: stats.weeklyProgress }),
    ...(stats.monthlyProgress !== undefined && { monthlyProgress: stats.monthlyProgress }),
  };

  return {
    ...baseData,
    ...optionalFields
  };
}
// Helper function to update calendar statistics
const updateCalendarStats = async (calendarRef: any, stats: CalendarStats): Promise<void> => {
  // Update the calendar document with the new statistics
  await updateDoc(calendarRef, getUpdateCalendarData(stats));
};

// Get calendar statistics
export const getCalendarStats = (calendar: Calendar) => {
  return {
    totalPnL: calendar.totalPnL || 0,
    winRate: calendar.winRate || 0,
    totalTrades: calendar.totalTrades || 0,
    growthPercentage: calendar.pnlPerformance || 0,
    avgWin: calendar.avgWin || 0,
    avgLoss: calendar.avgLoss || 0,
    profitFactor: calendar.profitFactor || 0,
    maxDrawdown: calendar.maxDrawdown || 0,
    drawdownRecoveryNeeded: calendar.drawdownRecoveryNeeded || 0,
    drawdownDuration: calendar.drawdownDuration || 0,
    drawdownStartDate: calendar.drawdownStartDate || null,
    drawdownEndDate: calendar.drawdownEndDate || null,
    weeklyProgress: calendar.weeklyProgress || 0,
    monthlyProgress: calendar.monthlyProgress || 0,
    yearlyProgress: calendar.targetProgress || 0,
    winCount: calendar.winCount || 0,
    lossCount: calendar.lossCount || 0,
    initialBalance: calendar.accountBalance,
    currentBalance: calendar.currentBalance || calendar.accountBalance,
    weeklyPnLPercentage: calendar.weeklyPnLPercentage || 0,
    monthlyPnLPercentage: calendar.monthlyPnLPercentage || 0,
    yearlyPnLPercentage: calendar.yearlyPnLPercentage || 0
  };
};



// Get a single calendar by ID
export const getCalendar = async (calendarId: string): Promise<Calendar | null> => {
  try {
    const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
    const calendarDoc = await getDoc(calendarRef);

    if (!calendarDoc.exists()) {
      return null;
    }

    return calendarConverter.fromJson(calendarDoc);
  } catch (error) {
    logger.error('Error getting calendar:', error);
    throw error;
  }
};


// Get all calendars for a user (excluding deleted ones)
export const getUserCalendars = async (userId: string): Promise<Calendar[]> => {
  const q = query(
    collection(db, CALENDARS_COLLECTION),
    where("userId", "==", userId),
    where("isDeleted", "!=", true)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => calendarConverter.fromJson(doc));
};

// Create a new calendar
export const createCalendar = async (userId: string, calendar: Omit<Calendar, 'id' | 'userId' | 'cachedTrades' | 'loadedYears'>): Promise<string> => {
  const calendarData = {
    ...calendarConverter.toJson(calendar),
    userId,
    // Initialize notes
    note: calendar.note || '',
    daysNotes: calendar.daysNotes ? Object.fromEntries(calendar.daysNotes) : {},
    // Initialize tags
    tags: calendar.tags || [],
    // Initialize pinned events
    pinnedEvents: calendar.pinnedEvents || [],
    // Initialize statistics
    winRate: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    targetProgress: 0,
    pnlPerformance: 0,
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    totalPnL: 0,
    drawdownStartDate: null,
    drawdownEndDate: null,
    drawdownRecoveryNeeded: 0,
    drawdownDuration: 0,
    avgWin: 0,
    avgLoss: 0,
    currentBalance: calendar.accountBalance
  };

  const docRef = await addDoc(collection(db, CALENDARS_COLLECTION), calendarData);
  return docRef.id;
};

// Duplicate an existing calendar
export const duplicateCalendar = async (userId: string, sourceCalendarId: string, newName: string, includeContent: boolean = false): Promise<Omit<Calendar, 'cachedTrades' | 'loadedYears'>> => {
  try {
    // Get the source calendar
    const sourceCalendar = await getCalendar(sourceCalendarId);
    if (!sourceCalendar) {
      throw new Error('Source calendar not found');
    }

    // Create a new calendar based on the source calendar
    const duplicatedCalendar: Omit<Calendar, 'id' | 'cachedTrades' | 'loadedYears'> = {
      name: newName,
      createdAt: new Date(),
      lastModified: new Date(),
      userId: sourceCalendar.userId,
      accountBalance: sourceCalendar.accountBalance,
      maxDailyDrawdown: sourceCalendar.maxDailyDrawdown,
      weeklyTarget: sourceCalendar.weeklyTarget,
      monthlyTarget: sourceCalendar.monthlyTarget,
      yearlyTarget: sourceCalendar.yearlyTarget,
      riskPerTrade: sourceCalendar.riskPerTrade,
      requiredTagGroups: sourceCalendar.requiredTagGroups || [],
      dynamicRiskEnabled: sourceCalendar.dynamicRiskEnabled,
      increasedRiskPercentage: sourceCalendar.increasedRiskPercentage,
      profitThresholdPercentage: sourceCalendar.profitThresholdPercentage,
      // Mark as duplicated calendar and track source
      duplicatedCalendar: true,
      sourceCalendarId: sourceCalendarId,
      isDeleted: false,
      // Copy notes, tags, score settings, and economic calendar filters
      note: sourceCalendar.note,
      heroImageUrl: sourceCalendar.heroImageUrl,
      heroImageAttribution: sourceCalendar.heroImageAttribution,
      daysNotes: sourceCalendar.daysNotes,
      tags: sourceCalendar.tags || [],
      scoreSettings: sourceCalendar.scoreSettings,
      economicCalendarFilters: sourceCalendar.economicCalendarFilters,
      pinnedEvents: sourceCalendar.pinnedEvents || [],
      // Copy statistics if including content, otherwise reset
      winRate: includeContent ? sourceCalendar.winRate : 0,
      profitFactor: includeContent ? sourceCalendar.profitFactor : 0,
      maxDrawdown: includeContent ? sourceCalendar.maxDrawdown : 0,
      targetProgress: includeContent ? sourceCalendar.targetProgress : 0,
      pnlPerformance: includeContent ? sourceCalendar.pnlPerformance : 0,
      totalTrades: includeContent ? sourceCalendar.totalTrades : 0,
      winCount: includeContent ? sourceCalendar.winCount : 0,
      lossCount: includeContent ? sourceCalendar.lossCount : 0,
      totalPnL: includeContent ? sourceCalendar.totalPnL : 0,
      drawdownStartDate: includeContent ? sourceCalendar.drawdownStartDate : null,
      drawdownEndDate: includeContent ? sourceCalendar.drawdownEndDate : null,
      drawdownRecoveryNeeded: includeContent ? sourceCalendar.drawdownRecoveryNeeded : 0,
      drawdownDuration: includeContent ? sourceCalendar.drawdownDuration : 0,
      avgWin: includeContent ? sourceCalendar.avgWin : 0,
      avgLoss: includeContent ? sourceCalendar.avgLoss : 0,
      currentBalance: includeContent ? sourceCalendar.currentBalance : sourceCalendar.accountBalance,
      weeklyPnL: includeContent ? sourceCalendar.weeklyPnL : 0,
      monthlyPnL: includeContent ? sourceCalendar.monthlyPnL : 0,
      yearlyPnL: includeContent ? sourceCalendar.yearlyPnL : 0,
      weeklyPnLPercentage: includeContent ? sourceCalendar.weeklyPnLPercentage : 0,
      monthlyPnLPercentage: includeContent ? sourceCalendar.monthlyPnLPercentage : 0,
      yearlyPnLPercentage: includeContent ? sourceCalendar.yearlyPnLPercentage : 0,
      weeklyProgress: includeContent ? sourceCalendar.weeklyProgress : 0,
      monthlyProgress: includeContent ? sourceCalendar.monthlyProgress : 0,
      
    };

    // Create the new calendar
    const newCalendarId = await createCalendar(userId, duplicatedCalendar);

    // If includeContent is true, copy all trades from the source calendar
    if (includeContent) {
      try {
        const sourceTrades = await getAllTrades(sourceCalendarId);
        if (sourceTrades.length > 0) {
          // Import all trades to the new calendar
          await importTrades(newCalendarId, sourceTrades);
        }
      } catch (error) {
        logger.error('Error copying trades to duplicated calendar:', error);
        // Don't throw here - the calendar was created successfully, just the trades failed to copy
      }
    }

    return {
      id: newCalendarId,
      ...duplicatedCalendar
    };
  } catch (error) {
    logger.error('Error duplicating calendar:', error);
    throw error;
  }
};

// Update an existing calendar
export const updateCalendar = async (calendarId: string, updates: Partial<Omit<Calendar, 'cachedTrades' | 'loadedYears'>>): Promise<void> => {
  const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
  const updateData: Record<string, any> = {
    ...updates,
    lastModified: Timestamp.fromDate(new Date())
  };

  // Remove undefined fields and fields that should not be stored directly
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined || key === 'cachedTrades' || key === 'loadedYears') {
      delete updateData[key];
    }
  });

  await updateDoc(calendarRef, updateData);
};

// Delete a calendar (soft delete - move to trash)
export const deleteCalendar = async (calendarId: string, userId: string): Promise<void> => {
  // Import moveCalendarToTrash to avoid circular dependency
  const { moveCalendarToTrash } = await import('./trashService');
  await moveCalendarToTrash(calendarId, userId);
};

// Get trades for a specific year
export const getYearlyTrades = async (calendarId: string, year: number): Promise<Trade[]> => {
  const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, year.toString());
  const yearDoc = await getDoc(yearDocRef);

  if (yearDoc.exists()) {
    const yearlyTrades = yearlyTradesConverter.fromJson(yearDoc);
    return yearlyTrades.trades;
  }

  return [];
};

// Get all trades for a calendar (across all years)
export const getAllTrades = async (calendarId: string): Promise<Trade[]> => {
  const yearsCollectionRef = collection(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION);
  const yearsSnapshot = await getDocs(yearsCollectionRef);

  let allTrades: Trade[] = [];

  yearsSnapshot.docs.forEach(yearDoc => {
    const yearlyTrades = yearlyTradesConverter.fromJson(yearDoc);
    allTrades = [...allTrades, ...yearlyTrades.trades];
  });

  return allTrades;
};

// Add a trade to a calendar using a transaction to prevent race conditions
export const addTrade = async (calendarId: string, trade: Trade, cachedTrades: Trade[] = []): Promise<CalendarStats> => {
  try {
    const year = new Date(trade.date).getFullYear();
    const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, year.toString());
    const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);

    // Run a transaction to add the trade
    return await runTransaction(db, async (transaction) => {
      // Get the calendar to calculate stats
      const calendarDoc = await transaction.get(calendarRef);
      if (!calendarDoc.exists()) {
        throw new Error('Calendar not found');
      }
      const calendar = calendarConverter.fromJson(calendarDoc);

      // Get trades (either from cache or Firestore)
      const existingTrades = await getTrades(calendarId, cachedTrades);

      // Add the new trade to the existing trades
      const allTrades = [...existingTrades, trade];

      // Calculate stats
      const stats = calculateCalendarStats(allTrades, calendar);

      // Check if the year document exists
      const yearDoc = await transaction.get(yearDocRef);

      if (yearDoc.exists()) {
        // Year document exists, update it
        const yearlyTrades = yearlyTradesConverter.fromJson(yearDoc);
        yearlyTrades.trades.push(trade);
        yearlyTrades.userId = calendar.userId;
        yearlyTrades.lastModified = new Date();

        transaction.update(yearDocRef, yearlyTradesConverter.toJson(yearlyTrades, calendarId));
      } else {
        // Year document doesn't exist, create it
        const yearlyTrades: YearlyTrades = {
          year,
          userId: calendar.userId,
          lastModified: new Date(),
          trades: [trade]
        };

        transaction.set(yearDocRef, yearlyTradesConverter.toJson(yearlyTrades, calendarId));
      }

      // Update the calendar with stats
      transaction.update(calendarRef, getUpdateCalendarData(stats));

      // Return the updated stats
      return stats;
    }).then(async (stats) => {
      await onUpdateCalendar(calendarId, (calendar) => {
        const calendarTags = calendar.tags || []
        trade.tags?.forEach((tag) => {
          if (!calendarTags.includes(tag)) {
            calendarTags.push(tag)
          }
        })
        calendar.tags = calendarTags;
        return calendar;
      });

      // Sync trade to vector database
      await syncTradeToVectors(trade, calendarId, 'add');

      return stats;
    });
  } catch (error) {
    logger.error('Error adding trade:', error);
    throw error;
  }
};

export const onUpdateCalendar = async (calendarId: string, updateCallback: (calendar: Calendar) => Calendar): Promise<Calendar> => {
  try {
    const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);

    // Run a transaction to update the calendar
    return await runTransaction(db, async (transaction) => {
      // Get the calendar
      const calendarDoc = await transaction.get(calendarRef);
      if (!calendarDoc.exists()) {
        throw new Error('Calendar not found');
      }
      const calendar = calendarConverter.fromJson(calendarDoc);

      // Apply the update callback to get the updated calendar
      const updatedCalendar = updateCallback(calendar);
      updatedCalendar.lastModified = new Date();
      // Convert daysNotes Map to a plain object for Firestore

      // Update the calendar document
      transaction.update(calendarRef, calendarConverter.toJson(updatedCalendar));
      return updatedCalendar;
    });
  } catch (error) {
    logger.error('Error updating calendar:', error);
    throw error;
  }
};

// Update a trade in a calendar using a transaction to prevent race conditions
export const updateTrade = async (calendarId: string, tradeId: string, cachedTrades: Trade[] = [],
  updateCallback: (trade: Trade) => Trade, createIfNotExists?: (tradeId: string) => Trade): Promise<[CalendarStats, Trade[]] | undefined> => {
  try {
    // First try to find the trade in cached trades
    let trade = cachedTrades.find(t => t.id === tradeId);
    let tempTrade: Trade | undefined;
    let isNewTrade = false;

    // If not found in cache and createIfNotExists is provided, create a new trade
    if (trade === undefined && createIfNotExists) {
      logger.log(`Creating new trade with ID ${tradeId} since it wasn't found in cached trades`);
      tempTrade = createIfNotExists(tradeId);
      trade = tempTrade;
      isNewTrade = true;
    }
    // If still not found, try to fetch it from Firestore
    else if (trade === undefined) {
      const fetchedTrade = await getTrade(calendarId, tradeId);
      if (fetchedTrade === null || fetchedTrade === undefined) {
        throw new Error(`Attempting to fetch trade with ID ${tradeId} from Firestore`);
      }
      trade = fetchedTrade;

    }

    const year = new Date(trade.date).getFullYear();
    // If the trade is moved to a different year, we need to handle it differently

    // Same year, use a transaction to update the trade
    const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
    const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, year.toString());

    // Run a transaction to update the trade
    return runTransaction(db, async (transaction) => {
      // Get the calendar to calculate stats
      const calendarDoc = await transaction.get(calendarRef);
      if (!calendarDoc.exists()) {
        throw new Error('Calendar not found');
      }
      const calendar = calendarConverter.fromJson(calendarDoc);

      // Get the year document
      const yearDoc = await transaction.get(yearDocRef);
      // If this is a new trade and the year document doesn't exist, we'll create it
      if (!yearDoc.exists() && !isNewTrade) {
        throw new Error(`Year document for ${year} not found`);
      }
      let tradeIndex = cachedTrades.findIndex(t => t.id === trade!!.id);
      // get updated all trade if this is a delete process
      let allTrades: Trade[] = await getTrades(calendarId, tradeIndex >= 0 && updateCallback(cachedTrades[tradeIndex]).isDeleted ? [] : cachedTrades);
      let yearTrades: Trade[] = [];
      let updatedTrade: Trade;

      // Handle the case where the year document exists
      if (yearDoc.exists()) {
        // Get the trades for this year
        const yearData = yearlyTradesConverter.fromJson(yearDoc);
        yearTrades = yearData.trades;
      }

      // Find the trade to update or add the new trade
      tradeIndex = yearTrades.findIndex(t => t.id === trade!!.id);

      if (tradeIndex === -1) {
        // If this is a new trade, add it to the arrays
        if (isNewTrade) {
          logger.log(`Adding new trade with ID ${trade!!.id} to year ${year}`);
          updatedTrade = trade!!;
          yearTrades.push(updatedTrade);
          allTrades.push(updatedTrade);
          tradeIndex = yearTrades.length - 1;
        } else {
          logger.log(`Trade with ID ${trade!!.id} not found in year ${year}`)
        }
      }

      // Apply the update callback to the trade
      updatedTrade = updateCallback(yearTrades[tradeIndex]);
      // Get all trades (either from cache or Firestore)
      logger.log(`Updating trade with ID ${trade!!.id} in year ${year} : ${JSON.stringify(updatedTrade)}`);


      if (updatedTrade.isDeleted) {
        yearTrades.splice(tradeIndex, 1);
        allTrades = allTrades.filter(t => t.id !== updatedTrade.id);
      }
      else {
        // Update the trade in the array
        yearTrades[tradeIndex] = updatedTrade;
        allTrades = allTrades.map(t => t.id === updatedTrade.id ? updatedTrade : t);
      }

      // Calculate stats
      const stats = calculateCalendarStats(allTrades, calendar);
      // Update or create the year document with the modified trades array
      if (yearDoc.exists()) {
        // Update existing year document
        transaction.update(yearDocRef, {
          trades: yearTrades.map(trade => tradeConverter.toJson(trade, calendarId)),
          lastModified: Timestamp.fromDate(new Date())
        });
      } else {
        // Create new year document
        logger.log(`Creating new year document for year ${year}`);
        transaction.set(yearDocRef, {
          year,
          trades: yearTrades.map(trade => tradeConverter.toJson(trade, calendarId)),
          lastModified: Timestamp.fromDate(new Date())
        });
      }

      // Update the calendar with stats
      transaction.update(calendarRef, getUpdateCalendarData(stats));

      // Return both the stats and the updated trades list
      return [stats, allTrades, updatedTrade];
    }).then(async (result) => {
      if (result) {
        const [stats, allTrades, updatedTrade] = result as [CalendarStats, Trade[], Trade];
        if (updatedTrade.isDeleted) {
          await syncTradeToVectors(updatedTrade, calendarId, 'delete');
        } else {
          await syncTradeToVectors(updatedTrade, calendarId, 'update');
        }

        return [stats, allTrades] as [CalendarStats, Trade[]];
      }
      return undefined;
    });
  } catch (error) {
    logger.error('Error updating trade:', error);
    throw error;
  }
};


// Clear all trades for a specific month and year
export const clearMonthTrades = async (calendarId: string, month: number, year: number, cachedTrades: Trade[] = []): Promise<CalendarStats | undefined> => {
  const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, year.toString());
  const yearDoc = await getDoc(yearDocRef);

  // Get the calendar to calculate stats
  const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
  const calendarDoc = await getDoc(calendarRef);

  if (!calendarDoc.exists()) {
    throw new Error('Calendar not found');
  }

  const calendar = calendarConverter.fromJson(calendarDoc);

  if (yearDoc.exists()) {
    const yearlyTrades = yearlyTradesConverter.fromJson(yearDoc);

    // Filter out trades from the specified month
    const filteredTrades = yearlyTrades.trades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate.getMonth() !== month;
    });



    yearlyTrades.trades = filteredTrades;
    yearlyTrades.lastModified = new Date();

    // Get trades (either from cache or Firestore)
    const existingTrades = await getTrades(calendarId, cachedTrades);

    // Filter out trades from the specified month and year
    const allTrades = existingTrades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return !(tradeDate.getMonth() === month && tradeDate.getFullYear() === year);
    });

    // Calculate stats
    const stats = calculateCalendarStats(allTrades, calendar);

    await updateDoc(yearDocRef, yearlyTradesConverter.toJson(yearlyTrades, calendarId));

    // Update the calendar with stats and lastModified timestamp
    await updateCalendarStats(calendarRef, stats);

    // Sync deleted trades to vector database
    const deletedTrades = existingTrades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate.getMonth() === month && tradeDate.getFullYear() === year;
    });

    if (deletedTrades.length > 0) {
      await syncMultipleTradesToVectors(deletedTrades, calendarId, 'delete');
    }

    // Return the updated stats
    return stats;
  }

  return undefined;
};

// Import trades (replace all trades)
export const importTrades = async (calendarId: string, trades: Trade[]): Promise<CalendarStats> => {
  // Get the calendar to calculate stats
  const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
  const calendarDoc = await getDoc(calendarRef);

  if (!calendarDoc.exists()) {
    throw new Error('Calendar not found');
  }

  const calendar = calendarConverter.fromJson(calendarDoc);

  // Calculate stats for the imported trades
  const stats = calculateCalendarStats(trades, calendar);

  // Group trades by year
  const tradesByYear = trades.reduce((acc, trade) => {
    const year = new Date(trade.date).getFullYear();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(trade);
    return acc;
  }, {} as Record<number, Trade[]>);

  // Delete all existing year documents
  const yearsCollectionRef = collection(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION);
  const yearsSnapshot = await getDocs(yearsCollectionRef);

  const batch = writeBatch(db);
  yearsSnapshot.docs.forEach(yearDoc => {
    batch.delete(yearDoc.ref);
  });
  await batch.commit();

  // Create new year documents
  for (const [year, yearTrades] of Object.entries(tradesByYear)) {
    const yearlyTrades: YearlyTrades = {
      userId: calendar.userId,
      year: parseInt(year),
      lastModified: new Date(),
      trades: yearTrades
    };

    const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, year);
    await setDoc(yearDocRef, yearlyTradesConverter.toJson(yearlyTrades, calendarId));
  }

  // Update the calendar with stats and lastModified timestamp
  await updateCalendarStats(calendarRef, stats);

  // Sync all imported trades to vector database
  if (trades.length > 0) {
    await syncMultipleTradesToVectors(trades, calendarId, 'add');
  }

  // Return the updated stats
  return stats;
};






// Get a specific trade by ID
export const getTrade = async (calendarId: string, tradeId: string): Promise<Trade | null | undefined> => {
  // Find which year the trade belongs to
  const yearsRef = collection(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION);
  const yearsSnapshot = await getDocs(yearsRef);

  for (const yearDoc of yearsSnapshot.docs) {
    const yearlyTrades = yearlyTradesConverter.fromJson(yearDoc);
    const trade = yearlyTrades.trades.find(t => t.id === tradeId);

    if (trade) {
      return trade;
    }
  }

  return null;
};



export const generateImageId = (file: File): string => {
  const timestamp = new Date().getTime();
  return `${timestamp}_${file.name}`;
};

// Upload a single image and return its details
export const uploadImage = async (
  calendarId: string,
  filename: string,
  file: File,
  width?: number,
  height?: number,
  caption?: string,
  onProgress?: (progress: number) => void
) => {
  try {
    // Create a unique filename using timestamp and original filename


    // Create a reference to the file location in Firebase Storage
    const storageRef = ref(storage, `users/${auth.currentUser?.uid}/trade-images/${filename}`);

    // Upload the file with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, file);

    // Return a promise that resolves when the upload is complete
    return new Promise<TradeImage>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot: any) => {
          // Track upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error: any) => {
          // Handle errors
          logger.error('Error uploading image:', error);
          reject(error);
        },
        async () => {
          // Upload completed successfully, get the download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Return the image details
          resolve({
            url: downloadURL,
            id: filename,
            calendarId: calendarId,
            width,
            height,
            caption
          });
        }
      );
    });
  } catch (error) {
    logger.error('Error setting up image upload:', error);
    throw error;
  }
};

// Update a tag across all trades in a calendar
export const updateTag = async (calendarId: string, oldTag: string, newTag: string): Promise<{ success: boolean; tradesUpdated: number }> => {
  try {
    // Ensure user is authenticated
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get the cloud function
    const updateTagFunction = httpsCallable(functions, 'updateTagV2');

    // Call the cloud function
    const result = await updateTagFunction({ calendarId, oldTag, newTag });

    return result.data as { success: boolean; tradesUpdated: number };
  } catch (error) {
    logger.error('Error updating tag:', error);
    throw error;
  }
};



