/**
 * Calendar types - Re-export from dualWrite.ts
 * All types use snake_case to match Supabase schema
 */

import { Calendar as BaseCalendar, Trade } from './dualWrite';

// Re-export base Calendar type
export type { Calendar } from './dualWrite';

/**
 * Calendar with UI state - used only in App.tsx for state management
 * Separates database properties from UI-only caching properties
 */
export interface CalendarWithUIState extends BaseCalendar {
  cachedTrades: Trade[];
  loadedYears: number[];
}

