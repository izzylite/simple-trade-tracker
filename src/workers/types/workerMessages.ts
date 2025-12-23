/**
 * Worker Message Types
 *
 * Type definitions for communication between main thread and Web Workers.
 * All data must be serializable (no functions, Date objects converted to strings).
 */

import type { Trade } from '../../types/dualWrite';
import type { TimePeriod, ChartDataPoint } from '../../utils/chartDataUtils';

// ============================================================================
// Base Message Types
// ============================================================================

export interface WorkerRequest<T = unknown> {
  id: string;
  type: string;
  payload: T;
}

export interface WorkerResponse<T = unknown> {
  id: string;
  type: string;
  payload?: T;
  error?: {
    message: string;
    stack?: string;
  };
}

// ============================================================================
// Chart Worker Messages
// ============================================================================

export interface CalculateChartDataRequest {
  trades: Trade[];
  selectedDate: string; // ISO string, not Date object
  timePeriod: TimePeriod;
}

export interface CalculateChartDataResponse {
  chartData: ChartDataPoint[];
}

// ============================================================================
// Tag Pattern Worker Messages (Future)
// ============================================================================

export interface GenerateTagCombinationsRequest {
  trades: Trade[];
  minSupport?: number;
}

export interface GenerateTagCombinationsResponse {
  combinations: Array<{
    tags: string[];
    support: number;
    winRate: number;
    totalPnL: number;
  }>;
}

// ============================================================================
// Stats Worker Messages (Future)
// ============================================================================

export interface CalculateMaxDrawdownRequest {
  trades: Trade[];
  accountBalance: number;
}

export interface CalculateMaxDrawdownResponse {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  drawdownPeriod: {
    start: string; // ISO string
    end: string; // ISO string
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isWorkerResponse<T>(message: unknown): message is WorkerResponse<T> {
  return (
    typeof message === 'object' &&
    message !== null &&
    'id' in message &&
    'type' in message
  );
}

export function isErrorResponse(message: WorkerResponse): boolean {
  return message.error !== undefined;
}
