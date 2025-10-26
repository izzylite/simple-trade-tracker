/**
 * Get Shared Calendar Edge Function
 * Replaces Firebase getSharedCalendarV2 callable function
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { 
  createServiceClient,
  errorResponse, 
  successResponse, 
  handleCors, 
  log, 
  parseJsonBody 
} from '../_shared/supabase.ts'

interface GetSharedCalendarPayload {
  shareId: string
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    log('Get shared calendar request received')
    
    const payload = await parseJsonBody<GetSharedCalendarPayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }
    
    const { shareId } = payload
    
    if (!shareId) {
      return errorResponse('Missing shareId parameter', 400)
    }
    
    const supabase = createServiceClient()
    
    // Get shared calendar document
    const { data: sharedCalendar, error: sharedError } = await supabase
      .from('shared_calendars')
      .select('*')
      .eq('id', shareId)
      .single()
    
    if (sharedError || !sharedCalendar) {
      return errorResponse('Shared calendar not found', 404)
    }
    
    if (!sharedCalendar.is_active) {
      return errorResponse('This shared calendar is no longer available', 403)
    }
    
    // Get the actual calendar data
    const { data: calendar, error: calendarError } = await supabase
      .from('calendars')
      .select('*')
      .eq('id', sharedCalendar.calendar_id)
      .single()
    
    if (calendarError || !calendar) {
      return errorResponse('The shared calendar no longer exists', 404)
    }
    
    // Get all trades for this calendar
    const { data: trades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .eq('calendar_id', sharedCalendar.calendar_id)
      .order('created_at', { ascending: false })
    
    if (tradesError) {
      log('Error fetching calendar trades', 'error', tradesError)
      return errorResponse('Failed to load calendar trades', 500)
    }
    
    // Increment view count
    const { error: updateError } = await supabase
      .from('shared_calendars')
      .update({ view_count: (sharedCalendar.view_count || 0) + 1 })
      .eq('id', shareId)
    
    if (updateError) {
      log('Error updating view count', 'error', updateError)
      // Continue anyway - this is not critical
    }
    
    log(`Shared calendar ${shareId} viewed (calendar: ${calendar.id})`)
    
    return successResponse({
      calendar,
      trades: trades || [],
      shareInfo: {
        id: sharedCalendar.id,
        createdAt: sharedCalendar.created_at,
        viewCount: (sharedCalendar.view_count || 0) + 1,
        userId: sharedCalendar.user_id
      }
    })
    
  } catch (error) {
    log('Error getting shared calendar', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
