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
export function parseAIResponse(response: string, functionCalls?: any[]): ParsedAIResponse {
  let textContent = response;
  let tradeData: ParsedAIResponse['tradeData'] = undefined;
  let hasStructuredData = false;

  // Check if function calls contain trade data
  if (functionCalls && functionCalls.length > 0) {
    for (const call of functionCalls) {
      if (call.result?.success && call.result?.data) {
        const data = call.result.data;
        
        // Handle findSimilarTrades differently - look for JSON trade IDs in response
        if (call.name === 'findSimilarTrades' && data.trades && Array.isArray(data.trades)) {
          const displayTradeIds = extractDisplayTradeIds(response);
          if (displayTradeIds.length > 0) {
            // Filter trades to only include those specified by the AI
            const allTrades = data.trades.map((trade: any) => {
              if (trade.date && typeof trade.date === 'number') {
                return trimmedTradeToTrade(trade as TrimmedTrade);
              }
              return trade as Trade;
            });

            const displayTrades = allTrades.filter((trade: Trade) => displayTradeIds.includes(trade.id));

            if (displayTrades.length > 0) {
              tradeData = {
                trades: displayTrades,
                title: 'Analyzed Trades',
                summary: {
                  totalTrades: displayTrades.length,
                  totalPnL: displayTrades.reduce((sum: number, t: Trade) => sum + t.amount, 0),
                  winRate: calculateWinRate(displayTrades)
                }
              };
              hasStructuredData = true;

              // Clean the JSON from the text content
              textContent = cleanJsonFromResponse(response);
              break;
            }
          }
          // If no JSON found, don't display any cards for findSimilarTrades
          continue;
        }

        // Check for trade search results (other functions)
        if (data.trades && Array.isArray(data.trades) && data.trades.length > 0) {
          const trades = data.trades.map((trade: any) => {
            // Handle both full Trade objects and TrimmedTrade objects
            if (trade.date && typeof trade.date === 'number') {
              return trimmedTradeToTrade(trade as TrimmedTrade);
            }
            return trade as Trade;
          });

          tradeData = {
            trades,
            title: getTitleFromFunctionCall(call),
            summary: {
              totalTrades: data.count || trades.length,
              totalPnL: data.totalPnl || trades.reduce((sum: number, t: Trade) => sum + t.amount, 0),
              winRate: data.winRate || calculateWinRate(trades)
            }
          };
          hasStructuredData = true;
          break;
        }

        // Check for statistics with best/worst trades
        if (data.bestTrade || data.worstTrade) {
          const trades: Trade[] = [];
          if (data.bestTrade) {
            trades.push(data.bestTrade);
          }
          if (data.worstTrade && data.worstTrade.id !== data.bestTrade?.id) {
            trades.push(data.worstTrade);
          }

          if (trades.length > 0) {
            tradeData = {
              trades,
              title: 'Notable Trades',
              summary: {
                totalTrades: data.totalTrades || trades.length,
                totalPnL: data.totalPnl || trades.reduce((sum, t) => sum + t.amount, 0),
                winRate: data.winRate || calculateWinRate(trades)
              }
            };
            hasStructuredData = true;
            break;
          }
        }
      }
    }
  }

  // Clean up text content if we have structured data (light cleaning only since AI should be aware)
  if (hasStructuredData && tradeData) {
    textContent = lightCleanTextContent(response, tradeData);
  }

  return {
    textContent,
    tradeData,
    hasStructuredData
  };
}

/**
 * Get appropriate title from function call
 */
function getTitleFromFunctionCall(call: any): string {
  const functionName = call.name;
  const args = call.args || {};

  switch (functionName) {
    case 'searchTrades':
      if (args.tradeType && args.tradeType !== 'all') {
        return `${args.tradeType.charAt(0).toUpperCase() + args.tradeType.slice(1)} Trades`;
      }
      if (args.session) {
        return `${args.session} Session Trades`;
      }
      if (args.tags && args.tags.length > 0) {
        return `Trades with ${args.tags.join(', ')} tags`;
      }
      if (args.dateRange) {
        return `Trades from ${args.dateRange}`;
      }
      return 'Search Results';

    case 'findSimilarTrades':
      return 'Similar Trades';

    case 'getTradeStatistics':
      return 'Trade Analysis';

    default:
      return 'Trades';
  }
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
 * Light cleaning of text content - minimal since AI should be aware of trade cards
 */
function lightCleanTextContent(response: string, tradeData: NonNullable<ParsedAIResponse['tradeData']>): string {
  let cleaned = response;

  // Only remove obvious redundant patterns that might slip through
  const patternsToRemove = [
    // Remove explicit trade ID listings
    /Trade ID: [a-zA-Z0-9-]+/gi,
    // Remove "Here are the trades:" type introductions
    /Here are the.*?trades?:?\s*\n/gi,
    // Remove "Found X trades:" type statements
    /Found \d+ trades?:?\s*\n/gi,
  ];

  patternsToRemove.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Clean up extra whitespace
  cleaned = cleaned
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove triple+ line breaks
    .replace(/^\s+|\s+$/g, '') // Trim
    .trim();

  // If the response is empty or too short, provide a minimal summary
  if (cleaned.length < 20) {
    const { trades, summary } = tradeData;
    const tradeCount = trades.length;
    const totalPnL = summary?.totalPnL || trades.reduce((sum, t) => sum + t.amount, 0);
    const winRate = summary?.winRate || (trades.filter(t => t.type === 'win').length / trades.length) * 100;

    cleaned = `Found ${tradeCount} trade${tradeCount !== 1 ? 's' : ''} with ` +
              `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)} total P&L ` +
              `and ${winRate.toFixed(1)}% win rate.`;
  }

  return cleaned;
}

/**
 * Check if response likely contains trade data that should be displayed as cards
 */
export function shouldDisplayTradeCards(response: string, functionCalls?: any[]): boolean {
  // Check function calls first
  if (functionCalls && functionCalls.length > 0) {
    return functionCalls.some(call => 
      call.result?.success && 
      call.result?.data?.trades && 
      Array.isArray(call.result.data.trades) && 
      call.result.data.trades.length > 0
    );
  }

  // Fallback: check response text for trade-like patterns
  const tradePatterns = [
    /\$[\d,]+\.?\d*.*?(win|loss|breakeven)/gi,
    /trade.*?\$[\d,]+\.?\d*/gi,
    /(win|loss).*?\$[\d,]+\.?\d*/gi
  ];

  return tradePatterns.some(pattern => pattern.test(response));
}

/**
 * Extract trade IDs from JSON format in AI response
 */
function extractDisplayTradeIds(response: string): string[] {
  try {
    // Look for JSON pattern in the response
    const jsonPattern = /```json\s*\n?\s*(\{[^}]*"displayTrades"[^}]*\})\s*\n?\s*```/i;
    const match = response.match(jsonPattern);

    if (match && match[1]) {
      const jsonData = JSON.parse(match[1]);
      if (jsonData.displayTrades && Array.isArray(jsonData.displayTrades)) {
        return jsonData.displayTrades.filter((id: any) => typeof id === 'string');
      }
    }

    // Fallback: look for simpler JSON pattern without code blocks
    const simpleJsonPattern = /\{"displayTrades":\s*\[[^\]]*\]\}/i;
    const simpleMatch = response.match(simpleJsonPattern);

    if (simpleMatch) {
      const jsonData = JSON.parse(simpleMatch[0]);
      if (jsonData.displayTrades && Array.isArray(jsonData.displayTrades)) {
        return jsonData.displayTrades.filter((id: any) => typeof id === 'string');
      }
    }
  } catch (error) {
    // JSON parsing failed, return empty array
  }

  return [];
}

/**
 * Remove JSON trade IDs from response text
 */
function cleanJsonFromResponse(response: string): string {
  // Remove JSON code blocks
  let cleaned = response.replace(/```json\s*\n?\s*\{[^}]*"displayTrades"[^}]*\}\s*\n?\s*```/gi, '');

  // Remove simple JSON patterns
  cleaned = cleaned.replace(/\{"displayTrades":\s*\[[^\]]*\]\}/gi, '');

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
