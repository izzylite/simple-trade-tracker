/**
 * Server-Sent Events (SSE) helpers — stream creation, event framing,
 * slash-command framing, and the multimodal function-response builder.
 *
 * Enables real-time streaming of AI responses, tool calls, and results.
 */

import { log } from '../_shared/supabase.ts';
import { isAllowedImageUrl } from './tools/analyze-image.ts';
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

/**
 * SSE Event Types
 */
export type SSEEventType =
  | 'text_chunk'      // Streaming text as it's generated
  | 'text_reset'      // Reset accumulated text (narration streamed before tool call detected)
  | 'thought_chunk'   // Intermediate AI narration during tool use
  | 'reasoning_chunk' // Gemini thought summary (chain-of-thought) — from thinkingConfig.includeThoughts
  | 'tool_call'       // Tool is being called
  | 'tool_result'     // Tool execution completed
  | 'citation'        // Citation discovered
  | 'embedded_data'   // Embedded trades/events fetched
  | 'done'            // Stream complete
  | 'error';          // Error occurred

/**
 * Create SSE event string
 */
export function createSSEEvent(event: SSEEventType, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Frame a bare slash-command turn with an explicit execute directive.
 *
 * Client-side expansion emits a `[Referenced command "Title":\n<body>\n]`
 * block (title is optional; old clients may omit it). When the user's entire
 * message body is nothing but that block (bare command invocation), wrap it
 * so Gemini treats the block content as the primary directive:
 *
 *   The user wants you to execute this command:
 *
 *   [Referenced command "Weekly Outlook":
 *   <body>
 *   ]
 *
 * Mixed messages (typed text + block) are returned unchanged — the system
 * prompt's slash-command section covers how to interpret them.
 */
export function frameBareSlashCommand(message: string): string {
  // Strict: the entire trimmed body must be one or more [Referenced command:]
  // blocks separated by `\n\n`, nothing before or after. The client emits
  // this shape only when the user invoked one or more slash commands with
  // no other typed text. Mixed messages — any user text, or any
  // [Referenced note:] block — fall through unchanged.
  //
  // The inner content uses a tempered greedy token `(?:(?!\n\n\[Referenced ).)*?`
  // (with the s-flag so `.` matches newlines) to prevent the lazy match
  // from extending past a block boundary. Without this, a message like
  // `[Referenced command:\nA\n]\n\n[Referenced note:\nB\n]` would match
  // as a single bare command whose body includes the trailing note block.
  //
  // Format constants live in src/utils/chatMentions.ts (BLOCK_OPEN_PREFIX
  // etc). If you change them there, update this regex too.
  const trimmed = message.trim();
  const bareRe =
    /^(\[Referenced command(?:\s+"[^"]*")?:\n(?:(?!\n\n\[Referenced ).)*?\n\](?:\n\n\[Referenced command(?:\s+"[^"]*")?:\n(?:(?!\n\n\[Referenced ).)*?\n\])*)$/s;
  const m = bareRe.exec(trimmed);
  if (!m) return message;
  const isMulti = /\n\n\[Referenced command/.test(m[1]);
  const directive = isMulti
    ? 'The user wants you to execute these commands in order:'
    : 'The user wants you to execute this command:';
  return `${directive}\n\n${m[1]}`;
}

/**
 * Create readable stream for SSE
 */
export function createSSEStream(): { stream: ReadableStream; writer: WritableStreamDefaultWriter } {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;

  // Native ReadableStream with controller gives us direct enqueue semantics —
  // TransformStream's internal queue was being held by the Supabase/Cloudflare
  // proxy until the whole response finished. Enqueuing on the underlying source
  // forces each chunk to flush.
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
    },
  });

  const wrappedWriter = {
    write: async (chunk: string) => {
      if (closed) return;
      try {
        controller.enqueue(encoder.encode(chunk));
      } catch (_err) {
        closed = true;
      }
    },
    close: async () => {
      if (closed) return;
      closed = true;
      try {
        controller.close();
      } catch (_err) {
        // already closed
      }
    },
  };

  return { stream, writer: wrappedWriter as any };
}

/**
 * Send SSE event to stream
 */
export async function sendSSE(writer: WritableStreamDefaultWriter, event: SSEEventType, data: any) {
  try {
    await writer.write(createSSEEvent(event, data));
  } catch (error) {
    log(`Error sending SSE event: ${error}`, 'error');
  }
}

/**
 * Build multimodal function response parts
 * Detects [IMAGE_ANALYSIS:url] markers and injects images as inline_data
 */
export async function buildFunctionResponseParts(
  toolName: string,
  result: string,
  callId?: string
): Promise<Array<Record<string, unknown>>> {
  const parts: Array<Record<string, unknown>> = [];
  // Build a functionResponse object with the optional id echoed back so
  // Gemini 3 can map this response to the original call (essential for
  // parallel calls; harmless when id is undefined on older models).
  const buildFnResponse = (response: Record<string, unknown>): Record<string, unknown> => {
    const fr: Record<string, unknown> = { name: toolName, response };
    if (callId) fr.id = callId;
    return { functionResponse: fr };
  };

  // Check for image analysis marker
  const imageMarkerMatch = result.match(/\[IMAGE_ANALYSIS:(https?:\/\/[^\]]+)\]/);

  if (imageMarkerMatch) {
    const imageUrl = imageMarkerMatch[1];
    log(`Injecting image into conversation: ${imageUrl.substring(0, 50)}...`, 'info');

    // Strip the marker (and the "IMAGE LOADED SUCCESSFULLY" header line that follows)
    // so the fallback text is always honest — the model must never see that claim
    // if the image was not actually fetched.
    const textWithoutMarker = result.replace(/\[IMAGE_ANALYSIS:[^\]]+\]\n?/, '').trim();

    // Safety: re-validate using the same isAllowedImageUrl function as the tool
    // executor. Belt-and-suspenders: any code path that synthesises a marker
    // without going through executeAnalyzeImage is still blocked here.
    if (!isAllowedImageUrl(imageUrl)) {
      log(`buildFunctionResponseParts: blocked image URL not on allowlist`, 'warn');
      parts.push(buildFnResponse({ result: 'Image could not be loaded (unsupported URL). Please describe the trade based on available context.' }));
      return parts;
    }

    const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — cap before base64 expansion
    try {
      // redirect:'manual' prevents fetch from silently following a redirect to a
      // private/internal URL that would bypass the hostname allowlist above.
      // A 3xx response is not ok (status outside 200-299) and falls to the
      // error-message path — we never follow redirects for image fetches.
      // AbortSignal.timeout: 15s so a slow image cannot eat the wall-clock budget.
      const imageResponse = await fetch(imageUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });
      if (imageResponse.ok) {
        // Fast-fail on Content-Length before we stream the body
        const clHeader = Number(imageResponse.headers.get('content-length') || 0);
        if (clHeader > MAX_IMAGE_BYTES) {
          log(`Image too large (Content-Length: ${clHeader} bytes) — skipping`, 'warn');
          parts.push(buildFnResponse({ result: 'Image could not be loaded (file too large). Please describe the trade based on available context.' }));
          return parts;
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
          log(`Image too large (actual: ${imageBuffer.byteLength} bytes) — skipping`, 'warn');
          parts.push(buildFnResponse({ result: 'Image could not be loaded (file too large). Please describe the trade based on available context.' }));
          return parts;
        }

        const base64Image = encodeBase64(new Uint8Array(imageBuffer));
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        const mimeType = contentType.split(';')[0].trim();

        parts.push({ inline_data: { mime_type: mimeType, data: base64Image } });
        parts.push(buildFnResponse({ result: textWithoutMarker }));
        log('Image injected successfully into conversation', 'info');
        return parts;
      } else {
        log(`Failed to fetch image: ${imageResponse.status}`, 'error');
      }
    } catch (error) {
      log(`Error fetching image for injection: ${error}`, 'error');
    }

    // Fetch failed — return the cleaned text (marker stripped) so the model
    // does NOT see "IMAGE LOADED SUCCESSFULLY" and hallucinate an analysis.
    parts.push(buildFnResponse({ result: `Image could not be loaded. ${textWithoutMarker}` }));
    return parts;
  }

  // Default: just return text function response
  parts.push(buildFnResponse({ result }));

  return parts;
}
