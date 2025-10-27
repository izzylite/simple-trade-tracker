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

async function findExtraTrades() {
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

    // Get all Supabase trades for Strategy Dataset calendars only
    const { data: supabaseTrades, error } = await supabase
      .from('trades')
      .select('id, name, trade_date, amount, trade_type, share_id')
      .in('calendar_id', calendarIds);

    if (error) {
      console.error('❌ Error fetching Supabase trades:', error);
      process.exit(1);
    }

    console.log('Supabase Trades:', supabaseTrades.length);

    // Create a map of Firebase trades for quick lookup
    const firebaseTradeMap = new Map();
    strategyDataset.trades.forEach(fbTrade => {
      const tradeData = fbTrade.data;
      
      if (!tradeData) return;

      const tradeDate = tradeData.date?.iso 
        ? new Date(tradeData.date.iso).toISOString().split('T')[0]
        : null;
      
      const key = `${tradeData.name}_${tradeDate}_${tradeData.amount}`;
      firebaseTradeMap.set(key, fbTrade);
    });

    // Find extra trades in Supabase that don't exist in Firebase
    const extraTrades = [];
    supabaseTrades.forEach(sbTrade => {
      const tradeDate = new Date(sbTrade.trade_date).toISOString().split('T')[0];
      const key = `${sbTrade.name}_${tradeDate}_${sbTrade.amount}`;
      
      if (!firebaseTradeMap.has(key)) {
        extraTrades.push({
          supabaseId: sbTrade.id,
          name: sbTrade.name,
          date: sbTrade.trade_date,
          amount: sbTrade.amount,
          type: sbTrade.trade_type,
          shareId: sbTrade.share_id
        });
      }
    });

    console.log(`\n❌ Extra Trades in Supabase: ${extraTrades.length}\n`);

    if (extraTrades.length > 0) {
      console.log('Extra trades details:\n');
      extraTrades.forEach((trade, i) => {
        console.log(`${i + 1}. Supabase ID: ${trade.supabaseId}`);
        console.log(`   Name: ${trade.name}`);
        console.log(`   Date: ${trade.date}`);
        console.log(`   Amount: ${trade.amount}`);
        console.log(`   Type: ${trade.type}`);
        console.log(`   Share ID: ${trade.shareId || 'none'}`);
        console.log('');
      });

      // Save extra trades to file
      fs.writeFileSync(
        'scripts/extra-trades.json',
        JSON.stringify(extraTrades, null, 2)
      );
      console.log('📝 Extra trades saved to scripts/extra-trades.json\n');
    } else {
      console.log('✅ No extra trades found!\n');
    }

    console.log('✅ Verification complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

findExtraTrades();

