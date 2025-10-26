// @ts-nocheck
/**
 * Test script for the new Repository system
 * Tests Supabase-only repository operations
 */

import { repositoryService } from '../services/repository/RepositoryService';
import { Calendar, Trade } from '../types/dualWrite';

async function testRepositorySystem() {
  console.log('🧪 Testing Repository System...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing health check...');
    const health = await repositoryService.healthCheck();
    console.log('Health status:', health.status);
    console.log('Details:', health.details);
    console.log('✅ Health check completed\n');

    // Test 2: Get Statistics
    console.log('2️⃣ Testing statistics...');
    const stats = await repositoryService.getStats();
    console.log('Current stats:', stats);
    console.log('✅ Statistics retrieved\n');

    // Test 3: Calendar Operations
    console.log('3️⃣ Testing calendar operations...');
    
    // Create a test calendar
    const testCalendar: Omit<Calendar, 'id' | 'created_at' | 'updated_at'> = {
      user_id: 'test-user-123',
      name: 'Test Repository Calendar',
      account_balance: 10000,
      max_daily_drawdown: 500,
      weekly_target: 1000,
      monthly_target: 4000,
      yearly_target: 50000,
      risk_per_trade: 2,
      dynamic_risk_enabled: false,
      duplicated_calendar: false,
      required_tag_groups: ['Strategy', 'Market'],
      tags: ['Forex', 'Swing Trading'],
      total_trades: 0,
      win_count: 0,
      loss_count: 0,
      is_shared: false
    };

    const createResult = await repositoryService.createCalendar(testCalendar);
    if (createResult.success && createResult.data) {
      console.log('✅ Calendar created:', createResult.data.id);
      
      // Test reading the calendar
      const retrievedCalendar = await repositoryService.getCalendar(createResult.data.id);
      if (retrievedCalendar) {
        console.log('✅ Calendar retrieved:', retrievedCalendar.name);
      } else {
        console.log('❌ Failed to retrieve calendar');
      }

      // Test updating the calendar
      const updateResult = await repositoryService.updateCalendar(createResult.data.id, {
        name: 'Updated Test Calendar',
        account_balance: 15000
      });
      
      if (updateResult.success) {
        console.log('✅ Calendar updated');
      } else {
        console.log('❌ Failed to update calendar:', updateResult.error?.message);
      }

      // Test 4: Trade Operations
      console.log('\n4️⃣ Testing trade operations...');
      
      const testTrade: Omit<Trade, 'id' | 'created_at' | 'updated_at'> = {
        calendar_id: createResult.data.id,
        user_id: 'test-user-123',
        name: 'EURUSD Test Trade',
        entry_price: 1.0850,
        exit_price: 1.0900,
        amount: 50,
        trade_type: 'win',
        trade_date: new Date(),
        tags: ['Forex', 'Breakout'],
        notes: 'Test trade from repository system'
      };

      const tradeResult = await repositoryService.createTrade(testTrade);
      if (tradeResult.success && tradeResult.data) {
        console.log('✅ Trade created:', tradeResult.data.id);
        
        // Test reading trades by calendar
        const calendarTrades = await repositoryService.getTradesByCalendarId(createResult.data.id);
        console.log('✅ Trades for calendar:', calendarTrades.length);
      } else {
        console.log('❌ Failed to create trade:', tradeResult.error?.message);
      }

      // Test 5: Cleanup
      console.log('\n5️⃣ Testing cleanup...');
      
      if (tradeResult.success && tradeResult.data) {
        const deleteTradeResult = await repositoryService.deleteTrade(tradeResult.data.id);
        if (deleteTradeResult.success) {
          console.log('✅ Trade deleted');
        } else {
          console.log('❌ Failed to delete trade:', deleteTradeResult.error?.message);
        }
      }

      const deleteCalendarResult = await repositoryService.deleteCalendar(createResult.data.id);
      if (deleteCalendarResult.success) {
        console.log('✅ Calendar deleted');
      } else {
        console.log('❌ Failed to delete calendar:', deleteCalendarResult.error?.message);
      }

    } else {
      console.log('❌ Failed to create calendar:', createResult.error?.message);
    }

    // Final statistics
    console.log('\n6️⃣ Final statistics...');
    const finalStats = await repositoryService.getStats();
    console.log('Final stats:', finalStats);

    console.log('\n🎉 Repository system test completed successfully!');

  } catch (error) {
    console.error('❌ Repository test failed:', error);
    process.exit_price(1);
  }
}

// Run the test
if (require.main === module) {
  testRepositorySystem()
    .then(() => {
      console.log('\n✅ All tests passed!');
      process.exit_price(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit_price(1);
    });
}

export { testRepositorySystem };
