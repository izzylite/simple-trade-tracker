/**
 * Shared utility functions for Edge Functions
 * Business logic helpers and common operations
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { Trade,  TagUpdateResult } from './types.ts'

/**
 * Capitalizes the first letter of a string
 */
function capitalizeFirstLetter(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Formats a tag by capitalizing the group name (if it's a grouped tag)
 * @param tag The tag to format (e.g., "strategy:Volume" or "breakout")
 * @returns The formatted tag with capitalized group (e.g., "Strategy:Volume" or "breakout")
 */
export function formatTagWithCapitalizedGroup(tag: string): string {
  if (!tag) return tag

  if (tag.includes(':')) {
    const parts = tag.split(':')
    const group = capitalizeFirstLetter(parts[0].trim())
    const tagName = parts[1]?.trim() || ''
    return `${group}:${tagName}`
  }

  return tag
}

/**
 * Extract unique tags from an array of trades
 */
export function extractTagsFromTrades(trades: Trade[]): string[] {
  const tagSet = new Set<string>()

  trades.forEach(trade => {
    if (trade.tags && Array.isArray(trade.tags)) {
      trade.tags.forEach(tag => {
        if (tag && tag.trim()) {
          tagSet.add(tag.trim())
        }
      })
    }
  })

  return Array.from(tagSet).sort()
}

/**
 * Update tags in a trade object, handling group name changes
 */
export function updateTradeTagsWithGroupNameChange(
  trade: Trade, 
  oldTag: string, 
  newTag: string
): TagUpdateResult {
  if (!trade.tags || !Array.isArray(trade.tags)) {
    return { updated: false, updated_count: 0 }
  }

  // Check if this is a group name change (Category:Tag format)
  const oldGroup = oldTag.includes(':') ? oldTag.split(':')[0] : null
  const newGroup = newTag && newTag.includes(':') ? newTag.split(':')[0] : null
  const isGroupNameChange = oldGroup && newGroup && oldGroup !== newGroup

  let updatedCount = 0
  let updated = false

  if (isGroupNameChange) {
    // Group name change - update all tags in the old group
    for (let i = 0; i < trade.tags.length; i++) {
      const tag = trade.tags[i]
      if (tag === oldTag) {
        // Direct match - replace with new tag
        if (newTag.trim() === '') {
          trade.tags.splice(i, 1)
          i-- // Adjust index after removal
        } else {
          trade.tags[i] = newTag.trim()
        }
        updated = true
        updatedCount++
      } else if (tag.includes(':') && tag.split(':')[0] === oldGroup) {
        // Same group - update group name but keep tag name
        const tagName = tag.split(':')[1]
        trade.tags[i] = `${newGroup}:${tagName}`
        updated = true
        updatedCount++
      }
    }
  } else {
    // Not a group name change - just replace the specific tag
    const tagIndex = trade.tags.indexOf(oldTag)
    if (tagIndex !== -1) {
      if (newTag.trim() === '') {
        trade.tags.splice(tagIndex, 1)
      } else {
        trade.tags[tagIndex] = newTag.trim()
      }
      updated = true
      updatedCount++
    }
  }

  return { updated, updated_count: updatedCount }
}

/**
 * Check if an image exists in any trade within a calendar
 */
export async function imageExistsInCalendar(
  supabase: SupabaseClient,
  imageId: string,
  calendarId: string
): Promise<boolean> {
  try {
    const { data: trades, error } = await supabase
      .from('trades')
      .select('images')
      .eq('calendar_id', calendarId)

    if (error) {
      console.error('Error checking image existence:', error)
      return false
    }

    for (const trade of trades || []) {
      if (trade.images && Array.isArray(trade.images)) {
        for (const image of trade.images) {
          if (image && image.id === imageId) {
            return true
          }
        }
      }
    }

    return false
  } catch (error) {
    console.error('Error in imageExistsInCalendar:', error)
    return false
  }
}

/**
 * Check if an image can be safely deleted (considering duplicated and linked calendars)
 */
/**
 * Check if an image can be safely deleted
 * replacing the complex graph traversal with a direct global check
 * 
 * @param supabase - The Supabase client
 * @param imageId - The ID of the image to check
 * @param currentCalendarId - The calendar ID performing the cleanup
 * @param ignoreCurrentCalendar - If true, ignores usages in the current calendar (use for calendar usage/deletion)
 * @param ignoreTradeId - If provided, ignores this specific trade ID (use for trade update/delete to prevent self-matching)
 */
export async function canDeleteImage(
  supabase: SupabaseClient,
  imageId: string,
  currentCalendarId: string,
  ignoreCurrentCalendar = false,
  ignoreTradeId?: string
): Promise<boolean> {
  try {
    // Get user_id from calendar to scope the query
    const { data: calendar, error: calendarError } = await supabase
      .from('calendars')
      .select('user_id')
      .eq('id', currentCalendarId)
      .single()

    if (calendarError || !calendar) {
      console.error('Calendar not found during image check:', calendarError)
      return false // Safety first
    }

    const userId = calendar.user_id

    // Check for ANY usage of this image in the user's trades
    // We use the @> JSONB operator to check if the images array contains the specific image ID
    // The images column structure is: [{"id": "...", "url": "..."}]
    let query = supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .contains('images', [{ id: imageId }])

    // If we're deleting the whole calendar, we don't care if trades inside it use the image
    // (because they are being deleted too)
    if (ignoreCurrentCalendar) {
      query = query.neq('calendar_id', currentCalendarId)
    }

    // If we're processing a specific trade update/delete, we must ignore that trade
    // to avoid race conditions where the DB might still show the old state
    if (ignoreTradeId) {
      query = query.neq('id', ignoreTradeId)
    }

    const { count, error } = await query

    if (error) {
      console.error('Error checking image usage:', error)
      return false // Err on the side of caution
    }

    // If count is 0, no one else is using it -> Safe to delete
    // If count > 0, someone uses it -> Keep it
    return count === 0

  } catch (error) {
    console.error('Error in canDeleteImage:', error)
    return false // Err on the side of caution
  }
}

/**
 * Generate a unique share ID
 */
export function generateShareId(type: 'trade' | 'calendar', id: string): string {
  const prefix = type === 'trade' ? 'share' : 'calendar_share'
  return `${prefix}_${id}`
}

/**
 * Clean event name for economic calendar
 */
export function cleanEventName(eventName: string): string {
  return eventName
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\w\s-]/g, '')
}

/**
 * Parse MyFXBook date format to ISO string
 */
export function parseMyFXBookDate(dateStr: string, timeStr: string): string {
  try {
    // MyFXBook typically uses format like "2024-08-24" and "14:30"
    const [year, month, day] = dateStr.split('-').map(Number)
    const [hour, minute] = timeStr.split(':').map(Number)
    
    const date = new Date(year, month - 1, day, hour, minute)
    return date.toISOString()
  } catch (error) {
    console.error('Error parsing MyFXBook date:', error)
    return new Date().toISOString()
  }
}

/**
 * Delete trade images from Supabase Storage
 *
 * @param supabase - Supabase client instance
 * @param imageIds - Array of image IDs to delete
 * @param userId - User ID for constructing the storage path
 * @param logFn - Optional logging function (defaults to console.log)
 * @returns Object with success count and total count
 */ export async function deleteTradeImages(supabase: SupabaseClient, imageIds : string[], userId : string, logFn = console.log) {
  if (imageIds.length === 0) {
    return {
      successCount: 0,
      totalCount: 0
    };
  }
  const deletePromises = imageIds.map(async (imageId)=>{
    try {
      // Path must match upload path: users/${userId}/trade-images/${filename}
      const filePath = `users/${userId}/trade-images/${imageId}`;
      const { error } = await supabase.storage.from('trade-images').remove([
        filePath
      ]);
      if (error) {
        logFn(`Error deleting image ${imageId}`, 'error', error);
        return false;
      } else {
        logFn(`Successfully deleted image: ${imageId}`);
        return true;
      }
    } catch (error) {
      logFn(`Error deleting image ${imageId}`, 'error', error);
      return false;
    }
  });
  const results = await Promise.all(deletePromises);
  const successCount = results.filter(Boolean).length;
  return {
    successCount,
    totalCount: imageIds.length
  };
}
 
