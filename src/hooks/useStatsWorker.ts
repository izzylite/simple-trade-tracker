/**
 * useStatsWorker Hook
 *
 * React hook for using the Stats Worker with automatic fallback.
 */

import { useCallback, useEffect, useRef } from 'react';
import { calculateMaxDrawdownInWorker, terminateStatsWorker } from '../workers/statsWorker';
import { calculateMaxDrawdown } from '../utils/statsUtils';
import type { Trade } from '../types/dualWrite';
import { logger } from '../utils/logger';

interface UseStatsWorkerOptions {
  useWorker?: boolean;
  fallbackOnError?: boolean;
}

/**
 * Hook for calculating stats using Web Worker with automatic fallback
 */
export function useStatsWorker(options: UseStatsWorkerOptions = {}) {
  const { useWorker = true, fallbackOnError = true } = options;
  const workerFailedRef = useRef(false);

  useEffect(() => {
    return () => {
      terminateStatsWorker();
    };
  }, []);

  const calculateMaxDrawdownAsync = useCallback(
    async (
      trades: Trade[]
    ): Promise<{
      max_drawdown: number;
      drawdown_start_date?: Date;
      drawdown_end_date?: Date;
      drawdown_recovery_needed: number;
      drawdown_duration: number;
    }> => {
      if (!useWorker || workerFailedRef.current || typeof Worker === 'undefined') {
        return calculateMaxDrawdown(trades);
      }

      try {
        const result = await calculateMaxDrawdownInWorker(trades);
        return result;
      } catch (error) {
        logger.error('Stats worker failed:', error);
        workerFailedRef.current = true;

        if (fallbackOnError) {
          logger.info('Falling back to main thread for stats calculation');
          return calculateMaxDrawdown(trades);
        }

        throw error;
      }
    },
    [useWorker, fallbackOnError]
  );

  return {
    calculateMaxDrawdown: calculateMaxDrawdownAsync,
    isUsingWorker: useWorker && !workerFailedRef.current && typeof Worker !== 'undefined',
    resetWorkerState: () => {
      workerFailedRef.current = false;
    }
  };
}
