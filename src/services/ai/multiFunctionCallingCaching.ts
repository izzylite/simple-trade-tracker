import { logger } from "../../utils/logger";
import { tradingAnalysisFunctions, TradingAnalysisResult } from "./tradingAnalysisFunctions";

 
 // Function result caching for large data handling
interface CachedResult {
    data: any;
    timestamp: number;
    functionName: string;
  }
  
  class FunctionResultCache {
    private static readonly CACHE_PREFIX = 'ai_function_result_';
    private static readonly CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  
    static store(functionName: string, result: any): string {
      const key = `${this.CACHE_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const cachedResult: CachedResult = {
        data: result,
        timestamp: Date.now(),
        functionName
      };
  
      try {
        localStorage.setItem(key, JSON.stringify(cachedResult));
        logger.log(`Stored large function result for ${functionName} with key: ${key}`);
        return key;
      } catch (error) {
        logger.error('Failed to store function result in localStorage:', error);
        return '';
      }
    }
  
    static retrieve(key: string): any {
      try {
        const item = localStorage.getItem(key);
        if (!item) {
          logger.warn(`Function result cache miss for key: ${key}`);
          return null;
        }
  
        const cachedResult: CachedResult = JSON.parse(item);
  
        // Check if expired
        if (Date.now() - cachedResult.timestamp > this.CACHE_EXPIRY) {
          localStorage.removeItem(key);
          logger.warn(`Function result cache expired for key: ${key}`);
          return null;
        }
  
        logger.log(`Retrieved cached result for ${cachedResult.functionName} from key: ${key}`);
        return cachedResult.data;
      } catch (error) {
        logger.error('Failed to retrieve function result from localStorage:', error);
        return null;
      }
    }
  
    static clear(key: string): void {
      try {
        localStorage.removeItem(key);
        logger.log(`Cleared function result cache for key: ${key}`);
      } catch (error) {
        logger.error('Failed to clear function result cache:', error);
      }
    }
  
    static clearExpired(): void {
      try {
        const keys = Object.keys(localStorage).filter(key => key.startsWith(this.CACHE_PREFIX));
        let cleared = 0;
  
        keys.forEach(key => {
          const item = localStorage.getItem(key);
          if (item) {
            try {
              const cachedResult: CachedResult = JSON.parse(item);
              if (Date.now() - cachedResult.timestamp > this.CACHE_EXPIRY) {
                localStorage.removeItem(key);
                cleared++;
              }
            } catch {
              // Invalid format, remove it
              localStorage.removeItem(key);
              cleared++;
            }
          }
        });
  
        if (cleared > 0) {
          logger.log(`Cleared ${cleared} expired function result cache entries`);
        }
      } catch (error) {
        logger.error('Failed to clear expired function result cache:', error);
      }
    }
  }
  
  class MultiFunctionCallingCachingService {
 
  private lastInitializedCalendarId: string | null = null;
  private lastInitializedTradesCount: number = 0;
  private static readonly LARGE_RESULT_THRESHOLD = 10000; // 10KB threshold for caching
 /**
   * Determines if a function result is too large and should be cached
   */
 private isResultTooLarge(result: any): boolean {
    try {
      const resultString = JSON.stringify(result);
      return resultString.length >   MultiFunctionCallingCachingService.LARGE_RESULT_THRESHOLD;
    } catch {
      return false;
    }
  }
 /**
   * Processes function result - caches large results and returns appropriate response
   */
  processLargeResult(functionName: string, result: any, isLastFunction: boolean, totalFunctions: number): any {
    // Clear expired cache entries periodically
    FunctionResultCache.clearExpired();

    // If this is the last function or there's only one function, return the full result
    if (isLastFunction || totalFunctions === 1) {
      logger.log(`Returning full result for ${functionName} (last function or single function)`);
      return result;
    }

    // Check if result is too large
    if (this.isResultTooLarge(result)) {
      const cacheKey = FunctionResultCache.store(functionName, result);
      if (cacheKey) {
        logger.log(`Cached large result for ${functionName}, returning cache key`);

        // Create a summary of what was cached to help the AI understand
        let summary = `Large result cached for ${functionName}. Use cache key ${cacheKey} to retrieve data in subsequent functions.`;

        // Add specific information about the cached data structure
        if (result && typeof result === 'object' && result.success && result.data) {
          if (result.data.trades && Array.isArray(result.data.trades)) {
            summary += ` Contains ${result.data.trades.length} trades.`;
          } else if (Array.isArray(result.data)) {
            summary += ` Contains ${result.data.length} items.`;
          }
        }

        return {
          success: true,
          cached: true,
          cacheKey: cacheKey,
          summary: summary,
          resultSize: JSON.stringify(result).length,
          // Include metadata about the cached data structure
          dataStructure: this.describeCachedDataStructure(result)
        };
      } else {
        logger.warn(`Failed to cache large result for ${functionName}, returning truncated result`);
        return {
          success: true,
          cached: false,
          summary: `Large result for ${functionName} could not be cached. Result truncated.`,
          resultSize: JSON.stringify(result).length,
          data: result // Fallback to original result
        };
      }
    }

    // Result is small enough, return as-is
    return result;
  }

  
    /**
     * Describe the structure of cached data to help with debugging
     */
    private describeCachedDataStructure(result: any): string {
      if (!result || typeof result !== 'object') {
        return 'primitive';
      }
  
      if (result.success && result.data) {
        if (result.data.trades && Array.isArray(result.data.trades)) {
          return `function_result_with_trades_array(${result.data.trades.length})`;
        } else if (Array.isArray(result.data)) {
          return `function_result_with_array(${result.data.length})`;
        } else {
          return 'function_result_with_object';
        }
      } else if (Array.isArray(result)) {
        return `array(${result.length})`;
      } else {
        return 'object';
      }
    }



    
  /**
   * Process function arguments to handle cache keys
   */
  private processFunctionArgs(args: any): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const processedArgs = { ...args }; 

    // Look for cache keys in arguments and replace with actual data
    for (const [key, value] of Object.entries(processedArgs)) {
      // Check if value is a cache key string
      if (typeof value === 'string' && value.startsWith(FunctionResultCache['CACHE_PREFIX'])) {
        logger.log(`Found cache key in argument ${key}: ${value}`);
        const cachedData = FunctionResultCache.retrieve(value);
        if (cachedData) {
          // The cached data might be a full function result with success/data structure
          // Extract the actual data we need
          let actualData = cachedData;
          if (cachedData && typeof cachedData === 'object' && cachedData.success && cachedData.data) {
            actualData = cachedData.data;
          }

          // For extractTradeIds function, we need the trades array specifically
          if (key === 'trades' && actualData && typeof actualData === 'object') {
            if (actualData.trades && Array.isArray(actualData.trades)) {
              processedArgs[key] = actualData.trades;
            } else if (Array.isArray(actualData)) {
              processedArgs[key] = actualData;
            } else {
              logger.warn(`Cached data for ${key} doesn't contain expected trades array:`, actualData);
              processedArgs[key] = [];
            }
          } else {
            processedArgs[key] = actualData;
          }

          // Clear the cache after retrieval to free up space
          FunctionResultCache.clear(value);
          logger.log(`Retrieved and cleared cached data for argument ${key}`);
        } else {
          logger.warn(`Failed to retrieve cached data for key: ${value}`);
          // For critical parameters like 'trades', provide an empty array as fallback
          if (key === 'trades') {
            logger.warn(`Setting empty array for missing trades cache key`);
            processedArgs[key] = [];
          }
        }
      }

      // Handle nested objects
      else if (typeof value === 'object' && value !== null) {
        processedArgs[key] = this.processFunctionArgs(value);
      }
    }

    return processedArgs;
  }
  /**
   * Execute a function call requested by the AI
   */
    async executeFunctionCall(call: any): Promise<TradingAnalysisResult> {
    try {
      logger.log(`Executing function call: ${call.name}`, call.args);

      // Process arguments to handle cache keys
      const processedArgs = this.processFunctionArgs(call.args);

      switch (call.name) {
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

        default:
          return {
            success: false,
            error: `Unknown function: ${call.name}`
          };
      }
    } catch (error) {
      logger.error(`Error executing function ${call.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const multiFunctionCallingCachingService = new MultiFunctionCallingCachingService();