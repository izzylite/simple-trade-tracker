/**
 * Deactivate Share Link Edge Function
 *
 * Consolidates trade, calendar, and note share-link deactivation behind one
 * endpoint. Clears share_id / share_link / is_shared / shared_at on the
 * source row after verifying caller owns it.
 *
 * Payload: { type: 'trade' | 'calendar' | 'note', shareId: string }
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

interface DeactivateSharePayload {
  type: ShareType
  shareId: string
}

const CLEARED_SHARE_FIELDS = {
  share_id: null,
  share_link: null,
  is_shared: false,
  shared_at: null,
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authResult = await createAuthenticatedClient(req)
    if (!authResult) return errorResponse('Authentication required', 401)

    const { user, supabase } = authResult
    const payload = await parseJsonBody<DeactivateSharePayload>(req)
    if (!payload) return errorResponse('Invalid JSON payload', 400)

    const { type, shareId } = payload
    if (!type || !['trade', 'calendar', 'note'].includes(type)) {
      return errorResponse('Invalid or missing type (trade | calendar | note)', 400)
    }
    if (!shareId) return errorResponse('Missing shareId parameter', 400)

    if (type === 'trade') {
      // Verify ownership through the parent calendar
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('id, calendars(user_id)')
        .eq('share_id', shareId)
        .single()
      if (tradeError || !trade) return errorResponse('Shared trade not found', 404)

      // deno-lint-ignore no-explicit-any
      const ownerId = (trade as any).calendars?.user_id
      if (ownerId !== user.id) {
        return errorResponse('You do not have permission to modify this shared trade', 403)
      }

      const { error: updateError } = await supabase
        .from('trades')
        .update(CLEARED_SHARE_FIELDS)
        .eq('share_id', shareId)
      if (updateError) {
        log('Error clearing trade share fields', 'error', updateError)
        return errorResponse('Failed to deactivate shared trade', 500)
      }

      log(`Deactivated trade share ${shareId} by user ${user.id}`)
      return successResponse({ success: true })
    }

    if (type === 'calendar') {
      const { data: calendar, error: calendarError } = await supabase
        .from('calendars')
        .select('id, user_id')
        .eq('share_id', shareId)
        .single()
      if (calendarError || !calendar) return errorResponse('Shared calendar not found', 404)
      if (calendar.user_id !== user.id) {
        return errorResponse('You do not have permission to modify this shared calendar', 403)
      }

      const { error: updateError } = await supabase
        .from('calendars')
        .update(CLEARED_SHARE_FIELDS)
        .eq('share_id', shareId)
      if (updateError) {
        log('Error clearing calendar share fields', 'error', updateError)
        return errorResponse('Failed to deactivate shared calendar', 500)
      }

      log(`Deactivated calendar share ${shareId} by user ${user.id}`)
      return successResponse({ success: true })
    }

    // type === 'note'
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('id, user_id')
      .eq('share_id', shareId)
      .single()
    if (noteError || !note) return errorResponse('Shared note not found', 404)
    if (note.user_id !== user.id) {
      return errorResponse('You do not have permission to modify this shared note', 403)
    }

    const { error: updateError } = await supabase
      .from('notes')
      .update(CLEARED_SHARE_FIELDS)
      .eq('share_id', shareId)
    if (updateError) {
      log('Error clearing note share fields', 'error', updateError)
      return errorResponse('Failed to deactivate shared note', 500)
    }

    log(`Deactivated note share ${shareId} by user ${user.id}`)
    return successResponse({ success: true })
  } catch (error) {
    log('Error deactivating share link', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
