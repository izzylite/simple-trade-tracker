/**
 * Test script for process-economic-events edge function
 *
 * Usage:
 *   npx ts-node supabase/functions/process-economic-events/test-process-events.ts
 *
 * Or with Deno:
 *   deno run --allow-net --allow-env supabase/functions/process-economic-events/test-process-events.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fxkjblrlogjumybceozk.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

interface EconomicEvent {
  id: string
  external_id: string
  currency: string
  event_name: string
  impact: string
  event_date: string
  actual_value?: string
  forecast_value?: string
  previous_value?: string
  actual_result_type?: string
  country?: string
  flag_code?: string
}

interface ProcessResponse {
  success: boolean
  events_processed: number
  events_stored: number
  events?: EconomicEvent[]
  message?: string
  error?: string
}

async function fetchMyFXBookHTML(): Promise<string> {
  console.log('📡 Fetching HTML from MyFXBook...')

  const response = await fetch('https://www.myfxbook.com/forex-economic-calendar', {
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
  console.log(`✅ Received HTML: ${html.length} characters`)

  return html
}

async function callProcessEconomicEvents(htmlContent: string): Promise<ProcessResponse> {
  const functionUrl = `${SUPABASE_URL}/functions/v1/process-economic-events`

  console.log(`📤 Calling edge function: ${functionUrl}`)
  console.log(`   HTML content size: ${htmlContent.length} characters`)

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ htmlContent })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Edge function error ${response.status}: ${text}`)
  }

  return await response.json() as ProcessResponse
}

function analyzeActualResultTypes(events: EconomicEvent[]): void {
  console.log('\n📊 ACTUAL_RESULT_TYPE ANALYSIS')
  console.log('=' .repeat(80))

  const withActual = events.filter(e => e.actual_value)
  const withResultType = events.filter(e => e.actual_result_type)
  const goodResults = events.filter(e => e.actual_result_type === 'good')
  const badResults = events.filter(e => e.actual_result_type === 'bad')
  const neutralResults = events.filter(e => e.actual_result_type === 'neutral')

  console.log(`\nTotal events: ${events.length}`)
  console.log(`Events with actual value: ${withActual.length}`)
  console.log(`Events with actual_result_type: ${withResultType.length}`)
  console.log(`  - Good: ${goodResults.length}`)
  console.log(`  - Bad: ${badResults.length}`)
  console.log(`  - Neutral: ${neutralResults.length}`)

  // Show events that have actual but no result type (the problem cases)
  const missingResultType = withActual.filter(e => !e.actual_result_type)
  if (missingResultType.length > 0) {
    console.log(`\n⚠️  Events with actual value but NO actual_result_type: ${missingResultType.length}`)
    console.log('-'.repeat(80))
    missingResultType.slice(0, 10).forEach(e => {
      console.log(`  ${e.currency} | ${e.event_name.substring(0, 40).padEnd(40)} | A: ${e.actual_value?.padEnd(10)} | F: ${e.forecast_value?.padEnd(10)} | P: ${e.previous_value}`)
    })
    if (missingResultType.length > 10) {
      console.log(`  ... and ${missingResultType.length - 10} more`)
    }
  }

  // Show events that DO have result type
  if (withResultType.length > 0) {
    console.log(`\n✅ Events WITH actual_result_type:`)
    console.log('-'.repeat(80))
    withResultType.slice(0, 15).forEach(e => {
      const resultIcon = e.actual_result_type === 'good' ? '🟢' : e.actual_result_type === 'bad' ? '🔴' : '⚪'
      console.log(`  ${resultIcon} ${e.currency} | ${e.event_name.substring(0, 35).padEnd(35)} | A: ${(e.actual_value || '').padEnd(8)} | Type: ${e.actual_result_type}`)
    })
  }
}

async function main() {
  console.log('🚀 Testing process-economic-events edge function')
  console.log('=' .repeat(80))

  if (!SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_ANON_KEY environment variable is required')
    console.log('\nUsage:')
    console.log('  SUPABASE_ANON_KEY=your-anon-key npx ts-node test-process-events.ts')
    process.exit(1)
  }

  try {
    // Step 1: Fetch HTML from MyFXBook
    const html = await fetchMyFXBookHTML()

    // Step 2: Call the edge function
    const result = await callProcessEconomicEvents(html)

    console.log('\n📥 EDGE FUNCTION RESPONSE')
    console.log('=' .repeat(80))
    console.log(`Success: ${result.success}`)
    console.log(`Events processed: ${result.events_processed}`)
    console.log(`Events stored: ${result.events_stored}`)
    console.log(`Message: ${result.message}`)

    // Step 3: Analyze actual_result_type
    if (result.events && result.events.length > 0) {
      analyzeActualResultTypes(result.events)

      // Sample some events
      console.log('\n📋 SAMPLE EVENTS (first 5)')
      console.log('=' .repeat(80))
      result.events.slice(0, 5).forEach((e, i) => {
        console.log(`\n[${i + 1}] ${e.event_name}`)
        console.log(`    Currency: ${e.currency}`)
        console.log(`    Impact: ${e.impact}`)
        console.log(`    Date: ${e.event_date}`)
        console.log(`    Actual: ${e.actual_value || '(none)'} | Result Type: ${e.actual_result_type || '(none)'}`)
        console.log(`    Forecast: ${e.forecast_value || '(none)'}`)
        console.log(`    Previous: ${e.previous_value || '(none)'}`)
      })
    } else {
      console.log('\n⚠️  No events returned in response')
    }

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main()
