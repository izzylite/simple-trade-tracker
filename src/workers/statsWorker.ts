/**
 * Stats Worker
 *
 * Web Worker for calculating statistics like max drawdown off the main thread.
 */

import { createInlineWorker, WorkerManager } from './utils/workerManager';
import type { Trade } from '../types/dualWrite';

export interface CalculateMaxDrawdownRequest {
  trades: Trade[];
}

export interface CalculateMaxDrawdownResponse {
  max_drawdown: number;
  drawdown_start_date?: string; // ISO string
  drawdown_end_date?: string; // ISO string
  drawdown_recovery_needed: number;
  drawdown_duration: number;
}

/**
 * Worker code for stats calculations
 * IMPORTANT: No external dependencies, all logic inlined
 */
const STATS_WORKER_CODE = `
// ============================================================================
// Max Drawdown Calculation
// ============================================================================

function calculateMaxDrawdown(trades) {
  if (trades.length === 0) {
    return {
      max_drawdown: 0,
      drawdown_recovery_needed: 0,
      drawdown_duration: 0
    };
  }

  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) =>
    new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let drawdown_start_date;
  let drawdown_end_date;
  let currentDrawdownStartDate;
  let drawdownDuration = 0;

  sortedTrades.forEach(trade => {
    balance += trade.amount;

    if (balance > peak) {
      peak = balance;
      currentDrawdownStartDate = undefined;
    } else if (peak > 0) {
      const drawdown = (peak - balance) / peak * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        drawdown_start_date = currentDrawdownStartDate || trade.trade_date;
        drawdown_end_date = trade.trade_date;

        // Calculate drawdown duration (number of trades)
        if (drawdown_start_date && drawdown_end_date) {
          const startIndex = sortedTrades.findIndex(t => t.trade_date === drawdown_start_date);
          const endIndex = sortedTrades.findIndex(t => t.trade_date === drawdown_end_date);
          if (startIndex !== -1 && endIndex !== -1) {
            drawdownDuration = endIndex - startIndex + 1;
          } else {
            drawdownDuration = 1;
          }
        } else {
          drawdownDuration = 1;
        }
      }

      if (!currentDrawdownStartDate) {
        currentDrawdownStartDate = trade.trade_date;
      }
    }
  });

  // Calculate recovery needed
  const drawdownRecoveryNeeded = maxDrawdown > 0
    ? (maxDrawdown / (100 - maxDrawdown)) * 100
    : 0;

  return {
    max_drawdown: maxDrawdown,
    drawdown_start_date,
    drawdown_end_date,
    drawdown_recovery_needed: drawdownRecoveryNeeded,
    drawdown_duration: drawdownDuration
  };
}

// ============================================================================
// Message Handler
// ============================================================================

self.addEventListener('message', (event) => {
  const request = event.data;

  try {
    if (request.type === 'CALCULATE_MAX_DRAWDOWN') {
      const { trades } = request.payload;

      const result = calculateMaxDrawdown(trades);

      const response = {
        id: request.id,
        type: request.type,
        payload: result
      };

      self.postMessage(response);
    } else {
      throw new Error('Unknown request type: ' + request.type);
    }
  } catch (error) {
    const response = {
      id: request.id,
      type: request.type,
      error: {
        message: error.message,
        stack: error.stack
      }
    };

    self.postMessage(response);
  }
});
`;

// ============================================================================
// Worker Manager Instance
// ============================================================================

let statsWorkerManager: WorkerManager | null = null;

/**
 * Get or create the stats worker manager instance (singleton)
 */
function getStatsWorkerManager(): WorkerManager {
  if (!statsWorkerManager) {
    statsWorkerManager = new WorkerManager(() => createInlineWorker(STATS_WORKER_CODE));
  }
  return statsWorkerManager;
}

/**
 * Calculate max drawdown using Web Worker
 */
export async function calculateMaxDrawdownInWorker(
  trades: Trade[]
): Promise<{
  max_drawdown: number;
  drawdown_start_date?: Date;
  drawdown_end_date?: Date;
  drawdown_recovery_needed: number;
  drawdown_duration: number;
}> {
  const manager = getStatsWorkerManager();

  const request: CalculateMaxDrawdownRequest = { trades };

  const response = await manager.request<
    CalculateMaxDrawdownRequest,
    CalculateMaxDrawdownResponse
  >('CALCULATE_MAX_DRAWDOWN', request);

  // Convert date strings back to Date objects
  return {
    ...response,
    drawdown_start_date: response.drawdown_start_date
      ? new Date(response.drawdown_start_date)
      : undefined,
    drawdown_end_date: response.drawdown_end_date
      ? new Date(response.drawdown_end_date)
      : undefined
  };
}

/**
 * Terminate the stats worker (cleanup)
 */
export function terminateStatsWorker(): void {
  if (statsWorkerManager) {
    statsWorkerManager.terminate();
    statsWorkerManager = null;
  }
}

/**
 * Check if stats worker is active
 */
export function isStatsWorkerActive(): boolean {
  return statsWorkerManager?.isActive() ?? false;
}
