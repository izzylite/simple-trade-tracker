import { Trade } from './trade';

export interface YearlyTrades {
  year: number;
  trades: Trade[];
  lastModified: Date;
}
