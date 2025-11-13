/**
 * Update Tag Edge Function
 * Replaces Firebase updateTagV2 callable function
 *
 * Updates tags across all trades in a calendar with support for:
 * - Group name changes (Category:Tag format)
 * - Tag deletion and replacement
 * - Calendar metadata updates
 * - Batch processing with transactions
 */  
import { createAuthenticatedClient, errorResponse, successResponse, handleCors, log, parseJsonBody } from '../_shared/supabase.ts';
import type { AuthenticatedRequest } from '../_shared/supabase.ts';
import { updateTradeTagsWithGroupNameChange, extractTagsFromTrades, formatTagWithCapitalizedGroup } from '../_shared/utils.ts';
import type { Calendar, Trade, UpdateTagRequest } from '../_shared/types.ts';

/**
 * Helper function to update tags array with group name changes
 * Used for calendar metadata (tags, scoreSettings, requiredTagGroups)
 */ function updateTagsArray(tags: string[], oldTag: string, newTag: string): string[] {
  if (!Array.isArray(tags)) return [];
  const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null;
  const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null;
  const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup;
  let updatedTags = [...tags];
  if (isGroupNameChange) {
    // Group name change - update all tags in the old group
    updatedTags = updatedTags.map((tag) => {
      if (tag === oldTag) {
        // Direct match - replace with new tag
        return newTag.trim() === '' ? null : newTag.trim();
      } else if (tag.includes(':') && tag.split(':')[0] === oldGroup) {
        // Same group - update group name but keep tag name
        const tagName = tag.split(':')[1];
        return `${newGroup}:${tagName}`;
      }
      return tag;
    }).filter((tag) => tag !== null) as string[];
  } else {
    // Not a group name change - just replace the specific tag
    const tagIndex = updatedTags.indexOf(oldTag);
    if (tagIndex !== -1) {
      if (newTag.trim() === '') {
        updatedTags.splice(tagIndex, 1);
      } else {
        updatedTags[tagIndex] = newTag.trim();
      }
    }
  }
  // Remove duplicates and sort
  return [...new Set(updatedTags)].sort();
}
/**
 * Update tags in calendar metadata (tags, scoreSettings, requiredTagGroups)
 */ async function updateCalendarMetadata(supabase: AuthenticatedRequest['supabase'], calendarId: string, calendarData: Calendar, oldTag: string, newTag: string): Promise<void> {
  try {
    log('Updating calendar metadata');
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    // Update required tag groups when a group name changes
    if (calendarData.required_tag_groups && Array.isArray(calendarData.required_tag_groups)) {
      const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null;
      const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null;
      if (oldGroup && newGroup && oldGroup !== newGroup) {
        // Group name changed, update it in required_tag_groups
        updateData.required_tag_groups = calendarData.required_tag_groups.map((group) => group === oldGroup ? newGroup : group);
        log(`Updated required tag group: ${oldGroup} → ${newGroup}`);
      }
    }
    // Update calendar tags array
    if (calendarData.tags && Array.isArray(calendarData.tags)) {
      updateData.tags = updateTagsArray(calendarData.tags, oldTag, newTag);
      log(`Updated calendar tags array`);
    }
    // Update score settings if they exist
    if (calendarData.score_settings) {
      const scoreSettings = { ...calendarData.score_settings };
      if (scoreSettings.excluded_tags_from_patterns && Array.isArray(scoreSettings.excluded_tags_from_patterns)) {
        scoreSettings.excluded_tags_from_patterns = updateTagsArray(scoreSettings.excluded_tags_from_patterns, oldTag, newTag);
      }
      if (scoreSettings.selected_tags && Array.isArray(scoreSettings.selected_tags)) {
        scoreSettings.selected_tags = updateTagsArray(scoreSettings.selected_tags, oldTag, newTag);
      }
      updateData.score_settings = scoreSettings;
      log(`Updated score settings`);
    }
    // Update the calendar
    // Cast to satisfy TypeScript in edge runtime (no generated DB types)
    const { error } = await supabase
      .from('calendars')
      .update(updateData as never)
      .eq('id', calendarId);
    if (error) {
      throw error;
    }
    log('Calendar metadata updated successfully');
  } catch (error) {
    log('Error updating calendar metadata', 'error', error);
    throw error;
  }
}

/**
 * Update tags in all trades for the calendar
 */ async function updateTradesTags(supabase: AuthenticatedRequest['supabase'], calendarId: string, oldTag: string, newTag: string): Promise<number> {
  try {
    log(`Updating trades tags: ${oldTag} → ${newTag}`);
    // Get only necessary fields for this calendar
    const { data: trades, error: fetchError } = await supabase
      .from('trades')
      .select('id,tags')
      .eq('calendar_id', calendarId);
    if (fetchError) {
      throw fetchError;
    }
    if (!trades || trades.length === 0) {
      log('No trades found for calendar');
      return 0;
    }
    log(`Found ${trades.length} trades to process`);
    let totalTradesUpdated = 0;
    const batchSize = 100;
    // Process trades in batches
    for (let i = 0; i < trades.length; i += batchSize) {
      const batch = trades.slice(i, i + batchSize);
      const updates: Array<{ id: string; tags: string[]; updated_at: string }> = [];
      batch.forEach((trade: Trade) => {
        const result = updateTradeTagsWithGroupNameChange(trade, oldTag, newTag);
        if (result.updated && trade.tags) {
          updates.push({
            id: trade.id,
            tags: trade.tags,
            updated_at: new Date().toISOString()
          });
          totalTradesUpdated += result.updated_count;
        }
      });
      // Update this batch if there are changes
      if (updates.length > 0) {
        for (const update of updates) {
          const { error } = await supabase
            .from('trades')
            .update({
              tags: update.tags,
              updated_at: update.updated_at
            } as never)
            .eq('id', update.id);
          if (error) {
            log(`Error updating trade ${update.id}`, 'error', error);
          }
        }
        log(`Updated batch of ${updates.length} trades`);
      }
    }
    log(`Total trades updated: ${totalTradesUpdated}`);
    return totalTradesUpdated;
  } catch (error) {
    log('Error updating trades tags', 'error', error);
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
    if (req.method !== 'POST') {
      return errorResponse('Method Not Allowed', 405);
    }
    log('Update tag request received');
    // Authenticate user
    const authResult = await createAuthenticatedClient(req);
    if (!authResult) {
      return errorResponse('Authentication required', 401);
    }
    const { user, supabase } = authResult;
    // Parse request body
    const payload = await parseJsonBody<UpdateTagRequest>(req);
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400);
    }
    const { calendar_id: calendarId, old_tag: rawOldTag, new_tag: rawNewTag } = payload;
    const oldTag = typeof rawOldTag === 'string' ? rawOldTag.trim() : rawOldTag as string;
    // Capitalize the group name in newTag
    const newTag = typeof rawNewTag === 'string'
      ? formatTagWithCapitalizedGroup(rawNewTag.trim())
      : rawNewTag as string;
    // Validate required parameters
    if (!calendarId || !oldTag || newTag === undefined || newTag === null) {
      return errorResponse('Missing required parameters: calendarId, oldTag, or newTag', 400);
    }
    // If oldTag and newTag are the same, no update needed
    if (oldTag === newTag) {
      log('oldTag and newTag are identical, no update needed');
      return successResponse({
        success: true,
        tradesUpdated: 0
      });
    }
    log('Processing tag update', 'info', {
      calendarId,
      oldTag,
      newTag,
      userId: user.id
    });
    // Get calendar (RLS enforces ownership)
    const { data: calendar, error: calendarError } = await supabase
      .from('calendars')
      .select('*')
      .eq('id', calendarId)
      .single();
    if (calendarError || !calendar) {
      return errorResponse('Calendar not found', 404);
    }
    // Perform the tag updates
    const [tradesUpdated] = await Promise.all([
      // Update trades tags
      updateTradesTags(supabase, calendarId, oldTag, newTag),
      // Update calendar metadata
      updateCalendarMetadata(supabase, calendarId, calendar, oldTag, newTag)
    ]);
    // After updating trades, refresh the calendar's tag list
    const { data: updatedTrades, error: tradesError } = await supabase.from('trades').select('tags').eq('calendar_id', calendarId);
    if (!tradesError && updatedTrades) {
      const allTags = extractTagsFromTrades(updatedTrades);
      await supabase
        .from('calendars')
        .update({
          tags: allTags,
          updated_at: new Date().toISOString()
        } as never)
        .eq('id', calendarId);
      log(`Refreshed calendar tags: ${allTags.length} unique tags`);
    }
    log(`Tag update completed successfully: ${tradesUpdated} trades updated`);
    return successResponse({
      success: true,
      tradesUpdated,
      message: `Successfully updated ${tradesUpdated} trades`
    });
  } catch (error) {
    log('Error processing tag update', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
