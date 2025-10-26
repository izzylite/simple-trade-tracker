import { TradeImage } from "../components/trades/TradeForm";
import { ImpactLevel, Currency } from "./economicCalendar";
import { Timestamp, DocumentData } from 'firebase/firestore';

// Generic interface for Firestore conversion
export interface FirestoreConvertible<T> {
  fromJson(doc: DocumentData, additionalData?: any): T;
  toJson(item: T, additionalData?: any): any;
}

/**
 * Simplified economic event data stored with trades
 * Contains only essential information needed for correlation analysis
 */
export interface TradeEconomicEvent {
  /** Event name (e.g., "Non-Farm Payrolls", "FOMC Meeting") */
  name: string;
  /** Country flag code for display (e.g., "us", "eu") */
  flagCode?: string;
  /** Event impact level */
  impact: ImpactLevel;
  /** Currency associated with the event */
  currency: Currency;
  /** Event time in UTC ISO string */
  timeUtc: string;
}

export interface Trade {
  id: string;
  date: Date;
  amount: number;
  isDeleted?: boolean;
  type: 'win' | 'loss' | 'breakeven';
  name?: string;
  entry?: string;
  exit?: string;

  tags?: string[];
  riskToReward?: number;
  partialsTaken?: boolean;
  session?: 'Asia' | 'London' | 'NY AM' | 'NY PM';
  notes?: string;
  isTemporary?: boolean;
  images?: Array<TradeImage>;
  isPinned?: boolean;

  // Economic events that occurred during this trade's session
  economicEvents?: TradeEconomicEvent[];

  // Update timestamp
  updatedAt?: Date;

  // Sharing fields
  shareLink?: string;
  isShared?: boolean;
  sharedAt?: Date;
  shareId?: string;
}

// Trade Converter implementing FirestoreConvertible interface
export class TradeConverter implements FirestoreConvertible<Trade> {
  fromJson(data: any): Trade {
    return {
      id: data.id,
      date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
      amount: data.amount,
      type: data.type,
      isDeleted: data.isDeleted,
      name: data.name,
      entry: data.entry,
      exit: data.exit,
      tags: data.tags,
      riskToReward: data.riskToReward,
      partialsTaken: data.partialsTaken,
      session: data.session,
      notes: data.notes,
      isTemporary: data.isTemporary,
      images: data.images,
      isPinned: data.isPinned || false,
      // Economic events
      economicEvents: data.economicEvents,
      // Update timestamp
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt ? new Date(data.updatedAt) : undefined,
      // Sharing fields
      shareLink: data.shareLink,
      isShared: data.isShared || false,
      sharedAt: data.sharedAt?.toDate ? data.sharedAt.toDate() : data.sharedAt,
      shareId: data.shareId
    };
  }

  toJson(trade: Trade, calendarId: string): any {
    // Create base object with required fields
    const baseData = {
      id: trade.id,
      date: Timestamp.fromDate(new Date(trade.date)),
      amount: trade.amount,
      type: trade.type,
      calendarId: calendarId
    };

    // Process images to ensure no undefined values
    let processedImages;
    if (trade.images) {
      processedImages = trade.images.map(img => ({
        id: img.id,
        url: img.url,
        caption: img.caption || '',
        width: img.width || 0,
        height: img.height || 0,
        row: img.row !== undefined ? img.row : 0,
        column: img.column !== undefined ? img.column : 0,
        columnWidth: img.columnWidth !== undefined ? img.columnWidth : 50,
        pending: img.pending || false
      }));
    }

    // Add optional fields only if they are defined
    const optionalFields = {
      ...(trade.name !== undefined && { name: trade.name }),
      ...(trade.entry !== undefined && { entry: trade.entry }),
      ...(trade.exit !== undefined && { exit: trade.exit }),
      ...(trade.tags !== undefined && { tags: trade.tags }),
      ...(trade.riskToReward !== undefined && { riskToReward: trade.riskToReward }),
      ...(trade.partialsTaken !== undefined && { partialsTaken: trade.partialsTaken }),
      ...(trade.session !== undefined && { session: trade.session }),
      ...(trade.notes !== undefined && { notes: trade.notes }),
      ...(trade.isTemporary !== undefined && { isTemporary: trade.isTemporary }),
      ...(trade.isPinned !== undefined && { isPinned: trade.isPinned }),
      ...(processedImages && { images: processedImages }),
      // Economic events
      ...(trade.economicEvents !== undefined && { economicEvents: trade.economicEvents }),
      // Update timestamp
      ...(trade.updatedAt !== undefined && { updatedAt: Timestamp.fromDate(trade.updatedAt) }),
      // Sharing fields
      ...(trade.shareLink !== undefined && { shareLink: trade.shareLink }),
      ...(trade.isShared !== undefined && { isShared: trade.isShared }),
      ...(trade.sharedAt !== undefined && { sharedAt: Timestamp.fromDate(trade.sharedAt) }),
      ...(trade.shareId !== undefined && { shareId: trade.shareId })
    };

    return {
      ...baseData,
      ...optionalFields
    };
  }
}

// Create a singleton instance for easy access
export const tradeConverter = new TradeConverter();

