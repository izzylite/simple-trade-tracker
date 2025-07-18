/**
 * Multi-function execution and data structure info for AI trading analysis
 */

import { Trade } from '../../../types/trade';
import { logger } from '../../../utils/logger';
import { ExecuteMultipleFunctionsParams, MultiFunctionExecutor } from './multiFunctionExecutor';
import { TradingAnalysisResult } from './types';

/**
 * Execute multiple functions in sequence and return the final result
 * This allows the AI to combine multiple function calls into a single request
 */
export async function executeMultipleFunctions(
  trades: Trade[],
  params: ExecuteMultipleFunctionsParams
): Promise<TradingAnalysisResult> {
  const multiFunctionExecutor = new MultiFunctionExecutor();
  multiFunctionExecutor.initialize(trades);
  return await multiFunctionExecutor.executeMultipleFunctions(params);
}

/**
 * Get comprehensive documentation of all available placeholder patterns for executeMultipleFunctions
 * Call this when you need to use advanced placeholders or are unsure about syntax
 */
export async function getAvailablePlaceholderPatterns(
  trades: Trade[],
  params: { category?: string } = {}
): Promise<TradingAnalysisResult> {
  const multiFunctionExecutor = new MultiFunctionExecutor();
  multiFunctionExecutor.initialize(trades);
  return await multiFunctionExecutor.getAvailablePlaceholderPatterns(params);
}

/**
 * Get comprehensive documentation of data structures and database schema
 * Call this when you need to understand trade data fields, database tables, or query structure
 */
export async function getDataStructureInfo(params: {
  type?: 'trade' | 'database' | 'economic' | 'all',
  detail?: 'basic' | 'full' | 'fields-only',
  context?: 'filtering' | 'aggregation' | 'joins' | 'performance' | 'examples'
} = {}): Promise<TradingAnalysisResult> {
  try {
    const { type = 'all', detail = 'basic', context } = params;

    const structures = {
      trade: {
        description: "Trade data structure - the main trading record interface used in the application",
        interface: "Trade",
        coreFields: {
          id: { type: "string", required: true, description: "Unique trade identifier" },
          date: { type: "Date", required: true, description: "Trade execution date" },
          amount: { type: "number", required: true, description: "Trade P&L amount (positive for wins, negative for losses)" },
          type: { type: "'win' | 'loss' | 'breakeven'", required: true, description: "Trade outcome type" },
          name: { type: "string", description: "Trade name/description" },
          entry: { type: "string", description: "Entry price or level" },
          exit: { type: "string", description: "Exit price or level" },
          tags: { type: "string[]", description: "Array of trade tags for categorization" },
          riskToReward: { type: "number", description: "Risk to reward ratio" },
          session: { type: "'Asia' | 'London' | 'NY AM' | 'NY PM'", description: "Trading session" },
        },
        optionalFields: {
          partialsTaken: { type: "boolean", description: "Whether partial profits were taken" },
          notes: { type: "string", description: "Trade notes" },
          images: { type: "TradeImage[]", description: "Array of trade screenshot images" },
          isPinned: { type: "boolean", description: "Whether trade is pinned" },
          economicEvents: { type: "TradeEconomicEvent[]", description: "Economic events during trade" },
          updatedAt: { type: "Date", description: "Last update timestamp" }
        },
        examples: {
          winningTrade: {
            id: "trade_123",
            date: "2024-01-15T10:30:00Z",
            amount: 150.50,
            type: "win",
            tags: ["breakout", "EURUSD"],
            session: "London",
            riskToReward: 2.5
          },
          losingTrade: {
            id: "trade_124",
            date: "2024-01-15T14:20:00Z",
            amount: -75.25,
            type: "loss",
            tags: ["reversal", "GBPUSD"],
            session: "NY AM"
          }
        }
      },
      database: {
        description: "Supabase database schema for trade embeddings and vector search",
        mainTable: "trade_embeddings",
        tables: {
          trade_embeddings: {
            description: "Main table storing trade data with vector embeddings for AI search",
            fields: {
              id: { type: "UUID", description: "Primary key" },
              user_id: { type: "TEXT", required: true, description: "User identifier" },
              calendar_id: { type: "TEXT", required: true, description: "Calendar identifier" },
              trade_id: { type: "TEXT", required: true, description: "Trade identifier from main app" },
              trade_name: { type: "TEXT", description: "Trade name/description" },
              trade_date: { type: "BIGINT", required: true, description: "Trade date as Unix timestamp in milliseconds" },
              trade_type: { type: "TEXT", required: true, description: "Trade outcome: win, loss, breakeven" },
              trade_amount: { type: "NUMERIC", required: true, description: "Trade P&L amount" },
              trade_entry: { type: "TEXT", description: "Entry price or level" },
              trade_exit: { type: "TEXT", description: "Exit price or level" },
              risk_to_reward: { type: "NUMERIC", description: "Risk to reward ratio" },
              trade_session: { type: "TEXT", description: "Trading session" },
              tags: { type: "TEXT[]", default: "'{}'", description: "Array of trade tags" },
              economic_events: { type: "JSONB", default: "'[]'", description: "JSON array of economic events" },
              embedding: { type: "vector(384)", required: true, description: "Vector embedding for similarity search" },
              embedded_content: { type: "TEXT", required: true, description: "Text content that was embedded" },
              created_at: { type: "TIMESTAMP WITH TIME ZONE", default: "NOW()" },
              updated_at: { type: "TIMESTAMP WITH TIME ZONE", default: "NOW()" }
            },
            indexes: [
              "idx_trade_embeddings_user_calendar (user_id, calendar_id)",
              "idx_trade_embeddings_trade_type (trade_type)",
              "idx_trade_embeddings_trade_date (trade_date)",
              "idx_trade_embeddings_tags USING GIN(tags)",
              "idx_trade_embeddings_economic_events USING GIN(economic_events)"
            ],
            constraints: [
              "UNIQUE(trade_id, calendar_id, user_id)"
            ]
          },
          embedding_metadata: {
            description: "Metadata table for tracking embedding generation",
            fields: {
              id: { type: "UUID", description: "Primary key" },
              user_id: { type: "TEXT", required: true },
              calendar_id: { type: "TEXT", required: true },
              model_name: { type: "TEXT", default: "'all-MiniLM-L6-v2'" },
              model_version: { type: "TEXT", default: "'v1'" },
              total_trades: { type: "INTEGER", default: "0" },
              total_embeddings: { type: "INTEGER", default: "0" },
              last_sync_at: { type: "TIMESTAMP WITH TIME ZONE", default: "NOW()" }
            }
          }
        },
        functions: {
          execute_sql: {
            description: "Secure function to execute SELECT queries with automatic user filtering",
            parameters: ["sql_query TEXT"],
            returns: "JSONB",
            security: "Only SELECT queries allowed, automatic user_id filtering applied"
          },
          search_similar_trades: {
            description: "Vector similarity search function",
            parameters: [
              "query_embedding vector(384)",
              "user_id_param TEXT",
              "calendar_id_param TEXT",
              "similarity_threshold FLOAT DEFAULT 0.7",
              "max_results INTEGER DEFAULT 20"
            ],
            returns: "TABLE with trade data and similarity scores"
          }
        }
      },
      economic: {
        description: "Economic calendar data structure for economic events and news",
        interface: "EconomicEvent",
        coreFields: {
          id: { type: "string", required: true, description: "Unique event identifier" },
          currency: { type: "Currency", required: true, description: "Currency affected (USD, EUR, GBP, etc.)" },
          event: { type: "string", required: true, description: "Event name/title" },
          impact: { type: "ImpactLevel", required: true, description: "Impact level: Low, Medium, High, Holiday, Non-Economic" },
          time: { type: "string", required: true, description: "Event time in ISO string format" },
          date: { type: "string", required: true, description: "Event date in YYYY-MM-DD format" }
        },
        optionalFields: {
          actual: { type: "string", description: "Actual result value" },
          forecast: { type: "string", description: "Forecasted value" },
          previous: { type: "string", description: "Previous value" },
          actualResultType: { type: "'good' | 'bad' | 'neutral' | ''", description: "Result impact assessment" },
          country: { type: "string", description: "Country name" },
          flagCode: { type: "string", description: "Country flag code" },
          unixTimestamp: { type: "number", description: "Unix timestamp in milliseconds" },
          description: { type: "string", description: "Event description" }
        },
        examples: {
          highImpactEvent: {
            id: "event_123",
            currency: "USD",
            event: "Non-Farm Payrolls",
            impact: "High",
            time: "2024-01-15T13:30:00Z",
            date: "2024-01-15",
            actual: "216K",
            forecast: "200K",
            previous: "199K",
            actualResultType: "good"
          },
          mediumImpactEvent: {
            id: "event_124",
            currency: "EUR",
            event: "CPI m/m",
            impact: "Medium",
            time: "2024-01-15T10:00:00Z",
            date: "2024-01-15",
            actual: "0.2%",
            forecast: "0.1%"
          }
        },
        filteringPatterns: {
          byCurrency: "events.filter(e => e.currency === 'USD')",
          byImpact: "events.filter(e => e.impact === 'High')",
          byDate: "events.filter(e => e.date >= '2024-01-01')",
          byMultipleCurrencies: "events.filter(e => ['USD', 'EUR'].includes(e.currency))"
        }
      }
    };

    // Add context-specific information
    const contextInfo: any = {};
    if (context) {
      switch (context) {
        case 'filtering':
          contextInfo.queryPatterns = {
            userFiltering: "WHERE user_id = 'user123' AND calendar_id = 'cal456'",
            typeFiltering: "WHERE trade_type = 'win'",
            dateFiltering: "WHERE trade_date >= 1640995200000",
            tagFiltering: "WHERE 'breakout' = ANY(tags)",
            economicEventFiltering: "WHERE economic_events @> '[{\"impact\": \"High\"}]'"
          };
          break;
        case 'aggregation':
          contextInfo.aggregationExamples = {
            totalPnl: "SELECT SUM(trade_amount) FROM trade_embeddings WHERE user_id = ?",
            winRate: "SELECT COUNT(*) FILTER (WHERE trade_type = 'win') * 100.0 / COUNT(*) FROM trade_embeddings",
            sessionStats: "SELECT trade_session, COUNT(*), AVG(trade_amount) FROM trade_embeddings GROUP BY trade_session",
            monthlyStats: "SELECT DATE_TRUNC('month', TO_TIMESTAMP(trade_date/1000)), COUNT(*) FROM trade_embeddings GROUP BY 1"
          };
          break;
        case 'performance':
          contextInfo.performanceTips = [
            "Always include user_id and calendar_id in WHERE clauses",
            "Use indexes: trade_type, trade_date, tags (GIN), economic_events (GIN)",
            "Limit large result sets with LIMIT clause",
            "Use DATE_TRUNC for time-based grouping",
            "Vector searches are optimized with similarity thresholds"
          ];
          break;
      }
    }

    // Return filtered structures or all structures
    const result = type === 'all' ? structures : { [type]: structures[type as keyof typeof structures] };

    if (type !== 'all' && !structures[type as keyof typeof structures]) {
      return {
        success: false,
        error: `Unknown data type: ${type}. Available types: ${Object.keys(structures).join(', ')}, all`
      };
    }

    return {
      success: true,
      data: {
        type: type,
        detail: detail,
        context: context,
        availableTypes: Object.keys(structures),
        structures: result,
        contextInfo: contextInfo,
        usage: "Use this information to understand data structure when calling other functions or constructing database queries. Always include user_id and calendar_id filters for security."
      }
    };

  } catch (error) {
    logger.error('Error getting data structure info:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting data structure info'
    };
  }
}
