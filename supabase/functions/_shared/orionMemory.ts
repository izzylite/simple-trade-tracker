/**
 * Shared AGENT_MEMORY loader. The AI chat agent and the run-orion-task
 * rollup handlers both need the same pre-loaded memory for the Orion system
 * prompt — duplicating the REST call in each function was the original
 * smell. Uses PostgREST directly (not the client SDK) to keep this file
 * dependency-light and safe to import from any edge function.
 */

import { log } from './supabase.ts';

/**
 * Fetch the AGENT_MEMORY note content for a user+calendar. Returns null when
 * no memory exists yet or on any error — callers treat "no memory" as the
 * signal to bootstrap one on first significant interaction.
 */
export async function fetchAgentMemory(
  userId: string,
  calendarId?: string
): Promise<string | null> {
  if (!calendarId) {
    log('[Memory] No calendar ID, skipping memory fetch', 'info');
    return null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    log('[Memory] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', 'warn');
    return null;
  }

  try {
    const url = `${supabaseUrl}/rest/v1/notes?user_id=eq.${userId}&calendar_id=eq.${calendarId}&tags=cs.{AGENT_MEMORY}&select=content&limit=1`;
    const response = await fetch(url, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log(`[Memory] Failed to fetch: ${response.status}`, 'warn');
      return null;
    }

    const notes = await response.json();
    if (notes && notes.length > 0 && notes[0].content) {
      const content = notes[0].content;
      log(`[Memory] Loaded ${content.length} chars of memory`, 'info');
      return content;
    }

    log('[Memory] No existing memory found', 'info');
    return null;
  } catch (error) {
    log(`[Memory] Error fetching: ${error}`, 'error');
    return null;
  }
}
