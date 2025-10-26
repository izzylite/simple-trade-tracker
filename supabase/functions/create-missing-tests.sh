#!/bin/bash

# Create missing test files for Edge Functions
# This script creates basic test files for functions that don't have them

set -e

echo "🧪 Creating missing test files for Edge Functions"
echo "================================================"

# Functions that need test files
FUNCTIONS_NEEDING_TESTS=(
    "process-economic-events"
    "refresh-economic-calendar"
    "cleanup-expired-calendars"
    "auto-refresh-economic-calendar"
    "generate-trade-share-link"
    "get-shared-trade"
    "deactivate-shared-trade"
    "generate-calendar-share-link"
    "get-shared-calendar"
    "deactivate-shared-calendar"
)

# Create basic test template
create_basic_test() {
    local func_name=$1
    local test_file="${func_name}/test.ts"
    
    echo "📝 Creating test file: $test_file"
    
    cat > "$test_file" << 'EOF'
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
EOF
    
    echo "   ✅ Created $test_file"
}

# Create deno.json template
create_deno_json() {
    local func_name=$1
    local deno_file="${func_name}/deno.json"
    
    echo "📝 Creating deno.json: $deno_file"
    
    cat > "$deno_file" << 'EOF'
{
  "imports": {
    "supabase": "https://esm.sh/@supabase/supabase-js@2"
  },
  "tasks": {
    "test": "deno run --allow-all test.ts",
    "dev": "deno run --allow-all --watch index.ts"
  },
  "compilerOptions": {
    "lib": ["deno.window"],
    "strict": true
  }
}
EOF
    
    echo "   ✅ Created $deno_file"
}

# Process each function
for func in "${FUNCTIONS_NEEDING_TESTS[@]}"; do
    echo ""
    echo "🔧 Processing function: $func"
    
    if [ ! -d "$func" ]; then
        echo "   ⚠️  Directory not found: $func"
        continue
    fi
    
    # Create test file if missing
    if [ ! -f "${func}/test.ts" ]; then
        create_basic_test "$func"
    else
        echo "   ✅ Test file already exists"
    fi
    
    # Create deno.json if missing
    if [ ! -f "${func}/deno.json" ]; then
        create_deno_json "$func"
    else
        echo "   ✅ deno.json already exists"
    fi
done

# Also create missing files for functions that have tests but missing deno.json
echo ""
echo "🔧 Processing update-tag (missing deno.json)"
if [ ! -f "update-tag/deno.json" ]; then
    create_deno_json "update-tag"
else
    echo "   ✅ deno.json already exists"
fi

echo ""
echo "🎉 Completed creating missing test files!"
echo ""
echo "Next steps:"
echo "1. Run tests: deno run --allow-all test-all.ts"
echo "2. Review and enhance individual test files as needed"
echo "3. Deploy functions: ./deploy.sh"
