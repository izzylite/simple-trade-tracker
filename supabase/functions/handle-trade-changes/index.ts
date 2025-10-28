/**
 * Handle Trade Changes Edge Function
 *
 * Triggered by database webhooks when trades are modified
 * Handles: image cleanup on DELETE and UPDATE operations
 */  
import { createServiceClient, errorResponse, successResponse, handleCors, log, parseJsonBody } from '../_shared/supabase.ts';
import { canDeleteImage, deleteTradeImages } from '../_shared/utils.ts';
import type { Trade, TradeWebhookPayload } from '../_shared/types.ts';
/**
 * Clean up removed images when a trade is deleted or updated
 */ async function cleanupRemovedImages(oldTrade: Trade | undefined, newTrade: Trade | undefined, calendarId: string, userId: string): Promise<void> {
  try {
    log('Starting image cleanup process');
    // Get images from old and new records
    const oldImages = (oldTrade?.images as Record<string, unknown>[] | undefined) || [];
    const newImages = (newTrade?.images as Record<string, unknown>[] | undefined) || [];
    // Create a map of new images for quick lookup
    const newImagesMap = new Map<string, boolean>();
    newImages.forEach((image) => {
      if (image && typeof image.id === 'string') {
        newImagesMap.set(image.id, true);
      }
    });
    // Find images that were removed (in old but not in new)
    const imagesToDelete: string[] = [];
    oldImages.forEach((image) => {
      if (image && typeof image.id === 'string' && !newImagesMap.has(image.id)) {
        imagesToDelete.push(image.id);
      }
    });
    if (imagesToDelete.length === 0) {
      log('No images to delete');
      return;
    }
    log(`Found ${imagesToDelete.length} images to potentially delete`);
    // Use service client for storage operations
    const supabase = createServiceClient();
    // Filter images that can be safely deleted
    // (check if they're used in duplicated calendars)
    const finalImagesToDelete: string[] = [];
    for (const imageId of imagesToDelete) {
      const canDelete = await canDeleteImage(supabase, imageId, calendarId);
      if (canDelete) {
        finalImagesToDelete.push(imageId);
        log(`Image ${imageId} can be safely deleted`);
      } else {
        log(`Image ${imageId} cannot be deleted - exists in related calendars`);
      }
    }
    if (finalImagesToDelete.length === 0) {
      log('No images to delete after safety check');
      return;
    }
    // Delete images from Supabase Storage using shared utility
    const { successCount, totalCount } = await deleteTradeImages(supabase, finalImagesToDelete, userId, log);
    log(`Image cleanup completed: ${successCount}/${totalCount} images deleted`);
  } catch (error) {
    log('Error in cleanupRemovedImages', 'error', error);
  // Don't throw - we don't want image cleanup failures to fail the webhook
  }
}
/**
 * Main Edge Function handler
 */ Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    log('Trade changes webhook received');
    // Parse the webhook payload
    const payload = await parseJsonBody<TradeWebhookPayload>(req);
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400);
    }
    log('Processing trade change event', 'info', {
      operation: payload.operation,
      table: payload.table
    });
    // Validate payload
    if (payload.table !== 'trades') {
      return errorResponse('Invalid table in payload', 400);
    }
    // For INSERT operations, no cleanup needed
    if (payload.operation === 'INSERT') {
      log('INSERT operation - no cleanup needed');
      return successResponse({
        message: 'Trade inserted successfully'
      });
    }
    // For DELETE operations, we need the old record
    if (payload.operation === 'DELETE' && !payload.old_record) {
      return errorResponse('Missing old_record for DELETE operation', 400);
    }
    // For UPDATE operations, we need both records
    if (payload.operation === 'UPDATE' && (!payload.old_record || !payload.new_record)) {
      return errorResponse('Missing records for UPDATE operation', 400);
    }
    // Extract calendar ID and user ID
    const calendarId = payload.calendar_id || payload.old_record?.calendar_id || payload.new_record?.calendar_id;
    const userId = payload.user_id || payload.old_record?.user_id || payload.new_record?.user_id;
    if (!calendarId || !userId) {
      return errorResponse('Missing calendar_id or user_id', 400);
    }
    // Clean up images based on operation type
    if (payload.operation === 'DELETE') {
      // Delete all images from the deleted trade
      await cleanupRemovedImages(payload.old_record, undefined, calendarId, userId);
    } else if (payload.operation === 'UPDATE') {
      // Delete images that were removed in the update
      await cleanupRemovedImages(payload.old_record, payload.new_record, calendarId, userId);
    }
    log('Trade changes processed successfully');
    return successResponse({
      message: 'Trade changes processed successfully',
      calendar_id: calendarId,
      operation: payload.operation
    });
  } catch (error) {
    log('Error processing trade changes', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
