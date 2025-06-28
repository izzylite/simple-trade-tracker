/**
 * Test the cleanEventName function directly
 */

// Copy the exact cleanEventName function from the TypeScript file
function cleanEventName(eventName) {
  if (!eventName) return eventName;

  let cleaned = eventName.trim();
  
  // Valid currencies for removal
  const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

  // Remove currency codes from event name (more aggressive cleaning)
  validCurrencies.forEach(curr => {
    // Remove currency at the beginning of the string
    cleaned = cleaned.replace(new RegExp(`^${curr}\\s+`, 'g'), '').trim();
    // Remove currency anywhere in the string
    cleaned = cleaned.replace(new RegExp(`\\b${curr}\\b`, 'g'), '').trim();
  });

  // Remove time indicators like "4h 5min", "35 min", "28 min", etc.
  cleaned = cleaned.replace(/\d+h\s*\d*min?/gi, '').trim();
  cleaned = cleaned.replace(/\d+\s*min/gi, '').trim();
  cleaned = cleaned.replace(/\d+h/gi, '').trim();

  // Remove "days" prefix that sometimes appears
  cleaned = cleaned.replace(/^days\s+/i, '').trim();

  // Remove common prefixes that include currency
  cleaned = cleaned.replace(/^(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)\s*/gi, '').trim();

  // Remove impact level indicators that get mixed into event names
  cleaned = cleaned.replace(/\s+(High|Medium|Low)\s*$/gi, '').trim();
  cleaned = cleaned.replace(/^(High|Medium|Low)\s+/gi, '').trim();

  // Remove leading "min" that appears in some events
  cleaned = cleaned.replace(/^min\s+/gi, '').trim();

  // Remove trailing incomplete parentheses like "(May" or "(Jun"
  cleaned = cleaned.replace(/\s*\([A-Za-z]{3}$/, '').trim();

  // Remove leading/trailing special characters and extra spaces
  cleaned = cleaned.replace(/^[^\w]+|[^\w]+$/g, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remove any remaining currency codes that might be embedded
  validCurrencies.forEach(curr => {
    cleaned = cleaned.replace(new RegExp(`\\s+${curr}\\s+`, 'g'), ' ').trim();
  });

  // Final cleanup
  cleaned = cleaned.replace(/^\s+|\s+$/g, '').trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

// Test with the exact problematic event names from the database
const problematicEvents = [
  "Fed Bostic Speech Medium",
  "Fed Golbee Speech Medium", 
  "ECB President Lagarde Speech Medium",
  "Fed Williams Speech Medium",
  "Fed Cook Speech Medium",
  "Fed Hammack Speech Medium",
  "ECB Forum on Central Banking Medium"
];

console.log('🧪 Testing cleanEventName Function Directly\n');
console.log('=' .repeat(80));

problematicEvents.forEach((eventName, index) => {
  console.log(`\n${index + 1}. Testing: "${eventName}"`);
  const cleaned = cleanEventName(eventName);
  console.log(`   Result: "${cleaned}"`);
  
  const stillHasImpact = cleaned.includes('High') || cleaned.includes('Medium') || cleaned.includes('Low');
  if (stillHasImpact) {
    console.log(`   ❌ FAILED: Still contains impact text!`);
  } else {
    console.log(`   ✅ SUCCESS: Impact text removed!`);
  }
});

console.log('\n' + '=' .repeat(80));
console.log('🎯 Function Test Summary:');
console.log('If all tests show SUCCESS, then the cleanEventName function works correctly.');
console.log('If tests show FAILED, then there\'s an issue with the function logic.');
console.log('If function works but database still has impact text, then the function');
console.log('is not being called during the storage process.');
