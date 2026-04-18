import type { TaskHandler } from './types.ts';
import { handleMarketResearch } from './market-research.ts';
import { handleDailyAnalysis } from './daily-analysis.ts';
import { handleWeeklyReview } from './weekly-review.ts';
import { handleMonthlyRollup } from './monthly-rollup.ts';

const handlers: Record<string, TaskHandler> = {
  market_research: handleMarketResearch,
  daily_analysis: handleDailyAnalysis,
  weekly_review: handleWeeklyReview,
  monthly_rollup: handleMonthlyRollup,
};

export function getHandler(taskType: string): TaskHandler | undefined {
  return handlers[taskType];
}
