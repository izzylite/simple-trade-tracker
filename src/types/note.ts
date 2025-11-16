/**
 * Note Types
 * Simple Notion-style notes with title, content, and cover image
 */

export interface Note {
  id: string;
  user_id: string;
  calendar_id: string;
  title: string;
  content: string;
  cover_image: string | null;
  is_archived: boolean;
  is_pinned: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNoteInput {
  user_id: string;
  calendar_id: string;
  title?: string;
  content?: string;
  cover_image?: string | null;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  cover_image?: string | null;
  calendar_id?: string;
  is_archived?: boolean;
  is_pinned?: boolean;
}
