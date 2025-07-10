import { Trade, FirestoreConvertible } from './trade';
import { ScoreSettings } from './score';
import { ImageAttribution } from '../components/heroImage';
import { EconomicCalendarFilterSettings } from '../components/economicCalendar/EconomicCalendarDrawer';
import { Timestamp, DocumentData, deleteField } from 'firebase/firestore';

export interface PinnedEvent {
  event: string;
  notes?: string;
}

export interface Calendar {
  id: string;
  name: string;
  createdAt: Date;
  lastModified: Date;
  accountBalance: number;
  maxDailyDrawdown: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
  riskPerTrade?: number;
  dynamicRiskEnabled?: boolean;
  increasedRiskPercentage?: number;
  profitThresholdPercentage?: number;
  // Duplication tracking
  duplicatedCalendar?: boolean;
  sourceCalendarId?: string;
  // Trash/deletion tracking
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  autoDeleteAt?: Date;
  // Tag validation
  requiredTagGroups?: string[];
  // All tags used in this calendar
  tags?: string[];
  // Notes
  note?: string;
  heroImageUrl?: string;
  heroImageAttribution?: ImageAttribution;

  daysNotes?: Map<string, string>;
  // Score settings
  scoreSettings?: ScoreSettings;
  // Economic calendar filter settings
  economicCalendarFilters?: EconomicCalendarFilterSettings
  // Pinned economic events (cleaned event names with optional notes)
  pinnedEvents?: PinnedEvent[];
  // Statistics
  winRate?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  targetProgress?: number;
  pnlPerformance?: number;
  totalTrades?: number;
  winCount?: number;
  lossCount?: number;
  totalPnL?: number;
  drawdownStartDate?: Date | null;
  drawdownEndDate?: Date | null;
  drawdownRecoveryNeeded?: number;
  drawdownDuration?: number;
  avgWin?: number;
  avgLoss?: number;
  currentBalance?: number;
  // Weekly, monthly, and yearly statistics
  weeklyPnL?: number;
  monthlyPnL?: number;
  yearlyPnL?: number;
  weeklyPnLPercentage?: number;
  monthlyPnLPercentage?: number;
  yearlyPnLPercentage?: number;
  weeklyProgress?: number;
  monthlyProgress?: number;
  // Cached trades for the current view
  cachedTrades: Trade[];
  // Track which years have been loaded
  loadedYears: number[];

  // Sharing fields
  shareLink?: string;
  isShared?: boolean;
  sharedAt?: Date;
  shareId?: string;
}

// Migration function to handle transition from string[] to PinnedEvent[]
const migratePinnedEvents = (pinnedEvents: any[]): PinnedEvent[] => {
  if (!Array.isArray(pinnedEvents)) return [];

  return pinnedEvents.map(event => {
    // If it's already in the new format (object with event property)
    if (typeof event === 'object' && event.event) {
      return event as PinnedEvent;
    }
    // If it's in the old format (string)
    if (typeof event === 'string') {
      return { event };
    }
    // Fallback for unexpected formats
    return { event: String(event) };
  });
};

// Calendar Converter implementing FirestoreConvertible interface
export class CalendarConverter implements FirestoreConvertible<Calendar> {
  fromJson(doc: DocumentData): Calendar {
    const data = doc.data();

    // Convert daysNotes from Firestore object to Map
    let daysNotesMap: Map<string, string> | undefined;
    if (data.daysNotes) {
      daysNotesMap = new Map(Object.entries(data.daysNotes));
    }

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
      requiredTagGroups: data.requiredTagGroups || [],
      dynamicRiskEnabled: data.dynamicRiskEnabled,
      increasedRiskPercentage: data.increasedRiskPercentage,
      profitThresholdPercentage: data.profitThresholdPercentage,
      // Duplication tracking
      duplicatedCalendar: data.duplicatedCalendar,
      sourceCalendarId: data.sourceCalendarId,
      // Trash/deletion tracking
      isDeleted: data.isDeleted,
      deletedAt: data.deletedAt ? data.deletedAt.toDate() : undefined,
      deletedBy: data.deletedBy,
      autoDeleteAt: data.autoDeleteAt ? data.autoDeleteAt.toDate() : undefined,
      // Tags
      tags: data.tags || [],
      // Notes
      note: data.note,
      heroImageUrl: data.heroImageUrl,
      heroImageAttribution: data.heroImageAttribution,
      daysNotes: daysNotesMap,
      // Score settings
      scoreSettings: data.scoreSettings,
      // Economic calendar filter settings
      economicCalendarFilters: data.economicCalendarFilters,
      // Pinned economic events (handle migration from string[] to PinnedEvent[])
      pinnedEvents: migratePinnedEvents(data.pinnedEvents || []),
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
      // Sharing fields
      shareLink: data.shareLink,
      isShared: data.isShared || false,
      sharedAt: data.sharedAt ? data.sharedAt.toDate() : undefined,
      shareId: data.shareId,
      // Cached data
      loadedYears: [],
      cachedTrades: []
    };
  }

  toJson(calendar: Omit<Calendar, 'id' | 'cachedTrades' | 'loadedYears'> & { _deleteHeroImage?: boolean }): any {
    // Create the base object with required fields
    const baseData = {
      name: calendar.name,
      createdAt: Timestamp.fromDate(calendar.createdAt),
      lastModified: Timestamp.fromDate(calendar.lastModified),
      accountBalance: calendar.accountBalance,
      maxDailyDrawdown: calendar.maxDailyDrawdown,
      requiredTagGroups: calendar.requiredTagGroups ? calendar.requiredTagGroups : []
    };

    // Convert daysNotes Map to a plain object for Firestore
    let daysNotesObj: Record<string, string> | undefined;
    if (calendar.daysNotes && calendar.daysNotes.size > 0) {
      daysNotesObj = Object.fromEntries(calendar.daysNotes);
    }

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

      // Duplication tracking
      ...(calendar.duplicatedCalendar !== undefined && { duplicatedCalendar: calendar.duplicatedCalendar }),
      ...(calendar.sourceCalendarId !== undefined && { sourceCalendarId: calendar.sourceCalendarId }),

      // Trash/deletion tracking
      ...(calendar.isDeleted !== undefined && { isDeleted: calendar.isDeleted }),
      ...(calendar.deletedAt !== undefined && {
        deletedAt: calendar.deletedAt ? Timestamp.fromDate(calendar.deletedAt) : null
      }),
      ...(calendar.deletedBy !== undefined && { deletedBy: calendar.deletedBy }),
      ...(calendar.autoDeleteAt !== undefined && {
        autoDeleteAt: calendar.autoDeleteAt ? Timestamp.fromDate(calendar.autoDeleteAt) : null
      }),

      // Tags
      ...(calendar.tags !== undefined && { tags: calendar.tags }),

      // Notes fields
      ...(calendar.note !== undefined && { note: calendar.note }),
      ...(calendar.heroImageUrl !== undefined && { heroImageUrl: calendar.heroImageUrl }),
      ...(calendar.heroImageAttribution !== undefined && { heroImageAttribution: calendar.heroImageAttribution }),
      ...(daysNotesObj && { daysNotes: daysNotesObj }),

      // Handle hero image deletion
      ...(calendar._deleteHeroImage && {
        heroImageUrl: deleteField(),
        heroImageAttribution: deleteField()
      }),

      // Score settings
      ...(calendar.scoreSettings !== undefined && { scoreSettings: calendar.scoreSettings }),

      // Economic calendar filter settings
      ...(calendar.economicCalendarFilters !== undefined && { economicCalendarFilters: calendar.economicCalendarFilters }),

      // Pinned economic events
      ...(calendar.pinnedEvents !== undefined && { pinnedEvents: calendar.pinnedEvents }),

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

      // Sharing fields
      ...(calendar.shareLink !== undefined && { shareLink: calendar.shareLink }),
      ...(calendar.isShared !== undefined && { isShared: calendar.isShared }),
      ...(calendar.sharedAt !== undefined && { sharedAt: calendar.sharedAt ? Timestamp.fromDate(calendar.sharedAt) : null }),
      ...(calendar.shareId !== undefined && { shareId: calendar.shareId }),
    };

    return {
      ...baseData,
      ...optionalFields
    };
  }
}

// Create a singleton instance for easy access
export const calendarConverter = new CalendarConverter();



