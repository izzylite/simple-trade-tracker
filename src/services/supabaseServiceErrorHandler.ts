/**
 * Service-Level Supabase Error Handler
 *
 * Provides high-level error handling utilities for services that directly use Supabase client.
 * Includes automatic retry logic, structured error responses, and operation tracking.
 *
 * @example
 * ```typescript
 * import { executeSupabaseQuery, executeSupabaseFunction } from './supabaseServiceErrorHandler';
 *
 * // Database query with retry
 * const result = await executeSupabaseQuery(
 *   supabase.from('trades').select('*').eq('user_id', userId),
 *   'Fetch User Trades',
 *   { retryAttempts: 2, context: 'Loading user dashboard' }
 * );
 *
 * // Edge Function call with retry
 * const funcResult = await executeSupabaseFunction(
 *   'update-tag',
 *   { calendarId, oldTag, newTag },
 *   supabase,
 *   { retryAttempts: 2 }
 * );
 * ```
 *
 * @see {@link docs/ERROR_HANDLING_GUIDE.md} for detailed usage patterns
 * @see {@link docs/SERVICE_LAYER_DOCUMENTATION.md} for service integration
 */

import { 
  SupabaseError, 
  SupabaseErrorCategory, 
  parseSupabaseError, 
  logSupabaseError, 
  getErrorRecoveryStrategy 
} from '../utils/supabaseErrorHandler';
import { logger } from '../utils/logger';

/**
 * Service operation result with enhanced error handling
 */
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: SupabaseError;
  operation?: string;
  timestamp: Date;
}

/**
 * Service operation configuration
 */
export interface ServiceOperationConfig {
  retryAttempts?: number;
  retryDelay?: number;
  logErrors?: boolean;
  context?: string;
}

/**
 * Default service operation configuration
 */
const DEFAULT_CONFIG: Required<ServiceOperationConfig> = {
  retryAttempts: 3,
  retryDelay: 1000,
  logErrors: true,
  context: 'Service operation'
};

/**
 * Execute a Supabase operation with error handling and retry logic
 */
export async function executeSupabaseOperation<T>(
  operation: () => Promise<T>,
  operationType: string,
  config: ServiceOperationConfig = {}
): Promise<ServiceResult<T>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: any = null;

  for (let attempt = 1; attempt <= finalConfig.retryAttempts; attempt++) {
    try {
      const data = await operation();
      return {
        success: true,
        data,
        operation: operationType,
        timestamp: new Date()
      };
    } catch (error) {
      lastError = error;
      const parsedError = parseSupabaseError(error, finalConfig.context);
      
      if (finalConfig.logErrors) {
        logSupabaseError(parsedError, operationType);
      }

      // Check if error is retryable and we have attempts left
      const recoveryStrategy = getErrorRecoveryStrategy(parsedError);
      const shouldRetry = recoveryStrategy.shouldRetry && attempt < finalConfig.retryAttempts;
      
      if (shouldRetry) {
        const delay = recoveryStrategy.retryDelay || (finalConfig.retryDelay * attempt);
        logger.info(`Retrying ${operationType} in ${delay}ms (attempt ${attempt + 1}/${finalConfig.retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Return error result
        return {
          success: false,
          error: parsedError,
          operation: operationType,
          timestamp: new Date()
        };
      }
    }
  }

  // Final fallback - should not reach here but handle gracefully
  const finalError = parseSupabaseError(lastError, finalConfig.context);
  return {
    success: false,
    error: finalError,
    operation: operationType,
    timestamp: new Date()
  };
}

/**
 * Execute a Supabase query with error handling
 */
export async function executeSupabaseQuery<T>(
  queryBuilder: any,
  operationType: string,
  config: ServiceOperationConfig = {}
): Promise<ServiceResult<T>> {
  return executeSupabaseOperation(async () => {
    const { data, error } = await queryBuilder;
    
    if (error) {
      throw error;
    }
    
    return data as T;
  }, operationType, config);
}

/**
 * Execute a Supabase Edge Function with error handling
 */
export async function executeSupabaseFunction<T>(
  functionName: string,
  payload: any,
  supabaseClient: any,
  config: ServiceOperationConfig = {}
): Promise<ServiceResult<T>> {
  return executeSupabaseOperation(async () => {
    const { data, error } = await supabaseClient.functions.invoke(functionName, {
      body: payload
    });
    
    if (error) {
      throw error;
    }
    
    return data as T;
  }, `Edge Function: ${functionName}`, config);
}

/**
 * Execute a Supabase Storage operation with error handling
 */
export async function executeSupabaseStorageOperation<T>(
  operation: () => Promise<{ data: T; error: any }>,
  operationType: string,
  config: ServiceOperationConfig = {}
): Promise<ServiceResult<T>> {
  return executeSupabaseOperation(async () => {
    const { data, error } = await operation();
    
    if (error) {
      throw error;
    }
    
    return data;
  }, operationType, config);
}

/**
 * Execute a Supabase Auth operation with error handling
 */
export async function executeSupabaseAuthOperation<T>(
  operation: () => Promise<{ data: T; error: any }>,
  operationType: string,
  config: ServiceOperationConfig = {}
): Promise<ServiceResult<T>> {
  return executeSupabaseOperation(async () => {
    const { data, error } = await operation();
    
    if (error) {
      throw error;
    }
    
    return data;
  }, operationType, config);
}

/**
 * Handle Supabase real-time subscription errors
 */
export function handleSupabaseSubscriptionError(
  error: any,
  subscriptionName: string,
  onError?: (error: SupabaseError) => void
): void {
  const parsedError = parseSupabaseError(error, `Real-time subscription: ${subscriptionName}`);
  logSupabaseError(parsedError, `Subscription: ${subscriptionName}`);
  
  if (onError) {
    onError(parsedError);
  }
}

/**
 * Create a standardized error response for API endpoints
 */
export function createErrorResponse(error: SupabaseError, statusCode: number = 500): {
  error: {
    code: string;
    message: string;
    category: string;
    severity: string;
    timestamp: string;
  };
  statusCode: number;
} {
  return {
    error: {
      code: error.code,
      message: error.userMessage,
      category: error.category,
      severity: error.severity,
      timestamp: error.timestamp.toISOString()
    },
    statusCode
  };
}

/**
 * Utility to check if a service result is successful
 */
export function isServiceResultSuccess<T>(result: ServiceResult<T>): result is ServiceResult<T> & { success: true; data: T } {
  return result.success && result.data !== undefined;
}

/**
 * Utility to extract data from service result or throw error
 */
export function getServiceResultData<T>(result: ServiceResult<T>): T {
  if (isServiceResultSuccess(result)) {
    return result.data;
  }
  
  throw new Error(result.error?.userMessage || 'Service operation failed');
}

/**
 * Utility to handle service result with callbacks
 */
export function handleServiceResult<T>(
  result: ServiceResult<T>,
  onSuccess: (data: T) => void,
  onError: (error: SupabaseError) => void
): void {
  if (isServiceResultSuccess(result)) {
    onSuccess(result.data);
  } else if (result.error) {
    onError(result.error);
  }
}
