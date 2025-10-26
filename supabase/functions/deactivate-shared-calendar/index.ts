/**
 * Deactivate Shared Calendar Edge Function
 * Replaces Firebase deactivateSharedCalendarV2 callable function
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

interface DeactivateSharedCalendarPayload {
  shareId: string
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    log('Deactivate shared calendar request received')
    
    const authResult = await createAuthenticatedClient(req)
    if (!authResult) {
      return errorResponse('Authentication required', 401)
    }
    
    const { user, supabase } = authResult
    const payload = await parseJsonBody<DeactivateSharedCalendarPayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }
    
    const { shareId } = payload
    
    if (!shareId) {
      return errorResponse('Missing shareId parameter', 400)
    }
    
    // Get shared calendar and verify ownership
    const { data: sharedCalendar, error: sharedError } = await supabase
      .from('shared_calendars')
      .select('*')
      .eq('id', shareId)
      .single()
    
    if (sharedError || !sharedCalendar) {
      return errorResponse('Shared calendar not found', 404)
    }
    
    if (sharedCalendar.user_id !== user.id) {
      return errorResponse('You do not have permission to modify this shared calendar', 403)
    }
    
    // Delete the shared calendar document
    const { error: deleteError } = await supabase
      .from('shared_calendars')
      .delete()
      .eq('id', shareId)
    
    if (deleteError) {
      log('Error deleting shared calendar', 'error', deleteError)
      return errorResponse('Failed to deactivate shared calendar', 500)
    }
    
    log(`Deleted shared calendar ${shareId} by user ${user.id}`)
    
    return successResponse({ success: true })
    
  } catch (error) {
    log('Error deactivating shared calendar', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
