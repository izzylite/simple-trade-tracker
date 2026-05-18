/**
 * Note Types
 * Simple Notion-style notes with title, content, and cover image
 * Supports reminder functionality for displaying notes on specific days
 */

export type ReminderType = "none" | "once" | "weekly";

export type DayAbbreviation =
  | "Sun"
  | "Mon"
  | "Tue"
  | "Wed"
  | "Thu"
  | "Fri"
  | "Sat";

export interface Note {
  id: string;
  user_id: string;
  calendar_id: string | null; // null = global note (visible in all calendars)
  title: string;
  content: string;
  cover_image: string | null;
  is_archived: boolean;
  is_pinned: boolean;
  by_assistant: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;

  // Reminder fields
  reminder_type?: ReminderType;
  reminder_date?: Date | null; // For one-time reminders
  reminder_days?: DayAbbreviation[]; // For weekly reminders
  is_reminder_active?: boolean;

  // Visuals
  color?: string; // Hex code or preset name

  // Tags for categorization
  tags?: string[];

  // Week association (null for regular notes)
  week_key?: string | null;

  // Sharing
  share_id?: string | null;
  share_link?: string | null;
  is_shared?: boolean;
  shared_at?: Date | null;
}

export interface CreateNoteInput {
  id?: string; // When provided, insert-or-fetch by this deterministic ID (idempotent save)
  user_id: string;
  calendar_id: string | null; // null = global note (visible in all calendars)
  title?: string;
  content?: string;
  cover_image?: string | null;
  by_assistant?: boolean;

  // Reminder fields
  reminder_type?: ReminderType;
  reminder_date?: Date | null;
  reminder_days?: DayAbbreviation[];
  is_reminder_active?: boolean;

  // Visuals
  color?: string;

  // Tags for categorization
  tags?: string[];

  // Week association
  week_key?: string | null;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  cover_image?: string | null;
  calendar_id?: string | null; // null = global note (visible in all calendars)
  is_archived?: boolean;
  is_pinned?: boolean;
  by_assistant?: boolean;

  // Reminder fields
  reminder_type?: ReminderType;
  reminder_date?: Date | null;
  reminder_days?: DayAbbreviation[];
  is_reminder_active?: boolean;

  // Visuals
  color?: string;

  // Tags for categorization
  tags?: string[];

  // Week association
  week_key?: string | null;

  // Sharing
  share_id?: string | null;
  share_link?: string | null;
  is_shared?: boolean;
  shared_at?: Date | null;
}

export interface ReminderConfig {
  type: ReminderType;
  date?: Date | null;
  days?: DayAbbreviation[];
}

/**
 * Reserved system tag values used by the app/Orion to mark notes with
 * built-in semantics (UI tag picker, "/" command popup, GUIDELINE reminder
 * injection, etc.). These are the single source of truth — never type the
 * raw string in components, services, or edge-function code.
 *
 * The matching set for the Deno edge functions lives in
 * `supabase/functions/_shared/noteTags.ts`. Keep both in sync.
 */
export const SLASH_COMMAND_TAG = 'SLASH_COMMAND';
export const GUIDELINE_TAG = 'GUIDELINE';
export const GAME_PLAN_TAG = 'GAME_PLAN';
export const LESSON_LEARNED_TAG = 'LESSON_LEARNED';
export const RISK_MANAGEMENT_TAG = 'RISK_MANAGEMENT';
export const PSYCHOLOGY_TAG = 'PSYCHOLOGY';
export const GENERAL_TAG = 'GENERAL';
export const STRATEGY_TAG = 'STRATEGY';
export const INSIGHT_TAG = 'INSIGHT';
export const AGENT_MEMORY_TAG = 'AGENT_MEMORY';

/**
 * All reserved system tag values. Useful for "is this a system tag?" checks.
 */
export const SYSTEM_NOTE_TAGS = [
  SLASH_COMMAND_TAG,
  GUIDELINE_TAG,
  GAME_PLAN_TAG,
  LESSON_LEARNED_TAG,
  RISK_MANAGEMENT_TAG,
  PSYCHOLOGY_TAG,
  GENERAL_TAG,
  STRATEGY_TAG,
  INSIGHT_TAG,
  AGENT_MEMORY_TAG,
] as const;
