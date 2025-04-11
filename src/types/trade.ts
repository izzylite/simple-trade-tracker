export interface Trade {
  id: string;
  date: Date;
  amount: number;
  type: 'win' | 'loss';
  journalLink?: string;
  tags?: string[];
  riskToReward?: number;
  partialsTaken?: boolean;
  session?: 'Asia' | 'London' | 'NY AM' | 'NY PM';
  notes?: string;
  images?: Array<{
    url: string;
    id: string;
    caption?: string;
    width?: number;
    height?: number;
  }>;
}