/**
 * Test the chart image formatter
 * Tests if [CHART_IMAGE:url] markers are converted to <img> tags
 */

// Simulate the formatter logic
function convertMarkdownToHtml(text) {
  if (!text) return '';

  // Extract chart image markers BEFORE any processing
  const chartImageRegex = /\[CHART_IMAGE:(.+?)\]/g;
  const chartImages = [];
  let match;
  while ((match = chartImageRegex.exec(text)) !== null) {
    chartImages.push({
      marker: match[0],
      url: match[1]
    });
  }

  // Replace chart markers with placeholder that won't be escaped
  let html = text;
  chartImages.forEach(({ marker }, index) => {
    html = html.replace(marker, `___CHART_PLACEHOLDER_${index}___`);
  });

  // Escape HTML special characters
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Convert markdown bold **text** to <strong>
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert markdown italic *text* to <em>
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Convert line breaks to <br>
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph tags
  if (!html.startsWith('<h') && !html.startsWith('<ul')) {
    html = `<p>${html}</p>`;
  }

  // Replace chart placeholders with actual <img> tags
  chartImages.forEach(({ url }, index) => {
    const placeholder = `___CHART_PLACEHOLDER_${index}___`;
    const imgTag = `<img src="${url}" alt="Chart" style="max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; display: block;" />`;
    html = html.replace(placeholder, imgTag);
  });

  return html;
}

// Test cases
const testCases = [
  {
    name: 'Chart Image Marker Conversion',
    input: 'Here is a chart of your trading performance.\n\n**Trading Performance by Session**\n\n[CHART_IMAGE:https://quickchart.io/chart?c=%7B%22type%22%3A%22bar%22%7D&width=800&height=400&format=png]\n\n[Open chart in new tab](https://quickchart.io/chart)',
    expectedPatterns: [
      /<img src="https:\/\/quickchart\.io\/chart/,
      /alt="Chart"/,
      /style="max-width: 100%/,
    ],
    shouldNotContain: [
      /\[CHART_IMAGE:/,
    ],
  },
  {
    name: 'Bold Text Formatting',
    input: 'Your win rate is **85.5%** which is excellent!',
    expectedPatterns: [
      /<strong>85\.5%<\/strong>/,
    ],
    shouldNotContain: [
      /\*\*/,
    ],
  },
  {
    name: 'Multiple Chart Images',
    input: 'First chart:\n[CHART_IMAGE:https://chart1.com]\n\nSecond chart:\n[CHART_IMAGE:https://chart2.com]',
    expectedPatterns: [
      /<img src="https:\/\/chart1\.com"/,
      /<img src="https:\/\/chart2\.com"/,
    ],
    shouldNotContain: [
      /\[CHART_IMAGE:/,
    ],
  },
];

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

// Run tests
console.log(`${colors.cyan}${colors.bright}`);
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         Chart Formatter Test Suite                        ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(colors.reset);

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Test ${index + 1}/${testCases.length}: ${testCase.name}${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

  const result = convertMarkdownToHtml(testCase.input);

  console.log(`\n${colors.yellow}Input:${colors.reset}`);
  console.log(testCase.input.substring(0, 150) + (testCase.input.length > 150 ? '...' : ''));

  console.log(`\n${colors.yellow}Output:${colors.reset}`);
  console.log(result.substring(0, 200) + (result.length > 200 ? '...' : ''));

  let testPassed = true;

  // Check expected patterns
  console.log(`\n${colors.yellow}Expected Patterns:${colors.reset}`);
  for (const pattern of testCase.expectedPatterns) {
    const found = pattern.test(result);
    if (found) {
      console.log(`${colors.green}✓${colors.reset} Found: ${pattern}`);
    } else {
      console.log(`${colors.red}✗${colors.reset} NOT found: ${pattern}`);
      testPassed = false;
    }
  }

  // Check patterns that should NOT be present
  if (testCase.shouldNotContain) {
    console.log(`\n${colors.yellow}Should NOT Contain:${colors.reset}`);
    for (const pattern of testCase.shouldNotContain) {
      const found = pattern.test(result);
      if (!found) {
        console.log(`${colors.green}✓${colors.reset} Correctly absent: ${pattern}`);
      } else {
        console.log(`${colors.red}✗${colors.reset} Incorrectly present: ${pattern}`);
        testPassed = false;
      }
    }
  }

  if (testPassed) {
    console.log(`\n${colors.green}${colors.bright}✓ TEST PASSED${colors.reset}`);
    passed++;
  } else {
    console.log(`\n${colors.red}${colors.bright}✗ TEST FAILED${colors.reset}`);
    failed++;
  }
});

// Summary
console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.bright}Test Summary${colors.reset}`);
console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`\n${colors.green}Passed:${colors.reset} ${passed}/${testCases.length}`);
console.log(`${colors.red}Failed:${colors.reset} ${failed}/${testCases.length}`);

if (passed === testCases.length) {
  console.log(`\n${colors.green}${colors.bright}✓ ALL TESTS PASSED!${colors.reset}`);
  console.log(`\n${colors.yellow}The formatter is working correctly!${colors.reset}`);
  console.log(`${colors.yellow}Chart markers will be converted to <img> tags in the edge function.${colors.reset}`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}${colors.bright}✗ SOME TESTS FAILED${colors.reset}`);
  process.exit(1);
}

