/**
 * Cleanup Deleted Calendar Edge Function
 * Replaces Firebase cleanupDeletedCalendarV2 trigger
 * 
 * Triggered by database webhooks when calendars are deleted
 * Handles: cascading deletes, image cleanup, data consistency
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
import { canDeleteImage } from '../_shared/utils.ts'
import type { 
  DatabaseTriggerEvent, 
  CalendarDeleteEvent, 
  Calendar,
  Trade 
} from '../_shared/types.ts'

interface CalendarDeletePayload {
  calendar_id: string
  user_id: string
  calendar_data?: Calendar
}

/**
 * Get all trades for a calendar to identify images
 */
async function getCalendarTrades(calendarId: string): Promise<Trade[]> {
  try {
    const supabase = createServiceClient()
    
    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('calendar_id', calendarId)
    
    if (error) {
      throw error
    }
    
    return trades || []
  } catch (error) {
    log('Error fetching calendar trades', 'error', error)
    throw error
  }
}

/**
 * Extract all image IDs from trades
 */
function extractImageIds(trades: Trade[]): Set<string> {
  const imageIds = new Set<string>()
  
  trades.forEach(trade => {
    if (trade.images && Array.isArray(trade.images)) {
      trade.images.forEach(image => {
        if (image && image.id) {
          imageIds.add(image.id)
        }
      })
    }
  })
  
  return imageIds
}

/**
 * Clean up images associated with deleted calendar
 */
async function cleanupCalendarImages(
  calendarId: string, 
  userId: string, 
  calendarData: Calendar
): Promise<number> {
  try {
    log(`Starting image cleanup for calendar ${calendarId}`)
    
    // Get all trades for this calendar
    const trades = await getCalendarTrades(calendarId)
    log(`Found ${trades.length} trades in calendar`)
    
    // Extract all image IDs
    const imageIdsToCheck = extractImageIds(trades)
    log(`Found ${imageIdsToCheck.size} images to check for deletion`)
    
    if (imageIdsToCheck.size === 0) {
      log('No images to process')
      return 0
    }
    
    const supabase = createServiceClient()
    const imageIdsToDelete = new Set<string>()
    
    // Check each image to see if it can be safely deleted
    for (const imageId of imageIdsToCheck) {
      const canDelete = await canDeleteImage(supabase, imageId, calendarId)
      if (canDelete) {
        imageIdsToDelete.add(imageId)
        log(`Image ${imageId} can be safely deleted`)
      } else {
        log(`Image ${imageId} cannot be deleted - exists in related calendars`)
      }
    }
    
    log(`Will delete ${imageIdsToDelete.size} images`)
    
    if (imageIdsToDelete.size === 0) {
      log('No images to delete after safety check')
      return 0
    }
    
    // Delete images from Supabase Storage
    const deletePromises = Array.from(imageIdsToDelete).map(async (imageId) => {
      try {
        const { error } = await supabase.storage
          .from('trade-images')
          .remove([`${userId}/${imageId}`])
        
        if (error) {
          log(`Error deleting image ${imageId}`, 'error', error)
          return false
        } else {
          log(`Successfully deleted image: ${imageId}`)
          return true
        }
      } catch (error) {
        log(`Error deleting image ${imageId}`, 'error', error)
        return false
      }
    })
    
    const results = await Promise.all(deletePromises)
    const successCount = results.filter(Boolean).length
    
    log(`Image cleanup completed: ${successCount}/${imageIdsToDelete.size} images deleted`)
    return successCount
    
  } catch (error) {
    log('Error in cleanupCalendarImages', 'error', error)
    throw error
  }
}

/**
 * Delete all trades associated with the calendar
 * Note: In PostgreSQL, this should be handled by CASCADE DELETE
 * but we'll implement it explicitly for safety
 */
async function deleteCalendarTrades(calendarId: string): Promise<number> {
  try {
    log(`Deleting trades for calendar ${calendarId}`)
    
    const supabase = createServiceClient()
    
    // Delete all trades for this calendar
    const { error, count } = await supabase
      .from('trades')
      .delete()
      .eq('calendar_id', calendarId)
    
    if (error) {
      throw error
    }
    
    const deletedCount = count || 0
    log(`Deleted ${deletedCount} trades`)
    return deletedCount
    
  } catch (error) {
    log('Error deleting calendar trades', 'error', error)
    throw error
  }
}

/**
 * Clean up shared links associated with the calendar
 */
async function cleanupSharedLinks(calendarId: string): Promise<number> {
  try {
    log(`Cleaning up shared links for calendar ${calendarId}`)
    
    const supabase = createServiceClient()
    let totalDeleted = 0
    
    // Delete shared trade links
    const { error: tradeError, count: tradeCount } = await supabase
      .from('shared_trades')
      .delete()
      .eq('calendar_id', calendarId)
    
    if (tradeError) {
      log('Error deleting shared trade links', 'error', tradeError)
    } else {
      totalDeleted += tradeCount || 0
      log(`Deleted ${tradeCount || 0} shared trade links`)
    }
    
    // Delete shared calendar links
    const { error: calendarError, count: calendarCount } = await supabase
      .from('shared_calendars')
      .delete()
      .eq('calendar_id', calendarId)
    
    if (calendarError) {
      log('Error deleting shared calendar links', 'error', calendarError)
    } else {
      totalDeleted += calendarCount || 0
      log(`Deleted ${calendarCount || 0} shared calendar links`)
    }
    
    log(`Total shared links deleted: ${totalDeleted}`)
    return totalDeleted
    
  } catch (error) {
    log('Error cleaning up shared links', 'error', error)
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
    log('Calendar deletion cleanup webhook received')
    
    // Parse the webhook payload
    const payload = await parseJsonBody<CalendarDeletePayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }
    
    log('Processing calendar deletion cleanup', 'info', { 
      calendar_id: payload.calendar_id,
      user_id: payload.user_id
    })
    
    // Validate payload
    if (!payload.calendar_id || !payload.user_id) {
      return errorResponse('Missing calendar_id or user_id', 400)
    }
    
    const { calendar_id: calendarId, user_id: userId, calendar_data: calendarData } = payload
    
    // If we don't have calendar data, try to reconstruct basic info
    const defaultCalendarData: Calendar = {
      id: calendarId,
      user_id: userId,
      duplicated_calendar: false,
      source_calendar_id: null,
      ...calendarData
    } as Calendar
    
    // Perform cleanup operations in parallel where possible
    const cleanupResults = await Promise.allSettled([
      // Clean up images (must be done before deleting trades)
      cleanupCalendarImages(calendarId, userId, defaultCalendarData),
      
      // Clean up shared links
      cleanupSharedLinks(calendarId),
    ])
    
    // Delete trades after image cleanup
    const tradesDeleted = await deleteCalendarTrades(calendarId)
    
    // Process results
    const imagesDeleted = cleanupResults[0].status === 'fulfilled' ? cleanupResults[0].value : 0
    const sharedLinksDeleted = cleanupResults[1].status === 'fulfilled' ? cleanupResults[1].value : 0
    
    // Log any errors
    cleanupResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const operation = ['image cleanup', 'shared links cleanup'][index]
        log(`Error in ${operation}`, 'error', result.reason)
      }
    })
    
    log(`Calendar cleanup completed for ${calendarId}`, 'info', {
      images_deleted: imagesDeleted,
      trades_deleted: tradesDeleted,
      shared_links_deleted: sharedLinksDeleted
    })
    
    return successResponse({ 
      message: 'Calendar cleanup completed successfully',
      calendar_id: calendarId,
      cleanup_summary: {
        images_deleted: imagesDeleted,
        trades_deleted: tradesDeleted,
        shared_links_deleted: sharedLinksDeleted
      }
    })
    
  } catch (error) {
    log('Error processing calendar deletion cleanup', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
