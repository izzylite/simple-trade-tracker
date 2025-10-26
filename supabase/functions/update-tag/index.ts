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

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { 
  createAuthenticatedClient, 
  errorResponse, 
  successResponse, 
  handleCors, 
  log, 
  parseJsonBody 
} from '../_shared/supabase.ts'
import { 
  updateTradeTagsWithGroupNameChange, 
  extractTagsFromTrades 
} from '../_shared/utils.ts'
import type { 
  UpdateTagRequest, 
  UpdateTagResponse, 
  Trade, 
  Calendar 
} from '../_shared/types.ts'

interface UpdateTagPayload {
  calendarId: string
  oldTag: string
  newTag: string
}

/**
 * Update tags in calendar metadata (tags, scoreSettings, requiredTagGroups)
 */
async function updateCalendarMetadata(
  supabase: any,
  calendarId: string,
  calendarData: Calendar,
  oldTag: string,
  newTag: string
): Promise<void> {
  try {
    log('Updating calendar metadata')
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    // Update required tag groups when a group name changes
    if (calendarData.required_tag_groups && Array.isArray(calendarData.required_tag_groups)) {
      const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null
      const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null
      
      if (oldGroup && newGroup && oldGroup !== newGroup) {
        // Group name changed, update it in required_tag_groups
        updateData.required_tag_groups = calendarData.required_tag_groups.map((group: string) =>
          group === oldGroup ? newGroup : group
        )
        log(`Updated required tag group: ${oldGroup} → ${newGroup}`)
      } else {
        // No group change needed
        updateData.required_tag_groups = calendarData.required_tag_groups
      }
    }
    
    // Update calendar tags array
    if (calendarData.tags && Array.isArray(calendarData.tags)) {
      updateData.tags = updateTagsWithGroupNameChange(calendarData.tags, oldTag, newTag)
      log(`Updated calendar tags array`)
    }
    
    // Update score settings if they exist
    if (calendarData.score_settings) {
      const scoreSettings = { ...calendarData.score_settings }
      
      if (scoreSettings.excluded_tags_from_patterns && Array.isArray(scoreSettings.excluded_tags_from_patterns)) {
        scoreSettings.excluded_tags_from_patterns = updateTagsWithGroupNameChange(
          scoreSettings.excluded_tags_from_patterns, 
          oldTag, 
          newTag
        )
      }
      
      if (scoreSettings.selected_tags && Array.isArray(scoreSettings.selected_tags)) {
        scoreSettings.selected_tags = updateTagsWithGroupNameChange(
          scoreSettings.selected_tags, 
          oldTag, 
          newTag
        )
      }
      
      updateData.score_settings = scoreSettings
      log(`Updated score settings`)
    }
    
    // Update the calendar
    const { error } = await supabase
      .from('calendars')
      .update(updateData)
      .eq('id', calendarId)
    
    if (error) {
      throw error
    }
    
    log('Calendar metadata updated successfully')
    
  } catch (error) {
    log('Error updating calendar metadata', 'error', error)
    throw error
  }
}

/**
 * Update tags in all trades for the calendar
 */
async function updateTradesTags(
  supabase: any,
  calendarId: string,
  oldTag: string,
  newTag: string
): Promise<number> {
  try {
    log(`Updating trades tags: ${oldTag} → ${newTag}`)
    
    // Get all trades for this calendar
    const { data: trades, error: fetchError } = await supabase
      .from('trades')
      .select('*')
      .eq('calendar_id', calendarId)
    
    if (fetchError) {
      throw fetchError
    }
    
    if (!trades || trades.length === 0) {
      log('No trades found for calendar')
      return 0
    }
    
    log(`Found ${trades.length} trades to process`)
    
    let totalTradesUpdated = 0
    const batchSize = 100 // Process in batches to avoid memory issues
    
    // Process trades in batches
    for (let i = 0; i < trades.length; i += batchSize) {
      const batch = trades.slice(i, i + batchSize)
      const updates: any[] = []
      
      batch.forEach(trade => {
        const result = updateTradeTagsWithGroupNameChange(trade, oldTag, newTag)
        
        if (result.updated) {
          updates.push({
            id: trade.id,
            tags: trade.tags,
            updated_at: new Date().toISOString()
          })
          totalTradesUpdated += result.updated_count
        }
      })
      
      // Update this batch if there are changes
      if (updates.length > 0) {
        for (const update of updates) {
          const { error } = await supabase
            .from('trades')
            .update({
              tags: update.tags,
              updated_at: update.updated_at
            })
            .eq('id', update.id)
          
          if (error) {
            log(`Error updating trade ${update.id}`, 'error', error)
            // Continue with other trades rather than failing completely
          }
        }
        
        log(`Updated batch of ${updates.length} trades`)
      }
    }
    
    log(`Total trades updated: ${totalTradesUpdated}`)
    return totalTradesUpdated
    
  } catch (error) {
    log('Error updating trades tags', 'error', error)
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
    log('Update tag request received')
    
    // Authenticate user
    const authResult = await createAuthenticatedClient(req)
    if (!authResult) {
      return errorResponse('Authentication required', 401)
    }
    
    const { user, supabase } = authResult
    
    // Parse request body
    const payload = await parseJsonBody<UpdateTagPayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }
    
    const { calendarId, oldTag, newTag } = payload
    
    // Validate required parameters
    if (!calendarId || !oldTag || newTag === undefined || newTag === null) {
      return errorResponse('Missing required parameters: calendarId, oldTag, or newTag', 400)
    }
    
    // If oldTag and newTag are the same, no update needed
    if (oldTag === newTag) {
      log('oldTag and newTag are identical, no update needed')
      return successResponse({ success: true, tradesUpdated: 0 })
    }
    
    log('Processing tag update', 'info', { calendarId, oldTag, newTag, userId: user.id })
    
    // Get calendar and verify ownership
    const { data: calendar, error: calendarError } = await supabase
      .from('calendars')
      .select('*')
      .eq('id', calendarId)
      .single()
    
    if (calendarError || !calendar) {
      return errorResponse('Calendar not found', 404)
    }
    
    if (calendar.user_id !== user.id) {
      return errorResponse('Unauthorized access to calendar', 403)
    }
    
    // Perform the tag updates
    const [tradesUpdated] = await Promise.all([
      // Update trades tags
      updateTradesTags(supabase, calendarId, oldTag, newTag),
      
      // Update calendar metadata
      updateCalendarMetadata(supabase, calendarId, calendar, oldTag, newTag)
    ])
    
    // After updating trades, refresh the calendar's tag list
    const { data: updatedTrades, error: tradesError } = await supabase
      .from('trades')
      .select('tags')
      .eq('calendar_id', calendarId)
    
    if (!tradesError && updatedTrades) {
      const allTags = extractTagsFromTrades(updatedTrades)
      
      await supabase
        .from('calendars')
        .update({ 
          tags: allTags,
          updated_at: new Date().toISOString()
        })
        .eq('id', calendarId)
      
      log(`Refreshed calendar tags: ${allTags.length} unique tags`)
    }
    
    log(`Tag update completed successfully: ${tradesUpdated} trades updated`)
    
    return successResponse({ 
      success: true, 
      tradesUpdated,
      message: `Successfully updated ${tradesUpdated} trades`
    })
    
  } catch (error) {
    log('Error processing tag update', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})

/**
 * Helper function to update tags with group name changes
 * This is a simplified version for the calendar metadata
 */
function updateTagsWithGroupNameChange(tags: string[], oldTag: string, newTag: string): string[] {
  if (!Array.isArray(tags)) return []
  
  const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null
  const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null
  const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup
  
  let updatedTags = [...tags]
  
  if (isGroupNameChange) {
    // Group name change - update all tags in the old group
    updatedTags = updatedTags.map(tag => {
      if (tag === oldTag) {
        // Direct match - replace with new tag
        return newTag.trim() === '' ? null : newTag.trim()
      } else if (tag.includes(':') && tag.split(':')[0] === oldGroup) {
        // Same group - update group name but keep tag name
        const tagName = tag.split(':')[1]
        return `${newGroup}:${tagName}`
      }
      return tag
    }).filter(tag => tag !== null) as string[]
  } else {
    // Not a group name change - just replace the specific tag
    const tagIndex = updatedTags.indexOf(oldTag)
    if (tagIndex !== -1) {
      if (newTag.trim() === '') {
        updatedTags.splice(tagIndex, 1)
      } else {
        updatedTags[tagIndex] = newTag.trim()
      }
    }
  }
  
  // Remove duplicates and sort
  return [...new Set(updatedTags)].sort()
}
