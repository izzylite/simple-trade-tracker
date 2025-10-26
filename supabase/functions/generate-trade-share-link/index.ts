/**
 * Generate Trade Share Link Edge Function
 * Replaces Firebase generateTradeShareLinkV2 callable function
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
import type { GenerateShareLinkRequest, GenerateShareLinkResponse } from '../_shared/types.ts'

interface GenerateTradeSharePayload {
  calendarId: string
  tradeId: string
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    log('Generate trade share link request received')
    
    const authResult = await createAuthenticatedClient(req)
    if (!authResult) {
      return errorResponse('Authentication required', 401)
    }
    
    const { user, supabase } = authResult
    const payload = await parseJsonBody<GenerateTradeSharePayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }
    
    const { calendarId, tradeId } = payload
    
    if (!calendarId || !tradeId) {
      return errorResponse('Missing required parameters: calendarId and tradeId', 400)
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
    
    // Verify trade exists
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('id')
      .eq('id', tradeId)
      .eq('calendar_id', calendarId)
      .single()
    
    if (tradeError || !trade) {
      return errorResponse('Trade not found in calendar', 404)
    }
    
    // Generate share ID and create shared trade
    const shareId = generateShareId('trade', `${calendarId}_${tradeId}`)
    
    const sharedTradeData = {
      id: shareId,
      trade_id: tradeId,
      calendar_id: calendarId,
      user_id: user.id,
      created_at: new Date().toISOString(),
      is_active: true,
      view_count: 0
    }
    
    const { error: insertError } = await supabase
      .from('shared_trades')
      .upsert(sharedTradeData)
    
    if (insertError) {
      log('Error creating shared trade', 'error', insertError)
      return errorResponse('Failed to create share link', 500)
    }
    
    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://tradetracker-30ec1.web.app'
    const shareLink = `${baseUrl}/shared/${shareId}`
    
    log(`Generated share link for trade ${tradeId}: ${shareLink}`)
    
    return successResponse({
      shareLink,
      shareId,
      directLink: shareLink
    })
    
  } catch (error) {
    log('Error generating trade share link', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
