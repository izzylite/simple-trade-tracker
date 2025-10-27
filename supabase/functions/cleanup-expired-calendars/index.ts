/**
 * Cleanup Expired Calendars Edge Function
 * Replaces Firebase cleanupExpiredCalendarsV2 scheduled function
 *
 * Runs daily at 2 AM to mark calendars for deletion
 * The handle-calendar-changes webhook then processes cleanup and final deletion
 */ import { createServiceClient, errorResponse, successResponse, handleCors, log } from '../_shared/supabase.ts';
/**
 * Mark expired calendars for deletion
 * The database webhook will automatically trigger handle-calendar-changes edge function
 * to handle cleanup and final deletion
 *
 * This approach is safer than direct DELETE because:
 * - Calendar exists during cleanup (no orphaned data if cleanup fails)
 * - Automatic retry if cleanup fails (cron runs again)
 * - Idempotent (can run multiple times safely)
 * - Transactional integrity maintained
 */ async function cleanupExpiredCalendars(): Promise<{ markedCount: number; errors: string[] }> {
  try {
    log('Starting cleanup of expired calendars');
    const supabase = createServiceClient();
    const now = new Date();
    const errors: string[] = [];
    // Find calendars that are soft deleted and past their auto-delete date
    // If cleanup fails, the calendar stays in DB and will be retried on next daily run
    const { data: expiredCalendars, error: fetchError } = await supabase.from('calendars').select('id, user_id, name, auto_delete_at, mark_for_deletion, deletion_date').not('deleted_at', 'is', null) // Soft deleted
    .not('auto_delete_at', 'is', null).lt('auto_delete_at', now.toISOString()) // Past auto-delete date
    .limit(1000);
    if (fetchError) {
      throw fetchError;
    }
    if (!expiredCalendars || expiredCalendars.length === 0) {
      log('No expired calendars found');
      return {
        markedCount: 0,
        errors: []
      };
    }
    log(`Found ${expiredCalendars.length} expired calendars to mark for deletion`);
    // Process all expired calendars in parallel
    // Marking them will trigger the UPDATE webhook
    // which calls handle-calendar-changes edge function to process cleanup and deletion
    const markPromises = expiredCalendars.map(async (calendar) => {
      try {
        log(`Marking calendar for deletion: ${calendar.id} (${calendar.name})`);
        // Update calendar to mark for deletion
        // This triggers the UPDATE webhook which will process cleanup
        const { error: updateError } = await supabase.from('calendars').update({
          mark_for_deletion: true,
          deletion_date: now.toISOString()
        }).eq('id', calendar.id);
        if (updateError) {
          throw updateError;
        }
        log(`Successfully marked calendar for deletion: ${calendar.id}`);
        log(`Webhook will handle cleanup and final deletion`);
        return {
          success: true,
          calendarId: calendar.id,
          calendarName: calendar.name
        };
      } catch (error) {
        const errorMsg = `Failed to mark calendar ${calendar.id}: ${error instanceof Error ? error.message : String(error)}`;
        log(errorMsg, 'error', error);
        return {
          success: false,
          calendarId: calendar.id,
          error: errorMsg
        };
      }
    });
    // Wait for all updates to complete
    const results = await Promise.allSettled(markPromises);
    // Process results
    let markedCount = 0;
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        markedCount++;
      } else if (result.status === 'fulfilled' && !result.value.success) {
        errors.push(result.value.error || 'Unknown error');
      } else if (result.status === 'rejected') {
        errors.push(`Unexpected error: ${result.reason}`);
      }
    });
    log(`Cleanup initiated: ${markedCount}/${expiredCalendars.length} calendars marked for deletion`);
    log(`Database webhooks will process cleanup and final deletion for all marked calendars`);
    return {
      markedCount,
      errors
    };
  } catch (error) {
    log('Error in cleanupExpiredCalendars', 'error', error);
    throw error;
  }
}
/**
 * Main Edge Function handler
 */ Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    log('Cleanup expired calendars scheduled function triggered');
    const result = await cleanupExpiredCalendars();
    const response: Record<string, unknown> = {
      success: true,
      message: `Cleanup initiated: ${result.markedCount} calendars marked for deletion`,
      markedCount: result.markedCount,
      errors: result.errors,
      timestamp: new Date().toISOString()
    };
    if (result.errors.length > 0) {
      log(`Cleanup initiated with ${result.errors.length} errors`, 'warn', result.errors);
    } else {
      log('Cleanup initiated successfully');
    }
    return successResponse(response);
  } catch (error) {
    log('Error in cleanup expired calendars function', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
