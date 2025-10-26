/**
 * Cleanup Expired Calendars Edge Function
 * Replaces Firebase cleanupExpiredCalendarsV2 scheduled function
 * 
 * Runs daily at 2 AM to permanently delete calendars that have been
 * in trash for more than 30 days
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { 
  createServiceClient,
  errorResponse, 
  successResponse, 
  handleCors, 
  log 
} from '../_shared/supabase.ts'

/**
 * Delete expired calendars and their associated data
 */
async function cleanupExpiredCalendars(): Promise<{ deletedCount: number, errors: string[] }> {
  try {
    log('Starting cleanup of expired calendars')
    
    const supabase = createServiceClient()
    const now = new Date()
    const errors: string[] = []
    
    // Find calendars that are deleted and past their auto-delete date
    const { data: expiredCalendars, error: fetchError } = await supabase
      .from('calendars')
      .select('id, user_id, name, auto_delete_at')
      .eq('is_deleted', true)
      .not('auto_delete_at', 'is', null)
      .lt('auto_delete_at', now.toISOString())
    
    if (fetchError) {
      throw fetchError
    }
    
    if (!expiredCalendars || expiredCalendars.length === 0) {
      log('No expired calendars found')
      return { deletedCount: 0, errors: [] }
    }
    
    log(`Found ${expiredCalendars.length} expired calendars to delete`)
    
    let deletedCount = 0
    
    // Process each expired calendar
    for (const calendar of expiredCalendars) {
      try {
        log(`Processing expired calendar: ${calendar.id} (${calendar.name})`)
        
        // Call the cleanup-deleted-calendar function for comprehensive cleanup
        const cleanupResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/cleanup-deleted-calendar`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              calendar_id: calendar.id,
              user_id: calendar.user_id,
              calendar_data: calendar
            })
          }
        )
        
        if (!cleanupResponse.ok) {
          const errorText = await cleanupResponse.text()
          throw new Error(`Cleanup function failed: ${errorText}`)
        }
        
        // Now delete the calendar itself
        const { error: deleteError } = await supabase
          .from('calendars')
          .delete()
          .eq('id', calendar.id)
        
        if (deleteError) {
          throw deleteError
        }
        
        deletedCount++
        log(`Successfully deleted expired calendar: ${calendar.id}`)
        
      } catch (error) {
        const errorMsg = `Failed to delete calendar ${calendar.id}: ${error.message}`
        log(errorMsg, 'error', error)
        errors.push(errorMsg)
      }
    }
    
    log(`Cleanup completed: ${deletedCount}/${expiredCalendars.length} calendars deleted`)
    
    return { deletedCount, errors }
    
  } catch (error) {
    log('Error in cleanupExpiredCalendars', 'error', error)
    throw error
  }
}

/**
 * Main Edge Function handler
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    log('Cleanup expired calendars scheduled function triggered')
    
    // This function can be called by Supabase Cron or manually
    // No authentication required for scheduled calls
    
    const result = await cleanupExpiredCalendars()
    
    const response = {
      success: true,
      message: `Cleanup completed: ${result.deletedCount} calendars deleted`,
      deletedCount: result.deletedCount,
      errors: result.errors,
      timestamp: new Date().toISOString()
    }
    
    if (result.errors.length > 0) {
      log(`Cleanup completed with ${result.errors.length} errors`, 'warn', result.errors)
    } else {
      log('Cleanup completed successfully')
    }
    
    return successResponse(response)
    
  } catch (error) {
    log('Error in cleanup expired calendars function', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
