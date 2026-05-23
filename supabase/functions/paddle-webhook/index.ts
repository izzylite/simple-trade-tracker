import {
  handleCors,
  log,
  createServiceClient,
  successResponse,
  errorResponse,
} from '../_shared/supabase.ts';
import { verifyPaddleSignature } from './_paddleSignature.ts';

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

  let event: { event_type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const eventType = event.event_type ?? 'unknown';
  log(`Paddle event received: ${eventType}`, 'info');

  // Event handling added in Tasks 4–6. Acknowledge unhandled events to stop Paddle retries.
  const _serviceClient = createServiceClient();
  return successResponse({ received: true, event_type: eventType }, 'OK');
});
