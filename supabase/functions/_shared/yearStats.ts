/**
 * Year-stats calculation shared between handle-trade-changes and update-tag.
 *
 * Extracted so bulk operations (e.g. tag rename) can trigger ONE explicit recompute
 * instead of relying on N webhook fires. Pair with the claim_year_stats_recompute
 * RPC to coalesce concurrent invocations.
 */

import { createServiceClient, log } from './supabase.ts';
import type { Trade, YearStats, MonthlyStats } from './types.ts';

/**
 * Compute year_stats for every year that has trades in the given calendar.
 * Carries the running balance across years using the calendar's account_balance
 * as the starting value.
 */
export async function calculateYearStats(
  calendarId: string,
  accountBalance: number,
): Promise<Record<string, YearStats>> {
  log('Starting year stats calculation', 'info', { calendarId, accountBalance });

  const supabase = createServiceClient();

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

  const tradesByYear = new Map<number, Trade[]>();
  trades.forEach((trade: Trade) => {
    const year = new Date(trade.trade_date).getFullYear();
    if (!tradesByYear.has(year)) tradesByYear.set(year, []);
    tradesByYear.get(year)!.push(trade);
  });

  log(`Found ${tradesByYear.size} years with trades`);

  const yearStatsMap: Record<string, YearStats> = {};
  const sortedYears = Array.from(tradesByYear.keys()).sort((a, b) => a - b);
  let carryOverBalance = accountBalance;

  for (const year of sortedYears) {
    const yearTrades = tradesByYear.get(year)!;
    log(`Calculating stats for year ${year} with ${yearTrades.length} trades`);

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

    const yearStartBalance = carryOverBalance;
    let runningBalance = carryOverBalance;
    const monthlyTrades = new Map<number, Trade[]>();

    yearTrades.forEach((trade) => {
      const monthIndex = new Date(trade.trade_date).getMonth();
      if (!monthlyTrades.has(monthIndex)) monthlyTrades.set(monthIndex, []);
      monthlyTrades.get(monthIndex)!.push(trade);
    });

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

    const yearlyPnL = yearTrades.reduce((sum, t) => sum + t.amount, 0);
    const totalTrades = yearTrades.length;
    const winCount = yearTrades.filter((t) => t.trade_type === 'win').length;
    const lossCount = yearTrades.filter((t) => t.trade_type === 'loss').length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    const yearlyGrowthPercentage = yearStartBalance > 0
      ? (yearlyPnL / yearStartBalance) * 100
      : 0;

    let bestMonthIndex = 0;
    let bestMonthPnL = monthlyStatsArray[0].month_pnl;
    monthlyStatsArray.forEach((m) => {
      if (m.month_pnl > bestMonthPnL) {
        bestMonthPnL = m.month_pnl;
        bestMonthIndex = m.month_index;
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

    carryOverBalance = runningBalance;
  }

  log('Year stats calculation completed', 'info', {
    years_calculated: Object.keys(yearStatsMap).length,
  });

  return yearStatsMap;
}

/**
 * Recompute and persist year_stats for a calendar.
 *
 * Pass coalesce=true to early-skip via claim_year_stats_recompute when another
 * recompute fired in the last ~5s. Pass coalesce=false to bypass the guard —
 * use this from bulk operations that just finished mutating trades and need a
 * guaranteed-fresh stats write.
 */
export async function updateYearStats(
  calendarId: string,
  opts: { coalesce?: boolean } = {},
): Promise<{ ran: boolean; years_updated?: number }> {
  const coalesce = opts.coalesce ?? true;
  const supabase = createServiceClient();

  if (coalesce) {
    const { data: claimed, error: claimError } = await supabase
      .rpc('claim_year_stats_recompute', { p_calendar_id: calendarId });
    if (claimError) {
      log('claim_year_stats_recompute failed; proceeding anyway', 'warn', claimError);
    } else if (claimed === false) {
      log('Skipping year_stats recompute — another invocation claimed the slot', 'info', { calendarId });
      return { ran: false };
    }
  }

  try {
    log('Fetching calendar for year stats calculation');

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

    const yearStats = await calculateYearStats(calendarId, calendar.account_balance as number);

    const { error: updateError } = await supabase
      .from('calendars')
      .update({ year_stats: yearStats } as never)
      .eq('id', calendarId);

    if (updateError) {
      log('Error updating calendar year_stats', 'error', updateError);
      throw updateError;
    }

    const yearsUpdated = Object.keys(yearStats).length;
    log('Calendar year_stats updated successfully', 'info', { years_updated: yearsUpdated });
    return { ran: true, years_updated: yearsUpdated };
  } catch (error) {
    log('Error in year stats calculation/update', 'error', error);
    // Release the claim so the next webhook can retry. Without this, the timestamp
    // set by claim_year_stats_recompute would block all recomputes for the full
    // window (default 5s), silently losing a known-needed recompute.
    if (coalesce) {
      try {
        await supabase
          .from('calendars')
          .update({ year_stats_last_recomputed_at: null } as never)
          .eq('id', calendarId);
      } catch (releaseErr) {
        log('Failed to release year_stats recompute claim', 'warn', releaseErr);
      }
    }
    return { ran: false };
  }
}
