const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to convert Firestore timestamp to ISO string
function convertTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp._type === 'timestamp' && timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }
  if (timestamp.iso) {
    return timestamp.iso;
  }
  return null;
}

async function migrateMissingTrades() {
  try {
    console.log('🚀 Starting migration of missing trades...\n');

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

    // Get the Supabase calendar ID
    const { data: supabaseCalendars, error: calError } = await supabase
      .from('calendars')
      .select('id, name')
      .eq('name', 'Strategy Dataset')
      .eq('user_id', '3d72a36e-ce9a-4531-a1ee-5eb4b815ada1')
      .limit(1);

    if (calError || !supabaseCalendars || supabaseCalendars.length === 0) {
      console.error('❌ Error fetching Supabase calendar:', calError);
      process.exit(1);
    }

    const supabaseCalendarId = supabaseCalendars[0].id;
    console.log('📅 Supabase Calendar ID:', supabaseCalendarId);

    // Load the failed trades list
    const failedTrades = JSON.parse(
      fs.readFileSync('scripts/failed-trades.json', 'utf8')
    );

    console.log(`\n📊 Found ${failedTrades.length} missing trades to migrate\n`);

    let migrated = 0;
    let failed = 0;

    for (const failedTrade of failedTrades) {
      try {
        // Get the full trade data from Firebase export
        const fbTrade = strategyDataset.trades[failedTrade.index];
        const tradeData = fbTrade.data;

        console.log(`\n📝 Migrating trade ${failedTrade.index + 1}:`);
        console.log(`   Firebase ID: ${fbTrade.id}`);
        console.log(`   Name: ${tradeData.name}`);
        console.log(`   Amount: ${tradeData.amount}`);
        console.log(`   Date: ${tradeData.date?.iso}`);

        // Prepare trade record for Supabase
        const tradeRecord = {
          id: uuidv4(), // Generate new UUID
          calendar_id: supabaseCalendarId,
          user_id: '3d72a36e-ce9a-4531-a1ee-5eb4b815ada1',
          name: tradeData.name || 'Untitled Trade',
          amount: parseFloat(tradeData.amount) || 0,
          trade_type: tradeData.type || tradeData.tradeType || 'breakeven',
          trade_date: convertTimestamp(tradeData.date || tradeData.tradeDate) || new Date().toISOString(),
          entry_price: parseFloat(tradeData.entryPrice) || null,
          exit_price: parseFloat(tradeData.exitPrice) || null,
          stop_loss: parseFloat(tradeData.stopLoss) || null,
          take_profit: parseFloat(tradeData.takeProfit) || null,
          risk_to_reward: parseFloat(tradeData.riskToReward) || null,
          partials_taken: tradeData.partialsTaken || false,
          session: tradeData.session || null,
          notes: tradeData.notes || null,
          tags: tradeData.tags || [],
          images: tradeData.images || [],
          economic_events: tradeData.economicEvents || [],
          is_temporary: tradeData.isTemporary || false,
          is_pinned: tradeData.isPinned || false,
          share_link: tradeData.shareLink || null,
          is_shared: tradeData.isShared || false,
          shared_at: convertTimestamp(tradeData.sharedAt) || null,
          share_id: tradeData.shareId || null,
          created_at: convertTimestamp(tradeData.createdAt) || new Date().toISOString(),
          updated_at: convertTimestamp(tradeData.updatedAt) || new Date().toISOString()
        };

        // Insert trade into Supabase
        const { error: insertError } = await supabase
          .from('trades')
          .insert(tradeRecord);

        if (insertError) {
          console.error(`   ❌ Error: ${insertError.message}`);
          failed++;
        } else {
          console.log(`   ✅ Migrated successfully`);
          migrated++;
        }

      } catch (error) {
        console.error(`   ❌ Error migrating trade: ${error.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('='.repeat(50));

    // Verify final count
    const { data: finalTrades, error: countError } = await supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('calendar_id', supabaseCalendarId);

    if (!countError) {
      console.log(`\n✅ Final trade count in Supabase: ${finalTrades?.length || 0}`);
    }

    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrateMissingTrades();

