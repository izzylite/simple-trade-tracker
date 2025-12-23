/**
 * useTagPatternWorker Hook
 *
 * React hook for using the Tag Pattern Worker with automatic fallback.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  generateTagCombinationsInWorker,
  terminateTagPatternWorker
} from '../workers/tagPatternWorker';
import type { Trade } from '../types/dualWrite';
import { logger } from '../utils/logger';

interface UseTagPatternWorkerOptions {
  useWorker?: boolean;
  fallbackOnError?: boolean;
}

/**
 * Fallback: Generate tag combinations on main thread
 */
function generateTagCombinationsFallback(
  trades: Trade[],
  excludedTags?: string[],
  minTrades: number = 50
): string[][] {
  const allTags = new Set<string>();
  const tagPairs = new Set<string>();
  const tagTriples = new Set<string>();

  // Collect all tags and their combinations
  trades.forEach(trade => {
    if (trade.tags && trade.tags.length > 0) {
      const filteredTags = trade.tags.filter(
        tag => !tag.startsWith('Partials:') && (!excludedTags || !excludedTags.includes(tag))
      );

      filteredTags.forEach(tag => allTags.add(tag));

      if (filteredTags.length >= 2) {
        for (let i = 0; i < filteredTags.length; i++) {
          for (let j = i + 1; j < filteredTags.length; j++) {
            const pair = [filteredTags[i], filteredTags[j]].sort().join('|');
            tagPairs.add(pair);
          }
        }
      }

      if (filteredTags.length >= 3) {
        for (let i = 0; i < filteredTags.length; i++) {
          for (let j = i + 1; j < filteredTags.length; j++) {
            for (let k = j + 1; k < filteredTags.length; k++) {
              const triple = [filteredTags[i], filteredTags[j], filteredTags[k]].sort().join('|');
              tagTriples.add(triple);
            }
          }
        }
      }
    }
  });

  const combinations: string[][] = [];
  allTags.forEach(tag => combinations.push([tag]));
  tagPairs.forEach(pair => combinations.push(pair.split('|')));

  if (trades.length > minTrades) {
    tagTriples.forEach(triple => combinations.push(triple.split('|')));
  }

  return combinations;
}

/**
 * Hook for generating tag combinations using Web Worker with automatic fallback
 */
export function useTagPatternWorker(options: UseTagPatternWorkerOptions = {}) {
  const { useWorker = true, fallbackOnError = true } = options;
  const workerFailedRef = useRef(false);

  useEffect(() => {
    return () => {
      terminateTagPatternWorker();
    };
  }, []);

  const generateTagCombinations = useCallback(
    async (trades: Trade[], excludedTags?: string[], minTrades?: number): Promise<string[][]> => {
      if (!useWorker || workerFailedRef.current || typeof Worker === 'undefined') {
        return generateTagCombinationsFallback(trades, excludedTags, minTrades);
      }

      try {
        const result = await generateTagCombinationsInWorker(trades, excludedTags, minTrades);
        return result;
      } catch (error) {
        logger.error('Tag pattern worker failed:', error);
        workerFailedRef.current = true;

        if (fallbackOnError) {
          logger.info('Falling back to main thread for tag pattern generation');
          return generateTagCombinationsFallback(trades, excludedTags, minTrades);
        }

        throw error;
      }
    },
    [useWorker, fallbackOnError]
  );

  return {
    generateTagCombinations,
    isUsingWorker: useWorker && !workerFailedRef.current && typeof Worker !== 'undefined',
    resetWorkerState: () => {
      workerFailedRef.current = false;
    }
  };
}
