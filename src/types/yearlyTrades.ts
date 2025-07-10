import { Trade, FirestoreConvertible, tradeConverter } from './trade';
import { Timestamp, DocumentData } from 'firebase/firestore';

export interface YearlyTrades {
  year: number;
  trades: Trade[];
  lastModified: Date;
}

// YearlyTrades Converter implementing FirestoreConvertible interface
export class YearlyTradesConverter implements FirestoreConvertible<YearlyTrades> {
  fromJson(doc: DocumentData): YearlyTrades {
    const data = doc.data();
    return {
      year: data.year,
      lastModified: data.lastModified.toDate(),
      trades: data.trades.map((trade: any) => tradeConverter.fromJson(trade))
    };
  }

  toJson(yearlyTrades: YearlyTrades, calendarId: string): any {
    return {
      year: yearlyTrades.year,
      lastModified: Timestamp.fromDate(yearlyTrades.lastModified),
      trades: yearlyTrades.trades.map(trade => tradeConverter.toJson(trade, calendarId))
    };
  }
}

// Create a singleton instance for easy access
export const yearlyTradesConverter = new YearlyTradesConverter();


