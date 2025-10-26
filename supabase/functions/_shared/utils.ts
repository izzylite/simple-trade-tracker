/**
 * Shared utility functions for Edge Functions
 * Business logic helpers and common operations
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { Trade, TradeImage, TagUpdateResult } from './types.ts'

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
  supabase: ReturnType<typeof createClient>,
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
 * Check if an image can be safely deleted (considering duplicated calendars)
 */
export async function canDeleteImage(
  supabase: ReturnType<typeof createClient>,
  imageId: string,
  currentCalendarId: string
): Promise<boolean> {
  try {
    // Get calendar information
    const { data: calendar, error: calendarError } = await supabase
      .from('calendars')
      .select('duplicated_calendar, source_calendar_id, user_id')
      .eq('id', currentCalendarId)
      .single()

    if (calendarError || !calendar) {
      console.error('Calendar not found:', calendarError)
      return false
    }

    const isDuplicatedCalendar = calendar.duplicated_calendar
    const sourceCalendarId = calendar.source_calendar_id

    if (isDuplicatedCalendar && sourceCalendarId) {
      // Deletion from duplicated calendar - check source and other duplicates
      
      // Check if image exists in source calendar
      const existsInSource = await imageExistsInCalendar(supabase, imageId, sourceCalendarId)
      if (existsInSource) {
        return false
      }

      // Check if image exists in other duplicated calendars
      const { data: otherDuplicates, error: duplicatesError } = await supabase
        .from('calendars')
        .select('id')
        .eq('source_calendar_id', sourceCalendarId)
        .eq('duplicated_calendar', true)
        .neq('id', currentCalendarId)

      if (duplicatesError) {
        console.error('Error finding duplicated calendars:', duplicatesError)
        return false
      }

      for (const duplicate of otherDuplicates || []) {
        const existsInDuplicate = await imageExistsInCalendar(supabase, imageId, duplicate.id)
        if (existsInDuplicate) {
          return false
        }
      }

      return true
    } else {
      // Deletion from original calendar - check all duplicated calendars
      const { data: duplicatedCalendars, error: duplicatesError } = await supabase
        .from('calendars')
        .select('id')
        .eq('source_calendar_id', currentCalendarId)
        .eq('duplicated_calendar', true)

      if (duplicatesError) {
        console.error('Error finding duplicated calendars:', duplicatesError)
        return false
      }

      for (const duplicate of duplicatedCalendars || []) {
        const existsInDuplicate = await imageExistsInCalendar(supabase, imageId, duplicate.id)
        if (existsInDuplicate) {
          return false
        }
      }

      return true
    }
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
 * Calculate trade statistics
 */
export function calculateTradeStats(trades: Trade[]) {
  const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== undefined)
  
  if (closedTrades.length === 0) {
    return {
      total_trades: 0,
      win_count: 0,
      loss_count: 0,
      win_rate: 0,
      total_pnl: 0,
      avg_win: 0,
      avg_loss: 0,
      profit_factor: 0
    }
  }

  const wins = closedTrades.filter(t => (t.pnl || 0) > 0)
  const losses = closedTrades.filter(t => (t.pnl || 0) < 0)
  
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const totalWinPnl = wins.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0))
  
  return {
    total_trades: closedTrades.length,
    win_count: wins.length,
    loss_count: losses.length,
    win_rate: (wins.length / closedTrades.length) * 100,
    total_pnl: totalPnl,
    avg_win: wins.length > 0 ? totalWinPnl / wins.length : 0,
    avg_loss: losses.length > 0 ? totalLossPnl / losses.length : 0,
    profit_factor: totalLossPnl > 0 ? totalWinPnl / totalLossPnl : 0
  }
}
