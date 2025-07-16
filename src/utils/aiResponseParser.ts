/**
 * AI Response Parser
 * Parses AI responses to detect and extract structured trade data for card display
 */

import { Trade } from '../types/trade';
import { TrimmedTrade } from '../types/aiChat';

export interface ParsedAIResponse {
  textContent: string;
  tradeData?: {
    trades: Trade[];
    title?: string;
    summary?: {
      totalTrades: number;
      totalPnL: number;
      winRate: number;
    };
  };
  hasStructuredData: boolean;
}

export interface AIResponseWithTrades {
  response: string;
  trades?: Trade[];
  tradesSummary?: {
    title: string;
    totalTrades: number;
    totalPnL: number;
    winRate: number;
  };
}

/**
 * Convert TrimmedTrade to full Trade object for display
 */
export function trimmedTradeToTrade(trimmedTrade: TrimmedTrade): Trade {
  return {
    id: trimmedTrade.id,
    name: trimmedTrade.name,
    date: new Date(trimmedTrade.date),
    session: trimmedTrade.session as 'Asia' | 'London' | 'NY AM' | 'NY PM' | undefined,
    type: trimmedTrade.type,
    amount: trimmedTrade.amount,
    tags: trimmedTrade.tags,
    notes: trimmedTrade.notes,
    entry: trimmedTrade.entry,
    exit: trimmedTrade.exit,
    riskToReward: trimmedTrade.riskToReward,
    partialsTaken: trimmedTrade.partialsTaken,
    updatedAt: trimmedTrade.updatedAt ? new Date(trimmedTrade.updatedAt) : undefined,
    economicEvents: trimmedTrade.economicEvents?.map(event => ({
      name: event.name,
      impact: event.impact as any,
      currency: event.currency as any,
      timeUtc: event.time,
      flagCode: undefined
    }))
  };
}

/**
 * Parse AI response to extract trade data and clean text content
 */
export function parseAIResponse(response: string, functionCalls?: any[], allTrades?: Trade[]): ParsedAIResponse {
  let textContent = response;
  let tradeData: ParsedAIResponse['tradeData'] = undefined;
  let hasStructuredData = false;



  // Check if function calls contain convertTradeIdsToCards
  if (functionCalls && functionCalls.length > 0) {
    for (const call of functionCalls) {
      if (call.result?.success && call.result?.data) {
        const data = call.result.data;

        // Handle convertTradeIdsToCards function - the only way to display trade cards
        if (call.name === 'convertTradeIdsToCards' && data.tradeCards && Array.isArray(data.tradeCards)) {
          if (allTrades && allTrades.length > 0) {
            // Find trades by ID from the allTrades array
            const trades = data.tradeCards
              .map((tradeId: string) => allTrades.find((trade: Trade) => trade.id === tradeId))
              .filter((trade: Trade | undefined): trade is Trade => trade !== undefined);

            if (trades.length > 0) {
              tradeData = {
                trades,
                title: data.title || 'Trade Cards',
                summary: {
                  totalTrades: trades.length,
                  totalPnL: trades.reduce((sum: number, t: Trade) => sum + t.amount, 0),
                  winRate: calculateWinRate(trades)
                }
              };
              hasStructuredData = true;
              break;
            }
          }
        }
      }
    }
  }

  // Clean up text content if we have structured data
  if (hasStructuredData && tradeData) {
    textContent = cleanJsonFromResponse(response);
  }

  return {
    textContent,
    tradeData,
    hasStructuredData
  };
}



/**
 * Calculate win rate from trades
 */
function calculateWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const winTrades = trades.filter(trade => trade.type === 'win');
  return (winTrades.length / trades.length) * 100;
}

 

/**
 * Check if response likely contains trade data that should be displayed as cards
 */
export function shouldDisplayTradeCards(_response: string, functionCalls?: any[]): boolean {
  // Only check for convertTradeIdsToCards function calls
  if (functionCalls && functionCalls.length > 0) {
    return functionCalls.some(call =>
      call.name === 'convertTradeIdsToCards' &&
      call.result?.success &&
      call.result?.data?.tradeCards &&
      Array.isArray(call.result.data.tradeCards) &&
      call.result.data.tradeCards.length > 0
    );
  }

  return false;
}



/**
 * Remove JSON trade IDs from response text
 */
function cleanJsonFromResponse(response: string): string {
  // Remove JSON code blocks for tradeCards
  let cleaned = response.replace(/```json\s*\n?\s*\{[^}]*"tradeCards"[^}]*\}\s*\n?\s*```/gi, '');

  // Remove simple JSON patterns for tradeCards
  cleaned = cleaned.replace(/\{"tradeCards":\s*\[[^\]]*\][^}]*\}/gi, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  return cleaned;
}

/**
 * Extract trade data from function calls
 */
export function extractTradeDataFromFunctionCalls(functionCalls: any[]): Trade[] {
  const allTrades: Trade[] = [];

  for (const call of functionCalls) {
    if (call.result?.success && call.result?.data?.trades) {
      const trades = call.result.data.trades.map((trade: any) => {
        if (trade.date && typeof trade.date === 'number') {
          return trimmedTradeToTrade(trade as TrimmedTrade);
        }
        return trade as Trade;
      });
      allTrades.push(...trades);
    }

    // Also check for best/worst trades in statistics
    if (call.result?.success && call.result?.data) {
      const data = call.result.data;
      if (data.bestTrade) allTrades.push(data.bestTrade);
      if (data.worstTrade && data.worstTrade.id !== data.bestTrade?.id) {
        allTrades.push(data.worstTrade);
      }
    }
  }

  // Remove duplicates based on trade ID
  const uniqueTrades = allTrades.filter((trade, index, self) => 
    index === self.findIndex(t => t.id === trade.id)
  );

  return uniqueTrades;
}






