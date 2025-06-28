/**
 * Test event name cleaning logic
 */

function cleanEventName(eventText) {
  let cleanEventName = eventText.trim();
  
  console.log(`Original: "${eventText}"`);
  
  // Remove currency codes from event name (more aggressive cleaning)
  const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];
  
  // Remove currency at the beginning of the string
  validCurrencies.forEach(curr => {
    cleanEventName = cleanEventName.replace(new RegExp(`^${curr}\\s+`, 'g'), '').trim();
  });
  
  console.log(`After currency prefix removal: "${cleanEventName}"`);
  
  // Remove currency anywhere in the string
  validCurrencies.forEach(curr => {
    cleanEventName = cleanEventName.replace(new RegExp(`\\b${curr}\\b`, 'g'), '').trim();
  });
  
  console.log(`After currency removal: "${cleanEventName}"`);
  
  // Remove time indicators like "4h 5min", "35 min", etc.
  cleanEventName = cleanEventName.replace(/\d+h\s*\d*min?/gi, '').trim();
  cleanEventName = cleanEventName.replace(/\d+\s*min/gi, '').trim();
  cleanEventName = cleanEventName.replace(/\d+h/gi, '').trim();
  
  console.log(`After time removal: "${cleanEventName}"`);
  
  // Remove "days" prefix that sometimes appears
  cleanEventName = cleanEventName.replace(/^days\s+/i, '').trim();
  
  console.log(`After days removal: "${cleanEventName}"`);
  
  // Remove leading/trailing special characters and extra spaces
  cleanEventName = cleanEventName.replace(/^[^\w]+|[^\w]+$/g, '').trim();
  cleanEventName = cleanEventName.replace(/\s+/g, ' ').trim();
  
  // Remove any remaining currency codes that might be embedded
  validCurrencies.forEach(curr => {
    cleanEventName = cleanEventName.replace(new RegExp(`\\s+${curr}\\s+`, 'g'), ' ').trim();
  });
  
  // Final cleanup
  cleanEventName = cleanEventName.replace(/^\s+|\s+$/g, '').trim();
  
  console.log(`Final result: "${cleanEventName}"`);
  console.log('---');
  
  return cleanEventName;
}

// Test cases based on the actual scraped data
const testCases = [
  "EUR Retail Sales YoY (May",
  "EUR Harmonised Inflation Rate YoY (Jun",
  "EUR Harmonised Inflation Rate MoM (Jun",
  "EUR PPI YoY (May",
  "EUR PPI MoM (May",
  "USD Core PCE Price Index YoY (May)",
  "USD Personal Spending MoM (May)",
  "USD Fed Williams Speech",
  "days USD Fed Balance Sheet",
  "4h 5min USD Core PCE Price Index",
  "35 min EUR Economic Sentiment (Jun)",
  "GBP Inflation Rate YoY (Jun)",
  "JPY Manufacturing PMI (Jun)"
];

console.log('🧪 Testing Event Name Cleaning Logic\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}:`);
  const cleaned = cleanEventName(testCase);
  console.log(`✅ Result: "${cleaned}"\n`);
});

console.log('🎯 Expected Results:');
console.log('- "Retail Sales YoY (May"');
console.log('- "Harmonised Inflation Rate YoY (Jun"');
console.log('- "Core PCE Price Index YoY (May)"');
console.log('- "Personal Spending MoM (May)"');
console.log('- "Fed Williams Speech"');
console.log('- "Fed Balance Sheet"');
console.log('- "Economic Sentiment (Jun)"');
console.log('- "Inflation Rate YoY (Jun)"');
console.log('- "Manufacturing PMI (Jun)"');
