/**
 * Test script for AI Trading Agent
 * Tests chart generation, HTML formatting, and image display
 */

const https = require('https');

// Configuration
const SUPABASE_URL = 'https://gwubzauelilziaqnsfac.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY_HERE';

// Test user credentials (you'll need to provide these)
const TEST_USER_ID = process.env.TEST_USER_ID || 'YOUR_USER_ID_HERE';
const TEST_CALENDAR_ID = process.env.TEST_CALENDAR_ID || 'YOUR_CALENDAR_ID_HERE';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Make HTTP request to Supabase Edge Function
 */
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: 'gwubzauelilziaqnsfac.supabase.co',
      port: 443,
      path: '/functions/v1/ai-trading-agent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Test cases
 */
const testCases = [
  {
    name: 'Chart Generation - Trading Performance by Session',
    message: 'Show me a chart of my trading performance by session',
    expectedPatterns: [
      /\[CHART_IMAGE:https:\/\/quickchart\.io\/chart/,
      /<img src="https:\/\/quickchart\.io\/chart/,
    ],
    checkHtml: true,
  },
  {
    name: 'Chart Generation - Equity Curve',
    message: 'Create an equity curve chart for my trades this month',
    expectedPatterns: [
      /\[CHART_IMAGE:https:\/\/quickchart\.io\/chart/,
      /<img src="https:\/\/quickchart\.io\/chart/,
    ],
    checkHtml: true,
  },
  {
    name: 'HTML Formatting - Bold Text',
    message: 'What is my win rate?',
    expectedPatterns: [
      /<strong>/,
      /<\/strong>/,
    ],
    checkHtml: true,
  },
  {
    name: 'Basic Query - Trade Statistics',
    message: 'How many trades do I have?',
    expectedPatterns: [
      /\d+/,
    ],
    checkHtml: false,
  },
];

/**
 * Run a single test case
 */
async function runTest(testCase, index) {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Test ${index + 1}/${testCases.length}: ${testCase.name}${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}Query:${colors.reset} "${testCase.message}"`);

  const startTime = Date.now();

  try {
    const response = await makeRequest({
      message: testCase.message,
      userId: TEST_USER_ID,
      calendarId: TEST_CALENDAR_ID,
      conversationHistory: [],
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Check if response is successful
    if (!response.success) {
      console.log(`${colors.red}✗ FAILED${colors.reset} - Response not successful`);
      console.log(`${colors.red}Error:${colors.reset}`, response.message);
      return { passed: false, duration, error: response.message };
    }

    console.log(`${colors.green}✓ Response received${colors.reset} (${duration}s)`);

    // Check message content
    const message = response.message || '';
    const messageHtml = response.messageHtml || '';

    console.log(`\n${colors.yellow}Message:${colors.reset}`);
    console.log(message.substring(0, 200) + (message.length > 200 ? '...' : ''));

    if (testCase.checkHtml && messageHtml) {
      console.log(`\n${colors.yellow}HTML:${colors.reset}`);
      console.log(messageHtml.substring(0, 200) + (messageHtml.length > 200 ? '...' : ''));
    }

    // Check for expected patterns
    let allPatternsPassed = true;
    console.log(`\n${colors.yellow}Pattern Checks:${colors.reset}`);

    for (const pattern of testCase.expectedPatterns) {
      const foundInMessage = pattern.test(message);
      const foundInHtml = testCase.checkHtml ? pattern.test(messageHtml) : false;
      const found = foundInMessage || foundInHtml;

      if (found) {
        console.log(`${colors.green}✓${colors.reset} Pattern found: ${pattern}`);
      } else {
        console.log(`${colors.red}✗${colors.reset} Pattern NOT found: ${pattern}`);
        allPatternsPassed = false;
      }
    }

    // Check for chart image in HTML
    if (testCase.checkHtml && messageHtml.includes('[CHART_IMAGE:')) {
      console.log(`${colors.yellow}⚠${colors.reset} Chart marker found in HTML (should be converted to <img>)`);
      allPatternsPassed = false;
    }

    // Check for citations
    if (response.citations && response.citations.length > 0) {
      console.log(`\n${colors.yellow}Citations:${colors.reset} ${response.citations.length} found`);
      response.citations.forEach((citation, i) => {
        console.log(`  ${i + 1}. ${citation.title} - ${citation.url}`);
      });
    }

    // Check metadata
    if (response.metadata) {
      console.log(`\n${colors.yellow}Metadata:${colors.reset}`);
      console.log(`  Model: ${response.metadata.model || 'N/A'}`);
      console.log(`  Function Calls: ${response.metadata.functionCalls?.length || 0}`);
    }

    const result = {
      passed: allPatternsPassed,
      duration,
      message: message.substring(0, 100),
      hasHtml: !!messageHtml,
      hasCitations: response.citations?.length > 0,
    };

    if (allPatternsPassed) {
      console.log(`\n${colors.green}${colors.bright}✓ TEST PASSED${colors.reset}`);
    } else {
      console.log(`\n${colors.red}${colors.bright}✗ TEST FAILED${colors.reset}`);
    }

    return result;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`${colors.red}✗ FAILED${colors.reset} - ${error.message}`);
    return { passed: false, duration, error: error.message };
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         AI Trading Agent - Test Suite                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  // Check configuration
  if (SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE') {
    console.log(`${colors.red}ERROR: Please set SUPABASE_ANON_KEY environment variable${colors.reset}`);
    console.log(`${colors.yellow}Usage: SUPABASE_ANON_KEY=your_key node scripts/test-ai-agent.js${colors.reset}`);
    process.exit(1);
  }

  if (TEST_USER_ID === 'YOUR_USER_ID_HERE' || TEST_CALENDAR_ID === 'YOUR_CALENDAR_ID_HERE') {
    console.log(`${colors.red}ERROR: Please set TEST_USER_ID and TEST_CALENDAR_ID environment variables${colors.reset}`);
    console.log(`${colors.yellow}Usage: TEST_USER_ID=your_id TEST_CALENDAR_ID=your_cal_id node scripts/test-ai-agent.js${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.blue}Configuration:${colors.reset}`);
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  User ID: ${TEST_USER_ID}`);
  console.log(`  Calendar ID: ${TEST_CALENDAR_ID}`);
  console.log(`  Total Tests: ${testCases.length}`);

  const results = [];

  // Run all tests
  for (let i = 0; i < testCases.length; i++) {
    const result = await runTest(testCases[i], i);
    results.push(result);

    // Wait between tests to avoid rate limiting
    if (i < testCases.length - 1) {
      console.log(`\n${colors.yellow}Waiting 2 seconds before next test...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Test Summary${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + parseFloat(r.duration), 0).toFixed(2);
  const avgDuration = (totalDuration / results.length).toFixed(2);

  console.log(`\n${colors.green}Passed:${colors.reset} ${passed}/${results.length}`);
  console.log(`${colors.red}Failed:${colors.reset} ${failed}/${results.length}`);
  console.log(`${colors.blue}Total Duration:${colors.reset} ${totalDuration}s`);
  console.log(`${colors.blue}Average Duration:${colors.reset} ${avgDuration}s`);

  if (passed === results.length) {
    console.log(`\n${colors.green}${colors.bright}✓ ALL TESTS PASSED!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bright}✗ SOME TESTS FAILED${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});

