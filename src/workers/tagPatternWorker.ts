/**
 * Tag Pattern Worker
 *
 * Web Worker for generating tag combinations off the main thread.
 * This is an O(n³) operation that can block the UI with large datasets.
 */

import { createInlineWorker, WorkerManager } from './utils/workerManager';
import type { Trade } from '../types/dualWrite';

export interface GenerateTagCombinationsRequest {
  trades: Trade[];
  excludedTags?: string[];
  minTrades?: number; // Minimum trades to include triple combinations
}

export interface GenerateTagCombinationsResponse {
  combinations: string[][];
}

/**
 * Worker code for tag pattern generation
 * IMPORTANT: No external dependencies, all logic inlined
 */
const TAG_PATTERN_WORKER_CODE = `
// ============================================================================
// Tag Pattern Generation
// ============================================================================

function generateTagCombinations(trades, excludedTags, minTrades) {
  const allTags = new Set();
  const tagPairs = new Set();
  const tagTriples = new Set();

  // Collect all tags and their combinations
  trades.forEach(trade => {
    if (trade.tags && trade.tags.length > 0) {
      // Filter out system tags like Partials and excluded tags
      const filteredTags = trade.tags.filter(tag =>
        !tag.startsWith('Partials:') &&
        (!excludedTags || !excludedTags.includes(tag))
      );

      // Single tags
      filteredTags.forEach(tag => allTags.add(tag));

      // Tag pairs
      if (filteredTags.length >= 2) {
        for (let i = 0; i < filteredTags.length; i++) {
          for (let j = i + 1; j < filteredTags.length; j++) {
            const pair = [filteredTags[i], filteredTags[j]].sort().join('|');
            tagPairs.add(pair);
          }
        }
      }

      // Tag triples (for high-volume traders)
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

  // Convert to arrays
  const combinations = [];

  // Add single tags
  allTags.forEach(tag => combinations.push([tag]));

  // Add pairs
  tagPairs.forEach(pair => combinations.push(pair.split('|')));

  // Add triples (only if we have enough trades)
  if (trades.length > (minTrades || 50)) {
    tagTriples.forEach(triple => combinations.push(triple.split('|')));
  }

  return combinations;
}

// ============================================================================
// Message Handler
// ============================================================================

self.addEventListener('message', (event) => {
  const request = event.data;

  try {
    if (request.type === 'GENERATE_TAG_COMBINATIONS') {
      const { trades, excludedTags, minTrades } = request.payload;

      const combinations = generateTagCombinations(trades, excludedTags, minTrades);

      const response = {
        id: request.id,
        type: request.type,
        payload: { combinations }
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

let tagPatternWorkerManager: WorkerManager | null = null;

/**
 * Get or create the tag pattern worker manager instance (singleton)
 */
function getTagPatternWorkerManager(): WorkerManager {
  if (!tagPatternWorkerManager) {
    tagPatternWorkerManager = new WorkerManager(() => createInlineWorker(TAG_PATTERN_WORKER_CODE));
  }
  return tagPatternWorkerManager;
}

/**
 * Generate tag combinations using Web Worker
 */
export async function generateTagCombinationsInWorker(
  trades: Trade[],
  excludedTags?: string[],
  minTrades?: number
): Promise<string[][]> {
  const manager = getTagPatternWorkerManager();

  const request: GenerateTagCombinationsRequest = {
    trades,
    excludedTags,
    minTrades
  };

  const response = await manager.request<
    GenerateTagCombinationsRequest,
    GenerateTagCombinationsResponse
  >('GENERATE_TAG_COMBINATIONS', request);

  return response.combinations;
}

/**
 * Terminate the tag pattern worker (cleanup)
 */
export function terminateTagPatternWorker(): void {
  if (tagPatternWorkerManager) {
    tagPatternWorkerManager.terminate();
    tagPatternWorkerManager = null;
  }
}

/**
 * Check if tag pattern worker is active
 */
export function isTagPatternWorkerActive(): boolean {
  return tagPatternWorkerManager?.isActive() ?? false;
}
