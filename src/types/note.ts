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
