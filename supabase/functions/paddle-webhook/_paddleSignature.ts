/**
 * Paddle Billing webhook signature format: "ts=<unix-seconds>;h1=<hmac-sha256-hex>".
 * HMAC is computed over `${ts}:${rawBody}` with the webhook signing secret.
 *
 * Spec: https://developer.paddle.com/webhooks/signature-verification
 */
import { constantTimeEquals, hmacSha256Hex } from '../_shared/crypto.ts';

export interface PaddleSignatureCheck {
  ok: boolean;
  reason?: string;
}

export async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  maxAgeSeconds = 300
): Promise<PaddleSignatureCheck> {
  if (!signatureHeader) return { ok: false, reason: 'missing signature header' };
  if (!secret) return { ok: false, reason: 'webhook secret not configured' };

  const parts = Object.fromEntries(
    signatureHeader.split(';').map((kv) => {
      const [k, v] = kv.split('=');
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return { ok: false, reason: 'malformed signature header' };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: 'non-numeric ts' };
  const ageSeconds = Math.abs(Date.now() / 1000 - tsNum);
  if (ageSeconds > maxAgeSeconds) {
    return { ok: false, reason: `signature too old (${Math.round(ageSeconds)}s)` };
  }

  const expected = await hmacSha256Hex(secret, `${ts}:${rawBody}`);

  return constantTimeEquals(expected, h1)
    ? { ok: true }
    : { ok: false, reason: 'hmac mismatch' };
}
