import { TradeImage } from "../components/trades/TradeForm";

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

  // Sharing fields
  shareLink?: string;
  isShared?: boolean;
  sharedAt?: Date;
  shareId?: string;
}