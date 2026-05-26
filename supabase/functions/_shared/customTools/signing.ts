// HMAC-SHA256 signing for outbound custom-tool webhook calls.
//
// Thin wrappers over the shared crypto primitives in `_shared/crypto.ts`.
// Userside verification: plain HMAC-SHA256(secret_hex_string, raw_body)
// → lowercase hex, compared to the `X-Orion-Signature` header. The secret
// string is signed AS-IS (not hex-decoded) — see the webhook-implementer
// docs in CustomToolFormDialog.

import { bytesToHex, hmacSha256Hex } from "../crypto.ts";

export async function signWebhookBody(
  secret: string,
  body: string,
): Promise<string> {
  return hmacSha256Hex(secret, body);
}

/**
 * 32 random bytes → 64 hex chars. Same shape as the existing reminders-
 * dispatcher secret (migration 20260507000005). Generated server-side so
 * we never trust user-provided entropy.
 */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
