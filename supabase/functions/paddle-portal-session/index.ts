import {
  handleCors,
  log,
  createAuthenticatedClient,
  successResponse,
  errorResponse,
} from '../_shared/supabase.ts';

const PADDLE_API_BASE = Deno.env.get('PADDLE_ENVIRONMENT') === 'production'
  ? 'https://api.paddle.com'
  : 'https://sandbox-api.paddle.com';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authed = await createAuthenticatedClient(req);
  if (!authed) return errorResponse('Unauthorized', 401);

  const apiKey = Deno.env.get('PADDLE_API_KEY');
  if (!apiKey) return errorResponse('Paddle API key not configured', 500);

  // Look up the user's Paddle customer id.
  const { data: sub, error } = await authed.supabase
    .from('subscriptions')
    .select('paddle_customer_id, paddle_subscription_id')
    .eq('user_id', authed.user.id)
    .maybeSingle();
  if (error) {
    log('Failed to load subscription', 'error', error);
    return errorResponse('Failed to load subscription', 500);
  }
  if (!sub?.paddle_customer_id) {
    return errorResponse('No paid subscription on file', 404);
  }

  // Mint a portal session.
  const res = await fetch(
    `${PADDLE_API_BASE}/customers/${sub.paddle_customer_id}/portal-sessions`,
    {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(
        sub.paddle_subscription_id
          ? { subscription_ids: [sub.paddle_subscription_id] }
          : {}
      ),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    log('Paddle portal-session request failed', 'error', { status: res.status, text });
    return errorResponse('Failed to create portal session', 500);
  }
  const body = await res.json();
  // Paddle returns { data: { urls: { general: { overview: '...' } } } }
  const overviewUrl = body?.data?.urls?.general?.overview;
  if (!overviewUrl) {
    log('Paddle portal-session response missing overview url', 'error', body);
    return errorResponse('Malformed Paddle response', 500);
  }
  return successResponse({ url: overviewUrl });
});
