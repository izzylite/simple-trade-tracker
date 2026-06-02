/**
 * Request-level helpers: tool-result redaction, trade/image pre-fetching,
 * and user-data isolation validation.
 */

import { log, createServiceClient } from '../_shared/supabase.ts';
import { isWebhookTool } from '../_shared/customTools/runtime.ts';
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

/**
 * Sanitize a tool result for CLIENT consumption. Two concerns:
 *  - Webhook-tool bodies are attacker-controlled (fenced) → null entirely.
 *  - Built-in/MCP tool ERRORS are raw strings ("Error: ...", "MCP tool call
 *    failed: ...", "Tool execution error: ...") that can carry SQL/table names,
 *    MCP RPC detail, or stack text → replace with a generic label.
 * Gemini still receives the FULL result via buildFunctionResponseParts (a
 * separate path), so its ability to reason about / recover from the error is
 * unaffected — only the browser-bound copy is redacted.
 */
export function redactToolErrorForClient(name: string, result: string | null): string | null {
  if (isWebhookTool(name)) return null;
  if (typeof result !== 'string') return result;
  const lower = result.toLowerCase();
  if (
    result.startsWith('Error:') ||
    lower.startsWith('tool execution error') ||
    lower.startsWith('mcp tool call failed') ||
    lower.startsWith('mcp error')
  ) {
    return 'This tool call failed.';
  }
  return result;
}

/**
 * Scrub tool results before they ship to the FE in SSE/JSON `done` metadata:
 * null webhook bodies and genericize raw error strings (see
 * redactToolErrorForClient). FE today only reads name/label, but leaving raw
 * bodies/errors in transit is one debug-dump or eager render away from a leak.
 */
export function scrubWebhookResults(
  calls: Array<{ name: string; args: unknown; result: string }>,
): Array<{ name: string; args: unknown; result: string | null }> {
  return calls.map((c) => ({ ...c, result: redactToolErrorForClient(c.name, c.result) }));
}

/**
 * Pre-fetch focused trade data so the AI has instrument/session/date
 * context from turn 0 (prevents irrelevant tool calls).
 */
export async function fetchFocusedTrade(
  tradeId: string,
  userId: string
): Promise<Record<string, unknown> | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('trades')
      .select(
        'id, name, amount, trade_type, trade_date, session, ' +
        'entry_price, exit_price, stop_loss, take_profit, ' +
        'risk_to_reward, tags, notes, economic_events, images'
      )
      .eq('id', tradeId)
      .eq('user_id', userId)
      .single();

    if (error) {
      log(`[FocusedTrade] Query error: ${error.message}`, 'warn');
      return null;
    }

    if (data) {
      log(`[FocusedTrade] Loaded trade: ${data.name || data.id}`, 'info');
      return data;
    }

    log('[FocusedTrade] Trade not found', 'warn');
    return null;
  } catch (error) {
    log(`[FocusedTrade] Error fetching: ${error}`, 'error');
    return null;
  }
}

/**
 * Fetch trade images and convert to base64 data URLs so they are
 * injected directly into the Gemini context (no tool call needed).
 * Limited to first 4 images to keep token budget reasonable.
 */
export async function fetchTradeImages(
  trade: Record<string, unknown>
): Promise<Array<{ url: string; mimeType: string }>> {
  const images = trade.images as Array<Record<string, unknown>> | undefined;
  if (!images?.length) return [];

  const MAX_TRADE_IMAGES = 4;
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
  const toFetch = images.slice(0, MAX_TRADE_IMAGES);
  const results: Array<{ url: string; mimeType: string }> = [];

  await Promise.all(
    toFetch.map(async (img) => {
      const imageUrl = img.url as string | undefined;
      if (!imageUrl) return;

      try {
        // 15s timeout — 4 concurrent fetches before turn 0 must not eat the
        // wall-clock budget. redirect:'manual' prevents a redirect to an internal
        // URL from bypassing the storage domain expectation; a 3xx is non-ok and
        // silently skipped.
        const response = await fetch(imageUrl, {
          redirect: 'manual',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          log(`[TradeImages] Failed to fetch ${imageUrl.substring(0, 50)}: ${response.status}`, 'warn');
          return;
        }

        const clHeader = Number(response.headers.get('content-length') || 0);
        if (clHeader > MAX_IMAGE_BYTES) {
          log(`[TradeImages] Skipping oversized image (Content-Length: ${clHeader})`, 'warn');
          return;
        }

        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
          log(`[TradeImages] Skipping oversized image (actual: ${buffer.byteLength} bytes)`, 'warn');
          return;
        }

        const base64 = encodeBase64(new Uint8Array(buffer));
        const contentType = response.headers.get('content-type') || 'image/png';
        const mimeType = contentType.split(';')[0].trim();

        results.push({
          url: `data:${mimeType};base64,${base64}`,
          mimeType
        });
        log(`[TradeImages] Loaded image: ${mimeType}, ${base64.length} chars`, 'info');
      } catch (error) {
        log(`[TradeImages] Error fetching image: ${error}`, 'warn');
      }
    })
  );

  return results;
}

/**
 * Validate user data isolation
 */
export function validateUserDataIsolation(
  response: unknown,
  expectedUserId: string
): { valid: boolean; reason?: string } {
  const content = JSON.stringify(response).toLowerCase();
  const userIdPattern = /user[_-]?id['\"]?\s*[:=]\s*['\"]?([a-zA-Z0-9-]+)/gi;
  const matches = content.matchAll(userIdPattern);
  const expectedUserIdLower = expectedUserId.toLowerCase();

  for (const match of matches) {
    const foundUserId = match[1];
    if (foundUserId && foundUserId !== expectedUserIdLower) {
      return {
        valid: false,
        reason: `Response contains data for user ${foundUserId} but request was for ${expectedUserId}`,
      };
    }
  }
  return { valid: true };
}
