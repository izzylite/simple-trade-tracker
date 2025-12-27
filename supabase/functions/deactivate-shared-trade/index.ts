/**
 * Deactivate Shared Trade Edge Function
 * Replaces Firebase deactivateSharedTradeV2 callable function
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

interface DeactivateSharedTradePayload {
  shareId: string
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    log('Deactivate shared trade request received')

    const authResult = await createAuthenticatedClient(req)
    if (!authResult) {
      return errorResponse('Authentication required', 401)
    }

    const { user, supabase } = authResult
    const payload = await parseJsonBody<DeactivateSharedTradePayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }

    const { shareId } = payload

    if (!shareId) {
      return errorResponse('Missing shareId parameter', 400)
    }

    // Get shared trade and verify ownership
    const { data: sharedTrade, error: sharedError } = await supabase
      .from('shared_trades')
      .select('*')
      .eq('id', shareId)
      .single()

    if (sharedError || !sharedTrade) {
      return errorResponse('Shared trade not found', 404)
    }

    if (sharedTrade.user_id !== user.id) {
      return errorResponse('You do not have permission to modify this shared trade', 403)
    }

    // Delete the shared trade document
    const { error: deleteError } = await supabase
      .from('shared_trades')
      .delete()
      .eq('id', shareId)

    if (deleteError) {
      log('Error deleting shared trade', 'error', deleteError)
      return errorResponse('Failed to deactivate shared trade', 500)
    }

    log(`Deleted shared trade ${shareId} by user ${user.id}`)

    return successResponse({ success: true })

  } catch (error) {
    log('Error deactivating shared trade', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
