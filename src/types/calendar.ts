import { Trade } from './trade';

export interface Calendar {
  id: string;
  name: string;
  createdAt: Date;
  lastModified: Date;
  trades: Trade[];
  accountBalance: number;
  maxDailyDrawdown: number;
  weeklyTarget?: number;
  monthlyTarget?: number;
  yearlyTarget?: number;
} 