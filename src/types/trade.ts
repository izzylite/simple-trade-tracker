export interface Trade {
  id: string;
  date: Date;
  amount: number;
  type: 'win' | 'loss';
  journalLink?: string; 
  tags?: string[];
} 