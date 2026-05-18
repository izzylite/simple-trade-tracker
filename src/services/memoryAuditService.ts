import { supabase } from '../config/supabase';
import { AGENT_MEMORY_TAG } from 'features/notes/types/note';

export interface MemoryAuditRow {
  id: string;
  op: 'ADD' | 'UPDATE' | 'REMOVE' | 'COMPACT' | 'REPLACE_SECTION';
  section: string;
  before_text: string | null;
  after_text: string | null;
  match_score: number | null;
  created_at: string;
}

export async function getMemoryAudit(calendarId: string): Promise<MemoryAuditRow[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('memory_audit')
    .select('id, op, section, before_text, after_text, match_score, created_at')
    .eq('user_id', user.id)
    .eq('calendar_id', calendarId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function getMemoryNote(calendarId: string): Promise<string | null> {
  // Security: ownership enforced by RLS via calendars.user_id = auth.uid().
  // calendarId must belong to the calling user — never pass an untrusted value.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('notes')
    .select('content')
    .eq('calendar_id', calendarId)
    .contains('tags', [AGENT_MEMORY_TAG])
    .maybeSingle();

  if (error) throw error;
  return (data as { content: string } | null)?.content ?? null;
}
