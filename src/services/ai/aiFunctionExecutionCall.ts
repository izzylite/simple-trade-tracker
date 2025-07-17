import { logger } from "../../utils/logger";
import { tradingAnalysisFunctions, TradingAnalysisResult } from "./tradingAnalysisFunctions";

class AIFunctionExecution {

    
  /**
   * Execute a function call requested by the AI
   */
   public async executeFunctionCall(functionName: string, args: any): Promise<TradingAnalysisResult> {
    try {
      logger.log(`Executing function call: ${functionName}`, args);

      // Process arguments to handle cache keys (if needed)
      const processedArgs = this.processFunctionArgs(args, functionName);

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
  public processFunctionArgs(args: any, functionName: string): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const processedArgs = { ...args };
    logger.log('Processing function arguments:', processedArgs);

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
            // For extractTradeIds function, we need the trades array specifically
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
            else if(key === 'tradeIds' && actualData && typeof actualData === 'object'){
              if(actualData.trades && Array.isArray(actualData.trades)){
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
              processedArgs[key] = actualData;
            }

            // Clear the cache after retrieval to free up space
            localStorage.removeItem(value);
            logger.log(`Retrieved and cleared cached data for argument ${key}`, processedArgs[key]);
          } else {
            logger.warn(`Failed to retrieve cached data for key: ${value}`);
            // For critical parameters like 'trades', provide an empty array as fallback
            if (key === 'trades') {
              logger.warn(`Setting empty array for missing trades cache key`);
              processedArgs[key] = [];
            }
          }
        } catch (error) {
          logger.error('Error processing cache key:', error);
          if (key === 'trades') {
            processedArgs[key] = [];
          }
        }
      }
    }

    return processedArgs;
  }

}

export const aiFunctionExecution = new AIFunctionExecution();
