/**
 * Auto Refresh Economic Calendar Edge Function
 * Replaces Firebase autoRefreshEconomicCalendarV2 scheduled function
 *
 * Runs 4x daily (6 AM, 10 AM, 2 PM, 6 PM UTC) to fetch economic calendar data
 * from MyFXBook/MQL5 and update the database with the latest events
 *
 * SMART SKIP LOGIC (saves ScraperAPI credits):
 * - Skips weekends (no events on Sat/Sun)
 * - Skips if no events today and last fetch was < 12 hours ago
 */
import { errorResponse, successResponse, handleCors, log } from '../_shared/supabase.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

// 12 hours in milliseconds
const SKIP_THRESHOLD_MS = 12 * 60 * 60 * 1000;

/**
 * Check if we should skip this refresh to save ScraperAPI credits
 * Returns { skip: boolean, reason: string }
 */
async function shouldSkipRefresh(): Promise<{ skip: boolean; reason: string }> {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

  // Skip weekends - no economic events
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { skip: true, reason: `Weekend (${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}) - no events` };
  }

  // Check if there are events today
  const supabase = createServiceClient();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);

  const { data: todayEvents, error: eventsError } = await supabase
    .from('economic_events')
    .select('id, last_updated')
    .gte('event_time', todayStart.toISOString())
    .lte('event_time', todayEnd.toISOString())
    .limit(1);

  if (eventsError) {
    log('Error checking today events, proceeding with refresh', 'warn', eventsError);
    return { skip: false, reason: 'Error checking events, proceeding anyway' };
  }

  // If there are events today, always refresh to get latest actual values
  if (todayEvents && todayEvents.length > 0) {
    return { skip: false, reason: 'Events exist today - refreshing for updates' };
  }

  // No events today - check when we last fetched
  const { data: lastFetch, error: fetchError } = await supabase
    .from('economic_events')
    .select('last_updated')
    .order('last_updated', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !lastFetch?.last_updated) {
    return { skip: false, reason: 'No previous fetch found - need initial data' };
  }

  const lastFetchTime = new Date(lastFetch.last_updated).getTime();
  const timeSinceLastFetch = now.getTime() - lastFetchTime;

  if (timeSinceLastFetch < SKIP_THRESHOLD_MS) {
    const hoursAgo = Math.round(timeSinceLastFetch / (60 * 60 * 1000));
    return {
      skip: true,
      reason: `No events today and last fetch was ${hoursAgo}h ago (< 12h threshold)`
    };
  }

  return { skip: false, reason: 'No events today but last fetch was > 12h ago' };
}

/**
 * Auto refresh economic calendar data
 */ async function autoRefreshEconomicCalendar(): Promise<{ eventsProcessed: number; eventsStored: number }> {
  try {
    log('Starting auto refresh of economic calendar data');
    // Get current date for fetching today's events
    const today = new Date();
    const targetDate = today.toISOString().split('T')[0] // YYYY-MM-DD format
    ;
    // Major currencies to filter for
    const majorCurrencies = [
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'AUD',
      'CAD',
      'CHF'
    ];
    log(`Fetching economic calendar for date: ${targetDate}, currencies: ${majorCurrencies.join(', ')}`);
    // Call the refresh-economic-calendar function to fetch and process data
    // Use service role key for internal function calls
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    // For internal edge function calls, use only the apikey header with service role key
    // Avoid using Authorization: Bearer which triggers JWT validation at the gateway
    const refreshResponse = await fetch(`${supabaseUrl}/functions/v1/refresh-economic-calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        targetDate,
        currencies: majorCurrencies
      })
    });
    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      throw new Error(`Refresh function failed: ${errorText}`);
    }
    const refreshResult = await refreshResponse.json();
    if (!refreshResult.success) {
      throw new Error(`Refresh function returned error: ${refreshResult.error}`);
    }
    // Response is wrapped in { success: true, data: {...} } by successResponse()
    const refreshData = refreshResult.data || refreshResult;
    // Use targetEvents for auto-refresh (foundEvents is only for specific event requests)
    const eventsProcessed = refreshData.targetEvents?.length || 0;
    const eventsStored = refreshData.updatedCount || 0;
    log(`Auto refresh completed: ${eventsProcessed} events processed, ${eventsStored} events stored`);
    return {
      eventsProcessed,
      eventsStored
    };
  } catch (error) {
    log('Error in autoRefreshEconomicCalendar', 'error', error);
    throw error;
  }
}
/**
 * Main Edge Function handler
 */ Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    log('Auto refresh economic calendar scheduled function triggered');

    // Check if we should skip this refresh to save ScraperAPI credits
    const skipCheck = await shouldSkipRefresh();
    if (skipCheck.skip) {
      log(`Skipping refresh: ${skipCheck.reason}`);
      return successResponse({
        success: true,
        skipped: true,
        reason: skipCheck.reason,
        message: `Refresh skipped to save ScraperAPI credits`,
        timestamp: new Date().toISOString()
      });
    }

    log(`Proceeding with refresh: ${skipCheck.reason}`);

    // This function can be called by Supabase Cron or manually
    // No authentication required for scheduled calls
    const result = await autoRefreshEconomicCalendar();
    const response: Record<string, unknown> = {
      success: true,
      skipped: false,
      message: `Auto refresh completed: ${result.eventsStored} events updated`,
      eventsProcessed: result.eventsProcessed,
      eventsStored: result.eventsStored,
      timestamp: new Date().toISOString()
    };
    log('Auto refresh completed successfully', 'info', response);
    return successResponse(response);
  } catch (error) {
    log('Error in auto refresh economic calendar function', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
