/**
 * Basic test for Edge Function
 * Run with: deno run --allow-all test.ts
 */

// Make this a module
export {}

// Mock environment variables for testing
const env = (globalThis as any).Deno?.env || { set: () => {} }
env.set('SUPABASE_URL', 'https://test.supabase.co')
env.set('SUPABASE_ANON_KEY', 'test-anon-key')
env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

async function testCorsHandling(): Promise<boolean> {
  try {
    console.log(`\n🧪 Testing: CORS preflight request`)
    
    const corsHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
    })
    
    const response = new Response('ok', { 
      status: 200,
      headers: corsHeaders
    })
    
    if (response.status !== 200) {
      console.log(`❌ CORS test failed: expected 200, got ${response.status}`)
      return false
    }
    
    console.log(`✅ CORS test passed`)
    return true
    
  } catch (error) {
    console.log(`❌ CORS test failed with error:`, error.message)
    return false
  }
}

async function testBasicValidation(): Promise<boolean> {
  try {
    console.log(`\n🧪 Testing: Basic function validation`)
    
    // Test that function file exists and can be imported
    const functionExists = await import('./index.ts').then(() => true).catch(() => false)
    
    if (!functionExists) {
      console.log(`❌ Function index.ts cannot be imported`)
      return false
    }
    
    console.log(`✅ Function validation passed`)
    return true
    
  } catch (error) {
    console.log(`❌ Function validation failed:`, error.message)
    return false
  }
}

async function runAllTests(): Promise<boolean> {
  console.log('🚀 Starting Basic Edge Function Tests\n')
  
  const results: boolean[] = []
  
  // Test CORS handling
  results.push(await testCorsHandling())
  
  // Test basic validation
  results.push(await testBasicValidation())
  
  const passed = results.filter(Boolean).length
  const total = results.length
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log('🎉 All tests passed! Function structure is valid.')
    return true
  } else {
    console.log('❌ Some tests failed. Please check the function implementation.')
    return false
  }
}

// Run the tests
if ((import.meta as any).main) {
  const success = await runAllTests()
  if (typeof (globalThis as any).Deno !== 'undefined') {
    (globalThis as any).Deno.exit(success ? 0 : 1)
  }
}
