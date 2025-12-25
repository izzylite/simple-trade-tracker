/**
 * Handle Trade Changes Edge Function
 *
 * Triggered by database webhooks when trades are modified
 * Handles: image cleanup on DELETE and UPDATE operations
 */  
import { createServiceClient, errorResponse, successResponse, handleCors, log, parseJsonBody } from '../_shared/supabase.ts';
import { canDeleteImage, deleteTradeImages } from '../_shared/utils.ts';
import type { Trade, TradeWebhookPayload, YearStats, MonthlyStats } from '../_shared/types.ts';
/**
 * Clean up removed images when a trade is deleted or updated
 */ async function cleanupRemovedImages(oldTrade: Trade | undefined, newTrade: Trade | undefined, calendarId: string, userId: string): Promise<void> {
  try {
    log('Starting image cleanup process');
    // Get images from old and new records
    const oldImages = (oldTrade?.images as Record<string, unknown>[] | undefined) || [];
    const newImages = (newTrade?.images as Record<string, unknown>[] | undefined) || [];
    // Create a map of new images for quick lookup
    const newImagesMap = new Map<string, boolean>();
    newImages.forEach((image) => {
      if (image && typeof image.id === 'string') {
        newImagesMap.set(image.id, true);
      }
    });
    // Find images that were removed (in old but not in new)
    const imagesToDelete: string[] = [];
    oldImages.forEach((image) => {
      if (image && typeof image.id === 'string' && !newImagesMap.has(image.id)) {
        imagesToDelete.push(image.id);
      }
    });
    if (imagesToDelete.length === 0) {
      log('No images to delete');
      return;
    }
    log(`Found ${imagesToDelete.length} images to potentially delete`);
    // Use service client for storage operations
    const supabase = createServiceClient();
    // Filter images that can be safely deleted
    // (check if they're used in duplicated calendars)
    const finalImagesToDelete: string[] = [];
    for (const imageId of imagesToDelete) {
      const canDelete = await canDeleteImage(supabase, imageId, calendarId);
      if (canDelete) {
        finalImagesToDelete.push(imageId);
        log(`Image ${imageId} can be safely deleted`);
      } else {
        log(`Image ${imageId} cannot be deleted - exists in related calendars`);
      }
    }
    if (finalImagesToDelete.length === 0) {
      log('No images to delete after safety check');
      return;
    }
    // Delete images from Supabase Storage using shared utility
    const { successCount, totalCount } = await deleteTradeImages(supabase, finalImagesToDelete, userId, log);
    log(`Image cleanup completed: ${successCount}/${totalCount} images deleted`);
  } catch (error) {
    log('Error in cleanupRemovedImages', 'error', error);
  // Don't throw - we don't want image cleanup failures to fail the webhook
  }
}

/**
 * Calculate year statistics for a calendar
 * Computes yearly aggregates and monthly breakdown for each year
 */
async function calculateYearStats(
  calendarId: string,
  accountBalance: number
): Promise<Record<string, YearStats>> {
  try {
    log('Starting year stats calculation', 'info', { calendarId, accountBalance });

    const supabase = createServiceClient();

    // Fetch all trades for the calendar, ordered by date
    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('calendar_id', calendarId)
      .order('trade_date', { ascending: true });

    if (error) {
      log('Error fetching trades for stats calculation', 'error', error);
      throw error;
    }

    if (!trades || trades.length === 0) {
      log('No trades found for calendar', 'info', { calendarId });
      return {};
    }

    log(`Processing ${trades.length} trades for stats calculation`);

    // Group trades by year
    const tradesByYear = new Map<number, Trade[]>();
    trades.forEach((trade) => {
      const tradeDate = new Date(trade.trade_date);
      const year = tradeDate.getFullYear();

      if (!tradesByYear.has(year)) {
        tradesByYear.set(year, []);
      }
      tradesByYear.get(year)!.push(trade);
    });

    log(`Found ${tradesByYear.size} years with trades`);

    // Calculate stats for each year
    const yearStatsMap: Record<string, YearStats> = {};

    for (const [year, yearTrades] of tradesByYear.entries()) {
      log(`Calculating stats for year ${year} with ${yearTrades.length} trades`);

      // Initialize monthly stats array (12 months, indices 0-11)
      const monthlyStatsArray: MonthlyStats[] = [];
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        monthlyStatsArray.push({
          month_index: monthIndex,
          month_pnl: 0,
          trade_count: 0,
          win_count: 0,
          loss_count: 0,
          growth_percentage: 0,
          account_value_at_start: 0,
        });
      }

      // Group trades by month and calculate monthly stats
      let runningBalance = accountBalance;
      const monthlyTrades = new Map<number, Trade[]>();

      yearTrades.forEach((trade) => {
        const tradeDate = new Date(trade.trade_date);
        const monthIndex = tradeDate.getMonth(); // 0-11

        if (!monthlyTrades.has(monthIndex)) {
          monthlyTrades.set(monthIndex, []);
        }
        monthlyTrades.get(monthIndex)!.push(trade);
      });

      // Calculate stats for each month
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const monthTrades = monthlyTrades.get(monthIndex) || [];
        const monthStartBalance = runningBalance;

        let monthPnL = 0;
        let winCount = 0;
        let lossCount = 0;

        monthTrades.forEach((trade) => {
          monthPnL += trade.amount;
          if (trade.trade_type === 'win') winCount++;
          else if (trade.trade_type === 'loss') lossCount++;
        });

        runningBalance += monthPnL;

        const growthPercentage = monthStartBalance > 0
          ? (monthPnL / monthStartBalance) * 100
          : 0;

        monthlyStatsArray[monthIndex] = {
          month_index: monthIndex,
          month_pnl: monthPnL,
          trade_count: monthTrades.length,
          win_count: winCount,
          loss_count: lossCount,
          growth_percentage: Number(growthPercentage.toFixed(2)),
          account_value_at_start: monthStartBalance,
        };
      }

      // Calculate yearly aggregates
      const yearlyPnL = yearTrades.reduce((sum, trade) => sum + trade.amount, 0);
      const totalTrades = yearTrades.length;
      const winCount = yearTrades.filter((t) => t.trade_type === 'win').length;
      const lossCount = yearTrades.filter((t) => t.trade_type === 'loss').length;
      const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
      const yearlyGrowthPercentage = accountBalance > 0
        ? (yearlyPnL / accountBalance) * 100
        : 0;

      // Find best month (month with highest P&L)
      let bestMonthIndex = 0;
      let bestMonthPnL = monthlyStatsArray[0].month_pnl;

      monthlyStatsArray.forEach((monthStats) => {
        if (monthStats.month_pnl > bestMonthPnL) {
          bestMonthPnL = monthStats.month_pnl;
          bestMonthIndex = monthStats.month_index;
        }
      });

      yearStatsMap[year.toString()] = {
        year,
        yearly_pnl: Number(yearlyPnL.toFixed(2)),
        yearly_growth_percentage: Number(yearlyGrowthPercentage.toFixed(2)),
        total_trades: totalTrades,
        win_count: winCount,
        loss_count: lossCount,
        win_rate: Number(winRate.toFixed(2)),
        best_month_index: bestMonthIndex,
        best_month_pnl: Number(bestMonthPnL.toFixed(2)),
        monthly_stats: monthlyStatsArray,
      };

      log(`Year ${year} stats calculated:`, 'info', {
        yearly_pnl: yearlyPnL,
        total_trades: totalTrades,
        win_rate: winRate.toFixed(2),
        best_month: bestMonthIndex,
      });
    }

    log('Year stats calculation completed', 'info', {
      years_calculated: Object.keys(yearStatsMap).length
    });

    return yearStatsMap;
  } catch (error) {
    log('Error calculating year stats', 'error', error);
    // Return empty object on error - don't fail the webhook
    return {};
  }
}

/**
 * Main Edge Function handler
 */ Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    log('Trade changes webhook received');
    // Parse the webhook payload
    const payload = await parseJsonBody<TradeWebhookPayload>(req);
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400);
    }
    log('Processing trade change event', 'info', {
      operation: payload.operation,
      table: payload.table
    });
    // Validate payload
    if (payload.table !== 'trades') {
      return errorResponse('Invalid table in payload', 400);
    }

    // Validate operation-specific requirements
    if (payload.operation === 'DELETE' && !payload.old_record) {
      return errorResponse('Missing old_record for DELETE operation', 400);
    }
    if (payload.operation === 'UPDATE' && (!payload.old_record || !payload.new_record)) {
      return errorResponse('Missing records for UPDATE operation', 400);
    }

    // Extract calendar ID and user ID
    const calendarId = payload.calendar_id || payload.old_record?.calendar_id || payload.new_record?.calendar_id;
    const userId = payload.user_id || payload.old_record?.user_id || payload.new_record?.user_id;

    if (!calendarId || !userId) {
      return errorResponse('Missing calendar_id or user_id', 400);
    }

    // Clean up images based on operation type (UPDATE and DELETE only)
    if (payload.operation === 'DELETE') {
      // Delete all images from the deleted trade
      await cleanupRemovedImages(payload.old_record, undefined, calendarId, userId);
    } else if (payload.operation === 'UPDATE') {
      // Delete images that were removed in the update
      await cleanupRemovedImages(payload.old_record, payload.new_record, calendarId, userId);
    }

    // Calculate and update year_stats for all operations (INSERT, UPDATE, DELETE)
    await updateYearStats(calendarId);

    log('Trade changes processed successfully');
    return successResponse({
      message: 'Trade changes processed successfully',
      calendar_id: calendarId,
      operation: payload.operation
    });
  } catch (error) {
    log('Error processing trade changes', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});

async function updateYearStats(calendarId : string) {
   try {
      log('Fetching calendar for year stats calculation');
      const supabase = createServiceClient();

      // Fetch calendar to get account_balance
      const { data: calendar, error: calendarError } = await supabase
        .from('calendars')
        .select('account_balance')
        .eq('id', calendarId)
        .single();

      if (calendarError) {
        log('Error fetching calendar', 'error', calendarError);
        throw calendarError;
      }

      if (!calendar) {
        log('Calendar not found', 'error', { calendarId });
        throw new Error('Calendar not found');
      }

      // Calculate year stats
      const yearStats = await calculateYearStats(calendarId, calendar.account_balance);

      // Update calendar with calculated year_stats
      const { error: updateError } = await supabase
        .from('calendars')
        .update({ year_stats: yearStats })
        .eq('id', calendarId);

      if (updateError) {
        log('Error updating calendar year_stats', 'error', updateError);
        throw updateError;
      }

      log('Calendar year_stats updated successfully', 'info', {
        years_updated: Object.keys(yearStats).length
      });
    } catch (error) {
      log('Error in year stats calculation/update', 'error', error);
      // Don't fail the webhook on year stats errors - log and continue
    }
}
