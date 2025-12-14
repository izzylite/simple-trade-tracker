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
  calendar_id: string;
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
}

export interface CreateNoteInput {
  user_id: string;
  calendar_id: string;
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
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  cover_image?: string | null;
  calendar_id?: string;
  is_archived?: boolean;
  is_pinned?: boolean;

  // Reminder fields
  reminder_type?: ReminderType;
  reminder_date?: Date | null;
  reminder_days?: DayAbbreviation[];
  is_reminder_active?: boolean;

  // Visuals
  color?: string;

  // Tags for categorization
  tags?: string[];
}

export interface ReminderConfig {
  type: ReminderType;
  date?: Date | null;
  days?: DayAbbreviation[];
}
