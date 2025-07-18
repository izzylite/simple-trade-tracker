/**
 * Multi-Function Executor
 * Handles execution of multiple AI functions in sequence with placeholder support
 */

import { Trade } from '../../types/trade';
import { logger } from '../../utils/logger';
import { aiFunctionExecution } from './aiFunctionExecutionCall';

export interface FunctionCall {
  name: string;
  args: any;
  condition?: string;
  validate?: any;
}

export interface ExecuteMultipleFunctionsParams {
  functions: FunctionCall[];
  description?: string;
}

export interface TradingAnalysisResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class MultiFunctionExecutor {
  private trades: Trade[] = [];

  /**
   * Initialize with current trading data
   */
  initialize(trades: Trade[]) {
    this.trades = trades;
  }

  /**
   * Execute multiple functions in sequence and return the final result
   * This allows the AI to combine multiple function calls into a single request
   */
  async executeMultipleFunctions(params: ExecuteMultipleFunctionsParams): Promise<TradingAnalysisResult> {
    try {
      logger.log('Executing multiple functions:', params.functions.map(f => f.name));

      if (!params.functions || params.functions.length === 0) {
        return {
          success: false,
          error: 'No functions provided to execute'
        };
      }

      const results: any[] = [];
      let lastResult: any = null;

      // Validate that functions don't use returnCacheKey (placeholders need actual data)
      for (const functionCall of params.functions) {
        if (functionCall.args && functionCall.args.returnCacheKey === true) {
          logger.error(`❌ CRITICAL ERROR: Function ${functionCall.name} in executeMultipleFunctions uses returnCacheKey=true. This breaks placeholder functionality!`);
          logger.error(`Remove returnCacheKey from function arguments in executeMultipleFunctions - placeholders need actual data, not cache keys.`);
          return {
            success: false,
            error: `Function ${functionCall.name} incorrectly uses returnCacheKey=true in executeMultipleFunctions. Placeholders need actual data, not cache keys. Remove returnCacheKey from the function arguments.`
          };
        }
      }

      // Execute functions sequentially
      for (let i = 0; i < params.functions.length; i++) {
        const functionCall = params.functions[i];
        logger.log(`Executing function ${i + 1}/${params.functions.length}: ${functionCall.name}`);

        // Check conditional execution
        if (functionCall.condition && !this.evaluateCondition(functionCall.condition, results, lastResult)) {
          logger.log(`Skipping function ${functionCall.name} due to condition: ${functionCall.condition}`);
          results.push({
            functionName: functionCall.name,
            args: functionCall.args,
            result: { skipped: true, reason: `Condition not met: ${functionCall.condition}` },
            skipped: true
          });
          continue;
        }

        // Process arguments to handle references to previous results
        const processedArgs = this.processMultiFunctionArgs(functionCall.args, results, lastResult);

        // Execute the function (preserve cache for all but the last function)
        const preserveCache = i < params.functions.length - 1;
        const result = await aiFunctionExecution.executeFunctionCall(functionCall.name, processedArgs, preserveCache);

        if (!result.success) {
          logger.error(`Function ${functionCall.name} failed:`, result.error);
          return {
            success: false,
            error: `Function ${functionCall.name} failed: ${result.error}`,
            data: {
              completedFunctions: results,
              failedFunction: functionCall.name,
              failedAt: i + 1
            }
          };
        }

        // Validate result if validation rules are provided
        if (functionCall.validate && !this.validateResult(result.data, functionCall.validate)) {
          const validationError = `Function ${functionCall.name} result failed validation: ${JSON.stringify(functionCall.validate)}`;
          logger.error(validationError);
          return {
            success: false,
            error: validationError,
            data: {
              completedFunctions: results,
              failedFunction: functionCall.name,
              failedAt: i + 1
            }
          };
        }

        results.push({
          functionName: functionCall.name,
          args: processedArgs,
          result: result.data
        });

        lastResult = result.data;
      }

      logger.log('All functions executed successfully');

      // Clean up any remaining cache keys from this multi-function execution
      aiFunctionExecution.cleanupCacheKeys(results);

      return {
        success: true,
        data: {
          description: params.description || 'Multiple functions executed successfully',
          functions: results,
          finalResult: lastResult,
          totalFunctions: params.functions.length,
          skippedFunctions: results.filter(r => r.skipped).length
        }
      };

    } catch (error) {
      logger.error('Error executing multiple functions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing multiple functions'
      };
    }
  }


   /**
   * Process arguments for multi-function calls, handling references to previous results
   */
   private processMultiFunctionArgs(args: any, previousResults: any[], lastResult: any): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const processedArgs = { ...args };

    // Handle special placeholders that reference previous results
    for (const [key, value] of Object.entries(processedArgs)) {
      if (typeof value === 'string') {
        processedArgs[key] = this.processPlaceholder(value, previousResults, lastResult, key);
      }
    }

    return processedArgs;
  }

    /**
   * Process individual placeholder values
   */
    private processPlaceholder(value: string, previousResults: any[], lastResult: any, _key: string): any {
      // Handle field-specific extraction (e.g., EXTRACT_0.trades.id, EXTRACT_LAST.statistics.winRate)
      if (value.startsWith('EXTRACT_') && value.includes('.')) {
        return this.processFieldExtraction(value, previousResults, lastResult);
      }
  
      // Handle array operations (e.g., MERGE_TRADE_IDS_0_2, UNIQUE_TRADE_IDS_0_1_2)
      if (value.startsWith('MERGE_') || value.startsWith('UNIQUE_') || value.startsWith('INTERSECT_')) {
        return this.processArrayOperation(value, previousResults);
      }
  
      // Handle transformations (e.g., SLICE_0.trades.0.5, FILTER_1.trades.type.win)
      if (value.startsWith('SLICE_') || value.startsWith('FILTER_') || value.startsWith('SORT_')) {
        return this.processTransformation(value, previousResults, lastResult);
      }
  
      // Handle reference to last result
      if (value === 'LAST_RESULT') {
        return lastResult;
      }
  
      // Handle reference to specific function result by index
      if (value.startsWith('RESULT_')) {
        const index = parseInt(value.replace('RESULT_', ''));
        if (index >= 0 && index < previousResults.length) {
          return previousResults[index].result;
        }
      }
  
      // Handle reference to trade IDs from previous result
      if (value === 'EXTRACT_TRADE_IDS' && lastResult) {
        return this._extractTradeIds(lastResult);
      }
  
      // Handle indexed trade ID extraction (e.g., EXTRACT_TRADE_IDS_0)
      if (value.startsWith('EXTRACT_TRADE_IDS_')) {
        const index = parseInt(value.replace('EXTRACT_TRADE_IDS_', ''));
        if (index >= 0 && index < previousResults.length) {
          return this._extractTradeIds(previousResults[index].result);
        }
      }
  
      // Handle reference to trades array from previous result
      if (value === 'EXTRACT_TRADES' && lastResult) {
        return this._extractTrades(lastResult);
      }
  
      // Handle indexed trades extraction (e.g., EXTRACT_TRADES_1)
      if (value.startsWith('EXTRACT_TRADES_')) {
        const index = parseInt(value.replace('EXTRACT_TRADES_', ''));
        if (index >= 0 && index < previousResults.length) {
          return this._extractTrades(previousResults[index].result);
        }
      }
  
      // Handle cache keys from different functions
      if (value.startsWith('ai_function_result_')) {
        return value;
      }
  
      return value;
    }
  

    /**
   * Evaluate conditional expression for function execution
   */
    private evaluateCondition(condition: string, previousResults: any[], lastResult: any): boolean {
      try {
        // Handle field access (e.g., RESULT_0.count > 10)
        const fieldMatches = condition.match(/RESULT_(\d+)\.([a-zA-Z0-9_.]+)/g);
        if (fieldMatches) {
          let processedCondition = condition;
          for (const match of fieldMatches) {
            const [, indexStr, fieldPath] = match.match(/RESULT_(\d+)\.([a-zA-Z0-9_.]+)/) || [];
            const index = parseInt(indexStr);
            if (index >= 0 && index < previousResults.length) {
              const fieldValue = this.extractNestedField(previousResults[index].result, fieldPath, `CONDITION_${index}`);
              processedCondition = processedCondition.replace(match, JSON.stringify(fieldValue));
            }
          }
          return this.evaluateSimpleCondition(processedCondition);
        }
        
        // Handle LAST_RESULT field access
        const lastFieldMatches = condition.match(/LAST_RESULT\.([a-zA-Z0-9_.]+)/g);
        if (lastFieldMatches && lastResult) {
          let processedCondition = condition;
          for (const match of lastFieldMatches) {
            const [, fieldPath] = match.match(/LAST_RESULT\.([a-zA-Z0-9_.]+)/) || [];
            const fieldValue = this.extractNestedField(lastResult, fieldPath, 'CONDITION_LAST');
            processedCondition = processedCondition.replace(match, JSON.stringify(fieldValue));
          }
          return this.evaluateSimpleCondition(processedCondition);
        }
        
        // Handle simple RESULT_X references
        const resultMatches = condition.match(/RESULT_(\d+)/g);
        if (resultMatches) {
          let processedCondition = condition;
          for (const match of resultMatches) {
            const index = parseInt(match.replace('RESULT_', ''));
            if (index >= 0 && index < previousResults.length) {
              const resultValue = previousResults[index].result;
              processedCondition = processedCondition.replace(match, JSON.stringify(resultValue));
            }
          }
          return this.evaluateSimpleCondition(processedCondition);
        }
        
        // Handle LAST_RESULT references
        if (condition.includes('LAST_RESULT') && lastResult) {
          const processedCondition = condition.replace(/LAST_RESULT/g, JSON.stringify(lastResult));
          return this.evaluateSimpleCondition(processedCondition);
        }
        
        // Evaluate as simple condition
        return this.evaluateSimpleCondition(condition);
        
      } catch (error) {
        logger.error('Error evaluating condition:', condition, error);
        return false;
      }
    }

    /**
     * Evaluate simple conditional expressions
     */
    private evaluateSimpleCondition(condition: string): boolean {
      // Handle numeric comparisons
      const numericComparisons = [
        { op: '>=', fn: (a: number, b: number) => a >= b },
        { op: '<=', fn: (a: number, b: number) => a <= b },
        { op: '>', fn: (a: number, b: number) => a > b },
        { op: '<', fn: (a: number, b: number) => a < b },
        { op: '===', fn: (a: any, b: any) => a === b },
        { op: '!==', fn: (a: any, b: any) => a !== b },
        { op: '==', fn: (a: any, b: any) => a == b },
        { op: '!=', fn: (a: any, b: any) => a != b }
      ];
      
      for (const { op, fn } of numericComparisons) {
        if (condition.includes(op)) {
          const [left, right] = condition.split(op).map(s => s.trim());
          const leftVal = this.parseValue(left);
          const rightVal = this.parseValue(right);
          return fn(leftVal, rightVal);
        }
      }
      
      // Handle boolean values
      if (condition === 'true') return true;
      if (condition === 'false') return false;
      
      // Handle existence checks
      if (condition.startsWith('!')) {
        const value = this.parseValue(condition.substring(1));
        return !value;
      }
      
      // Default: check if value is truthy
      const value = this.parseValue(condition);
      return !!value;
    }
  
    /**
     * Parse value from string, handling JSON and primitives
     */
    private parseValue(value: string): any {
      const trimmed = value.trim();
      
      // Try to parse as JSON first
      try {
        return JSON.parse(trimmed);
      } catch {
        // If not JSON, try as number
        const num = parseFloat(trimmed);
        if (!isNaN(num)) return num;
        
        // Return as string
        return trimmed;
      }
    }
  
    /**
     * Validate function result against validation rules
     */
    private validateResult(result: any, validation: any): boolean {
      try {
        // Handle different validation types
        if (validation.minCount !== undefined) {
          const count = this.getResultCount(result);
          if (count < validation.minCount) {
            logger.warn(`Validation failed: count ${count} < minCount ${validation.minCount}`);
            return false;
          }
        }
        
        if (validation.maxCount !== undefined) {
          const count = this.getResultCount(result);
          if (count > validation.maxCount) {
            logger.warn(`Validation failed: count ${count} > maxCount ${validation.maxCount}`);
            return false;
          }
        }
        
        if (validation.hasField !== undefined) {
          if (!this.hasField(result, validation.hasField)) {
            logger.warn(`Validation failed: missing field ${validation.hasField}`);
            return false;
          }
        }
        
        if (validation.fieldValue !== undefined) {
          const { field, value } = validation.fieldValue;
          const fieldValue = this.extractNestedField(result, field, 'VALIDATION');
          if (fieldValue !== value) {
            logger.warn(`Validation failed: field ${field} value ${fieldValue} !== expected ${value}`);
            return false;
          }
        }
        
        return true;
        
      } catch (error) {
        logger.error('Error validating result:', error);
        return false;
      }
    }
  
    /**
     * Get count from result (trades, events, etc.)
     */
    private getResultCount(result: any): number {
      if (Array.isArray(result)) return result.length;
      if (result.trades && Array.isArray(result.trades)) return result.trades.length;
      if (result.data && Array.isArray(result.data)) return result.data.length;
      if (result.count !== undefined) return result.count;
      return 0;
    }
  
    /**
     * Check if result has a specific field
     */
    private hasField(result: any, fieldPath: string): boolean {
      try {
        const value = this.extractNestedField(result, fieldPath, 'VALIDATION');
        return value !== undefined && value !== null;
      } catch {
        return false;
      }
    }

  /**
   * Process field-specific extraction (e.g., EXTRACT_0.trades.id, EXTRACT_LAST.statistics.winRate)
   */
  private processFieldExtraction(value: string, previousResults: any[], lastResult: any): any {
    const match = value.match(/^EXTRACT_(\d+|LAST)\.(.+)$/);
    if (!match) {
      logger.warn(`Invalid field extraction format: ${value}. Expected format: EXTRACT_0.field.path or EXTRACT_LAST.field.path`);
      return [];
    }

    const [, indexStr, fieldPath] = match;
    const targetResult = indexStr === 'LAST' ? lastResult : previousResults[parseInt(indexStr)]?.result;
    
    if (!targetResult) {
      logger.warn(`Cannot extract from ${indexStr}: result not found. Available results: 0-${previousResults.length - 1}`);
      return [];
    }

    return this.extractNestedField(targetResult, fieldPath, `EXTRACT_${indexStr}`);
  }

  /**
   * Extract nested field from object using dot notation
   */
  private extractNestedField(obj: any, path: string, context: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (current && typeof current === 'object') {
        // Handle array access with special processing for trades
        if (part === 'id' && Array.isArray(current)) {
          return current.map((item: any) => item.id || item.tradeId || item.trade_id).filter(Boolean);
        }
        
        current = current[part];
      } else {
        const availableFields = current && typeof current === 'object' ? Object.keys(current) : [];
        logger.warn(`Cannot access field '${part}' in ${context}.${parts.slice(0, i).join('.')}. Available fields: ${availableFields.join(', ')}`);
        return [];
      }
    }
    
    return current || [];
  }

  /**
   * Process array operations (MERGE, UNIQUE, INTERSECT)
   */
  private processArrayOperation(value: string, previousResults: any[]): any {
    if (value.startsWith('MERGE_TRADE_IDS_')) {
      const indices = this.parseIndices(value, 'MERGE_TRADE_IDS_');
      return this.mergeTradeIds(previousResults, indices);
    }
    
    if (value.startsWith('UNIQUE_TRADE_IDS_')) {
      const indices = this.parseIndices(value, 'UNIQUE_TRADE_IDS_');
      const merged = this.mergeTradeIds(previousResults, indices);
      return Array.from(new Set(merged));
    }

    if (value.startsWith('INTERSECT_TRADE_IDS_')) {
      const indices = this.parseIndices(value, 'INTERSECT_TRADE_IDS_');
      return this.intersectTradeIds(previousResults, indices);
    }

    if (value.startsWith('MERGE_TRADES_')) {
      const indices = this.parseIndices(value, 'MERGE_TRADES_');
      return this.mergeTrades(previousResults, indices);
    }

    if (value.startsWith('UNIQUE_TRADES_')) {
      const indices = this.parseIndices(value, 'UNIQUE_TRADES_');
      const merged = this.mergeTrades(previousResults, indices);
      return this.uniqueTradesById(merged);
    }

    if (value.startsWith('INTERSECT_TRADES_')) {
      const indices = this.parseIndices(value, 'INTERSECT_TRADES_');
      return this.intersectTrades(previousResults, indices);
    }
    
    logger.warn(`Unknown array operation: ${value}`);
    return [];
  }

  /**
   * Process transformations (SLICE, FILTER, SORT)
   */
  private processTransformation(value: string, previousResults: any[], lastResult: any): any {
    // SLICE_0.trades.0.5 - Take first 5 trades from result 0
    if (value.startsWith('SLICE_')) {
      return this.processSliceTransformation(value, previousResults, lastResult);
    }

    // FILTER_1.trades.type.win - Filter to only winning trades from result 1
    if (value.startsWith('FILTER_')) {
      return this.processFilterTransformation(value, previousResults, lastResult);
    }

    // SORT_0.trades.amount.desc - Sort trades by amount descending from result 0
    if (value.startsWith('SORT_')) {
      return this.processSortTransformation(value, previousResults, lastResult);
    }

    logger.warn(`Unknown transformation: ${value}`);
    return [];
  }

  /**
   * Process slice transformation (e.g., SLICE_0.trades.0.5, SLICE_LAST.trades.10.20)
   */
  private processSliceTransformation(value: string, previousResults: any[], lastResult: any): any {
    const match = value.match(/^SLICE_(\d+|LAST)\.(.+)\.(\d+)\.(\d+)$/);
    if (!match) {
      logger.warn(`Invalid slice format: ${value}. Expected: SLICE_0.trades.0.5`);
      return [];
    }

    const [, indexStr, fieldPath, startStr, endStr] = match;
    const targetResult = indexStr === 'LAST' ? lastResult : previousResults[parseInt(indexStr)]?.result;
    
    if (!targetResult) {
      logger.warn(`Cannot slice from ${indexStr}: result not found`);
      return [];
    }

    const data = this.extractNestedField(targetResult, fieldPath, `SLICE_${indexStr}`);
    if (!Array.isArray(data)) {
      logger.warn(`Cannot slice non-array data from ${indexStr}.${fieldPath}`);
      return [];
    }

    const start = parseInt(startStr);
    const end = parseInt(endStr);
    
    return data.slice(start, end);
  }

  /**
   * Process filter transformation (e.g., FILTER_0.trades.type.win, FILTER_1.trades.amount.>100)
   */
  private processFilterTransformation(value: string, previousResults: any[], lastResult: any): any {
    const match = value.match(/^FILTER_(\d+|LAST)\.(.+)\.(.+)\.(.+)$/);
    if (!match) {
      logger.warn(`Invalid filter format: ${value}. Expected: FILTER_0.trades.type.win`);
      return [];
    }

    const [, indexStr, fieldPath, filterField, filterValue] = match;
    const targetResult = indexStr === 'LAST' ? lastResult : previousResults[parseInt(indexStr)]?.result;
    
    if (!targetResult) {
      logger.warn(`Cannot filter from ${indexStr}: result not found`);
      return [];
    }

    const data = this.extractNestedField(targetResult, fieldPath, `FILTER_${indexStr}`);
    if (!Array.isArray(data)) {
      logger.warn(`Cannot filter non-array data from ${indexStr}.${fieldPath}`);
      return [];
    }

    return this.applyFilter(data, filterField, filterValue);
  }

  /**
   * Process sort transformation (e.g., SORT_0.trades.amount.desc, SORT_1.trades.date.asc)
   */
  private processSortTransformation(value: string, previousResults: any[], lastResult: any): any {
    const match = value.match(/^SORT_(\d+|LAST)\.(.+)\.(.+)\.(asc|desc)$/);
    if (!match) {
      logger.warn(`Invalid sort format: ${value}. Expected: SORT_0.trades.amount.desc`);
      return [];
    }

    const [, indexStr, fieldPath, sortField, direction] = match;
    const targetResult = indexStr === 'LAST' ? lastResult : previousResults[parseInt(indexStr)]?.result;
    
    if (!targetResult) {
      logger.warn(`Cannot sort from ${indexStr}: result not found`);
      return [];
    }

    const data = this.extractNestedField(targetResult, fieldPath, `SORT_${indexStr}`);
    if (!Array.isArray(data)) {
      logger.warn(`Cannot sort non-array data from ${indexStr}.${fieldPath}`);
      return [];
    }

    return this.applySort(data, sortField, direction as 'asc' | 'desc');
  }
 
   /**
    * Apply filter to array based on field and value
    */
   private applyFilter(data: any[], filterField: string, filterValue: string): any[] {
     return data.filter(item => {
       const fieldValue = item[filterField];
       
       // Handle comparison operators
       if (filterValue.startsWith('>')) {
         const compareValue = parseFloat(filterValue.substring(1));
         return !isNaN(compareValue) && parseFloat(fieldValue) > compareValue;
       }
       
       if (filterValue.startsWith('<')) {
         const compareValue = parseFloat(filterValue.substring(1));
         return !isNaN(compareValue) && parseFloat(fieldValue) < compareValue;
       }
       
       if (filterValue.startsWith('>=')) {
         const compareValue = parseFloat(filterValue.substring(2));
         return !isNaN(compareValue) && parseFloat(fieldValue) >= compareValue;
       }
       
       if (filterValue.startsWith('<=')) {
         const compareValue = parseFloat(filterValue.substring(2));
         return !isNaN(compareValue) && parseFloat(fieldValue) <= compareValue;
       }
       
       // Handle special values
       if (filterValue === 'win') {
         return fieldValue === 'win' || (typeof fieldValue === 'number' && fieldValue > 0);
       }
       
       if (filterValue === 'loss') {
         return fieldValue === 'loss' || (typeof fieldValue === 'number' && fieldValue < 0);
       }
       
       // Exact match
       return fieldValue === filterValue || fieldValue?.toString() === filterValue;
     });
   }
 
   /**
    * Apply sort to array based on field and direction
    */
   private applySort(data: any[], sortField: string, direction: 'asc' | 'desc'): any[] {
     return [...data].sort((a, b) => {
       const aValue = a[sortField];
       const bValue = b[sortField];
       
       // Handle different data types
       if (typeof aValue === 'number' && typeof bValue === 'number') {
         return direction === 'asc' ? aValue - bValue : bValue - aValue;
       }
       
       if (aValue instanceof Date && bValue instanceof Date) {
         return direction === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
       }
       
       // String comparison
       const aStr = aValue?.toString() || '';
       const bStr = bValue?.toString() || '';
       
       if (direction === 'asc') {
         return aStr.localeCompare(bStr);
       } else {
         return bStr.localeCompare(aStr);
       }
     });
   }
 
   /**
    * Merge trades from multiple results
    */
   private mergeTrades(previousResults: any[], indices: number[]): any[] {
     const allTrades: any[] = [];
     
     for (const index of indices) {
       if (index >= 0 && index < previousResults.length) {
         const result = previousResults[index].result;
         const trades = this._extractTrades(result);
         allTrades.push(...trades);
       } else {
         logger.warn(`Invalid index ${index} for merging trades. Available: 0-${previousResults.length - 1}`);
       }
     }
     
     return allTrades;
   }
 
   /**
    * Get unique trades by ID
    */
   private uniqueTradesById(trades: any[]): any[] {
     const seen = new Set<string>();
     return trades.filter(trade => {
       const id = trade.id || trade.tradeId || trade.trade_id;
       if (id && !seen.has(id)) {
         seen.add(id);
         return true;
       }
       return false;
     });
   }
 
   /**
    * Find intersection of trades from multiple results
    */
   private intersectTrades(previousResults: any[], indices: number[]): any[] {
     if (indices.length === 0) return [];
     
     const tradeSets = indices.map(index => {
       if (index >= 0 && index < previousResults.length) {
         const trades = this._extractTrades(previousResults[index].result);
         const tradeMap = new Map();
         trades.forEach((trade: any) => {
           const id = trade.id || trade.tradeId || trade.trade_id;
           if (id) tradeMap.set(id, trade);
         });
         return tradeMap;
       }
       return new Map();
     }).filter(map => map.size > 0);
 
     if (tradeSets.length === 0) return [];
     
     // Find intersection of all sets
     const firstSet = tradeSets[0];
     const intersectionTrades: any[] = [];
     
     Array.from(firstSet.entries()).forEach(([id, trade]) => {
       if (tradeSets.every(set => set.has(id))) {
         intersectionTrades.push(trade);
       }
     });
     
     return intersectionTrades;
   }
   /**
   * Extract trade IDs from various result formats
   */
  private _extractTradeIds(result: any): string[] {
    if (!result) return [];
    
    // Direct array of trade IDs
    if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'string') {
      return result;
    }
    
    // Array of trade objects
    if (Array.isArray(result)) {
      return result.map(trade => trade.id || trade.tradeId || trade.trade_id).filter(Boolean);
    }
    
    // Result object with trades array
    if (result.trades && Array.isArray(result.trades)) {
      return result.trades.map((trade : Trade) => trade.id).filter(Boolean);
    }
    
    // Result object with data.trades array
    if (result.data && result.data.trades && Array.isArray(result.data.trades)) {
      return result.data.trades.map((trade : Trade) => trade.id).filter(Boolean);
    }
    
    // Single trade object
    if (result.id || result.tradeId || result.trade_id) {
      return [result.id || result.tradeId || result.trade_id];
    }
    
    logger.warn('Could not extract trade IDs from result:', Object.keys(result));
    return [];
  }

  /**
   * Extract trades array from various result formats
   */
  private _extractTrades(result: any): any[] {
    if (!result) return [];
    
    // Direct array of trades
    if (Array.isArray(result)) {
      return result;
    }
    
    // Result object with trades array
    if (result.trades && Array.isArray(result.trades)) {
      return result.trades;
    }
    
    // Result object with data.trades array
    if (result.data && result.data.trades && Array.isArray(result.data.trades)) {
      return result.data.trades;
    }
    
    // Single trade object
    if (result.id || result.tradeId || result.trade_id) {
      return [result];
    }
    
    logger.warn('Could not extract trades from result:', Object.keys(result));
    return [];
  }
  
  /**
   * Parse indices from placeholder string (e.g., "MERGE_TRADE_IDS_0_1_2" -> [0, 1, 2])
   */
  private parseIndices(value: string, prefix: string): number[] {
    const indicesStr = value.replace(prefix, '');
    return indicesStr.split('_').map(s => parseInt(s)).filter(n => !isNaN(n));
  }

  /**
   * Merge trade IDs from multiple results
   */
  private mergeTradeIds(previousResults: any[], indices: number[]): string[] {
    const allTradeIds: string[] = [];
    
    for (const index of indices) {
      if (index >= 0 && index < previousResults.length) {
        const result = previousResults[index].result;
        const tradeIds = this._extractTradeIds(result);
        allTradeIds.push(...tradeIds);
      } else {
        logger.warn(`Invalid index ${index} for merging trade IDs. Available: 0-${previousResults.length - 1}`);
      }
    }
    
    return allTradeIds;
  }

  /**
   * Find intersection of trade IDs from multiple results
   */
  private intersectTradeIds(previousResults: any[], indices: number[]): string[] {
    if (indices.length === 0) return [];
    
    const tradeSets = indices.map(index => {
      if (index >= 0 && index < previousResults.length) {
        const tradeIds = this._extractTradeIds(previousResults[index].result);
        return new Set(tradeIds);
      }
      return new Set<string>();
    }).filter(set => set.size > 0);

    if (tradeSets.length === 0) return [];
    
    // Find intersection of all sets
    const firstSet = tradeSets[0];
    const intersection: string[] = [];
    
    for (const id of Array.from(firstSet)) {
      if (tradeSets.every(set => set.has(id))) {
        intersection.push(id);
      }
    }
    
    return intersection;
  }

 
    async getAvailablePlaceholderPatterns(params: { category?: string } = {}): Promise<TradingAnalysisResult> {
      try {
        const { category = 'all' } = params;
  
        const patterns = {
          core: {
            description: "Basic result passing between functions - use these for most workflows",
            patterns: [
              {
                pattern: "LAST_RESULT",
                example: "LAST_RESULT",
                description: "Complete result from the previous function",
                usage: "Use when you need the entire result object from the previous function"
              },
              {
                pattern: "RESULT_{index}",
                example: "RESULT_0, RESULT_1",
                description: "Result from specific function by index (0-based)",
                usage: "Use when you need result from a specific function, not just the previous one"
              },
              {
                pattern: "EXTRACT_TRADES",
                example: "EXTRACT_TRADES",
                description: "Extract trades array from previous result",
                usage: "Use when previous function returned an object with trades array"
              },
              {
                pattern: "EXTRACT_TRADE_IDS",
                example: "EXTRACT_TRADE_IDS",
                description: "Extract trade IDs from previous result's trades array",
                usage: "Use when you need just the trade IDs for the next function"
              }
            ]
          },
          extraction: {
            description: "Extract specific data from function results using indices and field paths",
            patterns: [
              {
                pattern: "EXTRACT_TRADE_IDS_{index}",
                example: "EXTRACT_TRADE_IDS_0, EXTRACT_TRADE_IDS_2",
                description: "Trade IDs from specific result by index",
                usage: "Use when you need trade IDs from a specific function result, not the last one"
              },
              {
                pattern: "EXTRACT_TRADES_{index}",
                example: "EXTRACT_TRADES_1, EXTRACT_TRADES_3",
                description: "Trades array from specific result by index",
                usage: "Use when you need trades from a specific function result"
              },
              {
                pattern: "EXTRACT_{index}.{field.path}",
                example: "EXTRACT_0.trades.id, EXTRACT_1.statistics.winRate, EXTRACT_2.data.symbols",
                description: "Extract nested field using dot notation from specific result",
                usage: "Use when you need a specific field from a nested object structure"
              },
              {
                pattern: "EXTRACT_LAST.{field.path}",
                example: "EXTRACT_LAST.statistics.winRate, EXTRACT_LAST.data.count",
                description: "Extract nested field from the last result",
                usage: "Use when you need a specific field from the previous function's result"
              }
            ]
          },
          arrays: {
            description: "Combine, deduplicate, or find intersections of data from multiple function results",
            patterns: [
              {
                pattern: "MERGE_TRADE_IDS_{index}_{index}",
                example: "MERGE_TRADE_IDS_0_1, MERGE_TRADE_IDS_0_1_2",
                description: "Merge trade IDs from multiple results (can use multiple indices)",
                usage: "Use when you want to combine trade IDs from different function results"
              },
              {
                pattern: "UNIQUE_TRADE_IDS_{index}_{index}",
                example: "UNIQUE_TRADE_IDS_0_1, UNIQUE_TRADE_IDS_1_2_3",
                description: "Get unique trade IDs across multiple results",
                usage: "Use when you want to remove duplicates from merged trade IDs"
              },
              {
                pattern: "INTERSECT_TRADE_IDS_{index}_{index}",
                example: "INTERSECT_TRADE_IDS_0_1, INTERSECT_TRADE_IDS_1_2",
                description: "Find common trade IDs between multiple results",
                usage: "Use when you want to find trades that appear in multiple result sets"
              },
              {
                pattern: "MERGE_TRADES_{index}_{index}",
                example: "MERGE_TRADES_0_1, MERGE_TRADES_0_2_3",
                description: "Merge trade objects from multiple results",
                usage: "Use when you want to combine actual trade objects (not just IDs)"
              },
              {
                pattern: "UNIQUE_TRADES_{index}_{index}",
                example: "UNIQUE_TRADES_0_1, UNIQUE_TRADES_1_2",
                description: "Get unique trade objects by ID across multiple results",
                usage: "Use when you want to remove duplicate trades from merged results"
              },
              {
                pattern: "INTERSECT_TRADES_{index}_{index}",
                example: "INTERSECT_TRADES_0_1, INTERSECT_TRADES_0_2",
                description: "Find common trade objects between multiple results",
                usage: "Use when you want to find actual trade objects that appear in multiple result sets"
              }
            ]
          },
          transformations: {
            description: "Transform data by slicing, filtering, or sorting arrays from function results",
            patterns: [
              {
                pattern: "SLICE_{index}.{field}.{start}.{end}",
                example: "SLICE_0.trades.0.5, SLICE_LAST.trades.10.20",
                description: "Take a slice of an array from start to end index",
                usage: "Use when you want to limit results (e.g., first 5 trades, trades 10-20)"
              },
              {
                pattern: "FILTER_{index}.{field}.{property}.{value}",
                example: "FILTER_0.trades.type.win, FILTER_1.trades.amount.>100",
                description: "Filter array items by property value. Supports operators: >, <, >=, <=, ==, !=. Special values: 'win', 'loss'",
                usage: "Use when you want to filter results by specific criteria"
              },
              {
                pattern: "SORT_{index}.{field}.{property}.{direction}",
                example: "SORT_0.trades.amount.desc, SORT_1.trades.date.asc",
                description: "Sort array by property in ascending (asc) or descending (desc) order",
                usage: "Use when you want to order results by a specific field"
              }
            ]
          },
          conditions: {
            description: "Conditional execution patterns for the 'condition' field in function calls",
            patterns: [
              {
                pattern: "RESULT_{index}.{field} {operator} {value}",
                example: "RESULT_0.count > 10, RESULT_1.winRate >= 0.6",
                description: "Compare field from specific result with a value",
                usage: "Use in 'condition' field to execute function only if condition is met"
              },
              {
                pattern: "LAST_RESULT.{field} {operator} {value}",
                example: "LAST_RESULT.trades.length > 5, LAST_RESULT.success === true",
                description: "Compare field from last result with a value",
                usage: "Use in 'condition' field to check previous function's result"
              },
              {
                pattern: "Complex conditions",
                example: "RESULT_0.count > 10 && RESULT_1.winRate > 0.5",
                description: "Combine multiple conditions with && (and) or || (or)",
                usage: "Use for complex conditional logic"
              }
            ]
          }
        };
  
        // Return filtered patterns or all patterns
        const result = category === 'all' ? patterns : { [category]: patterns[category as keyof typeof patterns] };
  
        if (category !== 'all' && !patterns[category as keyof typeof patterns]) {
          return {
            success: false,
            error: `Unknown category: ${category}. Available categories: ${Object.keys(patterns).join(', ')}, all`
          };
        }
  
        return {
          success: true,
          data: {
            category: category,
            availableCategories: Object.keys(patterns),
            patterns: result,
            usage: "Use these patterns as string values in your executeMultipleFunctions arguments. Replace {index} with actual numbers (0, 1, 2, etc.) and {field.path} with dot notation like 'trades.id' or 'statistics.winRate'."
          }
        };
  
      } catch (error) {
        logger.error('Error getting placeholder patterns:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error getting placeholder patterns'
        };
      }
    }
}