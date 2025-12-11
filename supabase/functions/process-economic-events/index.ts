/**
 * Process Economic Events Edge Function
 * Replaces Firebase processHtmlEconomicEvents callable function
 *
 * Processes HTML content from MyFXBook to extract economic events
 * and stores them in the PostgreSQL database
 */
 
import {
  createServiceClient,
  errorResponse,
  successResponse,
  handleCors,
  log,
  parseJsonBody
} from '../_shared/supabase.ts'
import type {
  ProcessEconomicEventsResponse,
  EconomicEvent
} from '../_shared/types.ts'

// Import deno-dom for HTML parsing (replaces cheerio)
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts"

interface ProcessEventsPayload {
  htmlContent: string
}

// DB row mapping for economic_events table
export type EconomicEventDBRow = {
  external_id: string
  currency: string
  event_name: string
  impact: string
  event_date: string
  event_time?: string | null
  time_utc?: string | null
  unix_timestamp?: number | null
  actual_value?: string | null
  forecast_value?: string | null
  previous_value?: string | null
  actual_result_type?: string | null
  country?: string | null
  flag_code?: string | null
  flag_url?: string | null
  is_all_day?: boolean | null
  description?: string | null
  source_url?: string | null
  data_source?: string | null
  last_updated?: string | null
}

function normalizeImpact(impact?: string): string {
  const i = (impact || '').toLowerCase()
  if (i === 'high') return 'High'
  if (i === 'medium') return 'Medium'
  if (i === 'low') return 'Low'
  // Only High/Medium/Low are allowed to reach DB; anything else was filtered
  return 'Low'
}

export function mapEventToDbRow(e: EconomicEvent): EconomicEventDBRow | null {
  // Skip events with missing required fields
  if (!e.event_name || !e.currency || !e.external_id) {
    return null
  }
  return {
    external_id: e.external_id,
    currency: e.currency,
    event_name: e.event_name,
    impact: normalizeImpact(e.impact),
    event_date: e.event_date,
    event_time: e.time_utc ? new Date(e.time_utc).toISOString() : null,
    time_utc: e.time_utc ?? null,
    unix_timestamp: e.unix_timestamp ?? null,
    actual_value: e.actual_value ?? null,
    forecast_value: e.forecast_value ?? null,
    previous_value: e.previous_value ?? null,
    actual_result_type: e.actual_result_type ?? null,
    country: e.country ?? null,
    flag_code: e.flag_code ?? null,
    flag_url: e.flag_url ?? null,
    is_all_day: false,
    description: null,
    source_url: 'https://www.myfxbook.com/forex-economic-calendar',
    data_source: e.data_source ?? 'myfxbook',
    last_updated: new Date().toISOString(),
  }
}

// Helpers ported from Firebase parseMyFXBookWeeklyEnhanced
function isNumericValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 25) return false
  const cleaned = trimmed
    .replace(/N\/?A|n\/?a/gi, '')
    .replace(/%/g, '')
    .replace(/bps/gi, '')
    .replace(/pips?/gi, '')
    .replace(/\+/g, '')
    .replace(/,/g, '')
    .replace(/–/g, '-')
    .replace(/—/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length === 0 || cleaned.length > 20) return false
  const isNumeric = /^-?\d*(\.\d+)?$/.test(cleaned)
  const canParse = !isNaN(parseFloat(cleaned))
  return isNumeric && canParse && cleaned.length > 0
}

function cleanNumericValue(value: string): string {
  if (!value) return ''
  return value.trim()
    .replace(/^\+/, '')
    .replace(/,/g, '')
    .trim()
}

/**
 * Clean event name by removing newlines and excess whitespace
 */
function cleanEventName(name: string): string {
  if (!name) return ''
  return name
    .replace(/[\r\n]+/g, ' ')  // Replace newlines with space
    .replace(/\s+/g, ' ')       // Collapse multiple whitespace to single space
    .trim()
}

/**
 * Determine if an actual result is good or bad based on MyFXBook indicators
 * Ported from Firebase implementation
 */
function determineResultType(cellEl: Element): 'good' | 'bad' | 'neutral' | '' {
  // Method 1: Check CSS classes for background color indicators
  const cellClass = cellEl.getAttribute('class') || ''
  if (cellClass.includes('background-transparent-red')) {
    return 'bad'
  }
  if (cellClass.includes('background-transparent-green')) {
    return 'good'
  }

  // Method 2: Check data-content attribute for explicit descriptions
  const dataContentEl = cellEl.querySelector('[data-content]') as Element | null
  if (dataContentEl) {
    const dataContent = dataContentEl.getAttribute('data-content') || ''
    if (dataContent.toLowerCase().includes('worse than expected')) {
      return 'bad'
    }
    if (dataContent.toLowerCase().includes('better than expected')) {
      return 'good'
    }
    if (dataContent.toLowerCase().includes('as expected')) {
      return 'neutral'
    }
  }

  // Method 3: Check inner elements for color indicators
  const innerElements = cellEl.querySelectorAll('[class*="background-transparent"]')
  for (const inner of Array.from(innerElements)) {
    const innerClass = (inner as Element).getAttribute('class') || ''
    if (innerClass.includes('background-transparent-red')) {
      return 'bad'
    }
    if (innerClass.includes('background-transparent-green')) {
      return 'good'
    }
  }

  return '' // Unable to determine
}

function getFlagUrl(countryCode: string, size: string = 'w160'): string {
  if (!countryCode) return ''
  return `https://flagcdn.com/${size}/${countryCode.toLowerCase()}.png`
}

async function generateEventId(currency: string, eventName: string, country: string, impact: string): Promise<string> {
  const uniqueString = `${currency}-${eventName}-${country}-${impact}`.toLowerCase()
  const data = new TextEncoder().encode(uniqueString)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex.substring(0, 20)
}

function extractRelevantRowsHTML(html: string): string {
  try {
    const matches = html.match(/<tr[^>]*economicCalendarRow[^>]*>[\s\S]*?<\/tr>/gi)
    if (!matches || matches.length === 0) return html
    return `<!doctype html><html><body><table><tbody>${matches.join('\n')}</tbody></table></body></html>`
  } catch (_e) {
    return html
  }
}

/**
 * Port of Firebase parseMyFXBookWeeklyEnhanced using deno-dom
 */
async function parseMyFXBookWeeklyEnhancedHTML(html: string): Promise<EconomicEvent[]> {
  try {
    log('Parsing MyFXBook weekly HTML (enhanced)')
    // Pre-trim HTML to only relevant rows to reduce compute/memory
    const preTrimmed = extractRelevantRowsHTML(html)
    const parser = new DOMParser()
    const doc = parser.parseFromString(preTrimmed, 'text/html')
    if (!doc) throw new Error('Failed to parse HTML content')

    const events: EconomicEvent[] = []
    const rows = doc.querySelectorAll('tr')

    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF']
    const validImpacts = ['High', 'Medium', 'Low']

    for (const row of Array.from(rows)) {
      try {
        const el = row as Element
        const cells = el.querySelectorAll('td')
        const cellTexts: string[] = []
        cells.forEach((c) => cellTexts.push((c.textContent || '').trim()))
        const text = cellTexts.join(' ')

        const hasEnoughCells = cells.length >= 4
        const hasDatePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2}/i.test(text)
        const hasCurrency = /\b(USD|EUR|GBP|JPY|AUD|CAD|CHF)\b/.test(text)
        if (!(hasEnoughCells && hasDatePattern && hasCurrency)) continue

        // Extract currency
        let currency = ''
        for (const cell of cellTexts) {
          const m = cell.match(/\b(USD|EUR|GBP|JPY|AUD|CAD|CHF)\b/)
          if (m && validCurrencies.includes(m[1])) { currency = m[1]; break }
        }

        // Extract impact (only High/Medium/Low allowed)
        let impact = ''
        for (const cell of cellTexts) {
          if (validImpacts.includes(cell)) { impact = cell; break }
          const lc = cell.toLowerCase()
          if (lc.includes('holiday')) { impact = '' /* filtered out */ }
        }
        if (!impact) continue

        // Country and flag
        let country = ''
        let flagCode = ''
        for (const c of Array.from(cells)) {
          if (country && flagCode) break
          const cEl = c as Element
          const iTitle = cEl.querySelector('i[title]') as Element | null
          if (iTitle) {
            const t = iTitle.getAttribute('title') || ''
            if (t) country = t.trim()
            const cls = iTitle.getAttribute('class') || ''
            const cm = cls.match(/flag-icon-([a-z]{2})/)
            if (cm) flagCode = cm[1]
          }
          if (!flagCode) {
            const span = cEl.querySelector('span.flag') as Element | null
            if (span) {
              const scls = span.getAttribute('class') || ''
              const fm = scls.match(/flag-icon-([a-z]{2})/)
              if (fm) flagCode = fm[1]
            }
          }
          if (!flagCode) {
            const anyFlag = cEl.querySelector('[class*="flag-icon-"]') as Element | null
            if (anyFlag) {
              const acls = anyFlag.getAttribute('class') || ''
              const fm = acls.match(/flag-icon-([a-z]{2})/)
              if (fm) flagCode = fm[1]
            }
          }
        }
        if (flagCode === 'emu' || flagCode === 'em') flagCode = 'eu'

        // Date/time
        let isoDate = ''
        let unixTs: number | undefined
        const dateHolder = el.querySelector('[data-calendardatetd]') as Element | null
          || el.querySelector('[data-calendarDateTd]') as Element | null
        const timeAttrEl = el.querySelector('[time]') as Element | null
        if (dateHolder) {
          const raw = dateHolder.getAttribute('data-calendardatetd') || dateHolder.getAttribute('data-calendarDateTd') || ''
          if (raw) {
            const dt = new Date(raw.replace(' ', 'T') + 'Z')
            if (!isNaN(dt.getTime())) isoDate = dt.toISOString()
          }
        }
        if (timeAttrEl) {
          const t = timeAttrEl.getAttribute('time')
          if (t && /^\d+$/.test(t)) unixTs = parseInt(t, 10)
        }
        if (!isoDate) continue

        // Event name from position (cell 4) with parentheses stitching
        let eventName = ''
        if (cellTexts.length >= 5) {
          let candidate = cellTexts[4]
          if (candidate && candidate.includes('(') && !candidate.includes(')')) {
            for (let idx = 5; idx < Math.min(cellTexts.length, 8); idx++) {
              const nxt = cellTexts[idx]
              if (!nxt) continue
              candidate = candidate + ' ' + nxt
              if (candidate.includes(')')) break
            }
          }
          if (candidate && candidate.length > 3 && !validCurrencies.includes(candidate) && !validImpacts.includes(candidate) && !/^\d{1,2}:\d{2}$/.test(candidate)) {
            eventName = candidate
          }
        }

        // Values extraction - matching Firebase logic exactly
        // MyFXBook structure: data-previous/data-concensus may contain row IDs,
        // but the actual values are in previous-value/concensus attributes OR cell text
        let previous = ''
        let forecast = ''
        let actual = ''
        let actualResultType: 'good' | 'bad' | 'neutral' | '' = ''

        for (const c of Array.from(cells)) {
          const e = c as Element
          const cellText = (e.textContent || '').trim()

          // Look for previous value - check if cell has data-previous or previous-value attr
          // Then get value from previous-value attr OR fall back to cell text (Firebase logic)
          if (!previous && (e.getAttribute('data-previous') || e.getAttribute('previous-value'))) {
            const prevValue = e.getAttribute('previous-value') || cellText
            if (prevValue && isNumericValue(prevValue)) {
              previous = cleanNumericValue(prevValue)
            }
          }

          // Look for forecast/consensus value - same pattern as previous
          if (!forecast && (e.getAttribute('data-concensus') || e.getAttribute('concensus'))) {
            const forecastValue = e.getAttribute('concensus') || cellText
            if (forecastValue && isNumericValue(forecastValue)) {
              forecast = cleanNumericValue(forecastValue)
            }
          }

          // Look for actual value
          if (e.getAttribute('data-actual')) {
            if (!actual && cellText && isNumericValue(cellText)) {
              actual = cleanNumericValue(cellText)
              // Determine if actual result is good/bad/neutral
              actualResultType = determineResultType(e)
            }
          }
        }

        // Method 2: Use CSS classes as backup (matching Firebase)
        if (!previous) {
          for (const c of Array.from(cells)) {
            const e = c as Element
            const cls = e.getAttribute('class') || ''
            if (cls.includes('previousCell')) {
              const prevText = (e.textContent || '').trim()
              if (isNumericValue(prevText)) {
                previous = cleanNumericValue(prevText)
                break
              }
            }
          }
        }

        if (!actual) {
          for (const c of Array.from(cells)) {
            const e = c as Element
            const cls = e.getAttribute('class') || ''
            if (cls.includes('actualCell')) {
              const actualText = (e.textContent || '').trim()
              if (isNumericValue(actualText)) {
                actual = cleanNumericValue(actualText)
                actualResultType = determineResultType(e)
                break
              }
            }
          }
        }

        // Fallback: try to determine result type from the row if we have actual but no result type
        if (actual && !actualResultType) {
          for (const c of Array.from(cells)) {
            const e = c as Element
            const cls = e.getAttribute('class') || ''
            if (cls.includes('actualCell') || e.getAttribute('data-actual')) {
              actualResultType = determineResultType(e)
              if (actualResultType) break
            }
          }
        }

        // Method 3: Fallback to position-based extraction (MyFXBook standard layout)
        if (!previous && cellTexts[6] && isNumericValue(cellTexts[6])) previous = cleanNumericValue(cellTexts[6])
        if (!forecast && cellTexts[7] && isNumericValue(cellTexts[7])) forecast = cleanNumericValue(cellTexts[7])
        if (!actual && cellTexts[8] && isNumericValue(cellTexts[8])) actual = cleanNumericValue(cellTexts[8])

        const hasEconomicData = !!(actual || forecast || previous)
        const isSignificant = !!impact
        if (!(currency && eventName && (hasEconomicData || isSignificant))) continue

        const cleanedName = cleanEventName(eventName)
        const id = await generateEventId(currency, cleanedName, country || 'global', impact || 'None')
        const eventDate = isoDate.split('T')[0]

        const impactLower = impact ? impact.toLowerCase() : 'low'

        const normalizedImpact = impactLower === 'high' ? 'High' : impactLower === 'medium' ? 'Medium' : 'Low'

        const ev: EconomicEvent = {
          id,
          external_id: id,
          currency,
          event_name: cleanedName,
          impact: normalizedImpact,
          event_date: eventDate,
          event_time: isoDate,
          time_utc: isoDate,
          unix_timestamp: unixTs,
          actual_value: actual || undefined,
          forecast_value: forecast || undefined,
          previous_value: previous || undefined,
          actual_result_type: actualResultType || undefined,
          country: country || undefined,
          flag_code: flagCode || undefined,
          flag_url: flagCode ? getFlagUrl(flagCode) : undefined,
          is_all_day: false,
          description: undefined,
          source_url: 'https://www.myfxbook.com/forex-economic-calendar',
          data_source: 'myfxbook',
          last_updated: new Date().toISOString(),
          created_at: new Date().toISOString()
        }
        
        if (!ev.event_name.toLowerCase().includes('myfxbook')) {
          events.push(ev)
        }
      } catch (_rowErr) {
        // skip row errors
      }
    }

    log(`Successfully parsed ${events.length} events from HTML`)
    return events
  } catch (err) {
    log('Error parsing MyFXBook HTML (enhanced)', 'error', err)
    throw err
  }
}

/**
 * Store events in the database with deduplication
 */
async function storeEventsInDatabase(events: EconomicEvent[]): Promise<{ upserted: number, existing: number }> {
  try {
    log(`Storing ${events.length} events in database`)

    const supabase = createServiceClient()
    let upserted = 0
    let existing = 0

    // Process events in batches to avoid memory issues
    const batchSize = 200

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize)

      // Prepare DB rows and external_ids, de-duplicate by external_id within batch
      // Filter out null values from invalid events
      const rowsAll = batch.map(mapEventToDbRow).filter((r): r is EconomicEventDBRow => r !== null)
      const uniqueMap = new Map<string, EconomicEventDBRow>()
      for (const r of rowsAll) uniqueMap.set(r.external_id, r)
      const rows = Array.from(uniqueMap.values())
      const externalIds = rows.map(r => r.external_id)

      // Pre-check existing external_ids in this batch (unique)
      const { data: existingRows, error: existErr } = await supabase
        .from('economic_events')
        .select('external_id')
        .in('external_id', externalIds)

      if (existErr) {
        log(`Existence check failed for batch ${i / batchSize + 1}`, 'error', existErr)
      } else if (existingRows) {
        existing += existingRows.length
      }

      // Upsert unique rows on external_id and request ids to count affected rows
      const { data, error } = await supabase
        .from('economic_events')
        .upsert(rows, { onConflict: 'external_id' })
        .select('external_id')

      if (error) {
        log(`Error storing batch ${i / batchSize + 1}`, 'error', error)
      } else {
        upserted += (data?.length || 0)
        log(`Stored batch ${i / batchSize + 1}: affected ${data?.length || 0} rows (existing so far: ${existing})`)
      }
    }

    log(`Totals -> upserted: ${upserted}, existing: ${existing}`)
    return { upserted, existing }

  } catch (error) {
    log('Error storing events in database', 'error', error)
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
    log('Process economic events request received')

    // Parse request body
    const payload = await parseJsonBody<ProcessEventsPayload>(req)
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400)
    }

    const { htmlContent } = payload

    // Validate required parameters
    if (!htmlContent || typeof htmlContent !== 'string') {
      return errorResponse('HTML content is required and must be a string', 400)
    }

    log('Processing HTML content for economic events', 'info', {
      contentSize: htmlContent.length
    })

    // Parse HTML content to extract events (EXACT Firebase-equivalent)
    const events = await parseMyFXBookWeeklyEnhancedHTML(htmlContent)

    if (events.length === 0) {
      log('No events found in HTML content')
      return successResponse({
        success: true,
        message: 'No events found in HTML content',
        totalEvents: 0,
        majorCurrencyEvents: 0,
        eventsProcessed: 0,
        eventsStored: 0
      })
    }

    // Filter for major currencies
    const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF']
    const majorCurrencyEvents = events.filter(event =>
      majorCurrencies.includes(event.currency)
    )

    log(`Filtered ${events.length} total events to ${majorCurrencyEvents.length} major currency events`)

    // Store events in database
    const { upserted, existing } = await storeEventsInDatabase(majorCurrencyEvents)
    const inserted = Math.max(0, majorCurrencyEvents.length - existing)

    const response: ProcessEconomicEventsResponse = {
      success: true,
      events_processed: events.length,
      events_stored: upserted,
      parsed_total: events.length,
      existing_count: existing,
      inserted_count: inserted,
      upserted_count: upserted,
      message: `Processed ${events.length} events; upserted=${upserted}, existing=${existing}, inserted=${inserted}`,
      events: majorCurrencyEvents // Include the actual events in the response
    }

    log('Economic events processing completed', 'info', {
      success: response.success,
      events_processed: response.events_processed,
      events_stored: response.events_stored,
      parsed_total: response.parsed_total,
      existing_count: response.existing_count,
      inserted_count: response.inserted_count,
      upserted_count: response.upserted_count,
      events_count: majorCurrencyEvents.length
    })

    return successResponse(response)

  } catch (error) {
    log('Error processing economic events', 'error', error)
    return errorResponse('Internal server error', 500)
  }
})
