// @ts-nocheck
/**
 * NOTE: This file contains legacy Firebase Firestore converters.
 * Not used in production - kept for reference only.
 * Supabase uses direct JSON serialization.
 */

import { Trade } from './dualWrite';
// import { Timestamp, DocumentData } from 'firebase/firestore'; // Removed - migrated to Supabase

export interface YearlyTrades {
  year: number;
  userId: string;
  trades: Trade[];
  lastModified: Date;
}

interface FirestoreConvertible<T> {
  fromJson(data: any): T;
  toJson(data: T, ...args: any[]): any;
}

const Timestamp: any = null; // Placeholder
const DocumentData: any = null; // Placeholder

const tradeConverter: FirestoreConvertible<Trade> = {
  fromJson(data: any): Trade {
    return {
      ...data,
      trade_date: data.trade_date.toDate(),
      created_at: data.created_at.toDate(),
      updated_at: data.updated_at.toDate(),
      shared_at: data.shared_at ? data.shared_at.toDate() : null,
    } as Trade;
  },
  toJson(trade: Trade, calendarId: string): any {
    return {
      ...trade,
      calendar_id: calendarId,
      trade_date: Timestamp.fromDate(new Date(trade.trade_date)),
      created_at: Timestamp.fromDate(new Date(trade.created_at)),
      updated_at: Timestamp.fromDate(new Date(trade.updated_at)),
      shared_at: trade.shared_at ? Timestamp.fromDate(new Date(trade.shared_at)) : null,
    };
  },
};

// YearlyTrades Converter implementing FirestoreConvertible interface
export class YearlyTradesConverter implements FirestoreConvertible<YearlyTrades> {
  fromJson(doc: any): YearlyTrades {
    const data = doc.data();
    return {
      year: data.year,
      userId: data.user_id,
      lastModified: data.updated_at.toDate(),
      trades: data.trades.map((trade: any) => tradeConverter.fromJson(trade))
    };
  }

  toJson(yearlyTrades: YearlyTrades, calendarId: string): any {
    return {
      year: yearlyTrades.year,
      userId: yearlyTrades.userId,
      lastModified: Timestamp.fromDate(yearlyTrades.lastModified),
      trades: yearlyTrades.trades.map(trade => tradeConverter.toJson(trade, calendarId))
    };
  }
}

// Create a singleton instance for easy access
export const yearlyTradesConverter = new YearlyTradesConverter();