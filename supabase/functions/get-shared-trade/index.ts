/**
 * Get Shared Trade Edge Function
 * Queries trades table directly using share_id field
 * Share link information is stored directly on the trade document
 */
import { createServiceClient, errorResponse, successResponse, handleCors, log, parseJsonBody } from '../_shared/supabase.ts';
import type { Trade } from '../_shared/types.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    log('Get shared trade request received');
    const payload = await parseJsonBody<{ shareId: string }>(req);
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400);
    }
    const { shareId } = payload;
    if (!shareId) {
      return errorResponse('Missing shareId parameter', 400);
    }
    const supabase = createServiceClient();
    // Query trades table directly using share_id field
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('*')
      .eq('share_id', shareId)
      .eq('is_shared', true)
      .single();

    if (tradeError || !trade) {
      return errorResponse('Shared trade not found', 404);
    }

    log(`Shared trade ${shareId} viewed (trade: ${trade.id})`);
    return successResponse({
      trade: trade as Trade,
      viewCount: 0,
      sharedAt: trade.shared_at
    });
  } catch (error) {
    log('Error getting shared trade', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
