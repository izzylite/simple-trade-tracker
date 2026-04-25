/**
 * Shared GUIDELINE-note loader. Used by the Orion AI chat agent to detect
 * whether the user has an active guideline note so a short reminder can be
 * prepended to the user turn (see the "GUIDELINE Notes" section of the
 * Orion system prompt). Returns only the title — the full content stays
 * out of the reminder to preserve token budget; Orion is expected to call
 * search_notes({tags:["GUIDELINE"]}) to read the body when needed.
 *
 * "Empty" = the note exists but has no textual body beyond the title. This
 * can happen when the Draft.js editor contains only empty blocks. In that
 * case we return null so the reminder is skipped.
 */

import { log } from './supabase.ts';
import { GUIDELINE_TAG } from './noteTags.ts';

export interface GuidelineReminder {
  title: string;
}

function extractPlainText(content: unknown): string {
  if (typeof content !== 'string') return '';
  try {
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.blocks)) {
      return parsed.blocks
        .map((b: { text?: string }) => b.text || '')
        .join('\n')
        .trim();
    }
  } catch {
    // Not JSON — treat as plain text.
  }
  return content.trim();
}

export async function fetchGuidelineReminder(
  userId: string,
  calendarId?: string
): Promise<GuidelineReminder | null> {
  if (!calendarId) {
    return null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    log('[Guideline] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', 'warn');
    return null;
  }

  try {
    // GUIDELINE notes may be calendar-scoped or global (calendar_id IS NULL).
    // Check both via an OR filter. Limit 1 — system enforces max 1 per user.
    const url =
      `${supabaseUrl}/rest/v1/notes` +
      `?user_id=eq.${userId}` +
      `&tags=cs.{${GUIDELINE_TAG}}` +
      `&or=(calendar_id.eq.${calendarId},calendar_id.is.null)` +
      `&select=title,content&limit=1`;

    const response = await fetch(url, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log(`[Guideline] Failed to fetch: ${response.status}`, 'warn');
      return null;
    }

    const notes = await response.json();
    if (!notes || notes.length === 0) {
      return null;
    }

    const note = notes[0];
    const body = extractPlainText(note.content);
    if (!body) {
      log('[Guideline] Note exists but body is empty — skipping reminder', 'info');
      return null;
    }

    const title = (typeof note.title === 'string' && note.title.trim())
      ? note.title.trim()
      : 'Guideline';
    return { title };
  } catch (error) {
    log(`[Guideline] Error fetching: ${error}`, 'error');
    return null;
  }
}
