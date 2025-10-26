/**
 * Get Shared Trade Edge Function
 * Replaces Firebase getSharedTradeV2 callable function
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

interface GetSharedTradePayload {
  shareId: string
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    log('Get shared trade request received')
    
    const payload = await parseJsonBody<GetSharedTradePayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }
    
    const { shareId } = payload
    
    if (!shareId) {
      return errorResponse('Missing shareId parameter', 400)
    }
    
    const supabase = createServiceClient()
    
    // Get shared trade document
    const { data: sharedTrade, error: sharedError } = await supabase
      .from('shared_trades')
      .select('*')
      .eq('id', shareId)
      .single()
    
    if (sharedError || !sharedTrade) {
      return errorResponse('Shared trade not found', 404)
    }
    
    if (!sharedTrade.is_active) {
      return errorResponse('This shared trade is no longer available', 403)
    }
    
    // Get the actual trade data
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', sharedTrade.trade_id)
      .eq('calendar_id', sharedTrade.calendar_id)
      .single()
    
    if (tradeError || !trade) {
      return errorResponse('The shared trade no longer exists', 404)
    }
    
    // Increment view count
    const { error: updateError } = await supabase
      .from('shared_trades')
      .update({ view_count: (sharedTrade.view_count || 0) + 1 })
      .eq('id', shareId)
    
    if (updateError) {
      log('Error updating view count', 'error', updateError)
      // Continue anyway - this is not critical
    }
    
    log(`Shared trade ${shareId} viewed (trade: ${trade.id})`)
    
    return successResponse({
      trade,
      viewCount: (sharedTrade.view_count || 0) + 1,
      sharedAt: sharedTrade.created_at
    })
    
  } catch (error) {
    log('Error getting shared trade', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
