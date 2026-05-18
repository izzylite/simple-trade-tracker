/**
 * Generate Share Link Edge Function
 *
 * Consolidates trade, calendar, and note share-link generation behind one
 * endpoint. Writes share_id / share_link / is_shared / shared_at directly
 * onto the source row (trades, calendars, notes), matching the schema the
 * get-shared-link function reads from.
 *
 * Payload: { type: 'trade' | 'calendar' | 'note', calendarId?, tradeId?, noteId? }
 *   - trade    requires calendarId + tradeId
 *   - calendar requires calendarId
 *   - note     requires noteId
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import {
  createAuthenticatedClient,
  errorResponse,
  successResponse,
  handleCors,
  log,
  parseJsonBody,
} from '../_shared/supabase.ts'

type ShareType = 'trade' | 'calendar' | 'note'

interface GenerateSharePayload {
  type: ShareType
  calendarId?: string
  tradeId?: string
  noteId?: string
}

const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'https://journotrades.com'

function buildShareId(type: ShareType, ids: { calendarId?: string; tradeId?: string; noteId?: string }): string {
  if (type === 'trade') return `share_${ids.calendarId}_${ids.tradeId}`
  if (type === 'calendar') return `calendar_share_${ids.calendarId}`
  return `note_share_${ids.noteId}`
}

function buildShareLink(type: ShareType, shareId: string): string {
  if (type === 'trade') return `${APP_BASE_URL}/shared/${shareId}`
  if (type === 'calendar') return `${APP_BASE_URL}/shared-calendar/${shareId}`
  return `${APP_BASE_URL}/shared-note/${shareId}`
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authResult = await createAuthenticatedClient(req)
    if (!authResult) return errorResponse('Authentication required', 401)

    const { user, supabase } = authResult
    const payload = await parseJsonBody<GenerateSharePayload>(req)
    if (!payload) return errorResponse('Invalid JSON payload', 400)

    const { type, calendarId, tradeId, noteId } = payload
    if (!type || !['trade', 'calendar', 'note'].includes(type)) {
      return errorResponse('Invalid or missing type (trade | calendar | note)', 400)
    }

    const sharedAt = new Date().toISOString()

    if (type === 'trade') {
      if (!calendarId || !tradeId) {
        return errorResponse('Missing required parameters: calendarId and tradeId', 400)
      }

      const { data: calendar, error: calendarError } = await supabase
        .from('calendars')
        .select('user_id')
        .eq('id', calendarId)
        .single()
      if (calendarError || !calendar) return errorResponse('Calendar not found', 404)
      if (calendar.user_id !== user.id) return errorResponse('Unauthorized access to calendar', 403)

      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('id')
        .eq('id', tradeId)
        .eq('calendar_id', calendarId)
        .single()
      if (tradeError || !trade) return errorResponse('Trade not found in calendar', 404)

      const shareId = buildShareId('trade', { calendarId, tradeId })
      const shareLink = buildShareLink('trade', shareId)

      const { error: updateError } = await supabase
        .from('trades')
        .update({ share_id: shareId, share_link: shareLink, is_shared: true, shared_at: sharedAt })
        .eq('id', tradeId)
      if (updateError) {
        log('Error updating trade share fields', 'error', updateError)
        return errorResponse('Failed to create share link', 500)
      }

      log(`Generated share link for trade ${tradeId}: ${shareLink}`)
      return successResponse({ shareLink, shareId, directLink: shareLink })
    }

    if (type === 'calendar') {
      if (!calendarId) return errorResponse('Missing required parameter: calendarId', 400)

      const { data: calendar, error: calendarError } = await supabase
        .from('calendars')
        .select('user_id')
        .eq('id', calendarId)
        .single()
      if (calendarError || !calendar) return errorResponse('Calendar not found', 404)
      if (calendar.user_id !== user.id) return errorResponse('Unauthorized access to calendar', 403)

      const shareId = buildShareId('calendar', { calendarId })
      const shareLink = buildShareLink('calendar', shareId)

      const { error: updateError } = await supabase
        .from('calendars')
        .update({ share_id: shareId, share_link: shareLink, is_shared: true, shared_at: sharedAt })
        .eq('id', calendarId)
      if (updateError) {
        log('Error updating calendar share fields', 'error', updateError)
        return errorResponse('Failed to create share link', 500)
      }

      log(`Generated share link for calendar ${calendarId}: ${shareLink}`)
      return successResponse({ shareLink, shareId, directLink: shareLink })
    }

    // type === 'note'
    if (!noteId) return errorResponse('Missing required parameter: noteId', 400)

    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('id, user_id, by_assistant')
      .eq('id', noteId)
      .single()
    if (noteError || !note) return errorResponse('Note not found', 404)
    if (note.user_id !== user.id) return errorResponse('Unauthorized access to note', 403)
    if (note.by_assistant) return errorResponse('AI-created notes cannot be shared', 403)

    const shareId = buildShareId('note', { noteId })
    const shareLink = buildShareLink('note', shareId)

    const { error: updateError } = await supabase
      .from('notes')
      .update({ share_id: shareId, share_link: shareLink, is_shared: true, shared_at: sharedAt })
      .eq('id', noteId)
    if (updateError) {
      log('Error updating note share fields', 'error', updateError)
      return errorResponse('Failed to create share link', 500)
    }

    log(`Generated share link for note ${noteId}: ${shareLink}`)
    return successResponse({ shareLink, shareId, directLink: shareLink })
  } catch (error) {
    log('Error generating share link', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
