/**
 * Handle Trade Changes Edge Function
 * Replaces Firebase onTradeChangedV2 trigger
 * 
 * Triggered by database webhooks when trades are modified
 * Handles: image cleanup, year changes, tag synchronization
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { 
  createServiceClient, 
  errorResponse, 
  successResponse, 
  handleCors, 
  log, 
  parseJsonBody 
} from '../_shared/supabase.ts'
import { 
  canDeleteImage, 
  extractTagsFromTrades, 
  updateTradeTagsWithGroupNameChange 
} from '../_shared/utils.ts'
import type { 
  DatabaseTriggerEvent, 
  TradeChangeEvent, 
  Trade, 
  Calendar 
} from '../_shared/types.ts'

interface TradeChangePayload {
  table: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  old_record?: any
  new_record?: any
  calendar_id?: string
  user_id?: string
}

/**
 * Clean up removed images when trades are modified
 */
async function cleanupRemovedImages(
  beforeTrades: Trade[], 
  afterTrades: Trade[], 
  calendarId: string,
  userId: string
): Promise<void> {
  try {
    log('Starting image cleanup process')
    
    // Create a map of all images in the 'after' state for quick lookup
    const afterImagesMap = new Map<string, boolean>()
    afterTrades.forEach(trade => {
      if (trade.images && Array.isArray(trade.images)) {
        trade.images.forEach(image => {
          if (image && image.id) {
            afterImagesMap.set(image.id, true)
          }
        })
      }
    })

    // Find images that were in the 'before' state but not in the 'after' state
    const imagesToDelete: string[] = []
    beforeTrades.forEach(trade => {
      if (trade.images && Array.isArray(trade.images)) {
        trade.images.forEach(image => {
          if (image && image.id && !afterImagesMap.has(image.id)) {
            imagesToDelete.push(image.id)
          }
        })
      }
    })

    if (imagesToDelete.length === 0) {
      log('No images to delete')
      return
    }

    log(`Found ${imagesToDelete.length} images to potentially delete`)

    // Use service client for storage operations
    const supabase = createServiceClient()
    
    // Filter images that can be safely deleted
    const finalImagesToDelete: string[] = []
    
    for (const imageId of imagesToDelete) {
      const canDelete = await canDeleteImage(supabase, imageId, calendarId)
      if (canDelete) {
        finalImagesToDelete.push(imageId)
        log(`Image ${imageId} can be safely deleted`)
      } else {
        log(`Image ${imageId} cannot be deleted - exists in related calendars`)
      }
    }

    if (finalImagesToDelete.length === 0) {
      log('No images to delete after safety check')
      return
    }

    // Delete images from Supabase Storage
    const deletePromises = finalImagesToDelete.map(async (imageId) => {
      try {
        const { error } = await supabase.storage
          .from('trade-images')
          .remove([`${userId}/${imageId}`])
        
        if (error) {
          log(`Error deleting image ${imageId}`, 'error', error)
        } else {
          log(`Successfully deleted image: ${imageId}`)
        }
      } catch (error) {
        log(`Error deleting image ${imageId}`, 'error', error)
      }
    })

    await Promise.all(deletePromises)
    log(`Image cleanup completed: ${finalImagesToDelete.length} images deleted`)
    
  } catch (error) {
    log('Error in cleanupRemovedImages', 'error', error)
    throw error
  }
}

/**
 * Handle trade year changes (moving trades between different years)
 * Note: In PostgreSQL schema, we don't have year subcollections
 * This logic may need adjustment based on the actual schema design
 */
async function handleTradeYearChanges(
  beforeTrades: Trade[], 
  afterTrades: Trade[], 
  calendarId: string
): Promise<void> {
  try {
    log('Checking for trade year changes')
    
    // In the PostgreSQL schema, trades are stored directly in the trades table
    // Year changes would be handled by updating the date field
    // This is automatically handled by the database, so we may not need this logic
    
    // For now, we'll log that this would be handled differently in PostgreSQL
    log('Trade year changes are handled automatically in PostgreSQL schema')
    
    // If we need to implement year-based logic, we would:
    // 1. Compare dates between before and after trades
    // 2. Update any year-based aggregations or statistics
    // 3. Trigger recalculation of calendar statistics
    
  } catch (error) {
    log('Error in handleTradeYearChanges', 'error', error)
    throw error
  }
}

/**
 * Update calendar tags when trade tags change
 */
async function updateCalendarTags(
  beforeTrades: Trade[], 
  afterTrades: Trade[], 
  calendarId: string
): Promise<void> {
  try {
    log('Updating calendar tags')
    
    const supabase = createServiceClient()
    
    // Extract tags from before and after trades
    const beforeTags = new Set<string>()
    const afterTags = new Set<string>()
    
    beforeTrades.forEach(trade => {
      if (trade.tags && Array.isArray(trade.tags)) {
        trade.tags.forEach(tag => beforeTags.add(tag))
      }
    })
    
    afterTrades.forEach(trade => {
      if (trade.tags && Array.isArray(trade.tags)) {
        trade.tags.forEach(tag => afterTags.add(tag))
      }
    })
    
    // Check if tags have changed
    const tagsChanged = beforeTags.size !== afterTags.size || 
      Array.from(beforeTags).some(tag => !afterTags.has(tag))
    
    if (!tagsChanged) {
      log('No tag changes detected')
      return
    }
    
    log(`Tag changes detected in calendar ${calendarId}`)
    
    // Get all trades for this calendar to rebuild complete tag list
    const { data: allTrades, error: tradesError } = await supabase
      .from('trades')
      .select('tags')
      .eq('calendar_id', calendarId)
    
    if (tradesError) {
      throw tradesError
    }
    
    // Extract all unique tags
    const allTags = extractTagsFromTrades(allTrades || [])
    
    // Update calendar with new tag list
    const { error: updateError } = await supabase
      .from('calendars')
      .update({ 
        tags: allTags,
        updated_at: new Date().toISOString()
      })
      .eq('id', calendarId)
    
    if (updateError) {
      throw updateError
    }
    
    log(`Updated calendar ${calendarId} with ${allTags.length} unique tags`)
    
  } catch (error) {
    log('Error in updateCalendarTags', 'error', error)
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
    log('Trade changes webhook received')
    
    // Parse the webhook payload
    const payload = await parseJsonBody<TradeChangePayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }
    
    log('Processing trade change event', 'info', { 
      operation: payload.operation,
      table: payload.table 
    })
    
    // Validate payload
    if (payload.table !== 'trades') {
      return errorResponse('Invalid table in payload', 400)
    }
    
    // For INSERT operations, we don't need to do cleanup
    if (payload.operation === 'INSERT') {
      log('INSERT operation - no cleanup needed')
      return successResponse({ message: 'Trade inserted successfully' })
    }
    
    // For DELETE operations, we need the old record
    if (payload.operation === 'DELETE' && !payload.old_record) {
      return errorResponse('Missing old_record for DELETE operation', 400)
    }
    
    // For UPDATE operations, we need both records
    if (payload.operation === 'UPDATE' && (!payload.old_record || !payload.new_record)) {
      return errorResponse('Missing records for UPDATE operation', 400)
    }
    
    // Extract calendar ID and user ID
    const calendarId = payload.calendar_id || payload.old_record?.calendar_id || payload.new_record?.calendar_id
    const userId = payload.user_id || payload.old_record?.user_id || payload.new_record?.user_id
    
    if (!calendarId || !userId) {
      return errorResponse('Missing calendar_id or user_id', 400)
    }
    
    // Get current trades for the calendar (for tag comparison)
    const supabase = createServiceClient()
    const { data: currentTrades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .eq('calendar_id', calendarId)
    
    if (tradesError) {
      log('Error fetching current trades', 'error', tradesError)
      return errorResponse('Database error', 500)
    }
    
    // For comparison, we need to simulate before/after states
    let beforeTrades: Trade[] = []
    let afterTrades: Trade[] = currentTrades || []
    
    if (payload.operation === 'UPDATE') {
      // Create before state by replacing the updated trade with old version
      beforeTrades = (currentTrades || []).map(trade => 
        trade.id === payload.old_record.id ? payload.old_record : trade
      )
    } else if (payload.operation === 'DELETE') {
      // Before state includes the deleted trade
      beforeTrades = [...(currentTrades || []), payload.old_record]
    }
    
    // Process the changes
    await Promise.all([
      // Clean up removed images
      cleanupRemovedImages(beforeTrades, afterTrades, calendarId, userId),
      
      // Handle year changes (may not be needed in PostgreSQL schema)
      handleTradeYearChanges(beforeTrades, afterTrades, calendarId),
      
      // Update calendar tags
      updateCalendarTags(beforeTrades, afterTrades, calendarId)
    ])
    
    log('Trade changes processed successfully')
    
    return successResponse({ 
      message: 'Trade changes processed successfully',
      calendar_id: calendarId,
      operation: payload.operation
    })
    
  } catch (error) {
    log('Error processing trade changes', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
