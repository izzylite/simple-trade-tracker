/**
 * useChartWorker Hook
 *
 * React hook for using the Chart Worker with automatic fallback to main thread.
 * Provides a simple async function that works like the original calculateChartData.
 */

import { useCallback, useEffect, useRef } from 'react';
import { calculateChartDataInWorker, terminateChartWorker } from '../workers/chartWorker';
import { calculateChartData } from '../utils/chartDataUtils';
import type { Trade } from '../types/dualWrite';
import type { TimePeriod, ChartDataPoint } from '../utils/chartDataUtils';
import { logger } from '../utils/logger';

interface UseChartWorkerOptions {
  /**
   * Whether to use Web Worker (default: true)
   * Set to false to always use main thread
   */
  useWorker?: boolean;

  /**
   * Whether to fallback to main thread on worker errors (default: true)
   */
  fallbackOnError?: boolean;
}

/**
 * Hook for calculating chart data using Web Worker with automatic fallback
 */
export function useChartWorker(options: UseChartWorkerOptions = {}) {
  const { useWorker = true, fallbackOnError = true } = options;
  const workerFailedRef = useRef(false);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      terminateChartWorker();
    };
  }, []);

  /**
   * Calculate chart data using worker or fallback
   */
  const calculateChartDataAsync = useCallback(
    async (
      trades: Trade[],
      selectedDate: Date,
      timePeriod: TimePeriod
    ): Promise<ChartDataPoint[]> => {
      // Use main thread if:
      // 1. Worker is disabled
      // 2. Worker previously failed and fallback is disabled
      // 3. Browser doesn't support workers
      if (!useWorker || workerFailedRef.current || typeof Worker === 'undefined') {
        return calculateChartData(trades, selectedDate, timePeriod);
      }

      try {
        // Try to use worker
        const result = await calculateChartDataInWorker(trades, selectedDate, timePeriod);
        return result;
      } catch (error) {
        logger.error('Chart worker failed:', error);

        // Mark worker as failed
        workerFailedRef.current = true;

        // Fallback to main thread if enabled
        if (fallbackOnError) {
          logger.info('Falling back to main thread for chart calculation');
          return calculateChartData(trades, selectedDate, timePeriod);
        }

        // Otherwise, re-throw the error
        throw error;
      }
    },
    [useWorker, fallbackOnError]
  );

  return {
    /**
     * Calculate chart data (automatically uses worker or main thread)
     */
    calculateChartData: calculateChartDataAsync,

    /**
     * Whether worker is being used
     */
    isUsingWorker: useWorker && !workerFailedRef.current && typeof Worker !== 'undefined',

    /**
     * Reset worker failure state (will retry worker on next call)
     */
    resetWorkerState: () => {
      workerFailedRef.current = false;
    }
  };
}
