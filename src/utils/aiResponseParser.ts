/**
 * AI Response Parser
 * Parses AI responses to detect and extract structured trade data for card display
 */

import { Trade } from '../types/trade'; 

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
 * Parse AI response to extract trade data and clean text content
 */
export function parseAIResponse(response: string, functionCalls?: any[], allTrades?: Trade[]): ParsedAIResponse {
  let textContent = response;
  let tradeData: ParsedAIResponse['tradeData'] = undefined;
  let hasStructuredData = false;

  if(functionCalls && shouldDisplayTradeCards(functionCalls)) {
    const result = extractTradeDataFromFunctionCalls(functionCalls, 'convertTradeIdsToCards');
    const trades = result.uniqueTrades;
    if (trades.length > 0) {
      tradeData = {
        trades,
        title: result.title || 'Trade Cards',
        summary: {
          totalTrades: trades.length,
          totalPnL: trades.reduce((sum: number, t: Trade) => sum + t.amount, 0),
          winRate: calculateWinRate(trades)
        }
      };
      hasStructuredData = true;
       
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
export function shouldDisplayTradeCards(functionCalls?: any[]): boolean {
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
  
  // Remove simple JSON patterns for tradeCards
  let cleaned = response.replace(/\{"tradeCards":\s*\[[^\]]*\][^}]*\}/gi, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  return cleaned;
}

/**
 * Extract trade data from function calls
 */
export function extractTradeDataFromFunctionCalls(functionCalls: any[], name : string): {title:string,uniqueTrades:Trade[]} {
  const allTrades: Trade[] = [];
  let title = '';

  for (const call of functionCalls) {
    if (call.result?.success && call.result?.data?.trades && call.name === name) {
      title = call.result.data.title || 'Trade Cards',;
      const trades = call.result.data.trades.map((trade: any) => { 
        return trade as Trade;
      });
      allTrades.push(...trades);
      break;
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

  return {
    title,
    uniqueTrades};
}






