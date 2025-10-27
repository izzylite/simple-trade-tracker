/**
 * Get Shared Calendar Edge Function
 * Queries calendars table directly using share_id field
 * Share link information is stored directly on the calendar document
 */
import { createServiceClient, errorResponse, successResponse, handleCors, log, parseJsonBody } from '../_shared/supabase.ts';
import type { Calendar, Trade } from '../_shared/types.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    log('Get shared calendar request received');
    const payload = await parseJsonBody<{ shareId: string }>(req);
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400);
    }
    const { shareId } = payload;
    if (!shareId) {
      return errorResponse('Missing shareId parameter', 400);
    }
    const supabase = createServiceClient();
    // Query calendars table directly using share_id field
    const { data: calendar, error: calendarError } = await supabase
      .from('calendars')
      .select('*')
      .eq('share_id', shareId)
      .eq('is_shared', true)
      .single();

    if (calendarError || !calendar) {
      return errorResponse('Shared calendar not found', 404);
    }

    // Get all trades for this calendar
    const { data: trades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .eq('calendar_id', calendar.id)
      .order('trade_date', { ascending: false });

    if (tradesError) {
      log('Error fetching calendar trades', 'error', tradesError);
      return errorResponse('Failed to load calendar trades', 500);
    }

    log(`Shared calendar ${shareId} viewed (calendar: ${calendar.id})`);
    return successResponse({
      calendar: calendar as Calendar,
      trades: (trades || []) as Trade[],
      shareInfo: {
        viewCount: 0,
        sharedAt: calendar.shared_at
      }
    });
  } catch (error) {
    log('Error getting shared calendar', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
