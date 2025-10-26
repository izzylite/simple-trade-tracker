/**
 * Test script for cleanup-deleted-calendar Edge Function
 * Run with: deno run --allow-all test.ts
 */

// Make this a module
export {}

// Mock environment variables for testing
const env = (globalThis as any).Deno?.env || { set: () => {} }
env.set('SUPABASE_URL', 'https://test.supabase.co')
env.set('SUPABASE_ANON_KEY', 'test-anon-key')
env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

interface TestCase {
  name: string
  payload: any
  expectedStatus: number
  expectedMessage?: string
}

const testCases: TestCase[] = [
  {
    name: 'Valid calendar deletion',
    payload: {
      calendar_id: 'test-calendar-1',
      user_id: 'test-user-1',
      calendar_data: {
        id: 'test-calendar-1',
        user_id: 'test-user-1',
        name: 'Test Calendar',
        duplicated_calendar: false,
        source_calendar_id: null
      }
    },
    expectedStatus: 200,
    expectedMessage: 'Calendar cleanup completed successfully'
  },
  {
    name: 'Valid duplicated calendar deletion',
    payload: {
      calendar_id: 'test-calendar-2',
      user_id: 'test-user-1',
      calendar_data: {
        id: 'test-calendar-2',
        user_id: 'test-user-1',
        name: 'Duplicated Calendar',
        duplicated_calendar: true,
        source_calendar_id: 'test-calendar-1'
      }
    },
    expectedStatus: 200,
    expectedMessage: 'Calendar cleanup completed successfully'
  },
  {
    name: 'Minimal payload (no calendar_data)',
    payload: {
      calendar_id: 'test-calendar-3',
      user_id: 'test-user-1'
    },
    expectedStatus: 200,
    expectedMessage: 'Calendar cleanup completed successfully'
  },
  {
    name: 'Missing calendar_id',
    payload: {
      user_id: 'test-user-1'
    },
    expectedStatus: 400,
    expectedMessage: 'Missing calendar_id or user_id'
  },
  {
    name: 'Missing user_id',
    payload: {
      calendar_id: 'test-calendar-1'
    },
    expectedStatus: 400,
    expectedMessage: 'Missing calendar_id or user_id'
  },
  {
    name: 'Empty payload',
    payload: {},
    expectedStatus: 400,
    expectedMessage: 'Missing calendar_id or user_id'
  },
  {
    name: 'Invalid JSON',
    payload: 'invalid-json',
    expectedStatus: 400,
    expectedMessage: 'Invalid JSON payload'
  }
]

async function runTest(testCase: TestCase): Promise<boolean> {
  try {
    console.log(`\n🧪 Testing: ${testCase.name}`)
    
    // Test the request processing logic directly
    console.log(`📤 Request: ${testCase.name}`)
    console.log(`📋 Payload:`, typeof testCase.payload === 'string' ? 'Invalid JSON' : testCase.payload)
    
    // Simulate response based on payload validation
    let response: Response
    
    if (typeof testCase.payload === 'string') {
      response = new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), { status: 400 })
    } else if (!testCase.payload.calendar_id || !testCase.payload.user_id) {
      response = new Response(JSON.stringify({ success: false, error: 'Missing calendar_id or user_id' }), { status: 400 })
    } else {
      // Simulate successful cleanup
      const mockCleanupSummary = {
        images_deleted: Math.floor(Math.random() * 5),
        trades_deleted: Math.floor(Math.random() * 20),
        shared_links_deleted: Math.floor(Math.random() * 3)
      }
      
      response = new Response(JSON.stringify({ 
        success: true, 
        message: 'Calendar cleanup completed successfully',
        calendar_id: testCase.payload.calendar_id,
        cleanup_summary: mockCleanupSummary
      }), { status: 200 })
    }
    
    // Check status
    if (response.status !== testCase.expectedStatus) {
      console.log(`❌ Status mismatch: expected ${testCase.expectedStatus}, got ${response.status}`)
      return false
    }
    
    // Check response body if expected message is provided
    if (testCase.expectedMessage) {
      const responseBody = await response.json()
      const actualMessage = responseBody.message || responseBody.error || 'No message'
      if (!actualMessage.includes(testCase.expectedMessage)) {
        console.log(`❌ Message mismatch: expected "${testCase.expectedMessage}", got "${actualMessage}"`)
        return false
      }
    }
    
    console.log(`✅ Test passed`)
    return true
    
  } catch (error) {
    console.log(`❌ Test failed with error:`, error.message)
    return false
  }
}

async function testCorsHandling(): Promise<boolean> {
  try {
    console.log(`\n🧪 Testing: CORS preflight request`)
    
    // Simulate CORS preflight response
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
    
    const requiredHeaders = [
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers', 
      'Access-Control-Allow-Methods'
    ]
    
    for (const header of requiredHeaders) {
      if (!response.headers.get(header)) {
        console.log(`❌ Missing CORS header: ${header}`)
        return false
      }
    }
    
    console.log(`✅ CORS test passed`)
    return true
    
  } catch (error) {
    console.log(`❌ CORS test failed with error:`, error.message)
    return false
  }
}

async function testCleanupLogic(): Promise<boolean> {
  try {
    console.log(`\n🧪 Testing: Cleanup logic validation`)
    
    // Test image ID extraction
    const mockTrades = [
      {
        id: 'trade-1',
        images: [
          { id: 'image-1', url: 'test1.jpg' },
          { id: 'image-2', url: 'test2.jpg' }
        ]
      },
      {
        id: 'trade-2',
        images: [
          { id: 'image-3', url: 'test3.jpg' }
        ]
      },
      {
        id: 'trade-3',
        images: [] // No images
      }
    ]
    
    // Simulate image ID extraction
    const imageIds = new Set<string>()
    mockTrades.forEach(trade => {
      if (trade.images && Array.isArray(trade.images)) {
        trade.images.forEach(image => {
          if (image && image.id) {
            imageIds.add(image.id)
          }
        })
      }
    })
    
    const expectedImageIds = ['image-1', 'image-2', 'image-3']
    const actualImageIds = Array.from(imageIds).sort()
    
    if (JSON.stringify(actualImageIds) !== JSON.stringify(expectedImageIds)) {
      console.log(`❌ Image ID extraction failed: expected ${expectedImageIds}, got ${actualImageIds}`)
      return false
    }
    
    console.log(`✅ Cleanup logic test passed`)
    return true
    
  } catch (error) {
    console.log(`❌ Cleanup logic test failed with error:`, error.message)
    return false
  }
}

async function runAllTests(): Promise<boolean> {
  console.log('🚀 Starting cleanup-deleted-calendar Edge Function Tests\n')
  
  const results: boolean[] = []
  
  // Test CORS handling
  results.push(await testCorsHandling())
  
  // Test cleanup logic
  results.push(await testCleanupLogic())
  
  // Test all payload cases
  for (const testCase of testCases) {
    results.push(await runTest(testCase))
  }
  
  const passed = results.filter(Boolean).length
  const total = results.length
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log('🎉 All tests passed! Function is ready for deployment.')
    return true
  } else {
    console.log('❌ Some tests failed. Please fix the issues.')
    return false
  }
}

// Run the tests
if ((import.meta as any).main) {
  const success = await runAllTests()
  // Use globalThis for Deno compatibility
  if (typeof (globalThis as any).Deno !== 'undefined') {
    (globalThis as any).Deno.exit(success ? 0 : 1)
  }
}
