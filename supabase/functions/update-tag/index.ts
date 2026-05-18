/**
 * Update Tag Edge Function
 *
 * Renames a tag (or a tag group, e.g. "Setup:A" → "Strategy:A") across every trade
 * in a calendar, then refreshes calendar metadata (tags array, required_tag_groups,
 * excluded_tags_from_patterns) and triggers exactly one year_stats recompute.
 *
 * Previously this issued N individual UPDATE statements (one per affected trade),
 * each of which fired the per-row trigger_trade_changes webhook, spawning N
 * concurrent handle-trade-changes invocations that all raced to update the same
 * calendars row. With ~500 trades this hit Postgres statement_timeout (57014).
 *
 * Now: one SQL RPC (bulk_update_tag_in_calendar) does all writes inside a
 * transaction with app.skip_trade_webhook = 'true', then we explicitly recompute
 * year_stats once per affected calendar.
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
      return successResponse({ success: true, tradesUpdated: 0 });
    }

    log('Processing tag update', 'info', { calendarId, oldTag, newTag, userId: user.id });

    // Single RPC does all writes (trades + calendar metadata + linked-calendar sync)
    // with the skip-webhook GUC set, so we don't trigger the per-row webhook storm.
    // The RPC enforces calendar ownership against auth.uid().
    const { data: result, error: rpcError } = await supabase.rpc('bulk_update_tag_in_calendar', {
      p_calendar_id: calendarId,
      p_old_tag: oldTag,
      p_new_tag: newTag,
    });

    if (rpcError) {
      log('bulk_update_tag_in_calendar RPC failed', 'error', rpcError);
      const status = rpcError.message?.includes('Not authorized') ? 403
        : rpcError.message?.includes('not found') ? 404
        : 500;
      return errorResponse(rpcError.message || 'Failed to update tags', status);
    }

    const tradesUpdated = (result as { trades_updated?: number })?.trades_updated ?? 0;
    const linkedTradesUpdated = (result as { linked_trades_updated?: number })?.linked_trades_updated ?? 0;
    const linkedCalendarId = (result as { linked_calendar_id?: string | null })?.linked_calendar_id ?? null;

    log('Bulk tag update completed', 'info', { tradesUpdated, linkedTradesUpdated, linkedCalendarId });

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

    log(`Tag update completed successfully: ${tradesUpdated} trades updated`);
    return successResponse({
      success: true,
      tradesUpdated,
      linkedTradesUpdated,
      message: `Successfully updated ${tradesUpdated} trades`,
    });
  } catch (error) {
    log('Error processing tag update', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
