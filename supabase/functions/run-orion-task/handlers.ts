import type { TaskHandler } from './types.ts';
import { handleMarketResearch } from './market-research.ts';

const handlers: Record<string, TaskHandler> = {
  market_research: handleMarketResearch,
};

export function getHandler(taskType: string): TaskHandler | undefined {
  return handlers[taskType];
}
