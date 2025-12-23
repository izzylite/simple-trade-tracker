/**
 * Worker Manager Utility
 *
 * Provides a type-safe abstraction for Web Worker communication with:
 * - Promise-based request/response pattern
 * - Automatic cleanup and error handling
 * - Request timeout support
 */

import type { WorkerRequest, WorkerResponse } from '../types/workerMessages';
import { logger } from '../../utils/logger';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

export class WorkerManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private messageIdCounter = 0;

  constructor(private workerFactory: () => Worker) {}

  /**
   * Initialize the worker if not already initialized
   */
  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.addEventListener('message', this.handleMessage);
      this.worker.addEventListener('error', this.handleError);
    }
    return this.worker;
  }

  /**
   * Handle messages from the worker
   */
  private handleMessage = (event: MessageEvent) => {
    const response = event.data as WorkerResponse;

    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      logger.warn('Received response for unknown request ID:', response.id);
      return;
    }

    // Clear timeout
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    // Remove from pending
    this.pendingRequests.delete(response.id);

    // Resolve or reject based on response
    if (response.error) {
      const error = new Error(response.error.message);
      error.stack = response.error.stack;
      pending.reject(error);
    } else {
      pending.resolve(response.payload);
    }
  };

  /**
   * Handle worker errors
   */
  private handleError = (event: ErrorEvent) => {
    logger.error('Worker error:', event.error);

    // Reject all pending requests
    this.pendingRequests.forEach(pending => {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error(`Worker error: ${event.message}`));
    });

    this.pendingRequests.clear();

    // Terminate and null the worker so it can be recreated
    this.terminate();
  };

  /**
   * Send a request to the worker and return a Promise
   */
  async request<TRequest, TResponse>(
    type: string,
    payload: TRequest,
    timeoutMs: number = 30000
  ): Promise<TResponse> {
    const worker = this.ensureWorker();
    const id = `${type}-${++this.messageIdCounter}`;

    return new Promise<TResponse>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Worker request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout
      });

      // Send message to worker
      const request: WorkerRequest<TRequest> = { id, type, payload };
      worker.postMessage(request);
    });
  }

  /**
   * Terminate the worker and clean up
   */
  terminate(): void {
    if (this.worker) {
      this.worker.removeEventListener('message', this.handleMessage);
      this.worker.removeEventListener('error', this.handleError);
      this.worker.terminate();
      this.worker = null;
    }

    // Clear all pending requests
    this.pendingRequests.forEach(pending => {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error('Worker terminated'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Check if worker is active
   */
  isActive(): boolean {
    return this.worker !== null;
  }
}

/**
 * Create a Worker from inline code using Blob URL
 * This avoids needing separate worker files and build configuration
 */
export function createInlineWorker(workerCode: string): Worker {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  // Clean up blob URL after worker is created
  // The worker keeps a reference, so this is safe
  URL.revokeObjectURL(url);

  return worker;
}
