const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findFailedTrades() {
  try {
    // Load Firebase export
    const firebaseData = JSON.parse(
      fs.readFileSync('scripts/firestore-export/calendars-with-trades.json', 'utf8')
    );

    // Find Strategy Dataset calendar
    const strategyDataset = firebaseData.find(
      cal => cal.data && cal.data.name === 'Strategy Dataset'
    );

    if (!strategyDataset) {
      console.error('❌ Strategy Dataset calendar not found in Firebase export');
      process.exit(1);
    }

    console.log('📊 Strategy Dataset Trade Verification\n');
    console.log('Firebase Calendar ID:', strategyDataset.id);
    console.log('Firebase Trades:', strategyDataset.trades.length);

    // Get Supabase calendar IDs for Strategy Dataset
    const { data: supabaseCalendars, error: calError } = await supabase
      .from('calendars')
      .select('id')
      .eq('name', 'Strategy Dataset')
      .eq('user_id', '3d72a36e-ce9a-4531-a1ee-5eb4b815ada1');

    if (calError) {
      console.error('❌ Error fetching Supabase calendars:', calError);
      process.exit(1);
    }

    const calendarIds = supabaseCalendars.map(c => c.id);
    console.log('Supabase Calendar IDs:', calendarIds);

    // Get all Supabase trades for Strategy Dataset calendars only
    const { data: supabaseTrades, error } = await supabase
      .from('trades')
      .select('id, name, trade_date, amount, trade_type, share_id')
      .in('calendar_id', calendarIds);

    if (error) {
      console.error('❌ Error fetching Supabase trades:', error);
      process.exit(1);
    }

    console.log('Supabase Trades (Strategy Dataset only):', supabaseTrades.length);

    // Create a map of Supabase trades for quick lookup
    const supabaseTradeMap = new Map();
    supabaseTrades.forEach(trade => {
      // Use name, date, and amount as key
      const tradeDate = new Date(trade.trade_date).toISOString().split('T')[0];
      const key = `${trade.name}_${tradeDate}_${trade.amount}`;
      supabaseTradeMap.set(key, trade);
    });

    // Find missing trades from Firebase
    const missingTrades = [];
    strategyDataset.trades.forEach((fbTrade, index) => {
      const tradeData = fbTrade.data;
      
      if (!tradeData) {
        console.log(`⚠️  Trade ${index} has no data property`);
        return;
      }

      const tradeDate = tradeData.date?.iso 
        ? new Date(tradeData.date.iso).toISOString().split('T')[0]
        : null;
      
      const key = `${tradeData.name}_${tradeDate}_${tradeData.amount}`;
      
      if (!supabaseTradeMap.has(key)) {
        missingTrades.push({
          index,
          firebaseId: fbTrade.id,
          name: tradeData.name,
          date: tradeData.date?.iso,
          amount: tradeData.amount,
          type: tradeData.type,
          shareId: tradeData.shareId,
          entryPrice: tradeData.entryPrice,
          exitPrice: tradeData.exitPrice,
          tags: tradeData.tags?.slice(0, 3) // First 3 tags for brevity
        });
      }
    });

    console.log(`\n${missingTrades.length === 0 ? '✅' : '❌'} Missing Trades: ${missingTrades.length}\n`);

    if (missingTrades.length > 0) {
      console.log('Missing trades details:\n');
      missingTrades.forEach((trade, i) => {
        console.log(`${i + 1}. Firebase ID: ${trade.firebaseId}`);
        console.log(`   Index: ${trade.index}`);
        console.log(`   Name: ${trade.name}`);
        console.log(`   Date: ${trade.date}`);
        console.log(`   Amount: ${trade.amount}`);
        console.log(`   Type: ${trade.type}`);
        console.log(`   Share ID: ${trade.shareId || 'none'}`);
        console.log(`   Entry Price: ${trade.entryPrice || 'N/A'}`);
        console.log(`   Exit Price: ${trade.exitPrice || 'N/A'}`);
        console.log(`   Tags: ${trade.tags?.join(', ') || 'none'}`);
        console.log('');
      });

      // Save missing trades to file
      fs.writeFileSync(
        'scripts/failed-trades.json',
        JSON.stringify(missingTrades, null, 2)
      );
      console.log('📝 Failed trades saved to scripts/failed-trades.json\n');
    } else {
      console.log('✅ All trades migrated successfully!\n');
    }

    console.log('✅ Verification complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

findFailedTrades();

