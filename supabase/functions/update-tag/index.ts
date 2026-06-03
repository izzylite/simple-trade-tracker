/**
 * Update Tag Edge Function
 *
 * Renames a tag (or a tag group, e.g. "Setup:A" → "Strategy:A") across every trade
 * and note owned by the user, then refreshes calendar metadata and triggers exactly
 * one year_stats recompute.
 *
 * The trade and note bulk RPCs run in parallel (Promise.all). Each uses a GUC to
 * suppress per-row triggers during the bulk write, then does one explicit mirror/
 * stats refresh at the end.
 */
import { createAuthenticatedClient, createServiceClient, errorResponse, successResponse, handleCors, log, parseJsonBody } from '../_shared/supabase.ts';
import { extractTagsFromTrades, formatTagWithCapitalizedGroup } from '../_shared/utils.ts';
import { updateYearStats } from '../_shared/yearStats.ts';
import type { UpdateTagRequest } from '../_shared/types.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method Not Allowed', 405);
    }

    log('Update tag request received');

    const authResult = await createAuthenticatedClient(req);
    if (!authResult) {
      return errorResponse('Authentication required', 401);
    }
    const { user, supabase } = authResult;

    const payload = await parseJsonBody<UpdateTagRequest>(req);
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400);
    }

    const { calendar_id: calendarId, old_tag: rawOldTag, new_tag: rawNewTag } = payload;
    const oldTag = typeof rawOldTag === 'string' ? rawOldTag.trim() : (rawOldTag as string);
    const newTag = typeof rawNewTag === 'string'
      ? formatTagWithCapitalizedGroup(rawNewTag.trim())
      : (rawNewTag as string);

    if (!calendarId || !oldTag || newTag === undefined || newTag === null) {
      return errorResponse('Missing required parameters: calendarId, oldTag, or newTag', 400);
    }

    if (oldTag === newTag) {
      log('oldTag and newTag are identical, no update needed');
      return successResponse({ success: true, tradesUpdated: 0, notesUpdated: 0 });
    }

    log('Processing tag update', 'info', { calendarId, oldTag, newTag, userId: user.id });

    // Run trade and note bulk renames in parallel. Each RPC uses a GUC to suppress
    // per-row triggers during the write, so neither causes a webhook/trigger storm.
    // bulk_update_tag_in_calendar enforces calendar ownership; bulk_update_tag_in_notes
    // enforces user ownership — both via auth.uid() inside SECURITY DEFINER functions.
    const [calRpc, notesRpc] = await Promise.all([
      supabase.rpc('bulk_update_tag_in_calendar', {
        p_calendar_id: calendarId,
        p_old_tag: oldTag,
        p_new_tag: newTag,
      }),
      supabase.rpc('bulk_update_tag_in_notes', {
        p_user_id: user.id,
        p_old_tag: oldTag,
        p_new_tag: newTag,
      }),
    ]);

    if (calRpc.error) {
      log('bulk_update_tag_in_calendar RPC failed', 'error', calRpc.error);
      const status = calRpc.error.message?.includes('Not authorized') ? 403
        : calRpc.error.message?.includes('not found') ? 404
        : 500;
      return errorResponse(calRpc.error.message || 'Failed to update tags', status);
    }

    if (notesRpc.error) {
      log('bulk_update_tag_in_notes RPC failed (non-fatal)', 'warn', notesRpc.error);
    }

    const tradesUpdated = (calRpc.data as { trades_updated?: number })?.trades_updated ?? 0;
    const linkedTradesUpdated = (calRpc.data as { linked_trades_updated?: number })?.linked_trades_updated ?? 0;
    const linkedCalendarId = (calRpc.data as { linked_calendar_id?: string | null })?.linked_calendar_id ?? null;
    const notesUpdated = (notesRpc.data as { notes_updated?: number })?.notes_updated ?? 0;

    log('Bulk tag update completed', 'info', { tradesUpdated, linkedTradesUpdated, linkedCalendarId, notesUpdated });

    // Refresh the calendar's tags array from the current trade tags. The RPC
    // already applied the rename transform, but a full re-derive from trades
    // catches any pre-existing drift between calendar.tags and actual tags-in-use.
    // Use service client because authenticated client may not be able to read all
    // trades depending on RLS shape. The RPC already verified ownership.
    const service = createServiceClient();
    const { data: tradeRows, error: tradesErr } = await service
      .from('trades')
      .select('tags')
      .eq('calendar_id', calendarId);
    if (!tradesErr && tradeRows) {
      const allTags = extractTagsFromTrades(tradeRows as Array<{ tags?: string[] | null }> as never);
      await service
        .from('calendars')
        .update({ tags: allTags, updated_at: new Date().toISOString() } as never)
        .eq('id', calendarId);
      log(`Refreshed calendar tags: ${allTags.length} unique tags`);
    }

    // Trigger exactly one year_stats recompute per affected calendar. Skip the
    // coalesce guard since we just mutated trades and need fresh stats. Run the
    // linked-calendar recompute in parallel.
    const recomputes: Promise<unknown>[] = [
      updateYearStats(calendarId, { coalesce: false }),
    ];
    if (linkedCalendarId && linkedTradesUpdated > 0) {
      recomputes.push(updateYearStats(linkedCalendarId, { coalesce: false }));
    }
    await Promise.all(recomputes);

    log(`Tag update completed successfully: ${tradesUpdated} trades, ${notesUpdated} notes updated`);
    return successResponse({
      success: true,
      tradesUpdated,
      notesUpdated,
      linkedTradesUpdated,
      message: `Successfully updated ${tradesUpdated} trades and ${notesUpdated} notes`,
    });
  } catch (error) {
    log('Error processing tag update', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
