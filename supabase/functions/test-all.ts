/**
 * Master Test Runner for All Supabase Edge Functions
 * Runs comprehensive tests for all migrated Firebase Cloud Functions
 * 
 * Usage: deno run --allow-all test-all.ts
 */

import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts"

interface TestResult {
  functionName: string
  passed: number
  failed: number
  total: number
  success: boolean
  duration: number
  errors: string[]
}

interface TestSummary {
  totalFunctions: number
  passedFunctions: number
  failedFunctions: number
  totalTests: number
  passedTests: number
  failedTests: number
  duration: number
  results: TestResult[]
}

// List of all functions to test
const FUNCTIONS = [
  'handle-trade-changes',
  'cleanup-deleted-calendar', 
  'update-tag',
  'process-economic-events',
  'refresh-economic-calendar',
  'cleanup-expired-calendars',
  'auto-refresh-economic-calendar',
  'generate-trade-share-link',
  'get-shared-trade',
  'deactivate-shared-trade',
  'generate-calendar-share-link',
  'get-shared-calendar',
  'deactivate-shared-calendar'
]

/**
 * Run tests for a specific function
 */
async function runFunctionTests(functionName: string): Promise<TestResult> {
  const startTime = Date.now()
  
  console.log(`\n🧪 Testing function: ${functionName}`)
  console.log('='.repeat(50))
  
  const testResult: TestResult = {
    functionName,
    passed: 0,
    failed: 0,
    total: 0,
    success: false,
    duration: 0,
    errors: []
  }
  
  try {
    // Check if function directory exists
    if (!existsSync(functionName)) {
      throw new Error(`Function directory not found: ${functionName}`)
    }
    
    // Check if test file exists
    const testFile = `${functionName}/test.ts`
    if (!existsSync(testFile)) {
      throw new Error(`Test file not found: ${testFile}`)
    }
    
    // Run the test
    const process = new Deno.Command('deno', {
      args: ['run', '--allow-all', 'test.ts'],
      cwd: functionName,
      stdout: 'piped',
      stderr: 'piped'
    })
    
    const { code, stdout, stderr } = await process.output()
    
    const output = new TextDecoder().decode(stdout)
    const errorOutput = new TextDecoder().decode(stderr)
    
    // Parse test results from output
    const testPassedMatch = output.match(/(\d+)\/(\d+) tests passed/)
    if (testPassedMatch) {
      testResult.passed = parseInt(testPassedMatch[1])
      testResult.total = parseInt(testPassedMatch[2])
      testResult.failed = testResult.total - testResult.passed
    }
    
    // Check if all tests passed
    testResult.success = code === 0 && testResult.failed === 0
    
    if (!testResult.success) {
      if (errorOutput) {
        testResult.errors.push(errorOutput)
      }
      if (code !== 0) {
        testResult.errors.push(`Process exited with code: ${code}`)
      }
    }
    
    console.log(`📊 Results: ${testResult.passed}/${testResult.total} tests passed`)
    if (testResult.success) {
      console.log('✅ All tests passed!')
    } else {
      console.log('❌ Some tests failed')
      testResult.errors.forEach(error => console.log(`   Error: ${error}`))
    }
    
  } catch (error) {
    testResult.errors.push(error.message)
    console.log(`❌ Test execution failed: ${error.message}`)
  }
  
  testResult.duration = Date.now() - startTime
  console.log(`⏱️  Duration: ${testResult.duration}ms`)
  
  return testResult
}

/**
 * Validate function structure and files
 */
function validateFunctionStructure(functionName: string): { valid: boolean, issues: string[] } {
  const issues: string[] = []
  
  // Check if directory exists
  if (!existsSync(functionName)) {
    issues.push(`Directory missing: ${functionName}`)
    return { valid: false, issues }
  }
  
  // Check required files
  const requiredFiles = ['index.ts', 'test.ts']
  for (const file of requiredFiles) {
    const filePath = `${functionName}/${file}`
    if (!existsSync(filePath)) {
      issues.push(`Required file missing: ${filePath}`)
    }
  }
  
  // Check optional files
  const optionalFiles = ['deno.json', 'README.md']
  for (const file of optionalFiles) {
    const filePath = `${functionName}/${file}`
    if (!existsSync(filePath)) {
      issues.push(`Optional file missing: ${filePath}`)
    }
  }
  
  return { valid: issues.length === 0, issues }
}

/**
 * Run all tests and generate summary
 */
async function runAllTests(): Promise<TestSummary> {
  const startTime = Date.now()
  
  console.log('🚀 Starting Comprehensive Edge Functions Test Suite')
  console.log('=' .repeat(60))
  console.log(`📋 Functions to test: ${FUNCTIONS.length}`)
  console.log(`📅 Started at: ${new Date().toISOString()}`)
  console.log('')
  
  // Validate function structures first
  console.log('🔍 Validating function structures...')
  let structureIssues = 0
  
  for (const functionName of FUNCTIONS) {
    const validation = validateFunctionStructure(functionName)
    if (!validation.valid) {
      console.log(`⚠️  ${functionName}: ${validation.issues.join(', ')}`)
      structureIssues++
    } else {
      console.log(`✅ ${functionName}: Structure valid`)
    }
  }
  
  if (structureIssues > 0) {
    console.log(`\n⚠️  Found ${structureIssues} functions with structure issues`)
  }
  console.log('')
  
  // Run tests for each function
  const results: TestResult[] = []
  
  for (const functionName of FUNCTIONS) {
    const result = await runFunctionTests(functionName)
    results.push(result)
  }
  
  // Calculate summary
  const summary: TestSummary = {
    totalFunctions: FUNCTIONS.length,
    passedFunctions: results.filter(r => r.success).length,
    failedFunctions: results.filter(r => !r.success).length,
    totalTests: results.reduce((sum, r) => sum + r.total, 0),
    passedTests: results.reduce((sum, r) => sum + r.passed, 0),
    failedTests: results.reduce((sum, r) => sum + r.failed, 0),
    duration: Date.now() - startTime,
    results
  }
  
  return summary
}

/**
 * Print detailed test summary
 */
function printSummary(summary: TestSummary) {
  console.log('\n📊 COMPREHENSIVE TEST SUMMARY')
  console.log('=' .repeat(60))
  
  // Overall statistics
  console.log(`🎯 Functions: ${summary.passedFunctions}/${summary.totalFunctions} passed`)
  console.log(`🧪 Tests: ${summary.passedTests}/${summary.totalTests} passed`)
  console.log(`⏱️  Total Duration: ${summary.duration}ms`)
  console.log(`📅 Completed at: ${new Date().toISOString()}`)
  console.log('')
  
  // Function-by-function results
  console.log('📋 Function Results:')
  console.log('-'.repeat(60))
  
  for (const result of summary.results) {
    const status = result.success ? '✅' : '❌'
    const testInfo = result.total > 0 ? `${result.passed}/${result.total}` : 'N/A'
    console.log(`${status} ${result.functionName.padEnd(30)} ${testInfo.padEnd(8)} ${result.duration}ms`)
    
    if (!result.success && result.errors.length > 0) {
      result.errors.forEach(error => {
        console.log(`     Error: ${error}`)
      })
    }
  }
  
  console.log('')
  
  // Failed functions details
  const failedFunctions = summary.results.filter(r => !r.success)
  if (failedFunctions.length > 0) {
    console.log('❌ FAILED FUNCTIONS:')
    console.log('-'.repeat(60))
    
    for (const result of failedFunctions) {
      console.log(`\n🔴 ${result.functionName}`)
      console.log(`   Tests: ${result.passed}/${result.total} passed`)
      console.log(`   Duration: ${result.duration}ms`)
      
      if (result.errors.length > 0) {
        console.log('   Errors:')
        result.errors.forEach(error => console.log(`     - ${error}`))
      }
    }
    console.log('')
  }
  
  // Success message or recommendations
  if (summary.failedFunctions === 0) {
    console.log('🎉 ALL TESTS PASSED!')
    console.log('✅ All Edge Functions are ready for deployment')
    console.log('')
    console.log('Next steps:')
    console.log('1. Deploy functions: ./deploy.sh')
    console.log('2. Set up database triggers: setup-triggers.sql')
    console.log('3. Configure cron jobs: setup-cron.sql')
    console.log('4. Update client code to use new endpoints')
  } else {
    console.log('⚠️  SOME TESTS FAILED')
    console.log(`❌ ${summary.failedFunctions} functions need attention`)
    console.log('')
    console.log('Recommendations:')
    console.log('1. Fix failing tests before deployment')
    console.log('2. Review error messages above')
    console.log('3. Test functions individually: deno run --allow-all function-name/test.ts')
    console.log('4. Check function implementation and dependencies')
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const summary = await runAllTests()
    printSummary(summary)
    
    // Exit with appropriate code
    const exitCode = summary.failedFunctions === 0 ? 0 : 1
    if (typeof Deno !== 'undefined') {
      Deno.exit(exitCode)
    }
    
  } catch (error) {
    console.error('❌ Test runner failed:', error)
    if (typeof Deno !== 'undefined') {
      Deno.exit(1)
    }
  }
}

// Run if this is the main module
if (import.meta.main) {
  main()
}
