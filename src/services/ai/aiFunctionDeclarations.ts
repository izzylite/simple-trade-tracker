/**
 * AI Function Declarations
 * Contains all function declarations for the AI model's function calling capabilities
 */

import { FunctionDeclaration, SchemaType } from 'firebase/ai';
import { Currency } from '../../types/economicCalendar';

/**
 * Get function declarations for the AI model
 */
export function getFunctionDeclarations(currencies : Currency[]): FunctionDeclaration[] {
  return [
    {
      name: 'searchTrades',
      description: 'Search and filter trades based on specific criteria such as date ranges, trade outcomes, profit/loss amounts, tags, trading sessions, days of the week, or economic events. Can filter by economic event presence, impact level, currency, or event names. Returns matching trades with summary statistics including total P&L and win rate.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          returnCacheKey: {
            type: SchemaType.BOOLEAN,
            description: 'Set to true if you plan to call additional functions with this result (like extractTradeIds, getTradeStatistics). When true, large results return a cache key instead of full data to enable efficient multi-function workflows. Set to false if this is the final function call and you need the complete data immediately.'
          },
          dateRange: {
            type: SchemaType.STRING,
            description: 'Date range filter. Supports formats like "last 30 days", "last 6 months", "last 1 week", or specific months like "2024-01" for January 2024. Use "last X days/weeks/months" for relative periods.'
          },
          tradeType: {
            type: SchemaType.STRING,
            enum: ['win', 'loss', 'breakeven', 'all'],
            description: 'Filter trades by their outcome: "win" for profitable trades, "loss" for losing trades, "breakeven" for neutral trades, or "all" for no filtering by outcome.'
          },
          minAmount: {
            type: SchemaType.NUMBER,
            description: 'Minimum profit/loss amount in absolute value. For example, 100 will include trades with P&L >= $100 or <= -$100.'
          },
          maxAmount: {
            type: SchemaType.NUMBER,
            description: 'Maximum profit/loss amount in absolute value. For example, 500 will include trades with P&L between -$500 and $500.'
          },
          tags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'Array of tag names to filter by. Trades must contain at least one of the specified tags. Use exact tag names as they appear in the trading system.'
          },
          session: {
            type: SchemaType.STRING,
            enum: ['london', 'new-york', 'tokyo', 'sydney'],
            description: 'Trading session to filter by: "london" for London session, "new-york" for New York session, "tokyo" for Tokyo/Asian session, "sydney" for Sydney session.'
          },
          dayOfWeek: {
            type: SchemaType.STRING,
            description: 'Day of the week to filter by. Use full day names like "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" (case insensitive).'
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'Maximum number of trades to return. Defaults to all matching trades if not specified. Use reasonable limits (e.g., 50-300) for large datasets.'
          },
          hasEconomicEvents: {
            type: SchemaType.BOOLEAN,
            description: 'Filter trades by presence of economic events. True = only trades with economic events, False = only trades without economic events.'
          },
          economicEventImpact: {
            type: SchemaType.STRING,
            description: 'Filter trades by economic event impact level. Options: "High", "Medium", "Low", "all". Only includes trades that have events with the specified impact level.'
          },
          economicEventCurrency: {
            type: SchemaType.STRING,
            description: 'Filter trades by economic event currency. Options: "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "all". Only includes trades that have events for the specified currency.'
          },
          economicEventName: {
            type: SchemaType.STRING,
            description: 'Filter trades by economic event name (partial match). Examples: "NFP", "FOMC", "GDP", "CPI". Only includes trades that have events containing this text in the event name.'
          }
        }
      }
    },
    {
      name: 'getTradeStatistics',
      description: 'Calculate comprehensive statistical analysis and performance metrics for trades including total P&L, win rate, average trade size, best/worst trades, grouped performance data, and economic events correlation analysis. Can analyze how economic events impact trading performance by event impact level, currency, and frequency. Can also analyze statistics for specific trade IDs.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          returnCacheKey: {
            type: SchemaType.BOOLEAN,
            description: 'Set to true if you plan to call additional functions with this result. When true, large results return a cache key instead of full data to enable efficient multi-function workflows. Set to false if this is the final function call and you need the complete data immediately.'
          },
          period: {
            type: SchemaType.STRING,
            description: 'Time period for analysis. Can be relative periods like "last 30 days", "last 3 months", or specific periods like "2024-01" for January 2024.'
          },
          groupBy: {
            type: SchemaType.STRING,
            enum: ['day', 'week', 'month', 'session', 'tag', 'dayOfWeek', 'economicEvent'],
            description: 'How to group the statistical analysis: "day" for daily breakdown, "week" for weekly, "month" for monthly, "session" for trading session analysis, "tag" for tag-based grouping, "dayOfWeek" for day-of-week patterns, "economicEvent" for economic event correlation analysis.'
          },
          tradeType: {
            type: SchemaType.STRING,
            enum: ['win', 'loss', 'breakeven', 'all'],
            description: 'Filter statistics by trade outcome: "win" for winning trades only, "loss" for losing trades only, "breakeven" for neutral trades, "all" for comprehensive statistics.'
          },
          tradeIds: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.STRING
            },
            description: 'Array of specific trade IDs to analyze. When provided, statistics will be calculated only for these trades. Useful for analyzing performance of a specific subset of trades returned from other functions like searchTrades or findSimilarTrades.'
          },
          includeEconomicEventStats: {
            type: SchemaType.BOOLEAN,
            description: 'Include detailed economic events statistics in the analysis. Provides breakdown by event impact, currency, most common events, and win rates with/without events.'
          },
          economicEventImpact: {
            type: SchemaType.STRING,
            enum: ['High', 'Medium', 'Low', 'all'],
            description: 'Filter economic events analysis by impact level. Only relevant when includeEconomicEventStats is true.'
          }
        }
      }
    },
    {
      name: 'findSimilarTrades',
      description: `Find trades similar to a natural language query using semantic vector search. Searches through trade notes, descriptions, and metadata to find conceptually similar trades based on trading patterns, market conditions, strategies, or outcomes described in natural language. For finding similar trades or contextual analysis: Use findSimilarTrades (analyze results to answer user's question)`,
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          returnCacheKey: {
            type: SchemaType.BOOLEAN,
            description: 'Set to true if you plan to call additional functions with this result (like extractTradeIds, getTradeStatistics). When true, large results return a cache key instead of full data to enable efficient multi-function workflows. Set to false if this is the final function call and you need the complete data immediately.'
          },
          query: {
            type: SchemaType.STRING,
            description: 'Natural language description of what trades to find. Examples: "trades during high volatility", "breakout trades that failed", "trades with good risk management", "similar market conditions to today", "trades with specific patterns or setups".'
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'Maximum number of similar trades to return. Recommended range is 5-20 for focused analysis, up to 50 for comprehensive review.'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'analyzeEconomicEvents',
      description: 'Analyze the correlation between economic events and trading performance. Provides detailed statistics comparing trades with and without economic events, breakdown by impact level and currency, and identifies the most common events affecting trades.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          returnCacheKey: {
            type: SchemaType.BOOLEAN,
            description: 'Set to true if you plan to call additional functions with this result. When true, large results return a cache key instead of full data to enable efficient multi-function workflows. Set to false if this is the final function call and you need the complete data immediately.'
          },
          impactLevel: {
            type: SchemaType.STRING,
            enum: ['High', 'Medium', 'Low', 'all'],
            description: 'Filter analysis by economic event impact level. "High" for major market-moving events, "Medium" for moderate impact, "Low" for minor events, "all" for comprehensive analysis.'
          },
          currency: {
            type: SchemaType.STRING,
            enum: [...currencies, 'all'],
            description: 'Filter analysis by currency of economic events. Focus on specific currency events or use "all" for comprehensive analysis.'
          },
          eventName: {
            type: SchemaType.STRING,
            description: 'Filter by specific economic event name (partial match). Examples: "NFP", "FOMC", "GDP", "CPI", "Interest Rate Decision".'
          },
          dateRange: {
            type: SchemaType.STRING,
            description: 'Time period for analysis. Supports formats like "last 30 days", "last 6 months", or specific months like "2024-01".'
          },
          compareWithoutEvents: {
            type: SchemaType.BOOLEAN,
            description: 'Include comparison with trades that had no economic events during their session. Useful for understanding the impact of news vs. quiet market conditions.'
          }
        }
      }
    },
    {
      name: 'fetchEconomicEvents',
      description: 'Fetch upcoming or historical economic events from Firebase database. Only fetches High and Medium impact events to reduce costs and focus on market-relevant events. Can filter by date range, currency, and impact level. Uses pagination to limit Firebase reads for cost efficiency (default limit: 50, max: 100). Useful for answering questions about upcoming high-impact events, specific currency events, or events in a particular time period.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          returnCacheKey: {
            type: SchemaType.BOOLEAN,
            description: 'Set to true if you plan to call additional functions with this result. When true, large results return a cache key instead of full data to enable efficient multi-function workflows. Set to false if this is the final function call and you need the complete data immediately.'
          },
          startDate: {
            type: SchemaType.STRING,
            description: 'Start date as Unix timestamp in milliseconds or ISO date string. If not provided, defaults to current date.'
          },
          endDate: {
            type: SchemaType.STRING,
            description: 'End date as Unix timestamp in milliseconds or ISO date string. If not provided, defaults to 7 days from start date.'
          },
          currency: {
            type: SchemaType.STRING,
            enum: [...currencies, 'all'],
            description: 'Filter events by currency. Use "all" for events from all currencies.'
          },
          impact: {
            type: SchemaType.STRING,
            enum: ['High', 'Medium', 'all'],
            description: 'Filter events by impact level. "High" for major market-moving events, "Medium" for moderate impact, "all" for High and Medium events. Low impact events are excluded to focus on market-relevant events and reduce costs.'
          },
          dateRange: {
            type: SchemaType.STRING,
            description: 'Natural language date range. Examples: "next 7 days", "this week", "next week", "tomorrow", "today", "next 2 weeks". Takes precedence over startDate/endDate if provided.'
          },
          limit: {
            type: SchemaType.NUMBER,
            description: 'Maximum number of events to return. Defaults to 50 events if not specified, maximum allowed is 300 to control Firebase costs.'
          }
        }
      }
    },
    {
      name: 'extractTradeIds',
      description: 'Extract trade IDs from an array of trade objects or trade data. Useful for converting trade results from other functions (like searchTrades or findSimilarTrades) into a list of trade IDs that can be used with other functions like getTradeStatistics. Handles various trade object formats and removes duplicates.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          returnCacheKey: {
            type: SchemaType.BOOLEAN,
            description: 'Set to true if you plan to call additional functions with this result (like getTradeStatistics, convertTradeIdsToCards). When true, large results return a cache key instead of full data to enable efficient multi-function workflows. Set to false if this is the final function call and you need the complete data immediately.'
          },
          trades: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT
            },
            description: 'Array of trade objects or trade data from which to extract trade IDs. Can handle objects with "id", "tradeId", or "trade_id" fields, or arrays of strings representing trade IDs directly.'
          }
        },
        required: ['trades']
      }
    },
    {
      name: 'convertTradeIdsToCards',
      description: 'Convert a list of trade IDs to simple JSON format for card display. Returns a JSON object with "tradeCards" array containing the trade IDs, which the UI will use to display trade cards. Use this when you want to show specific trades as cards to the user.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          returnCacheKey: {
            type: SchemaType.BOOLEAN,
            description: 'Set to true if you plan to call additional functions with this result. When true, large results return a cache key instead of full data to enable efficient multi-function workflows. Set to false if this is the final function call and you need the complete data immediately.'
          },
          tradeIds: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.STRING
            },
            description: 'Array of trade IDs to convert to card format. These IDs should correspond to existing trades in the system.'
          },
          sortBy: {
            type: SchemaType.STRING,
            enum: ['date', 'amount', 'name'],
            description: 'Field to sort the cards by: "date" for chronological order, "amount" for profit/loss order, "name" for alphabetical order.'
          },
          sortOrder: {
            type: SchemaType.STRING,
            enum: ['asc', 'desc'],
            description: 'Sort direction: "asc" for ascending order, "desc" for descending order. Default is "asc".'
          }
        },
        required: ['tradeIds']
      }
    },
    {
      name: 'queryDatabase',
      description: `
      Execute a SQL SELECT query against the Supabase database to retrieve specific trading data, perform complex aggregations, or access database views. Automatically filters results to user\'s data for security. Use this for complex queries that cannot be handled by other functions.
      Main Table: trade_embeddings. Use this table for all queries and aggregations

      DATABASE SCHEMA:
      - id: UUID (primary key)
      - trade_id: TEXT (unique trade identifier)
      - user_id: TEXT (user identifier)
      - calendar_id: TEXT (calendar identifier)
      - trade_type: TEXT ('win', 'loss', 'breakeven')
      - trade_amount: DECIMAL (profit/loss amount)
      - trade_date: BIGINT (Unix timestamp in milliseconds when trade occurred)
      - trade_updated_at: BIGINT (Unix timestamp in milliseconds when trade was last modified)
      - trade_session: TEXT ('Asia', 'London', 'NY AM', 'NY PM' or NULL)
      - tags: TEXT[] (array of tag strings)
      - economic_events: JSONB (array of economic events that occurred during the trade)
      - embedding: vector(384) (vector embedding for similarity search)
      - embedded_content: TEXT (text content that was embedded which includes additional trade properties such as risk-to-reward, entry/exit prices, partials taken, trade name, notes, and economic events)
      

      Common SQL Patterns:
      - Day of week: EXTRACT(DOW FROM trade_date) (0=Sunday, 1=Monday, etc.)
      - Month grouping: DATE_TRUNC('month', trade_date) or TO_CHAR(trade_date, 'YYYY-MM')
      - Tag filtering: 'tag_name' = ANY(tags) or tags @> ARRAY['tag_name']
      - Date ranges: trade_date >= NOW() - INTERVAL '6 months'
      - Risk-to-reward filtering: embedded_content ILIKE '%risk reward ratio 2%' (for ratio above 2:1)
      - Entry/exit price search: embedded_content ILIKE '%entry 1.23%' or embedded_content ILIKE '%exit 1.24%'
      - Partials taken: embedded_content ILIKE '%partials taken%'
      - Trade name search: embedded_content ILIKE '%name EUR/USD%'
      - Economic events: embedded_content ILIKE '%economic events%' or embedded_content ILIKE '%Non-Farm Payrolls%'
      - High impact events: embedded_content ILIKE '%high USD%' or embedded_content ILIKE '%high EUR%'
      - Specific events: embedded_content ILIKE '%FOMC%' or embedded_content ILIKE '%NFP%'
`,
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          returnCacheKey: {
            type: SchemaType.BOOLEAN,
            description: 'Set to true if you plan to call additional functions with this result. When true, large results return a cache key instead of full data to enable efficient multi-function workflows. Set to false if this is the final function call and you need the complete data immediately.'
          },
          query: {
            type: SchemaType.STRING,
            description: `SQL SELECT statement to execute. Only SELECT queries are allowed for security. The query will be automatically filtered to include only the current user\'s data.`
          },
          description: {
            type: SchemaType.STRING,
            description: 'Optional description of what the query is intended to find or analyze. This helps with understanding the query purpose and results interpretation.'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'executeMultipleFunctions',
      description: 'Execute multiple trading analysis functions in sequence and return the final combined result. This allows combining multiple function calls into a single request instead of calling functions sequentially or concurrently. Functions are executed in the order provided, and later functions can reference results from earlier functions using special placeholders like "LAST_RESULT", "EXTRACT_TRADE_IDS", or "EXTRACT_TRADES". Use this when you need to perform complex multi-step analysis that involves multiple functions.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          functions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: {
                  type: SchemaType.STRING,
                  enum: ['searchTrades', 'getTradeStatistics', 'findSimilarTrades', 'queryDatabase', 'analyzeEconomicEvents', 'fetchEconomicEvents', 'extractTradeIds', 'convertTradeIdsToCards'],
                  description: 'Name of the function to execute. Must be one of the available trading analysis functions.'
                },
                args: {
                  type: SchemaType.OBJECT,
                  description: 'Arguments to pass to the function. Can use special placeholders: "LAST_RESULT" (result from previous function), "EXTRACT_TRADE_IDS" (extract trade IDs from previous result), "EXTRACT_TRADES" (extract trades array from previous result), "RESULT_0", "RESULT_1", etc. (result from specific function by index).'
                }
              },
              required: ['name', 'args']
            },
            description: 'Array of functions to execute in sequence. Each function can reference results from previous functions using special placeholders in the arguments.'
          },
          description: {
            type: SchemaType.STRING,
            description: 'Optional description of what this multi-function workflow is intended to accomplish. Helps with understanding the analysis purpose.'
          }
        },
        required: ['functions']
      }
    }
  ];
}
