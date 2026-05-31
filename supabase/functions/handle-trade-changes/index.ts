/**
 * Handle Trade Changes Edge Function
 *
 * Triggered by database webhooks when trades are modified
 * Handles:
 * - Image cleanup on DELETE and UPDATE operations
 * - Year stats recalculation
 * - Trade sync to linked calendars (one-way sync with 24hr window)
 */
import { createServiceClient, errorResponse, successResponse, handleCors, log, parseJsonBody } from '../_shared/supabase.ts';
import { canDeleteImage, deleteTradeImages } from '../_shared/utils.ts';
import { prepareSyncedTrade, isWithinSyncWindow, buildCalendarRiskSettings, CalendarRiskSettings } from '../_shared/tradeSync.ts';
import { updateYearStats } from '../_shared/yearStats.ts';
import type { Trade, TradeWebhookPayload } from '../_shared/types.ts';

// Timing-safe comparison to avoid leaking the secret via response-time differences.
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

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
      // 4th arg: ignoreTradeId - ensure we don't count the trade itself (critical for race conditions)
      const canDelete = await canDeleteImage(supabase, imageId, calendarId, false, oldTrade?.id);
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

  // Shared-secret auth: notify_trade_changes() sends X-Trade-Webhook-Secret.
  // Required because verify_jwt is disabled (a DB webhook can't present a JWT),
  // so without this the endpoint would be publicly invocable. Mirrors
  // paddle-webhook / dispatch-reminders.
  const expectedSecret = Deno.env.get('TRADE_WEBHOOK_SECRET');
  if (!expectedSecret) {
    log('TRADE_WEBHOOK_SECRET not set — refusing to process', 'error');
    return errorResponse('Webhook not configured', 500);
  }
  const providedSecret = req.headers.get('x-trade-webhook-secret') ?? '';
  if (!constantTimeEquals(providedSecret, expectedSecret)) {
    log('handle-trade-changes auth failed', 'warn', { hasHeader: providedSecret.length > 0 });
    return errorResponse('Unauthorized', 401);
  }

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

    // Validate operation-specific requirements
    if (payload.operation === 'DELETE' && !payload.old_record) {
      return errorResponse('Missing old_record for DELETE operation', 400);
    }
    if (payload.operation === 'UPDATE' && (!payload.old_record || !payload.new_record)) {
      return errorResponse('Missing records for UPDATE operation', 400);
    }

    // Extract calendar ID (user_id is derived authoritatively below, not trusted from the body)
    const calendarId = payload.calendar_id || payload.old_record?.calendar_id || payload.new_record?.calendar_id;
    if (!calendarId) {
      return errorResponse('Missing calendar_id', 400);
    }

    // Defense in depth: derive the owning user_id from the calendar row rather than
    // trusting the request body, so a forged payload cannot target another user's
    // storage path. (The shared-secret gate above is the primary defense.)
    const ownerClient = createServiceClient();
    const { data: calRow, error: calErr } = await ownerClient
      .from('calendars')
      .select('user_id')
      .eq('id', calendarId)
      .maybeSingle();
    if (calErr) {
      log('Failed to load calendar for ownership derivation', 'error', calErr);
      return errorResponse('Internal server error', 500);
    }
    if (!calRow) {
      return successResponse({ message: 'Calendar not found; nothing to process', calendar_id: calendarId });
    }
    const userId = (calRow as { user_id?: string }).user_id;
    if (!userId) {
      return errorResponse('Calendar has no owner', 500);
    }

    // Clean up images based on operation type (UPDATE and DELETE only)
    if (payload.operation === 'DELETE') {
      // Delete all images from the deleted trade
      await cleanupRemovedImages(payload.old_record, undefined, calendarId, userId);
    } else if (payload.operation === 'UPDATE') {
      // Delete images that were removed in the update
      await cleanupRemovedImages(payload.old_record, payload.new_record, calendarId, userId);
    }

    // Calculate and update year_stats for all operations (INSERT, UPDATE, DELETE)
    await updateYearStats(calendarId);

    // Sync trade to linked calendar (if one exists)
    await syncToLinkedCalendar(payload.operation, payload.old_record, payload.new_record, calendarId);

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

/**
 * Sync trade to linked calendar
 * One-way sync: trades in source calendar are copied to linked target calendar
 * 24-hour window: updates/deletes only propagate within 24 hours of trade creation
 */
async function syncToLinkedCalendar(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  oldTrade: Trade | undefined,
  newTrade: Trade | undefined,
  calendarId: string
): Promise<void> {
  try {
    const trade = newTrade || oldTrade;
    if (!trade) return;

    // Skip if this trade is already a synced copy (prevent infinite loops)
    if (trade.is_synced_copy) {
      log('Skipping sync - trade is already a synced copy');
      return;
    }

    // Skip temporary trades (placeholder trades being edited)
    if (trade.is_temporary) {
      log('Skipping sync - trade is temporary');
      return;
    }

    const supabase = createServiceClient();

    // Get the linked calendar ID for this calendar
    const { data: sourceCalendar, error: calendarError } = await supabase
      .from('calendars')
      .select('linked_to_calendar_id')
      .eq('id', calendarId)
      .single();

    if (calendarError || !sourceCalendar?.linked_to_calendar_id) {
      // No linked calendar - nothing to sync
      return;
    }

    const linkedCalendarId = sourceCalendar.linked_to_calendar_id;
    log('Syncing trade to linked calendar', 'info', { operation, linkedCalendarId });

    // Fetch target calendar's risk settings for amount recalculation
    const { data: targetCalendar, error: targetError } = await supabase
      .from('calendars')
      .select('account_balance, risk_per_trade, dynamic_risk_enabled, increased_risk_percentage, profit_threshold_percentage')
      .eq('id', linkedCalendarId)
      .single();

    // Calculate cumulative P&L for target calendar up to (but not including) the trade date
    // This matches the frontend calculation for consistent dynamic risk behavior
    let cumulativePnL = 0;
    if (targetCalendar && !targetError && trade.trade_date) {
      const { data: targetTrades } = await supabase
        .from('trades')
        .select('amount, trade_date')
        .eq('calendar_id', linkedCalendarId)
        .lt('trade_date', trade.trade_date);

      if (targetTrades) {
        cumulativePnL = targetTrades.reduce((sum: any, t: { amount: any; }) => sum + (t.amount || 0), 0);
      }
    }

    // Build target settings (will be undefined if fetch failed, causing raw amount copy)
    const targetSettings: CalendarRiskSettings | undefined = targetCalendar && !targetError
      ? buildCalendarRiskSettings(targetCalendar, cumulativePnL)
      : undefined;

    if (operation === 'INSERT' && newTrade) {
      // Prepare synced trade using utility (handles field stripping and amount calculation)
      // This sets is_synced_copy: true and source_trade_id to prevent infinite loops
      const syncedTradeData = prepareSyncedTrade(newTrade, linkedCalendarId, targetSettings);

      // Use RPC function for consistency - tags merged, user_id set, year stats via webhook
      const { error: insertError } = await supabase.rpc('add_trade_with_tags', {
        p_trade: syncedTradeData,
        p_calendar_id: linkedCalendarId
      });

      if (insertError) {
        log('Error creating synced trade', 'error', insertError);
      } else {
        log('Synced trade created successfully');
      }
    } else if (operation === 'UPDATE' && newTrade) {
      // Check 24-hour window using utility
      if (!isWithinSyncWindow(newTrade)) {
        log('Skipping update sync - outside 24hr window');
        return;
      }

      // Find the synced trade's actual ID by source_trade_id
      const { data: syncedTrade, error: findError } = await supabase
        .from('trades')
        .select('id')
        .eq('source_trade_id', newTrade.id)
        .eq('calendar_id', linkedCalendarId)
        .single();

      if (findError || !syncedTrade) {
        log('Synced trade not found for update', 'warn', { source_trade_id: newTrade.id });
        return;
      }

      // Prepare updated trade data
      const syncedTradeData = prepareSyncedTrade(newTrade, linkedCalendarId, targetSettings);

      // Use RPC function for consistency
      const { error: updateError } = await supabase.rpc('update_trade_with_tags', {
        p_trade_id: syncedTrade.id,
        p_trade_updates: syncedTradeData,
        p_calendar_id: linkedCalendarId
      });

      if (updateError) {
        log('Error updating synced trade', 'error', updateError);
      } else {
        log('Synced trade updated successfully');
      }
    } else if (operation === 'DELETE' && oldTrade) {
      // Check 24-hour window using utility
      if (!isWithinSyncWindow(oldTrade)) {
        log('Skipping delete sync - outside 24hr window');
        return;
      }

      // Find the synced trade's actual ID by source_trade_id
      const { data: syncedTrade, error: findError } = await supabase
        .from('trades')
        .select('id')
        .eq('source_trade_id', oldTrade.id)
        .eq('calendar_id', linkedCalendarId)
        .single();

      if (findError || !syncedTrade) {
        log('Synced trade not found for delete', 'warn', { source_trade_id: oldTrade.id });
        return;
      }

      // Use RPC function for consistency
      const { error: deleteError } = await supabase.rpc('delete_trade_transactional', {
        p_trade_id: syncedTrade.id
      });

      if (deleteError) {
        log('Error deleting synced trade', 'error', deleteError);
      } else {
        log('Synced trade deleted successfully');
      }
    }
  } catch (error) {
    log('Error in syncToLinkedCalendar', 'error', error);
    // Don't fail the webhook on sync errors - log and continue
  }
}
