/**
 * Debug script to test HTML parsing locally
 * This tests the parsing logic without calling the edge function
 *
 * Usage with Deno:
 *   cd supabase/functions/process-economic-events
 *   deno run --allow-net --allow-read debug-parse-html.ts
 */

import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts"

interface ParsedEvent {
  currency: string
  event_name: string
  impact: string
  actual_value: string
  actual_result_type: string
  forecast_value: string
  previous_value: string
  raw_actual_cell_class?: string
  raw_actual_cell_html?: string
}

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
 * Debug version of determineResultType with verbose logging
 */
function determineResultTypeDebug(cellEl: Element): { result: string, debug: string[] } {
  const debug: string[] = []

  // Method 1: Check CSS classes for background color indicators
  const cellClass = cellEl.getAttribute('class') || ''
  debug.push(`Cell class: "${cellClass}"`)

  if (cellClass.includes('background-transparent-red')) {
    debug.push('MATCH: background-transparent-red -> bad')
    return { result: 'bad', debug }
  }
  if (cellClass.includes('background-transparent-green')) {
    debug.push('MATCH: background-transparent-green -> good')
    return { result: 'good', debug }
  }

  // Method 2: Check data-content attribute for explicit descriptions
  const dataContentEl = cellEl.querySelector('[data-content]') as Element | null
  if (dataContentEl) {
    const dataContent = dataContentEl.getAttribute('data-content') || ''
    debug.push(`data-content element found: "${dataContent}"`)
    if (dataContent.toLowerCase().includes('worse than expected')) {
      debug.push('MATCH: worse than expected -> bad')
      return { result: 'bad', debug }
    }
    if (dataContent.toLowerCase().includes('better than expected')) {
      debug.push('MATCH: better than expected -> good')
      return { result: 'good', debug }
    }
    if (dataContent.toLowerCase().includes('as expected')) {
      debug.push('MATCH: as expected -> neutral')
      return { result: 'neutral', debug }
    }
  } else {
    debug.push('No [data-content] element found')
  }

  // Method 3: Check inner elements for color indicators
  const innerElements = cellEl.querySelectorAll('[class*="background-transparent"]')
  debug.push(`Found ${innerElements.length} inner elements with background-transparent class`)

  for (const inner of Array.from(innerElements)) {
    const innerClass = (inner as Element).getAttribute('class') || ''
    debug.push(`  Inner element class: "${innerClass}"`)
    if (innerClass.includes('background-transparent-red')) {
      debug.push('MATCH (inner): background-transparent-red -> bad')
      return { result: 'bad', debug }
    }
    if (innerClass.includes('background-transparent-green')) {
      debug.push('MATCH (inner): background-transparent-green -> good')
      return { result: 'good', debug }
    }
  }

  // Method 4: Check for span with colored background (MyFXBook specific)
  const coloredSpans = cellEl.querySelectorAll('span[class*="background"]')
  debug.push(`Found ${coloredSpans.length} spans with background class`)
  for (const span of Array.from(coloredSpans)) {
    const spanClass = (span as Element).getAttribute('class') || ''
    debug.push(`  Span class: "${spanClass}"`)
  }

  // Method 5: Check all child elements for any red/green indicators
  const allChildren = cellEl.querySelectorAll('*')
  for (const child of Array.from(allChildren)) {
    const childClass = (child as Element).getAttribute('class') || ''
    if (childClass.includes('red') || childClass.includes('green')) {
      debug.push(`Found child with color class: "${childClass}"`)
      if (childClass.includes('red')) {
        return { result: 'bad', debug }
      }
      if (childClass.includes('green')) {
        return { result: 'good', debug }
      }
    }
  }

  debug.push('No result type indicators found')
  return { result: '', debug }
}

async function fetchAndParseHTML(): Promise<void> {
  console.log('📡 Fetching HTML from MyFXBook...\n')

  const response = await fetch('https://www.myfxbook.com/forex-economic-calendar', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    }
  })

  const html = await response.text()
  console.log(`✅ Received HTML: ${html.length} characters\n`)

  // Parse HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  if (!doc) throw new Error('Failed to parse HTML')

  // Find all calendar rows
  const rows = doc.querySelectorAll('tr')
  console.log(`Found ${rows.length} total rows\n`)

  const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF']
  const validImpacts = ['High', 'Medium', 'Low']
  const parsedEvents: ParsedEvent[] = []

  let rowsWithActual = 0
  let rowsWithResultType = 0

  for (const row of Array.from(rows)) {
    const el = row as Element
    const cells = el.querySelectorAll('td')
    const cellTexts: string[] = []
    cells.forEach((c) => cellTexts.push((c.textContent || '').trim()))
    const text = cellTexts.join(' ')

    // Basic filtering
    const hasEnoughCells = cells.length >= 4
    const hasDatePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i.test(text)
    const hasCurrency = /\b(USD|EUR|GBP|JPY|AUD|CAD|CHF)\b/.test(text)

    if (!(hasEnoughCells && hasDatePattern && hasCurrency)) continue

    // Extract currency
    let currency = ''
    for (const cell of cellTexts) {
      const m = cell.match(/\b(USD|EUR|GBP|JPY|AUD|CAD|CHF)\b/)
      if (m && validCurrencies.includes(m[1])) { currency = m[1]; break }
    }

    // Extract impact
    let impact = ''
    for (const cell of cellTexts) {
      if (validImpacts.includes(cell)) { impact = cell; break }
    }

    // Event name
    let eventName = ''
    if (cellTexts.length >= 5 && cellTexts[4].length > 3) {
      eventName = cellTexts[4]
    }

    // Extract values
    let previous = ''
    let forecast = ''
    let actual = ''
    let actualResultType = ''
    let rawActualCellClass = ''
    let rawActualCellHtml = ''

    for (const c of Array.from(cells)) {
      const e = c as Element
      const prevAttr = e.getAttribute('data-previous') || e.getAttribute('previous-value')
      if (!previous && prevAttr && isNumericValue(prevAttr)) previous = cleanNumericValue(prevAttr)

      const fcAttr = e.getAttribute('data-concensus') || e.getAttribute('concensus')
      if (!forecast && fcAttr && isNumericValue(fcAttr)) forecast = cleanNumericValue(fcAttr)

      const actAttr = e.getAttribute('data-actual')
      if (actAttr !== null) {
        const actText = (e.textContent || '').trim()
        if (actText && isNumericValue(actText)) {
          actual = cleanNumericValue(actText)
          rawActualCellClass = e.getAttribute('class') || ''
          rawActualCellHtml = e.innerHTML.substring(0, 200)

          // Debug the result type determination
          const { result, debug } = determineResultTypeDebug(e)
          actualResultType = result

          rowsWithActual++
          if (result) rowsWithResultType++

          // Log debug info for cells with actual values
          if (!result && actual) {
            console.log(`\n⚠️  Event with actual but no result type:`)
            console.log(`   Event: ${eventName}`)
            console.log(`   Actual: ${actual}`)
            console.log(`   Cell class: ${rawActualCellClass}`)
            console.log(`   Debug steps:`)
            debug.forEach(d => console.log(`     - ${d}`))
          }
        }
      }
    }

    if (currency && eventName && actual) {
      parsedEvents.push({
        currency,
        event_name: eventName,
        impact,
        actual_value: actual,
        actual_result_type: actualResultType,
        forecast_value: forecast,
        previous_value: previous,
        raw_actual_cell_class: rawActualCellClass,
        raw_actual_cell_html: rawActualCellHtml
      })
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 PARSING SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total events with actual values: ${rowsWithActual}`)
  console.log(`Events with result type determined: ${rowsWithResultType}`)
  console.log(`Events missing result type: ${rowsWithActual - rowsWithResultType}`)

  console.log('\n📋 PARSED EVENTS WITH ACTUAL VALUES:')
  console.log('-'.repeat(80))

  for (const e of parsedEvents.slice(0, 15)) {
    const icon = e.actual_result_type === 'good' ? '🟢' :
                 e.actual_result_type === 'bad' ? '🔴' :
                 e.actual_result_type === 'neutral' ? '⚪' : '❓'

    console.log(`${icon} ${e.currency} | ${e.event_name.substring(0, 40).padEnd(40)} | A: ${e.actual_value.padEnd(10)} | Type: ${e.actual_result_type || '(none)'}`)
    if (!e.actual_result_type) {
      console.log(`   Cell class: ${e.raw_actual_cell_class}`)
    }
  }

  // Save a sample of the raw HTML for analysis
  console.log('\n📝 Saving sample HTML to debug-sample.html...')
  const sampleHtml = html.substring(0, 50000)
  await Deno.writeTextFile('debug-sample.html', sampleHtml)
  console.log('Done!')
}

fetchAndParseHTML().catch(console.error)
