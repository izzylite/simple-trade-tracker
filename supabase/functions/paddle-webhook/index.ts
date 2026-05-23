import {
  handleCors,
  log,
  createServiceClient,
  successResponse,
  errorResponse,
} from '../_shared/supabase.ts';
import { verifyPaddleSignature } from './_paddleSignature.ts';
import { resolveTierFromPriceId } from './_priceTierMap.ts';

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Returns true if the incoming event is older than the most recent event we've
 * processed for this subscription/user. Callers should skip stale events.
 */
async function isStaleEvent(
  client: ServiceClient,
  match: { userId?: string; paddleSubId?: string },
  incomingOccurredAt: string | null
): Promise<boolean> {
  if (!incomingOccurredAt) return false; // can't compare; let it through
  let query = client.from('subscriptions').select('last_event_occurred_at');
  if (match.userId) query = query.eq('user_id', match.userId);
  else if (match.paddleSubId) query = query.eq('paddle_subscription_id', match.paddleSubId);
  else return false;
  const { data } = await query.maybeSingle();
  const existing = (data as { last_event_occurred_at?: string } | null)?.last_event_occurred_at;
  if (!existing) return false;
  return new Date(incomingOccurredAt).getTime() < new Date(existing).getTime();
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  if (!secret) {
    log('PADDLE_WEBHOOK_SECRET not configured', 'error');
    return errorResponse('Webhook not configured', 500);
  }

  const rawBody = await req.text();
  const sig = req.headers.get('paddle-signature');
  const verify = await verifyPaddleSignature(rawBody, sig, secret);
  if (!verify.ok) {
    log('Paddle signature verification failed', 'warn', { reason: verify.reason });
    return errorResponse('Invalid signature', 401);
  }

  let event: { event_type?: string; data?: Record<string, unknown>; occurred_at?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const eventType = event.event_type ?? 'unknown';
  // Paddle Billing puts occurred_at on the event envelope, not on event.data.
  const eventOccurredAt: string | null = (event as any).occurred_at ?? null;
  log(`Paddle event received: ${eventType}`, 'info');

  const serviceClient = createServiceClient();

  if (eventType === 'subscription.created' || eventType === 'subscription.updated') {
    const result = await handleSubscriptionUpsert(serviceClient, event.data, eventOccurredAt);
    if (!result.ok) return errorResponse(result.reason ?? 'handler failed', 500);
    return successResponse({ event_type: eventType, applied: true });
  }

  if (eventType === 'subscription.canceled') {
    const result = await handleSubscriptionCancelled(serviceClient, event.data, eventOccurredAt);
    if (!result.ok) return errorResponse(result.reason ?? 'handler failed', 500);
    return successResponse({ event_type: eventType, applied: true });
  }

  if (eventType === 'transaction.payment_failed') {
    const result = await handlePaymentFailed(serviceClient, event.data, eventOccurredAt);
    if (!result.ok) return errorResponse(result.reason ?? 'handler failed', 500);
    return successResponse({ event_type: eventType, applied: true });
  }

  return successResponse({ event_type: eventType, applied: false }, 'Event ignored');
});

async function handleSubscriptionUpsert(
  client: ServiceClient,
  data: any,
  eventOccurredAt: string | null
): Promise<{ ok: boolean; reason?: string }> {
  const paddleSubId = data?.id;
  const paddleCustomerId = data?.customer_id;
  const customData = data?.custom_data ?? {};
  const userId = customData.user_id;
  const status = data?.status; // 'active' | 'trialing' | 'paused' | 'past_due' | 'canceled'
  const items = Array.isArray(data?.items) ? data.items : [];
  const priceId = items[0]?.price?.id ?? items[0]?.price_id;
  const currentPeriodStart = data?.current_billing_period?.starts_at ?? null;
  const currentPeriodEnd = data?.current_billing_period?.ends_at ?? null;
  const scheduledChange = data?.scheduled_change;

  if (!userId) {
    log('subscription event missing custom_data.user_id', 'error', { paddleSubId });
    return { ok: false, reason: 'missing user_id in custom_data' };
  }
  if (!priceId) {
    log('subscription event missing price id', 'error', { paddleSubId });
    return { ok: false, reason: 'missing price id' };
  }

  const resolved = resolveTierFromPriceId(priceId);
  if (!resolved) {
    log('Unknown Paddle price id', 'error', { priceId });
    return { ok: false, reason: 'unknown price id' };
  }

  // Skip stale events: if a newer event has already been applied, ignore this
  // delivery. We still return ok to stop Paddle's retry loop.
  if (await isStaleEvent(client, { userId }, eventOccurredAt)) {
    log('Skipping stale subscription upsert', 'info', {
      userId,
      paddleSubId,
      incomingOccurredAt: eventOccurredAt,
    });
    return { ok: true };
  }

  // Paddle uses 'canceled' (one l); we normalise to 'cancelled' (two l).
  const normalisedStatus =
    status === 'canceled' ? 'cancelled' : (status ?? 'active');

  const { error } = await client
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        tier: resolved.tier,
        status: normalisedStatus,
        billing_cycle: resolved.cycle,
        paddle_subscription_id: paddleSubId,
        paddle_customer_id: paddleCustomerId,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end:
          scheduledChange?.action === 'cancel' ? true : false,
        last_event_occurred_at: eventOccurredAt,
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    log('Failed to upsert subscription', 'error', error);
    return { ok: false, reason: error.message };
  }

  log('Subscription upserted', 'info', {
    userId,
    tier: resolved.tier,
    status: normalisedStatus,
  });
  return { ok: true };
}

async function handleSubscriptionCancelled(
  client: ServiceClient,
  data: any,
  eventOccurredAt: string | null
): Promise<{ ok: boolean; reason?: string }> {
  const paddleSubId = data?.id;
  if (!paddleSubId) {
    return { ok: false, reason: 'missing subscription id' };
  }

  // Skip stale events: a delayed `subscription.updated` from before this
  // cancellation must not overwrite the cancelled state.
  if (await isStaleEvent(client, { paddleSubId }, eventOccurredAt)) {
    log('Skipping stale subscription cancellation', 'info', {
      paddleSubId,
      incomingOccurredAt: eventOccurredAt,
    });
    return { ok: true };
  }

  // Update by paddle_subscription_id — independent of custom_data.user_id which
  // may not be present in cancellation payloads.
  const { error } = await client
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      last_event_occurred_at: eventOccurredAt,
    })
    .eq('paddle_subscription_id', paddleSubId);

  if (error) {
    log('Failed to mark subscription cancelled', 'error', error);
    return { ok: false, reason: error.message };
  }
  log('Subscription cancelled', 'info', { paddleSubId });
  return { ok: true };
}

async function handlePaymentFailed(
  client: ServiceClient,
  data: any,
  eventOccurredAt: string | null
): Promise<{ ok: boolean; reason?: string }> {
  // Paddle transaction events carry subscription_id on the transaction payload.
  const paddleSubId = data?.subscription_id;
  if (!paddleSubId) {
    // Some payment_failed events are for one-shot transactions; ignore them.
    return { ok: true };
  }

  // Skip stale events.
  if (await isStaleEvent(client, { paddleSubId }, eventOccurredAt)) {
    log('Skipping stale payment_failed event', 'info', {
      paddleSubId,
      incomingOccurredAt: eventOccurredAt,
    });
    return { ok: true };
  }

  const { error } = await client
    .from('subscriptions')
    .update({
      status: 'past_due',
      last_event_occurred_at: eventOccurredAt,
    })
    .eq('paddle_subscription_id', paddleSubId);
  if (error) {
    log('Failed to mark subscription past_due', 'error', error);
    return { ok: false, reason: error.message };
  }
  log('Subscription marked past_due', 'info', { paddleSubId });
  return { ok: true };
}
