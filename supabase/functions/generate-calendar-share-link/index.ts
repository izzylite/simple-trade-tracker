/**
 * Generate Calendar Share Link Edge Function
 * Replaces Firebase generateCalendarShareLinkV2 callable function
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { 
  createAuthenticatedClient, 
  errorResponse, 
  successResponse, 
  handleCors, 
  log, 
  parseJsonBody 
} from '../_shared/supabase.ts'
import { generateShareId } from '../_shared/utils.ts'

interface GenerateCalendarSharePayload {
  calendarId: string
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    log('Generate calendar share link request received')
    
    const authResult = await createAuthenticatedClient(req)
    if (!authResult) {
      return errorResponse('Authentication required', 401)
    }
    
    const { user, supabase } = authResult
    const payload = await parseJsonBody<GenerateCalendarSharePayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }
    
    const { calendarId } = payload
    
    if (!calendarId) {
      return errorResponse('Missing required parameter: calendarId', 400)
    }
    
    // Verify calendar ownership
    const { data: calendar, error: calendarError } = await supabase
      .from('calendars')
      .select('user_id')
      .eq('id', calendarId)
      .single()
    
    if (calendarError || !calendar) {
      return errorResponse('Calendar not found', 404)
    }
    
    if (calendar.user_id !== user.id) {
      return errorResponse('Unauthorized access to calendar', 403)
    }
    
    // Generate share ID and create shared calendar
    const shareId = generateShareId('calendar', calendarId)
    
    const sharedCalendarData = {
      id: shareId,
      calendar_id: calendarId,
      user_id: user.id,
      created_at: new Date().toISOString(),
      is_active: true,
      view_count: 0
    }
    
    const { error: insertError } = await supabase
      .from('shared_calendars')
      .upsert(sharedCalendarData)
    
    if (insertError) {
      log('Error creating shared calendar', 'error', insertError)
      return errorResponse('Failed to create share link', 500)
    }
    
    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://tradetracker-30ec1.web.app'
    const shareLink = `${baseUrl}/shared-calendar/${shareId}`
    
    log(`Generated share link for calendar ${calendarId}: ${shareLink}`)
    
    return successResponse({
      shareLink,
      shareId,
      directLink: shareLink
    })
    
  } catch (error) {
    log('Error generating calendar share link', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
