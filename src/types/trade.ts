import { TradeImage } from "../components/trades/TradeForm";
import { ImpactLevel, Currency } from "./economicCalendar";

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

  // Sharing fields
  shareLink?: string;
  isShared?: boolean;
  sharedAt?: Date;
  shareId?: string;
}