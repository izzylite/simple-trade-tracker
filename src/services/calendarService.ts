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
  writeBatch
} from 'firebase/firestore';
import { isSameWeek, isSameMonth } from 'date-fns';
import { auth, db } from '../firebase/config';
import { Calendar } from '../types/calendar';
import { Trade } from '../types/trade';
import { YearlyTrades } from '../types/yearlyTrades';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/config';

const CALENDARS_COLLECTION = 'calendars';
const YEARS_SUBCOLLECTION = 'years';

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
const calculateCalendarStats = (trades: Trade[], calendar: Calendar): CalendarStats => {
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

// Convert Firestore data to Calendar object
const convertFirestoreDataToCalendar = (doc: DocumentData): Calendar => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    createdAt: data.createdAt.toDate(),
    lastModified: data.lastModified.toDate(),
    accountBalance: data.accountBalance,
    maxDailyDrawdown: data.maxDailyDrawdown,
    weeklyTarget: data.weeklyTarget,
    monthlyTarget: data.monthlyTarget,
    yearlyTarget: data.yearlyTarget,
    riskPerTrade: data.riskPerTrade,
    dynamicRiskEnabled: data.dynamicRiskEnabled,
    increasedRiskPercentage: data.increasedRiskPercentage,
    profitThresholdPercentage: data.profitThresholdPercentage,
    // Statistics
    winRate: data.winRate || 0,
    profitFactor: data.profitFactor || 0,
    maxDrawdown: data.maxDrawdown || 0,
    targetProgress: data.targetProgress || 0,
    pnlPerformance: data.pnlPerformance || 0,
    totalTrades: data.totalTrades || 0,
    winCount: data.winCount || 0,
    lossCount: data.lossCount || 0,
    totalPnL: data.totalPnL || 0,
    drawdownStartDate: data.drawdownStartDate ? data.drawdownStartDate.toDate() : null,
    drawdownEndDate: data.drawdownEndDate ? data.drawdownEndDate.toDate() : null,
    drawdownRecoveryNeeded: data.drawdownRecoveryNeeded || 0,
    drawdownDuration: data.drawdownDuration || 0,
    avgWin: data.avgWin || 0,
    avgLoss: data.avgLoss || 0,
    currentBalance: data.currentBalance || data.accountBalance,

    // Weekly, monthly, and yearly statistics
    weeklyPnL: data.weeklyPnL || 0,
    monthlyPnL: data.monthlyPnL || 0,
    yearlyPnL: data.yearlyPnL || 0,
    weeklyPnLPercentage: data.weeklyPnLPercentage || 0,
    monthlyPnLPercentage: data.monthlyPnLPercentage || 0,
    yearlyPnLPercentage: data.yearlyPnLPercentage || 0,
    weeklyProgress: data.weeklyProgress || 0,
    monthlyProgress: data.monthlyProgress || 0,
    // Cached data
    loadedYears: [],
    cachedTrades: []
  };
};

// Convert Calendar object to Firestore data
const convertCalendarToFirestoreData = (calendar: Omit<Calendar, 'id' | 'cachedTrades' | 'loadedYears'>) => {
  // Create the base object with required fields
  const baseData = {
    name: calendar.name,
    createdAt: Timestamp.fromDate(calendar.createdAt),
    lastModified: Timestamp.fromDate(calendar.lastModified),
    accountBalance: calendar.accountBalance,
    maxDailyDrawdown: calendar.maxDailyDrawdown,
  };

  // Add optional fields only if they are not undefined
  const optionalFields = {
    // Configuration fields
    ...(calendar.weeklyTarget !== undefined && { weeklyTarget: calendar.weeklyTarget }),
    ...(calendar.monthlyTarget !== undefined && { monthlyTarget: calendar.monthlyTarget }),
    ...(calendar.yearlyTarget !== undefined && { yearlyTarget: calendar.yearlyTarget }),
    ...(calendar.riskPerTrade !== undefined && { riskPerTrade: calendar.riskPerTrade }),
    ...(calendar.dynamicRiskEnabled !== undefined && { dynamicRiskEnabled: calendar.dynamicRiskEnabled }),
    ...(calendar.increasedRiskPercentage !== undefined && { increasedRiskPercentage: calendar.increasedRiskPercentage }),
    ...(calendar.profitThresholdPercentage !== undefined && { profitThresholdPercentage: calendar.profitThresholdPercentage }),

    // Statistics fields
    ...(calendar.winRate !== undefined && { winRate: calendar.winRate }),
    ...(calendar.profitFactor !== undefined && { profitFactor: calendar.profitFactor }),
    ...(calendar.maxDrawdown !== undefined && { maxDrawdown: calendar.maxDrawdown }),
    ...(calendar.targetProgress !== undefined && { targetProgress: calendar.targetProgress }),
    ...(calendar.pnlPerformance !== undefined && { pnlPerformance: calendar.pnlPerformance }),
    ...(calendar.totalTrades !== undefined && { totalTrades: calendar.totalTrades }),
    ...(calendar.winCount !== undefined && { winCount: calendar.winCount }),
    ...(calendar.lossCount !== undefined && { lossCount: calendar.lossCount }),
    ...(calendar.totalPnL !== undefined && { totalPnL: calendar.totalPnL }),

    // New statistics fields
    ...(calendar.drawdownStartDate !== undefined && {
      drawdownStartDate: calendar.drawdownStartDate ? Timestamp.fromDate(calendar.drawdownStartDate) : null
    }),
    ...(calendar.drawdownEndDate !== undefined && {
      drawdownEndDate: calendar.drawdownEndDate ? Timestamp.fromDate(calendar.drawdownEndDate) : null
    }),
    ...(calendar.drawdownRecoveryNeeded !== undefined && { drawdownRecoveryNeeded: calendar.drawdownRecoveryNeeded }),
    ...(calendar.drawdownDuration !== undefined && { drawdownDuration: calendar.drawdownDuration }),
    ...(calendar.avgWin !== undefined && { avgWin: calendar.avgWin }),
    ...(calendar.avgLoss !== undefined && { avgLoss: calendar.avgLoss }),
    ...(calendar.currentBalance !== undefined && { currentBalance: calendar.currentBalance }),

    // Weekly, monthly, and yearly statistics
    ...(calendar.weeklyPnL !== undefined && { weeklyPnL: calendar.weeklyPnL }),
    ...(calendar.monthlyPnL !== undefined && { monthlyPnL: calendar.monthlyPnL }),
    ...(calendar.yearlyPnL !== undefined && { yearlyPnL: calendar.yearlyPnL }),
    ...(calendar.weeklyPnLPercentage !== undefined && { weeklyPnLPercentage: calendar.weeklyPnLPercentage }),
    ...(calendar.monthlyPnLPercentage !== undefined && { monthlyPnLPercentage: calendar.monthlyPnLPercentage }),
    ...(calendar.yearlyPnLPercentage !== undefined && { yearlyPnLPercentage: calendar.yearlyPnLPercentage }),
    ...(calendar.weeklyProgress !== undefined && { weeklyProgress: calendar.weeklyProgress }),
    ...(calendar.monthlyProgress !== undefined && { monthlyProgress: calendar.monthlyProgress }),
  };

  return {
    ...baseData,
    ...optionalFields
  };
};

// Convert Trade object to Firestore data
const convertTradeToFirestoreData = (trade: Trade) => {
  return {
    ...trade,
    date: Timestamp.fromDate(new Date(trade.date))
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

// Helper function to update calendar statistics
const updateCalendarStats = async (calendarRef: any, stats: CalendarStats): Promise<void> => {
  await updateDoc(calendarRef, {
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
    weeklyPnL: stats.weeklyPnL,
    monthlyPnL: stats.monthlyPnL,
    yearlyPnL: stats.yearlyPnL,
    weeklyPnLPercentage: stats.weeklyPnLPercentage,
    monthlyPnLPercentage: stats.monthlyPnLPercentage,
    yearlyPnLPercentage: stats.yearlyPnLPercentage,
    weeklyProgress: stats.weeklyProgress,
    monthlyProgress: stats.monthlyProgress
  });
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

// Convert Firestore data to YearlyTrades object
const convertFirestoreDataToYearlyTrades = (doc: DocumentData): YearlyTrades => {
  const data = doc.data();
  return {
    year: data.year,
    lastModified: data.lastModified.toDate(),
    trades: data.trades.map((trade: any) => ({
      ...trade,
      date: trade.date.toDate()
    }))
  };
};

// Convert YearlyTrades object to Firestore data
const convertYearlyTradesToFirestoreData = (yearlyTrades: YearlyTrades) => {
  return {
    year: yearlyTrades.year,
    lastModified: Timestamp.fromDate(yearlyTrades.lastModified),
    trades: yearlyTrades.trades.map(trade => convertTradeToFirestoreData(trade))
  };
};

// Get all calendars for a user
export const getUserCalendars = async (userId: string): Promise<Calendar[]> => {
  const q = query(collection(db, CALENDARS_COLLECTION), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(convertFirestoreDataToCalendar);
};

// Create a new calendar
export const createCalendar = async (userId: string, calendar: Omit<Calendar, 'id' | 'cachedTrades' | 'loadedYears'>): Promise<string> => {
  const calendarData = {
    ...convertCalendarToFirestoreData(calendar),
    userId,
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

// Delete a calendar
export const deleteCalendar = async (calendarId: string): Promise<void> => {
  // First, get all year documents
  const yearsCollectionRef = collection(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION);
  const yearsSnapshot = await getDocs(yearsCollectionRef);

  // Delete all year documents
  const batch = writeBatch(db);
  yearsSnapshot.docs.forEach(yearDoc => {
    batch.delete(yearDoc.ref);
  });

  // Delete the calendar document
  const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
  batch.delete(calendarRef);

  // Commit the batch
  await batch.commit();
};

// Get trades for a specific year
export const getYearlyTrades = async (calendarId: string, year: number): Promise<Trade[]> => {
  const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, year.toString());
  const yearDoc = await getDoc(yearDocRef);

  if (yearDoc.exists()) {
    const yearlyTrades = convertFirestoreDataToYearlyTrades(yearDoc);
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
    const yearlyTrades = convertFirestoreDataToYearlyTrades(yearDoc);
    allTrades = [...allTrades, ...yearlyTrades.trades];
  });

  return allTrades;
};

// Add a trade to a calendar
export const addTrade = async (calendarId: string, trade: Trade, cachedTrades: Trade[] = []): Promise<CalendarStats> => {
  const year = new Date(trade.date).getFullYear();
  const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, year.toString());
  const yearDoc = await getDoc(yearDocRef);

  // Get the calendar to calculate stats
  const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
  const calendarDoc = await getDoc(calendarRef);

  if (!calendarDoc.exists()) {
    throw new Error('Calendar not found');
  }

  const calendar = convertFirestoreDataToCalendar(calendarDoc);

  // Get trades (either from cache or Firestore)
  const existingTrades = await getTrades(calendarId, cachedTrades);

  // Add the new trade to the existing trades
  const allTrades = [...existingTrades, trade];

  // Calculate stats
  const stats = calculateCalendarStats(allTrades, calendar);

  if (yearDoc.exists()) {
    // Year document exists, update it
    const yearlyTrades = convertFirestoreDataToYearlyTrades(yearDoc);
    yearlyTrades.trades.push(trade);
    yearlyTrades.lastModified = new Date();

    await updateDoc(yearDocRef, convertYearlyTradesToFirestoreData(yearlyTrades));
  } else {
    // Year document doesn't exist, create it
    const yearlyTrades: YearlyTrades = {
      year,
      lastModified: new Date(),
      trades: [trade]
    };

    await setDoc(yearDocRef, convertYearlyTradesToFirestoreData(yearlyTrades));
  }

  // Update the calendar with stats and lastModified timestamp
  await updateCalendarStats(calendarRef, stats);

  // Return the updated stats
  return stats;
};

// Update a trade in a calendar
export const updateTrade = async (calendarId: string, oldTrade: Trade, newTrade: Trade, cachedTrades: Trade[] = []): Promise<CalendarStats | undefined> => {
  const oldYear = new Date(oldTrade.date).getFullYear();
  const newYear = new Date(newTrade.date).getFullYear();

  // Get the calendar to calculate stats
  const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
  const calendarDoc = await getDoc(calendarRef);

  if (!calendarDoc.exists()) {
    throw new Error('Calendar not found');
  }

  const calendar = convertFirestoreDataToCalendar(calendarDoc);

  // If the trade is moved to a different year
  if (oldYear !== newYear) {
    // Remove from old year
    await deleteTrade(calendarId, oldTrade, cachedTrades);
    // Add to new year
    await addTrade(calendarId, newTrade, cachedTrades);
    return; // The stats will be updated by the addTrade function
  } else {
    // Same year, just update the trade
    const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, oldYear.toString());
    const yearDoc = await getDoc(yearDocRef);

    if (yearDoc.exists()) {
      const yearlyTrades = convertFirestoreDataToYearlyTrades(yearDoc);
      const tradeIndex = yearlyTrades.trades.findIndex(t => t.id === oldTrade.id);

      if (tradeIndex !== -1) {
        yearlyTrades.trades[tradeIndex] = newTrade;
        yearlyTrades.lastModified = new Date();

        // Get trades (either from cache or Firestore)
        const existingTrades = await getTrades(calendarId, cachedTrades);

        // Replace the old trade with the new trade
        const allTrades = existingTrades.map(t => t.id === oldTrade.id ? newTrade : t);

        // Calculate stats
        const stats = calculateCalendarStats(allTrades, calendar);

        await updateDoc(yearDocRef, convertYearlyTradesToFirestoreData(yearlyTrades));

        // Update the calendar with stats and lastModified timestamp
        await updateCalendarStats(calendarRef, stats);

        // Return the updated stats
        return stats;
      }
    }
  }
};

// Delete a trade from a calendar
export const deleteTrade = async (calendarId: string, trade: Trade, cachedTrades: Trade[] = []): Promise<CalendarStats | undefined> => {
  const year = new Date(trade.date).getFullYear();
  const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, year.toString());
  const yearDoc = await getDoc(yearDocRef);

  // Get the calendar to calculate stats
  const calendarRef = doc(db, CALENDARS_COLLECTION, calendarId);
  const calendarDoc = await getDoc(calendarRef);

  if (!calendarDoc.exists()) {
    throw new Error('Calendar not found');
  }

  const calendar = convertFirestoreDataToCalendar(calendarDoc);

  // Delete images from Firebase Storage if they exist
  if (trade?.images && trade.images.length > 0) {
    await Promise.all(
      trade.images.map(async (image) => {
        const imageRef = ref(storage, `users/${auth.currentUser?.uid}/trade-images/${image.id}`);
        try {
          await deleteObject(imageRef);
        } catch (error) {
          console.error('Error deleting image:', error);
        }
      })
    );
  }

  if (yearDoc.exists()) {
    const yearlyTrades = convertFirestoreDataToYearlyTrades(yearDoc);
    yearlyTrades.trades = yearlyTrades.trades.filter(t => t.id !== trade.id);
    yearlyTrades.lastModified = new Date();

    // Get trades (either from cache or Firestore)
    const existingTrades = await getTrades(calendarId, cachedTrades);

    // Filter out the deleted trade
    const allTrades = existingTrades.filter(t => t.id !== trade.id);

    // Calculate stats
    const stats = calculateCalendarStats(allTrades, calendar);

    await updateDoc(yearDocRef, convertYearlyTradesToFirestoreData(yearlyTrades));

    // Update the calendar with stats and lastModified timestamp
    await updateCalendarStats(calendarRef, stats);

    // Return the updated stats
    return stats;
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

  const calendar = convertFirestoreDataToCalendar(calendarDoc);

  if (yearDoc.exists()) {
    const yearlyTrades = convertFirestoreDataToYearlyTrades(yearDoc);

    // Filter out trades from the specified month
    const filteredTrades = yearlyTrades.trades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate.getMonth() !== month;
    });

    // Get trades to delete (for image cleanup)
    const tradesToDelete = yearlyTrades.trades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate.getMonth() === month;
    });

    // Delete images from Firebase Storage
    for (const trade of tradesToDelete) {
      if (trade?.images && trade.images.length > 0) {
        await Promise.all(
          trade.images.map(async (image) => {
            const imageRef = ref(storage, `users/${auth.currentUser?.uid}/trade-images/${image.id}`);
            try {
              await deleteObject(imageRef);
            } catch (error) {
              console.error('Error deleting image:', error);
            }
          })
        );
      }
    }

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

    await updateDoc(yearDocRef, convertYearlyTradesToFirestoreData(yearlyTrades));

    // Update the calendar with stats and lastModified timestamp
    await updateCalendarStats(calendarRef, stats);

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

  const calendar = convertFirestoreDataToCalendar(calendarDoc);

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
      year: parseInt(year),
      lastModified: new Date(),
      trades: yearTrades
    };

    const yearDocRef = doc(db, CALENDARS_COLLECTION, calendarId, YEARS_SUBCOLLECTION, year);
    await setDoc(yearDocRef, convertYearlyTradesToFirestoreData(yearlyTrades));
  }

  // Update the calendar with stats and lastModified timestamp
  await updateCalendarStats(calendarRef, stats);

  // Return the updated stats
  return stats;
};

export const deleteImage = async (imageId: string) => {
  const imageRef = ref(storage, `users/${auth.currentUser?.uid}/trade-images/${imageId}`);
  await deleteObject(imageRef);
};

export const uploadImages = async (files: Array<{ file: File; preview: string; width?: number; height?: number; caption?: string }>) => {
  const uploadedImages = [];

  for (const { file, width, height, caption } of files) {
    try {
      // Create a unique filename using timestamp and original filename
      const timestamp = new Date().getTime();
      const filename = `${timestamp}_${file.name}`;

      // Create a reference to the file location in Firebase Storage
      const storageRef = ref(storage, `users/${auth.currentUser?.uid}/trade-images/${filename}`);

      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);

      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      uploadedImages.push({
        url: downloadURL,
        id: filename,
        width,
        height,
        caption
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  return uploadedImages;
};

