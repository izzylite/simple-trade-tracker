/**
 * Paddle Billing webhook signature format: "ts=<unix-seconds>;h1=<hmac-sha256-hex>".
 * HMAC is computed over `${ts}:${rawBody}` with the webhook signing secret.
 *
 * Spec: https://developer.paddle.com/webhooks/signature-verification
 */
export interface PaddleSignatureCheck {
  ok: boolean;
  reason?: string;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function hexFromBytes(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = hexFromBytes(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`${ts}:${rawBody}`))
  );

  return constantTimeEquals(expected, h1)
    ? { ok: true }
    : { ok: false, reason: 'hmac mismatch' };
}
