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

async function verifyMigration() {
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

    console.log('📊 Strategy Dataset Verification\n');
    console.log('Firebase Calendar ID:', strategyDataset.id);
    console.log('Firebase Trades:', strategyDataset.trades.length);

    // Get Supabase calendar
    const { data: supabaseCalendars, error: calError } = await supabase
      .from('calendars')
      .select('id, name')
      .eq('name', 'Strategy Dataset')
      .eq('user_id', '3d72a36e-ce9a-4531-a1ee-5eb4b815ada1');

    if (calError) {
      console.error('❌ Error fetching Supabase calendar:', calError);
      process.exit(1);
    }

    console.log('\nSupabase Calendars found:', supabaseCalendars.length);
    
    for (const cal of supabaseCalendars) {
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('id, name, trade_date, amount')
        .eq('calendar_id', cal.id);

      if (tradesError) {
        console.error('❌ Error fetching trades:', tradesError);
        continue;
      }

      console.log(`\nCalendar ID: ${cal.id}`);
      console.log(`Supabase Trades: ${trades.length}`);
    }

    // Find missing trades
    console.log('\n🔍 Checking for missing trades...\n');

    const firebaseTrades = strategyDataset.trades;
    const { data: supabaseTrades, error: allTradesError } = await supabase
      .from('trades')
      .select('name, trade_date, amount, share_id')
      .eq('user_id', '3d72a36e-ce9a-4531-a1ee-5eb4b815ada1')
      .in('calendar_id', supabaseCalendars.map(c => c.id));

    if (allTradesError) {
      console.error('❌ Error fetching all trades:', allTradesError);
      process.exit(1);
    }

    console.log('Total Supabase trades for Strategy Dataset:', supabaseTrades.length);

    // Create a map of Supabase trades for quick lookup
    const supabaseTradeMap = new Map();
    supabaseTrades.forEach(trade => {
      const key = `${trade.name}_${new Date(trade.trade_date).toISOString()}_${trade.amount}`;
      supabaseTradeMap.set(key, trade);
    });

    // Find missing trades
    const missingTrades = [];
    firebaseTrades.forEach((fbTrade, index) => {
      const tradeDate = fbTrade.date?.iso || fbTrade.date?.seconds 
        ? new Date(fbTrade.date.seconds * 1000).toISOString()
        : null;
      
      const key = `${fbTrade.name}_${tradeDate}_${fbTrade.amount}`;
      
      if (!supabaseTradeMap.has(key)) {
        missingTrades.push({
          index,
          name: fbTrade.name,
          date: tradeDate,
          amount: fbTrade.amount,
          type: fbTrade.type,
          shareId: fbTrade.shareId,
          entryPrice: fbTrade.entryPrice,
          exitPrice: fbTrade.exitPrice
        });
      }
    });

    console.log(`\n❌ Missing Trades: ${missingTrades.length}\n`);

    if (missingTrades.length > 0) {
      console.log('Missing trades details:');
      missingTrades.forEach((trade, i) => {
        console.log(`\n${i + 1}. Trade Index: ${trade.index}`);
        console.log(`   Name: ${trade.name}`);
        console.log(`   Date: ${trade.date}`);
        console.log(`   Amount: ${trade.amount}`);
        console.log(`   Type: ${trade.type}`);
        console.log(`   Share ID: ${trade.shareId || 'none'}`);
        console.log(`   Entry Price: ${trade.entryPrice}`);
        console.log(`   Exit Price: ${trade.exitPrice}`);
      });

      // Save missing trades to file
      fs.writeFileSync(
        'scripts/missing-trades.json',
        JSON.stringify(missingTrades, null, 2)
      );
      console.log('\n📝 Missing trades saved to scripts/missing-trades.json');
    }

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyMigration();

