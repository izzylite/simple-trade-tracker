import { logger } from "../../utils/logger";
import { tradingAnalysisFunctions, TradingAnalysisResult } from "./tradingAnalysisFunctions";

class AIFunctionExecution {

    
  /**
   * Execute a function call requested by the AI
   */
   public async executeFunctionCall(functionName: string, args: any, preserveCache: boolean = false): Promise<TradingAnalysisResult> {
    try {
      logger.log(`Executing function call: ${functionName}`, args);

      // Process arguments to handle cache keys (if needed)
      const processedArgs = this.processFunctionArgs(args, functionName, preserveCache);

      switch (functionName) {
        case 'searchTrades':
          return await tradingAnalysisFunctions.searchTrades(processedArgs);

        case 'getTradeStatistics':
          return await tradingAnalysisFunctions.getTradeStatistics(processedArgs);

        case 'findSimilarTrades':
          return await tradingAnalysisFunctions.findSimilarTrades(processedArgs);

        case 'queryDatabase':
          return await tradingAnalysisFunctions.queryDatabase(processedArgs);

        case 'analyzeEconomicEvents':
          return await tradingAnalysisFunctions.analyzeEconomicEvents(processedArgs);

        case 'fetchEconomicEvents':
          return await tradingAnalysisFunctions.fetchEconomicEvents(processedArgs);

        case 'extractTradeIds':
          return await tradingAnalysisFunctions.extractTradeIds(processedArgs);

        case 'convertTradeIdsToCards':
          return await tradingAnalysisFunctions.convertTradeIdsToCards(processedArgs);

        case 'executeMultipleFunctions':
          return await tradingAnalysisFunctions.executeMultipleFunctions(processedArgs);

        default:
          return {
            success: false,
            error: `Unknown function: ${functionName}`
          };
      }
    } catch (error) {
      logger.error(`Error executing function ${functionName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process function arguments to handle cache keys
   */
  public processFunctionArgs(args: any, functionName: string, preserveCache: boolean = false): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const processedArgs = { ...args };
    logger.log('Processing function arguments:', processedArgs);

    // Check for incorrect placeholder usage in sequential calling
    for (const [, value] of Object.entries(processedArgs)) {
      if (typeof value === 'string' &&
          (value === 'LAST_RESULT' || value === 'EXTRACT_TRADES' || value === 'EXTRACT_TRADE_IDS' || value.startsWith('RESULT_'))) {
        logger.error(`ERROR: Placeholder "${value}" used in sequential function calling for ${functionName}.
             Placeholders only work inside executeMultipleFunctions!.
            Use actual cache keys (like "ai_function_result_1234567890_abc123") for sequential calling.`);
        // Don't process this - let it fail so the AI learns
      }
    }

    // Look for cache keys in arguments and replace with actual data
    for (const [key, value] of Object.entries(processedArgs)) {
      if (typeof value === 'string' && value.startsWith('ai_function_result_')) {
        logger.log(`Found cache key in argument ${key}: ${value}`);
        try {
          const cachedItem = localStorage.getItem(value);
          if (cachedItem) {
            const cachedResult = JSON.parse(cachedItem);
            let actualData = cachedResult.data;
            logger.log(`Cached data for ${key}:`, actualData);

            // Handle different parameter types based on what the function expects
            if (key === 'trades' && actualData && typeof actualData === 'object') {
              if (actualData.trades && Array.isArray(actualData.trades)) {
                // extractTradeIds needs full trade objects, convertTradeIdsToCards needs just IDs
                processedArgs[key] = functionName === 'convertTradeIdsToCards' ? actualData.trades.map((trade: any) => trade.id) : actualData.trades;
              } else if (Array.isArray(actualData)) {
                processedArgs[key] = actualData;
              } else {
                logger.warn(`Cached data for ${key} doesn't contain expected trades array:`, actualData);
                processedArgs[key] = [];
              }
            }
            else if (key === 'tradeIds' && actualData && typeof actualData === 'object') {
              if (actualData.trades && Array.isArray(actualData.trades)) {
                // For tradeIds parameter, we always want the IDs, not the full objects
                processedArgs[key] = actualData.trades.map((trade: any) => trade.id);
              }
              else if (actualData.tradeIds && Array.isArray(actualData.tradeIds)) {
                processedArgs[key] = actualData.tradeIds;
              } else if (Array.isArray(actualData)) {
                processedArgs[key] = actualData;
              } else {
                logger.warn(`Cached data for ${key} doesn't contain expected tradeIds array:`, actualData);
                processedArgs[key] = [];
              }
            }
            else {
              // For other parameters, pass the data as-is
              processedArgs[key] = actualData;
            }

            // Only clear the cache if not preserving it (for multi-function workflows)
            if (!preserveCache) {
              localStorage.removeItem(value);
              logger.log(`Retrieved and cleared cached data for argument ${key}`, processedArgs[key]);
            } else {
              logger.log(`Retrieved cached data for argument ${key} (preserved for multi-function workflow)`, processedArgs[key]);
            }
          } else {
            logger.warn(`Failed to retrieve cached data for key: ${value}`);
            // For critical parameters like 'trades', provide an empty array as fallback
            if (key === 'trades' || key === 'tradeIds') {
              logger.warn(`Setting empty array for missing ${key} cache key`);
              processedArgs[key] = [];
            }
          }
        } catch (error) {
          logger.error('Error processing cache key:', error);
          if (key === 'trades' || key === 'tradeIds') {
            processedArgs[key] = [];
          }
        }
      }
    }

    return processedArgs;
  }

   /**
   * Clean up cache keys that were used in multi-function execution
   */
   public cleanupCacheKeys(results: any[]): void {
    try {
      // Look for cache keys in the arguments of executed functions
      const cacheKeysToClean = new Set<string>();

      for (const result of results) {
        if (result.args && typeof result.args === 'object') {
          for (const [, value] of Object.entries(result.args)) {
            if (typeof value === 'string' && value.startsWith('ai_function_result_')) {
              cacheKeysToClean.add(value);
            }
          }
        }
      }

      // Clean up the cache keys
      cacheKeysToClean.forEach(cacheKey => {
        try {
          localStorage.removeItem(cacheKey);
          logger.log(`Cleaned up cache key: ${cacheKey}`);
        } catch (error) {
          logger.warn(`Failed to clean up cache key ${cacheKey}:`, error);
        }
      });

      if (cacheKeysToClean.size > 0) {
        logger.log(`Cleaned up ${cacheKeysToClean.size} cache keys from multi-function execution`);
      }
    } catch (error) {
      logger.error('Error cleaning up cache keys:', error);
    }
  }

}

export const aiFunctionExecution = new AIFunctionExecution();
