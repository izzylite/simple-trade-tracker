/**
 * Base Repository Interface
 * Defines the contract for all data repositories using Supabase
 */

import { BaseEntity } from '../../../types/dualWrite';
import { SupabaseError, SupabaseErrorCategory } from '../../../utils/supabaseErrorHandler';

/**
 * Configuration for repository operations
 */
export interface RepositoryConfig {
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
}

/**
 * Enhanced result of a repository operation with Supabase error handling
 */
export interface RepositoryResult<T = any> {
  success: boolean;
  data?: T;
  error?: SupabaseError;
  operation?: string;
  timestamp: Date;
}

/**
 * Legacy result interface for backward compatibility
 */
export interface LegacyRepositoryResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Base repository interface for CRUD operations
 */
export interface BaseRepository<T extends BaseEntity> {
  // Read operations
  findById(id: string): Promise<T | null>;
  findByUserId(userId: string): Promise<T[]>;
  findAll(): Promise<T[]>;

  // Write operations
  create(entity: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<RepositoryResult<T>>;
  update(id: string, updates: Partial<T>): Promise<RepositoryResult<T>>;
  delete(id: string): Promise<RepositoryResult<boolean>>;

  // Batch operations
  createMany(entities: Omit<T, 'id' | 'created_at' | 'updated_at'>[]): Promise<RepositoryResult<T[]>>;
  updateMany(updates: Array<{ id: string; updates: Partial<T> }>): Promise<RepositoryResult<T[]>>;
  deleteMany(ids: string[]): Promise<RepositoryResult<boolean>>;

  // Configuration
  setConfig(config: Partial<RepositoryConfig>): void;
  getConfig(): RepositoryConfig;
}

/**
 * Abstract base repository implementation for Supabase
 */
export abstract class AbstractBaseRepository<T extends BaseEntity> implements BaseRepository<T> {
  protected config: RepositoryConfig = {
    retryAttempts: 3,
    retryDelayMs: 1000,
    timeoutMs: 30000
  };

  constructor(config?: Partial<RepositoryConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // Configuration methods
  setConfig(config: Partial<RepositoryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RepositoryConfig {
    return { ...this.config };
  }

  // Abstract methods that must be implemented by concrete repositories
  abstract findById(id: string): Promise<T | null>;
  abstract findByUserId(userId: string): Promise<T[]>;
  abstract findAll(): Promise<T[]>;

  // Abstract write methods for Supabase
  protected abstract createInSupabase(entity: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  protected abstract updateInSupabase(id: string, updates: Partial<T>): Promise<T>;
  protected abstract deleteInSupabase(id: string): Promise<boolean>;

  // Supabase-only implementation with enhanced error handling
  async create(entity: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<RepositoryResult<T>> {
    return await this.withRetryAndErrorHandling(async () => {
      const data = await this.createInSupabase(entity);
      return { success: true, data, timestamp: new Date(), operation: 'create' };
    }, 'create', `Creating ${this.constructor.name.replace('Repository', '').toLowerCase()}`);
  }

  async update(id: string, updates: Partial<T>): Promise<RepositoryResult<T>> {
    return await this.withRetryAndErrorHandling(async () => {
      const data = await this.updateInSupabase(id, updates);
      return { success: true, data, timestamp: new Date(), operation: 'update' };
    }, 'update', `Updating ${this.constructor.name.replace('Repository', '').toLowerCase()} ${id}`);
  }

  async delete(id: string): Promise<RepositoryResult<boolean>> {
    return await this.withRetryAndErrorHandling(async () => {
      const data = await this.deleteInSupabase(id);
      return { success: true, data, timestamp: new Date(), operation: 'delete' };
    }, 'delete', `Deleting ${this.constructor.name.replace('Repository', '').toLowerCase()} ${id}`);
  }

  // Default implementations for batch operations (can be overridden)
  async createMany(entities: Omit<T, 'id' | 'created_at' | 'updated_at'>[]): Promise<RepositoryResult<T[]>> {
    const results = await Promise.all(entities.map(entity => this.create(entity)));

    const successfulResults = results.filter(r => r.success);
    const allData = successfulResults.map(r => r.data).filter(Boolean) as T[];

    return {
      success: successfulResults.length === entities.length,
      data: allData,
      error: successfulResults.length === 0 ?
        (await import('../../../utils/supabaseErrorHandler')).parseSupabaseError(
          new Error('All batch create operations failed'),
          'Batch create operation'
        ) : undefined,
      timestamp: new Date(),
      operation: 'createMany'
    };
  }

  async updateMany(updates: { id: string; updates: Partial<T> }[]): Promise<RepositoryResult<T[]>> {
    const results = await Promise.all(updates.map(update => this.update(update.id, update.updates)));

    const successfulResults = results.filter(r => r.success);
    const allData = successfulResults.map(r => r.data).filter(Boolean) as T[];

    return {
      success: successfulResults.length === updates.length,
      data: allData,
      error: successfulResults.length === 0 ?
        (await import('../../../utils/supabaseErrorHandler')).parseSupabaseError(
          new Error('All batch update operations failed'),
          'Batch update operation'
        ) : undefined,
      timestamp: new Date(),
      operation: 'updateMany'
    };
  }

  async deleteMany(ids: string[]): Promise<RepositoryResult<boolean>> {
    const results = await Promise.all(ids.map(id => this.delete(id)));

    const successfulResults = results.filter(r => r.success);

    return {
      success: successfulResults.length > 0,
      data: true,
      error: successfulResults.length === 0 ?
        (await import('../../../utils/supabaseErrorHandler')).parseSupabaseError(
          new Error('All batch delete operations failed'),
          'Batch delete operation'
        ) : undefined,
      timestamp: new Date(),
      operation: 'deleteMany'
    };
  }



  // Enhanced utility method for retry logic with Supabase error handling
  protected async withRetryAndErrorHandling<T>(
    operation: () => Promise<T>,
    operationType: string,
    context: string
  ): Promise<T> {
    const { handleSupabaseError, getErrorRecoveryStrategy } = await import('../../../utils/supabaseErrorHandler');
    let lastError: any = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const parsedError = handleSupabaseError(error, context, operationType);

        // Check if error is retryable and we have attempts left
        const recoveryStrategy = getErrorRecoveryStrategy(parsedError);
        const shouldRetry = recoveryStrategy.shouldRetry && attempt < this.config.retryAttempts;

        if (shouldRetry) {
          const delay = recoveryStrategy.retryDelay || (this.config.retryDelayMs * attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Return error result instead of throwing
          return {
            success: false,
            error: parsedError,
            timestamp: new Date(),
            operation: operationType
          } as T;
        }
      }
    }

    // Final fallback - should not reach here but handle gracefully
    const finalError = handleSupabaseError(lastError, context, operationType);
    return {
      success: false,
      error: finalError,
      timestamp: new Date(),
      operation: operationType
    } as T;
  }

  // Legacy utility method for backward compatibility
  protected async withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`${context} failed on attempt ${attempt}/${this.config.retryAttempts}:`, error);

        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * attempt));
        }
      }
    }

    throw lastError || new Error(`${context} failed after ${this.config.retryAttempts} attempts`);
  }
}
