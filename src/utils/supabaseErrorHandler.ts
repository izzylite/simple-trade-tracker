/**
 * Supabase Error Handling Utilities
 *
 * Provides comprehensive error handling for Supabase operations including:
 * - Error categorization and severity assessment
 * - User-friendly error message generation
 * - Retry strategy determination
 * - Structured error logging
 *
 * @example
 * ```typescript
 * import { parseSupabaseError, handleSupabaseError } from './supabaseErrorHandler';
 *
 * try {
 *   const result = await supabase.from('trades').select('*');
 *   if (result.error) throw result.error;
 * } catch (error) {
 *   const parsedError = parseSupabaseError(error, 'Fetching trades');
 *   console.error('Operation failed:', parsedError.userMessage);
 *
 *   if (parsedError.retryable) {
 *     // Implement retry logic based on recovery strategy
 *     const strategy = getErrorRecoveryStrategy(parsedError);
 *     // ... retry implementation
 *   }
 * }
 * ```
 *
 * @see {@link docs/ERROR_HANDLING_GUIDE.md} for detailed usage patterns
 * @see {@link docs/SERVICE_LAYER_DOCUMENTATION.md} for service integration
 */

import { logger } from './logger';

/**
 * Supabase error categories
 */
export enum SupabaseErrorCategory {
  AUTHENTICATION = 'authentication',
  DATABASE = 'database',
  STORAGE = 'storage',
  NETWORK = 'network',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown'
}

/**
 * Supabase error severity levels
 */
export enum SupabaseErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Enhanced error interface for Supabase operations
 */
export interface SupabaseError {
  category: SupabaseErrorCategory;
  severity: SupabaseErrorSeverity;
  code: string;
  message: string;
  userMessage: string;
  details?: any;
  hint?: string;
  context?: string;
  retryable: boolean;
  timestamp: Date;
  originalError?: any;
}

/**
 * Error recovery strategies
 */
export interface ErrorRecoveryStrategy {
  shouldRetry: boolean;
  retryDelay?: number;
  maxRetries?: number;
  fallbackAction?: () => Promise<any>;
}

/**
 * Common Supabase error codes and their mappings
 */
const SUPABASE_ERROR_CODES = {
  // Authentication errors
  'invalid_credentials': {
    category: SupabaseErrorCategory.AUTHENTICATION,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'Invalid email or password. Please check your credentials and try again.',
    retryable: false
  },
  'email_not_confirmed': {
    category: SupabaseErrorCategory.AUTHENTICATION,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'Please check your email and click the confirmation link before signing in.',
    retryable: false
  },
  'token_expired': {
    category: SupabaseErrorCategory.AUTHENTICATION,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'Your session has expired. Please sign in again.',
    retryable: false
  },
  'insufficient_privileges': {
    category: SupabaseErrorCategory.PERMISSION,
    severity: SupabaseErrorSeverity.HIGH,
    userMessage: 'You do not have permission to perform this action.',
    retryable: false
  },

  // Database errors
  'PGRST116': {
    category: SupabaseErrorCategory.PERMISSION,
    severity: SupabaseErrorSeverity.HIGH,
    userMessage: 'Access denied. You do not have permission to access this data.',
    retryable: false
  },
  '23505': {
    category: SupabaseErrorCategory.DATABASE,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'This item already exists. Please use a different name or identifier.',
    retryable: false
  },
  '23503': {
    category: SupabaseErrorCategory.DATABASE,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'Cannot delete this item because it is referenced by other data.',
    retryable: false
  },
  '23502': {
    category: SupabaseErrorCategory.VALIDATION,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'Required information is missing. Please fill in all required fields.',
    retryable: false
  },

  // Storage errors
  'storage_object_not_found': {
    category: SupabaseErrorCategory.STORAGE,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'The requested file could not be found.',
    retryable: false
  },
  'storage_file_too_large': {
    category: SupabaseErrorCategory.STORAGE,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'The file is too large. Please choose a smaller file.',
    retryable: false
  },
  'storage_invalid_mime_type': {
    category: SupabaseErrorCategory.STORAGE,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'Invalid file type. Please choose a supported file format.',
    retryable: false
  },

  // Network errors
  'network_error': {
    category: SupabaseErrorCategory.NETWORK,
    severity: SupabaseErrorSeverity.HIGH,
    userMessage: 'Network connection error. Please check your internet connection and try again.',
    retryable: true
  },
  'timeout': {
    category: SupabaseErrorCategory.NETWORK,
    severity: SupabaseErrorSeverity.MEDIUM,
    userMessage: 'The request timed out. Please try again.',
    retryable: true
  },
  'rate_limit_exceeded': {
    category: SupabaseErrorCategory.RATE_LIMIT,
    severity: SupabaseErrorSeverity.HIGH,
    userMessage: 'Too many requests. Please wait a moment and try again.',
    retryable: true
  }
} as const;

/**
 * Parse and categorize Supabase errors
 */
export function parseSupabaseError(error: any, context?: string): SupabaseError {
  const timestamp = new Date();
  
  // Handle null or undefined errors
  if (!error) {
    return {
      category: SupabaseErrorCategory.UNKNOWN,
      severity: SupabaseErrorSeverity.LOW,
      code: 'unknown_error',
      message: 'An unknown error occurred',
      userMessage: 'Something went wrong. Please try again.',
      retryable: true,
      timestamp,
      context
    };
  }

  // Extract error information
  const errorCode = error.code || error.error_code || 'unknown';
  const errorMessage = error.message || error.error_description || 'Unknown error';
  const errorDetails = error.details || error.error_details;
  const errorHint = error.hint;

  // Look up error code mapping
  const errorMapping = SUPABASE_ERROR_CODES[errorCode as keyof typeof SUPABASE_ERROR_CODES];

  if (errorMapping) {
    return {
      category: errorMapping.category,
      severity: errorMapping.severity,
      code: errorCode,
      message: errorMessage,
      userMessage: errorMapping.userMessage,
      details: errorDetails,
      hint: errorHint,
      context,
      retryable: errorMapping.retryable,
      timestamp,
      originalError: error
    };
  }

  // Categorize unknown errors based on message content
  const category = categorizeErrorByMessage(errorMessage);
  const severity = determineSeverity(category, errorMessage);
  const userMessage = generateUserMessage(category, errorMessage);
  const retryable = isRetryable(category, errorCode);

  return {
    category,
    severity,
    code: errorCode,
    message: errorMessage,
    userMessage,
    details: errorDetails,
    hint: errorHint,
    context,
    retryable,
    timestamp,
    originalError: error
  };
}

/**
 * Categorize error based on message content
 */
function categorizeErrorByMessage(message: string): SupabaseErrorCategory {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('auth') || lowerMessage.includes('token') || lowerMessage.includes('session')) {
    return SupabaseErrorCategory.AUTHENTICATION;
  }
  if (lowerMessage.includes('permission') || lowerMessage.includes('access') || lowerMessage.includes('forbidden')) {
    return SupabaseErrorCategory.PERMISSION;
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('timeout')) {
    return SupabaseErrorCategory.NETWORK;
  }
  if (lowerMessage.includes('storage') || lowerMessage.includes('file') || lowerMessage.includes('upload')) {
    return SupabaseErrorCategory.STORAGE;
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || lowerMessage.includes('required')) {
    return SupabaseErrorCategory.VALIDATION;
  }
  if (lowerMessage.includes('rate') || lowerMessage.includes('limit') || lowerMessage.includes('quota')) {
    return SupabaseErrorCategory.RATE_LIMIT;
  }

  return SupabaseErrorCategory.DATABASE;
}

/**
 * Determine error severity
 */
function determineSeverity(category: SupabaseErrorCategory, message: string): SupabaseErrorSeverity {
  switch (category) {
    case SupabaseErrorCategory.AUTHENTICATION:
    case SupabaseErrorCategory.PERMISSION:
      return SupabaseErrorSeverity.HIGH;
    case SupabaseErrorCategory.NETWORK:
    case SupabaseErrorCategory.RATE_LIMIT:
      return SupabaseErrorSeverity.MEDIUM;
    case SupabaseErrorCategory.VALIDATION:
    case SupabaseErrorCategory.STORAGE:
      return SupabaseErrorSeverity.MEDIUM;
    case SupabaseErrorCategory.DATABASE:
      return message.toLowerCase().includes('constraint') ? SupabaseErrorSeverity.MEDIUM : SupabaseErrorSeverity.HIGH;
    default:
      return SupabaseErrorSeverity.LOW;
  }
}

/**
 * Generate user-friendly error message
 */
function generateUserMessage(category: SupabaseErrorCategory, message: string): string {
  switch (category) {
    case SupabaseErrorCategory.AUTHENTICATION:
      return 'Authentication failed. Please sign in again.';
    case SupabaseErrorCategory.PERMISSION:
      return 'You do not have permission to perform this action.';
    case SupabaseErrorCategory.NETWORK:
      return 'Network connection error. Please check your internet connection and try again.';
    case SupabaseErrorCategory.STORAGE:
      return 'File operation failed. Please try again or choose a different file.';
    case SupabaseErrorCategory.VALIDATION:
      return 'Invalid data provided. Please check your input and try again.';
    case SupabaseErrorCategory.RATE_LIMIT:
      return 'Too many requests. Please wait a moment and try again.';
    case SupabaseErrorCategory.DATABASE:
      return 'Database operation failed. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Determine if error is retryable
 */
function isRetryable(category: SupabaseErrorCategory, code: string): boolean {
  switch (category) {
    case SupabaseErrorCategory.NETWORK:
    case SupabaseErrorCategory.RATE_LIMIT:
      return true;
    case SupabaseErrorCategory.AUTHENTICATION:
    case SupabaseErrorCategory.PERMISSION:
    case SupabaseErrorCategory.VALIDATION:
      return false;
    case SupabaseErrorCategory.DATABASE:
      // Some database errors are retryable (timeouts, connection issues)
      return code.includes('timeout') || code.includes('connection');
    case SupabaseErrorCategory.STORAGE:
      // Storage errors are generally not retryable unless network-related
      return code.includes('network') || code.includes('timeout');
    default:
      return false;
  }
}

/**
 * Get error recovery strategy
 */
export function getErrorRecoveryStrategy(error: SupabaseError): ErrorRecoveryStrategy {
  if (!error.retryable) {
    return { shouldRetry: false };
  }

  switch (error.category) {
    case SupabaseErrorCategory.NETWORK:
      return {
        shouldRetry: true,
        retryDelay: 1000,
        maxRetries: 3
      };
    case SupabaseErrorCategory.RATE_LIMIT:
      return {
        shouldRetry: true,
        retryDelay: 5000,
        maxRetries: 2
      };
    case SupabaseErrorCategory.DATABASE:
      return {
        shouldRetry: true,
        retryDelay: 500,
        maxRetries: 2
      };
    default:
      return {
        shouldRetry: true,
        retryDelay: 1000,
        maxRetries: 1
      };
  }
}

/**
 * Log Supabase error with proper context
 */
export function logSupabaseError(error: SupabaseError, operation?: string): void {
  const logContext = {
    operation,
    category: error.category,
    severity: error.severity,
    code: error.code,
    context: error.context,
    retryable: error.retryable,
    timestamp: error.timestamp.toISOString()
  };

  // Add special logging for authentication errors to help debug token issues
  if (error.category === SupabaseErrorCategory.AUTHENTICATION) {
    logger.error(`🔐 AUTHENTICATION ERROR DETECTED:`, {
      ...logContext,
      userMessage: error.userMessage,
      hint: error.hint,
      details: error.details,
      originalError: error.originalError
    });
    logger.error(`📝 This error occurred during: ${operation || 'unknown operation'}`);
    logger.error(`💡 Suggestion: Check if token auto-refresh is working properly. Look for "TOKEN_REFRESHED" events in console.`);
    logger.error(`⚠️ This might happen after tab switching if session is not ready. Session should auto-refresh and retry.`);
    return;
  }

  switch (error.severity) {
    case SupabaseErrorSeverity.CRITICAL:
    case SupabaseErrorSeverity.HIGH:
      logger.error(`Supabase ${error.category} error: ${error.message}`, logContext);
      break;
    case SupabaseErrorSeverity.MEDIUM:
      logger.warn(`Supabase ${error.category} error: ${error.message}`, logContext);
      break;
    default:
      logger.info(`Supabase ${error.category} error: ${error.message}`, logContext);
      break;
  }
}

/**
 * Handle Supabase error with logging and recovery strategy
 */
export function handleSupabaseError(error: any, context?: string, operation?: string): SupabaseError {
  const parsedError = parseSupabaseError(error, context);
  logSupabaseError(parsedError, operation);
  return parsedError;
}
