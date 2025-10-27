/**
 * Handle Calendar Changes Edge Function
 *
 * Triggered by database webhooks when calendars are inserted, updated, or deleted
 * Handles: DELETE - cascading deletes, image cleanup, data consistency
 *         INSERT - placeholder for future logic
 *         UPDATE - processes mark_for_deletion flag from cleanup-expired-calendars cron job
 */ import { createServiceClient, errorResponse, successResponse, handleCors, log, parseJsonBody } from '../_shared/supabase.ts';
import { canDeleteImage } from '../_shared/utils.ts';
import type { Calendar, Trade, CalendarWebhookPayload } from '../_shared/types.ts';
/**
 * Get all trades for a calendar to identify images
 */ async function getCalendarTrades(calendarId: string): Promise<Trade[]> {
  try {
    const supabase = createServiceClient();
    const { data: trades, error } = await supabase.from('trades').select('*').eq('calendar_id', calendarId);
    if (error) {
      throw error;
    }
    return trades || [];
  } catch (error) {
    log('Error fetching calendar trades', 'error', error);
    throw error;
  }
}
/**
 * Extract all image IDs from trades
 */ function extractImageIds(trades: Trade[]): Set<string> {
  const imageIds = new Set<string>();
  trades.forEach((trade) => {
    if (trade.images && Array.isArray(trade.images)) {
      trade.images.forEach((image: Record<string, unknown>) => {
        if (image && typeof image.id === 'string') {
          imageIds.add(image.id);
        }
      });
    }
  });
  return imageIds;
}

/**
 * Clean up images associated with deleted calendar
 */ async function cleanupCalendarImages(calendarId: string, userId: string): Promise<number> {
  try {
    log(`Starting image cleanup for calendar ${calendarId}`);
    const trades = await getCalendarTrades(calendarId);
    log(`Found ${trades.length} trades in calendar`);
    const imageIdsToCheck = extractImageIds(trades);
    log(`Found ${imageIdsToCheck.size} images to check for deletion`);
    if (imageIdsToCheck.size === 0) {
      log('No images to process');
      return 0;
    }
    const supabase = createServiceClient();
    const imageIdsToDelete = new Set<string>();
    const deleteChecks = await Promise.all(Array.from(imageIdsToCheck).map(async (imageId) => {
      const canDelete = await canDeleteImage(supabase, imageId, calendarId);
      return {
        imageId,
        canDelete
      };
    }));
    deleteChecks.forEach(({ imageId, canDelete }) => {
      if (canDelete) {
        imageIdsToDelete.add(imageId);
        log(`Image ${imageId} can be safely deleted`);
      } else {
        log(`Image ${imageId} cannot be deleted - exists in related calendars`);
      }
    });
    log(`Will delete ${imageIdsToDelete.size} images`);
    if (imageIdsToDelete.size === 0) {
      log('No images to delete after safety check');
      return 0;
    }
    const { successCount, totalCount } = await deleteTradeImages(supabase, Array.from(imageIdsToDelete), userId, log);
    log(`Image cleanup completed: ${successCount}/${totalCount} images deleted`);
    return successCount;
  } catch (error) {
    log('Error in cleanupCalendarImages', 'error', error);
    throw error;
  }
}

/**
 * Delete all trades associated with the calendar
 */ async function deleteCalendarTrades(calendarId: string): Promise<number> {
  try {
    log(`Deleting trades for calendar ${calendarId}`);
    const supabase = createServiceClient();
    const { error, count } = await supabase.from('trades').delete().eq('calendar_id', calendarId);
    if (error) {
      throw error;
    }
    const deletedCount = count || 0;
    log(`Deleted ${deletedCount} trades`);
    return deletedCount;
  } catch (error) {
    log('Error deleting calendar trades', 'error', error);
    throw error;
  }
}
/**
 * Clean up shared links associated with the calendar
 */ async function cleanupSharedLinks(calendarId: string): Promise<number> {
  try {
    log(`Cleaning up shared links for calendar ${calendarId}`);
    const supabase = createServiceClient();
    let totalDeleted = 0;
    // Delete shared trade links
    const { error: tradeError, count: tradeCount } = await supabase.from('shared_trades').delete().eq('calendar_id', calendarId);
    if (tradeError) {
      log('Error deleting shared trade links', 'error', tradeError);
    } else {
      totalDeleted += tradeCount || 0;
      log(`Deleted ${tradeCount || 0} shared trade links`);
    }
    // Delete shared calendar links
    const { error: calendarError, count: calendarCount } = await supabase.from('shared_calendars').delete().eq('calendar_id', calendarId);
    if (calendarError) {
      log('Error deleting shared calendar links', 'error', calendarError);
    } else {
      totalDeleted += calendarCount || 0;
      log(`Deleted ${calendarCount || 0} shared calendar links`);
    }
    log(`Total shared links deleted: ${totalDeleted}`);
    return totalDeleted;
  } catch (error) {
    log('Error cleaning up shared links', 'error', error);
    throw error;
  }
}

/**
 * Handle calendar deletion
 */ async function handleDelete(calendarId: string, userId: string, oldRecord: Calendar | undefined): Promise<Record<string, unknown>> {
  log(`Processing DELETE operation for calendar ${calendarId}`);
  const cleanupResults = await Promise.allSettled([cleanupCalendarImages(calendarId, userId), cleanupSharedLinks(calendarId)]);
  const tradesDeleted = await deleteCalendarTrades(calendarId);
  const imagesDeleted = cleanupResults[0].status === 'fulfilled' ? cleanupResults[0].value : 0;
  const sharedLinksDeleted = cleanupResults[1].status === 'fulfilled' ? cleanupResults[1].value : 0;
  cleanupResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      const operation = ['image cleanup', 'shared links cleanup'][index];
      log(`Error in ${operation}`, 'error', result.reason);
    }
  });
  log(`Calendar cleanup completed for ${calendarId}`, 'info', {
    images_deleted: imagesDeleted,
    trades_deleted: tradesDeleted,
    shared_links_deleted: sharedLinksDeleted
  });
  return {
    message: 'Calendar deletion cleanup completed successfully',
    calendar_id: calendarId,
    cleanup_summary: {
      images_deleted: imagesDeleted,
      trades_deleted: tradesDeleted,
      shared_links_deleted: sharedLinksDeleted
    }
  };
}
/**
 * Handle calendar insert
 */ async function handleInsert(calendarId: string, userId: string, newRecord: Calendar | undefined): Promise<Record<string, unknown>> {
  log(`Processing INSERT operation for calendar ${calendarId}`);
  return {
    message: 'Calendar INSERT acknowledged - no action taken',
    calendar_id: calendarId,
    operation: 'INSERT'
  };
}
/**
 * Handle calendar update
 */ async function handleUpdate(calendarId: string, userId: string, oldRecord: Calendar | undefined, newRecord: Calendar | undefined): Promise<Record<string, unknown>> {
  log(`Processing UPDATE operation for calendar ${calendarId}`);
  if (newRecord?.mark_for_deletion && newRecord?.deletion_date) {
    const deletionDateChanged = oldRecord?.deletion_date !== newRecord.deletion_date;
    if (deletionDateChanged) {
      log(`Calendar ${calendarId} marked for deletion - processing cleanup`);
      const cleanupResult = await handleDelete(calendarId, userId, newRecord);
      try {
        log(`Deleting calendar ${calendarId} after successful cleanup`);
        const supabase = createServiceClient();
        const { error: deleteError } = await supabase.from('calendars').delete().eq('id', calendarId);
        if (deleteError) {
          throw deleteError;
        }
        log(`Successfully deleted calendar ${calendarId}`);
        return {
          message: 'Calendar cleanup and deletion completed successfully',
          calendar_id: calendarId,
          operation: 'UPDATE -> DELETE',
          cleanup_summary: cleanupResult.cleanup_summary
        };
      } catch (error) {
        log(`Failed to delete calendar ${calendarId} after cleanup`, 'error', error);
        throw new Error(`Cleanup successful but deletion failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      log(`Calendar ${calendarId} marked for deletion but deletion_date didn't change - skipping`);
      return {
        message: 'Calendar marked for deletion but no date change - skipping',
        calendar_id: calendarId,
        operation: 'UPDATE'
      };
    }
  }
  return {
    message: 'Calendar UPDATE acknowledged - no action taken',
    calendar_id: calendarId,
    operation: 'UPDATE'
  };
}

/**
 * Main Edge Function handler
 */ Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    log('Calendar changes webhook received');
    const payload = await parseJsonBody<CalendarWebhookPayload>(req);
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400);
    }
    log('Processing calendar change', 'info', {
      operation: payload.operation,
      calendar_id: payload.calendar_id,
      user_id: payload.user_id
    });
    if (!payload.calendar_id || !payload.user_id) {
      return errorResponse('Missing calendar_id or user_id', 400);
    }
    if (!payload.operation) {
      return errorResponse('Missing operation type', 400);
    }
    const { calendar_id: calendarId, user_id: userId, operation, old_record, new_record } = payload;
    let result: Record<string, unknown>;
    switch (operation) {
      case 'DELETE':
        result = await handleDelete(calendarId, userId, old_record);
        break;
      case 'INSERT':
        result = await handleInsert(calendarId, userId, new_record);
        break;
      case 'UPDATE':
        result = await handleUpdate(calendarId, userId, old_record, new_record);
        break;
      default:
        return errorResponse(`Unknown operation: ${operation}`, 400);
    }
    return successResponse(result);
  } catch (error) {
    log('Error processing calendar changes webhook', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
