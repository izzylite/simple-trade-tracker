/**
 * Rehost ephemeral chart images (currently only QuickChart) into the
 * `ai-chat-images` Supabase Storage bucket so they outlive the source's
 * short-URL TTL.
 *
 * Called from the persist task (after streaming/response completes, inside
 * EdgeRuntime.waitUntil) — NOT from inside tool calls. This keeps tool
 * latency unchanged: the streamed UI still gets the original QuickChart
 * URL, while the persisted messageHtml is rewritten to point at Supabase.
 *
 * Failures are silent (return original URL) — a rehost miss is better than
 * a missing chart in the persisted message.
 */

import { createServiceClient, log } from '../_shared/supabase.ts';

const REHOST_HOSTS = new Set(['quickchart.io']);
const MAX_BYTES = 5 * 1024 * 1024; // matches bucket file_size_limit
const FETCH_TIMEOUT_MS = 8000;
const BUCKET = 'ai-chat-images';

type ServiceClient = ReturnType<typeof createServiceClient>;

interface RehostCtx {
  userId: string;
  conversationId: string;
  messageId: string;
}

/**
 * Match QuickChart URLs (both /chart/render/<short> and /chart?c=<config>).
 * Stops at whitespace, quotes, and angle brackets so we don't grab
 * surrounding HTML attribute syntax.
 *
 * IMPORTANT: parens are valid URL characters (RFC 3986 sub-delims) and the
 * long `/chart?c=<encoded>` form embeds JSON content that includes literal
 * `(` and `)` unencoded (e.g. axis labels like "Cumulative P&L ($)"). Do
 * NOT add `(` or `)` to this class — doing so truncates the URL mid-encoding
 * and QuickChart returns an error on fetch.
 */
const QUICKCHART_URL_RE = /https:\/\/quickchart\.io\/[^\s"'<>]+/g;

/**
 * Fetch one URL and upload to Supabase Storage. Returns the public URL on
 * success, or null if anything went wrong (timeout, non-2xx, oversize,
 * upload error).
 */
async function rehostOneUrl(
  serviceClient: ServiceClient,
  ctx: RehostCtx,
  sourceUrl: string,
): Promise<string | null> {
  let host: string;
  try {
    host = new URL(sourceUrl).host;
  } catch {
    return null;
  }
  if (!REHOST_HOSTS.has(host)) return null;

  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(sourceUrl, { signal: ctl.signal });
    if (!res.ok) {
      log('rehost source fetch non-2xx', 'warn', {
        sourceUrl,
        status: res.status,
      });
      return null;
    }

    const contentType = res.headers.get('content-type') ?? 'image/png';
    const ext = contentType.includes('webp')
      ? 'webp'
      : contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : 'png';

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
      log('rehost source size out of bounds', 'warn', {
        sourceUrl,
        bytes: buf.byteLength,
      });
      return null;
    }

    // Short content hash for cache-busting + idempotency on retries.
    const hashBuf = await crypto.subtle.digest('SHA-1', buf);
    const hex = [...new Uint8Array(hashBuf)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 12);

    const path =
      `${ctx.userId}/${ctx.conversationId}/${ctx.messageId}-${hex}.${ext}`;

    const { error: upErr } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType,
        upsert: true,
        cacheControl: '31536000', // 1y — content-hashed path
      });
    if (upErr) {
      log('rehost upload failed', 'warn', {
        sourceUrl,
        path,
        error: upErr.message,
      });
      return null;
    }

    const { data } = serviceClient.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    log('rehost fetch/upload exception', 'warn', {
      sourceUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Find every QuickChart URL in `text` and replace it with a rehosted
 * Supabase URL. Unchanged URLs (rehost failed, or not a recognized host)
 * stay as-is. Safe to call on null/empty input.
 */
export async function rehostChartUrlsInText(
  serviceClient: ServiceClient,
  ctx: RehostCtx,
  text: string | null | undefined,
): Promise<string> {
  if (!text) return text ?? '';

  // Dedupe — the same URL often appears in both content and messageHtml,
  // and we don't want N uploads of the same bytes.
  const found = [...new Set(text.match(QUICKCHART_URL_RE) ?? [])];
  if (found.length === 0) return text;

  const replacements = await Promise.all(
    found.map(async (url) => {
      const rehosted = await rehostOneUrl(serviceClient, ctx, url);
      return [url, rehosted] as const;
    }),
  );

  let out = text;
  for (const [from, to] of replacements) {
    if (to) {
      // String split/join — no regex escaping needed.
      out = out.split(from).join(to);
    }
  }
  return out;
}
