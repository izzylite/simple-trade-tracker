/**
 * Test script for refresh-economic-calendar edge function
 * Tests with the "Unemployment Rate Q3" event
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gwubzauelilziaqnsfac.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dWJ6YXVlbGlsemlhcW5zZmFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjQ0MjQwMywiZXhwIjoyMDY4MDE4NDAzfQ.ATcbDJAbz_OZ8DS6uZXfk8V-3GGn5xlKZVLps51wmuU';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testRefreshCalendar() {
  console.log('🧪 Testing refresh-economic-calendar function...\n');

  // Event details from database
  const targetEvent = {
    external_id: 'faed5c769daeb4abc8b3',
    event: 'Unemployment Rate Q3',
    currency: 'EUR',
    actual: '7.7%',
    forecast: '289592',
    previous: '289592',
    time_utc: '2025-11-13T06:30:00.000Z'
  };

  const payload = {
    targetDate: '2025-11-13',
    currencies: ['EUR'],
    events: [targetEvent]
  };

  console.log('📤 Calling edge function with payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n⏳ Waiting for response...\n');

  const startTime = Date.now();

  try {
    const { data, error } = await supabase.functions.invoke('refresh-economic-calendar', {
      body: payload
    });

    const duration = Date.now() - startTime;

    if (error) {
      console.error('❌ Error calling function:', error);
      return;
    }

    console.log(`✅ Function completed in ${duration}ms\n`);
    console.log('📊 Response data:');
    console.log(JSON.stringify(data, null, 2));

    // Analyze the response
    const responseData = data as any;
    console.log('\n📈 Analysis:');
    console.log(`- Success: ${responseData.success}`);
    console.log(`- Updated Count: ${responseData.updatedCount}`);
    console.log(`- Target Events: ${responseData.targetEvents?.length || 0}`);
    console.log(`- Found Events: ${responseData.foundEvents?.length || 0}`);
    console.log(`- Has Specific Events: ${responseData.hasSpecificEvents}`);
    console.log(`- Message: ${responseData.message}`);

    if (responseData.targetEvents && responseData.targetEvents.length > 0) {
      console.log('\n🎯 Target Events:');
      responseData.targetEvents.forEach((event: any, index: number) => {
        console.log(`\n  Event ${index + 1}:`);
        console.log(`    - Name: ${event.event_name || event.event}`);
        console.log(`    - Currency: ${event.currency}`);
        console.log(`    - Actual: ${event.actual_value || event.actual}`);
        console.log(`    - Forecast: ${event.forecast_value || event.forecast}`);
        console.log(`    - Previous: ${event.previous_value || event.previous}`);
      });
    }

    if (responseData.foundEvents && responseData.foundEvents.length > 0) {
      console.log('\n✨ Found Events (matching requested):');
      responseData.foundEvents.forEach((event: any, index: number) => {
        console.log(`\n  Event ${index + 1}:`);
        console.log(`    - Name: ${event.event_name || event.event}`);
        console.log(`    - Currency: ${event.currency}`);
        console.log(`    - Actual: ${event.actual_value || event.actual}`);
        console.log(`    - Forecast: ${event.forecast_value || event.forecast}`);
        console.log(`    - Previous: ${event.previous_value || event.previous}`);
      });
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

// Run the test
testRefreshCalendar().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

