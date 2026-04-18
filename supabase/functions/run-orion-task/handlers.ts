import type { TaskHandler } from './types.ts';

const handlers: Record<string, TaskHandler> = {
  market_research: async (_task, _supabase) => ({
    content_html: '<p>Market research handler not yet implemented.</p>',
    content_plain: 'Market research handler not yet implemented.',
    significance: null,
    metadata: {},
  }),
  daily_analysis: async (_task, _supabase) => ({
    content_html: '<p>Daily analysis handler not yet implemented.</p>',
    content_plain: 'Daily analysis handler not yet implemented.',
    significance: null,
    metadata: {},
  }),
  weekly_review: async (_task, _supabase) => ({
    content_html: '<p>Weekly review handler not yet implemented.</p>',
    content_plain: 'Weekly review handler not yet implemented.',
    significance: null,
    metadata: {},
  }),
  monthly_rollup: async (_task, _supabase) => ({
    content_html: '<p>Monthly rollup handler not yet implemented.</p>',
    content_plain: 'Monthly rollup handler not yet implemented.',
    significance: null,
    metadata: {},
  }),
};

export function getHandler(taskType: string): TaskHandler | undefined {
  return handlers[taskType];
}
