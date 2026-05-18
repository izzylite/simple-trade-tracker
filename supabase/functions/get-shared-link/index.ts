/**
 * Get Shared Link Edge Function
 *
 * Consolidates public reads for shared trades, calendars, and notes. Uses
 * the service role client to bypass RLS for unauthenticated viewers.
 *
 * Payload: { type: 'trade' | 'calendar' | 'note', shareId: string }
 *
 * Response shapes (under successResponse.data):
 *   trade:    { trade, viewCount, sharedAt }
 *   calendar: { calendar, trades, shareInfo: { viewCount, sharedAt } }
 *   note:     { title, content, cover_image, color, tags, created_at, shared_at }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import {
  createServiceClient,
  errorResponse,
  successResponse,
  handleCors,
  log,
  parseJsonBody,
} from '../_shared/supabase.ts'
import type { Calendar, Trade } from '../_shared/types.ts'

type ShareType = 'trade' | 'calendar' | 'note'

interface GetSharedPayload {
  type: ShareType
  shareId: string
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const payload = await parseJsonBody<GetSharedPayload>(req)
    if (!payload) return errorResponse('Invalid JSON payload', 400)

    const { type, shareId } = payload
    if (!type || !['trade', 'calendar', 'note'].includes(type)) {
      return errorResponse('Invalid or missing type (trade | calendar | note)', 400)
    }
    if (!shareId) return errorResponse('Missing shareId parameter', 400)

    const supabase = createServiceClient()

    if (type === 'trade') {
      const { data: trade, error } = await supabase
        .from('trades')
        .select('*')
        .eq('share_id', shareId)
        .eq('is_shared', true)
        .single()
      if (error || !trade) return errorResponse('Shared trade not found', 404)

      log(`Shared trade ${shareId} viewed (trade: ${trade.id})`)
      return successResponse({
        trade: trade as Trade,
        viewCount: 0,
        sharedAt: trade.shared_at,
      })
    }

    if (type === 'calendar') {
      const { data: calendar, error: calendarError } = await supabase
        .from('calendars')
        .select('*')
        .eq('share_id', shareId)
        .eq('is_shared', true)
        .single()
      if (calendarError || !calendar) return errorResponse('Shared calendar not found', 404)

      // Increment view count via SECURITY DEFINER RPC; ignore failures so a
      // broken counter never blocks the viewer from loading the calendar.
      const { data: incResult } = await supabase
        .rpc('increment_shared_calendar_view_count', { p_share_id: shareId })
      const viewCount = (incResult?.viewCount as number | undefined) ??
        ((calendar.share_view_count as number | null) ?? 0) + 1

      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('calendar_id', calendar.id)
        .order('trade_date', { ascending: false })
      if (tradesError) {
        log('Error fetching calendar trades', 'error', tradesError)
        return errorResponse('Failed to load calendar trades', 500)
      }

      log(`Shared calendar ${shareId} viewed (calendar: ${calendar.id})`)
      return successResponse({
        calendar: calendar as Calendar,
        trades: (trades || []) as Trade[],
        shareInfo: {
          viewCount,
          sharedAt: calendar.shared_at,
        },
      })
    }

    // type === 'note'
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('title, content, cover_image, color, tags, created_at, shared_at')
      .eq('share_id', shareId)
      .eq('is_shared', true)
      .single()
    if (noteError || !note) return errorResponse('Shared note not found', 404)

    log(`Shared note ${shareId} viewed`)
    return successResponse({
      title: note.title,
      content: note.content,
      cover_image: note.cover_image,
      color: note.color,
      tags: note.tags || [],
      created_at: note.created_at,
      shared_at: note.shared_at,
    })
  } catch (error) {
    log('Error getting shared link', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
