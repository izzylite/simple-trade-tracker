/**
 * Shared crypto primitives for edge functions.
 *
 * Replaces 4-5 ad-hoc reimplementations of the same byte-to-hex /
 * HMAC-SHA256 / constant-time-compare patterns scattered across the
 * functions tree. Single source of truth — every webhook signer, hash
 * helper, and signature verifier imports from here.
 *
 * Consumers: customTools/signing.ts, paddle-webhook/_paddleSignature.ts,
 * process-economic-events, ai-trading-agent/imageRehost.
 */

/**
 * Convert a Uint8Array or ArrayBuffer to its lowercase hex string.
 * The conversion every `crypto.subtle.digest(...)` and `.sign(...)`
 * caller needs to turn the raw output into a header value or DB column.
 */
export function bytesToHex(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute HMAC-SHA256(secret, body) and return the lowercase hex digest.
 * Standard webhook-signing primitive — used by custom-tool dispatch,
 * Paddle verification, and any future signed-webhook integration.
 */
export async function hmacSha256Hex(
  secret: string,
  body: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return bytesToHex(sig);
}

/**
 * Constant-time string compare. Use whenever comparing a secret value
 * (HMAC digest, token) against an expected value — `===` is timing-leaky.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
