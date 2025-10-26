/**
 * Test script for hello-world Edge Function
 * Run with: deno run --allow-net test.ts
 */

// Test the hello-world function directly
async function testHelloWorld() {
  console.log('🧪 Testing hello-world Edge Function...')
  
  try {
    // Import the function (this simulates how it would work)
    const { default: handler } = await import('./index.ts')
    
    // Create a mock request
    const mockRequest = new Request('http://localhost:54321/functions/v1/hello-world', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Edge Functions Test' })
    })
    
    // Call the function
    const response = await handler(mockRequest)
    const result = await response.json()
    
    console.log('✅ Function executed successfully!')
    console.log('📤 Response:', result)
    console.log('🔍 Status:', response.status)
    
    // Verify the response
    if (result.message && result.message.includes('Edge Functions Test')) {
      console.log('🎉 Test PASSED: Function returned expected message')
      return true
    } else {
      console.log('❌ Test FAILED: Unexpected response')
      return false
    }
    
  } catch (error) {
    console.error('❌ Test FAILED with error:', error)
    return false
  }
}

// Test shared utilities
async function testSharedUtilities() {
  console.log('\n🧪 Testing shared utilities...')
  
  try {
    // Test environment validation
    const { validateEnvironment } = await import('../_shared/supabase.ts')
    const missing = validateEnvironment()
    
    console.log('📋 Environment check:')
    if (missing.length > 0) {
      console.log('⚠️  Missing environment variables:', missing)
    } else {
      console.log('✅ All required environment variables are set')
    }
    
    // Test utility functions
    const { extractTagsFromTrades, generateShareId } = await import('../_shared/utils.ts')
    
    // Test tag extraction
    const mockTrades = [
      { tags: ['Strategy:Scalping', 'Currency:EUR/USD'] },
      { tags: ['Strategy:Swing', 'Currency:GBP/USD'] },
      { tags: ['Strategy:Scalping', 'Market:Forex'] }
    ]
    
    const extractedTags = extractTagsFromTrades(mockTrades as any)
    console.log('🏷️  Extracted tags:', extractedTags)
    
    // Test share ID generation
    const tradeShareId = generateShareId('trade', 'test-trade-123')
    const calendarShareId = generateShareId('calendar', 'test-calendar-456')
    
    console.log('🔗 Generated share IDs:')
    console.log('   Trade:', tradeShareId)
    console.log('   Calendar:', calendarShareId)
    
    console.log('✅ Shared utilities test PASSED')
    return true
    
  } catch (error) {
    console.error('❌ Shared utilities test FAILED:', error)
    return false
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Edge Functions Environment Tests\n')
  
  const results = await Promise.all([
    testHelloWorld(),
    testSharedUtilities()
  ])
  
  const passed = results.filter(Boolean).length
  const total = results.length
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log('🎉 All tests passed! Edge Functions environment is ready.')
    Deno.exit(0)
  } else {
    console.log('❌ Some tests failed. Please check the setup.')
    Deno.exit(1)
  }
}

// Run the tests
if (import.meta.main) {
  runTests()
}
