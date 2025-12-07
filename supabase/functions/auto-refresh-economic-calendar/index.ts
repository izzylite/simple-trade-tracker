/**
 * Auto Refresh Economic Calendar Edge Function
 * Replaces Firebase autoRefreshEconomicCalendarV2 scheduled function
 *
 * Runs every 30 minutes to fetch economic calendar data from MyFXBook
 * and update the database with the latest events
 */
import { errorResponse, successResponse, handleCors, log } from '../_shared/supabase.ts';

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
    // This function can be called by Supabase Cron or manually
    // No authentication required for scheduled calls
    const result = await autoRefreshEconomicCalendar();
    const response: Record<string, unknown> = {
      success: true,
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
