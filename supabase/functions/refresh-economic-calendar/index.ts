/**
 * Refresh Economic Calendar Edge Function
 * Replaces Firebase refreshEconomicCalendar callable function
 * 
 * Manually refreshes economic calendar data for specific dates/currencies
 * by fetching from MyFXBook API and updating the database
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
import type {
  EconomicEvent
} from '../_shared/types.ts'

interface RefreshCalendarPayload {
  targetDate: string // YYYY-MM-DD format
  currencies: string[] // Array of currency codes
  events?: EconomicEvent[] // Optional: specific events to look for (EXACT Firebase format)
}



/**
 * Fetch weekly economic calendar data from MyFXBook (EXACT Firebase logic)
 */
async function fetchFromMyFXBookWeekly(): Promise<EconomicEvent[]> {
  try {
    log('🔄 Fetching weekly economic calendar from MyFXBook...')

    const url = 'https://www.myfxbook.com/forex-economic-calendar'
    log(`📡 Fetching URL: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    log(`✅ Response received: ${response.status}, content length: ${html.length}`)

    // Call the process-economic-events function to parse the HTML
    const processResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-economic-events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({ htmlContent: html })
      }
    )

    if (!processResponse.ok) {
      throw new Error(`Process function failed: ${await processResponse.text()}`)
    }

    const processResult = await processResponse.json()
    const stats = processResult.data || processResult

    const extracted = stats.parsed_total ?? (stats.events?.length || 0)
    log(`🎯 Successfully extracted ${extracted} events from MyFXBook (upserted=${stats.upserted_count ?? 0}, existing=${stats.existing_count ?? 0})`)

    // Prefer events if provided, otherwise return empty (refresh uses only counts)
    return stats.events || []

  } catch (error) {
    log('❌ Error fetching from MyFXBook:', 'error', error)
    throw error
  }
}




/**
 * Update events in database
 */
async function updateEventsInDatabase(events: EconomicEvent[]): Promise<number> {
  try {
    if (events.length === 0) {
      return 0
    }

    log(`Updating ${events.length} events in database`)

    const supabase = createServiceClient()
    let updatedCount = 0

    for (const e of events) {
      const normalizeImpact = (impact?: string) => {
        const i = (impact || '').toLowerCase()
        if (i === 'high') return 'High'
        if (i === 'medium') return 'Medium'
        if (i === 'low') return 'Low'
        return 'Low'
      }

      const row = {
        external_id: e.id,
        currency: e.currency,
        event_name: e.event,
        impact: normalizeImpact(e.impact),
        event_date: e.date,
        event_time: e.time_utc ? new Date(e.time_utc).toISOString() : null,
        time_utc: e.time_utc ?? null,
        unix_timestamp: e.unix_timestamp ?? null,
        actual_value: e.actual ?? null,
        forecast_value: e.forecast ?? null,
        previous_value: e.previous ?? null,
        country: e.country ?? null,
        flag_code: e.flag_code ?? null,
        flag_url: e.flag_url ?? null,
        source_url: 'https://www.myfxbook.com/forex-economic-calendar',
        data_source: e.source ?? 'myfxbook',
        last_updated: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('economic_events')
        .upsert(row, { onConflict: 'external_id' })
        .select('external_id')

      if (error) {
        log(`Error updating event ${e.id}`, 'error', error)
      } else {
        updatedCount += (data?.length || 0)
      }
    }

    log(`Updated ${updatedCount} events in database`)
    return updatedCount

  } catch (error) {
    log('Error updating events in database', 'error', error)
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
    log('Refresh economic calendar request received')
    
    // This function can be called by users or other functions
    // No authentication required - it's a data processing function
    
    // Parse request body
    const payload = await parseJsonBody<RefreshCalendarPayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }
    
    const { targetDate, currencies, events: requestedEvents } = payload

    // Validate required parameters (EXACT Firebase validation)
    if (!targetDate || !currencies || !Array.isArray(currencies)) {
      return errorResponse('Missing required parameters: targetDate and currencies array', 400)
    }

    // Optional: specific events to look for (EXACT Firebase logic)
    const hasSpecificEvents = requestedEvents && requestedEvents.length > 0

    log(`🔄 Refreshing economic calendar for date: ${targetDate}, currencies: ${currencies.join(', ')}`)
    if (hasSpecificEvents) {
      log(`🎯 Looking for ${requestedEvents!.length} specific event(s): ${requestedEvents!.map(e => e.event).join(', ')}`)
    } else {
      log(`📊 Refreshing all events for the specified date and currencies`)
    }

    // EXACT Firebase retry logic
    let updated = false
    let count = 0
    const maxRetries = 5
    let allEventsForDate: EconomicEvent[] = []
    let foundEvents: EconomicEvent[] = []

    while (!updated && count < maxRetries) {
      const freshEvents = await fetchFromMyFXBookWeekly()

      // Filter events by target date and currencies (EXACT Firebase logic)
      allEventsForDate = freshEvents.filter(event => {
        const eventDate = new Date(event.time_utc).toISOString().split('T')[0]
        return eventDate === targetDate && currencies.includes(event.currency)
      })

      if (hasSpecificEvents) {
        // Find all requested events by matching IDs (EXACT Firebase logic)
        const requestedEventIds = requestedEvents!.map(e => e.id)
        foundEvents = allEventsForDate.filter(event => requestedEventIds.includes(event.id))

        log(`📊 Found ${foundEvents.length}/${requestedEvents!.length} requested events in ${allEventsForDate.length} total events`)

        // Check if any of the found events have updated actual values
        let hasUpdates = false
        for (const foundEvent of foundEvents) {
          const originalEvent = requestedEvents!.find(e => e.id === foundEvent.id)
          if (originalEvent && foundEvent.actual !== originalEvent.actual) {
            hasUpdates = true
            log(`✅ Event updated: ${foundEvent.event} - Actual changed from "${originalEvent.actual}" to "${foundEvent.actual}"`)
          }
        }

        if (hasUpdates) {
          updated = true
          break
        } else {
          log(`❌ No updates found for requested events. Retrying (${count + 1}/${maxRetries}) after ${count + 1} seconds...`)
        }

        if (foundEvents.length === 0 || count >= maxRetries) {
          log(`⚠️ Events not found or max retries reached (${count + 1}/${maxRetries})`)
          break
        }

        await new Promise(resolve => setTimeout(resolve, (count + 1) * 1000))
        count++
      } else {
        // No specific events requested, just refresh all events for the date
        updated = true
        break
      }
    }

    log(`📊 Found ${allEventsForDate.length} events to update for ${targetDate}`)

    // Store events in database (EXACT Firebase logic)
    const updatedCount = await updateEventsInDatabase(allEventsForDate)
    
    // Log details about found events (EXACT Firebase logic)
    if (hasSpecificEvents) {
      if (foundEvents.length > 0) {
        log(`🎯 Found ${foundEvents.length} specific event(s):`)
        foundEvents.forEach(event => {
          log(`- ${event.event}: Actual: ${event.actual}, Forecast: ${event.forecast}, Previous: ${event.previous}`)
        })
      } else {
        const requestedEventIds = requestedEvents!.map(e => e.id)
        log(`⚠️ None of the requested events found. Requested IDs: ${requestedEventIds.join(', ')}`, 'warn')
      }
    }

    log(`✅ Successfully updated ${updatedCount} economic events`)

    // EXACT Firebase response format
    const response = {
      success: true,
      updatedCount,
      targetEvents: allEventsForDate, // All events for the date/currencies
      foundEvents, // The specific events that were requested (if any)
      targetDate,
      currencies,
      requestedEvents: requestedEvents || [],
      hasSpecificEvents,
      message: hasSpecificEvents
        ? `Updated ${updatedCount} events for ${targetDate}. Found ${foundEvents.length}/${requestedEvents!.length} requested events.`
        : `Updated ${updatedCount} events for ${targetDate}.`
    }
    
    return successResponse(response)
    
  } catch (error) {
    log('Error refreshing economic calendar', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
