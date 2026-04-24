/**
 * AI Trading Agent - Pure HTTP Implementation
 * Direct HTTP calls to both Gemini API and Supabase MCP (no SDKs)
 */

import { corsHeaders, handleCors, log, createServiceClient } from '../_shared/supabase.ts';
import { callGemini as sharedCallGemini } from '../_shared/gemini.ts';
import {
  callMCPTool,
  getCachedMCPTools,
} from '../_shared/orionMcp.ts';
import { fetchAgentMemory } from '../_shared/orionMemory.ts';
import { formatErrorResponse, formatResponseWithHtmlAndCitations } from './formatters.ts';
import type { AgentRequest, ToolCall } from './types.ts';
import {
  type GeminiFunctionDeclaration,
  getAllCustomTools,
  executeCustomTool,
  CUSTOM_TOOL_NAMES
} from './tools.ts';
import { fetchEmbeddedData, type EmbeddedData } from './embedDataFetcher.ts';
import { validateReferenceIds, hasReferenceTags, type ValidationResult } from './idValidator.ts';
import { buildSecureSystemPrompt } from "./systemPrompt.ts";
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

/**
 * ============================================================================
 * MODEL CONFIG
 * ============================================================================
 * Model ID is read from the GEMINI_MODEL env var so we can flip per-environment
 * (e.g. canary a new model in staging while prod stays on the stable one).
 * The default stays conservative — bump it once the target has been validated.
 */
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
// Gemini 3 thinking level: "minimal" | "low" | "medium" | "high".
// Default "medium" — enough reasoning for multi-step analysis without burning
// the token budget on shallow tool-routing queries. Flip via env to A/B.
const THINKING_LEVEL = Deno.env.get('GEMINI_THINKING_LEVEL') ?? 'medium';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function buildGeminiUrl(apiKey: string, streaming: boolean): string {
  return streaming
    ? `${GEMINI_API_BASE}/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`
    : `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`;
}

/**
 * Parsed function call from Gemini response. `thoughtSignature` is required
 * by Gemini 3.x — the API emits it as a sibling field of `functionCall` on the
 * Part, and the next turn's model part must echo it back verbatim or the API
 * returns 400 ("Function call is missing a thought_signature in functionCall
 * parts"). See https://ai.google.dev/gemini-api/docs/thought-signatures
 */
type ParsedFunctionCall = {
  name: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
};

/**
 * Extract a ParsedFunctionCall from a response Part. `thoughtSignature`
 * may live on the Part itself, nested in the functionCall object, or on a
 * preceding standalone Part — all three are captured elsewhere via rawParts
 * preservation. Here we just pull name/args for tool execution.
 */
function extractFunctionCall(part: Record<string, unknown>): ParsedFunctionCall | undefined {
  const fc = part.functionCall as { name?: string; args?: Record<string, unknown>; thoughtSignature?: string } | undefined;
  if (!fc?.name) return undefined;
  const thoughtSignature = (part as { thoughtSignature?: string }).thoughtSignature ?? fc.thoughtSignature;
  return { name: fc.name, args: fc.args || {}, thoughtSignature };
}

/**
 * Fallback Part builder used only when a caller has no rawParts available
 * (e.g. a synthesised turn). Prefer echoing `result.rawParts` verbatim
 * whenever possible — Gemini 3.x emits thoughtSignature as its own Part
 * preceding the functionCall, and reconstructing loses that context.
 */
function buildFunctionCallPart(call: ParsedFunctionCall): Record<string, unknown> {
  return {
    functionCall: { name: call.name, args: call.args },
    ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {})
  };
}

/**
 * Shared Gemini call for sites that already have `contents` in Gemini parts
 * format (continuation + correction passes inside the function-calling loop).
 * Streams text to the writer as it arrives when `streaming: true`.
 * Throws on non-2xx — callers that want soft-failure should wrap in try/catch.
 *
 * The initial request uses callGemini / callGeminiStreaming below, which build
 * `contents` from systemPrompt + message + history. Once we're past turn 1
 * we already have `contents`, so those helpers don't fit.
 */
async function callGeminiWithContents(
  apiKey: string,
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>,
  tools: GeminiFunctionDeclaration[],
  opts: {
    streaming: boolean;
    writer?: WritableStreamDefaultWriter;
    maxOutputTokens?: number;
    mode?: 'AUTO' | 'ANY' | 'NONE';
  }
): Promise<{ text: string; functionCall?: ParsedFunctionCall; rawParts: Array<Record<string, unknown>> }> {
  // Non-streaming: delegate to the shared `_shared/gemini.ts` helper.
  // The shared version handles body construction, error handling, and
  // part extraction; we just map the return shape (shared returns
  // `functionCalls: []`, chat consumer expects `functionCall` singular).
  if (!opts.streaming) {
    const result = await sharedCallGemini({
      contents: contents as Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }>,
      tools: tools.length > 0 ? tools : undefined,
      toolMode: opts.mode,
      maxOutputTokens: opts.maxOutputTokens ?? 4000,
      thinkingLevel: THINKING_LEVEL as 'minimal' | 'low' | 'medium' | 'high',
    });
    return {
      text: result.text,
      functionCall: result.functionCalls[0],
      rawParts: result.rawParts,
    };
  }

  // Streaming path stays local — SSE writer lifecycle is chat-specific
  // (reasoning/text/tool_call event emission) and would leak into a shared
  // helper. Body shape mirrors `_shared/gemini.ts` so behavior stays in sync.
  const body = {
    contents,
    tools: tools.length > 0 ? [{ function_declarations: tools }] : undefined,
    tool_config: tools.length > 0 ? {
      function_calling_config: { mode: opts.mode ?? 'AUTO' }
    } : undefined,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 4000,
      thinkingConfig: { includeThoughts: true, thinkingLevel: THINKING_LEVEL }
    }
  };

  const response = await fetch(buildGeminiUrl(apiKey, true), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  let text = '';
  let functionCall: ParsedFunctionCall | undefined;
  const rawParts: Array<Record<string, unknown>> = [];

  if (!response.body) return { text, functionCall, rawParts };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim() || line.startsWith('data: [DONE]')) continue;
        const jsonLine = line.startsWith('data: ') ? line.slice(6) : line;
        if (!jsonLine.trim()) continue;
        try {
          const chunk = JSON.parse(jsonLine);
          const parts = chunk.candidates?.[0]?.content?.parts || [];
          // Preserve ALL raw parts across chunks — thoughtSignature may arrive
          // as its own standalone Part preceding the functionCall Part, and
          // reconstructing would drop it.
          rawParts.push(...parts);
          for (const part of parts) {
            if (!part.text) continue;
            if (part.thought) {
              if (opts.writer) await sendSSE(opts.writer, 'reasoning_chunk', { text: part.text });
              continue;
            }
            text += part.text;
            if (opts.writer) await sendSSE(opts.writer, 'text_chunk', { text: part.text });
          }
          const fcPart = parts.find((p: { functionCall?: unknown }) => p.functionCall);
          if (fcPart) {
            const extracted = extractFunctionCall(fcPart);
            if (extracted) functionCall = extracted;
          }
        } catch (parseError) {
          log(`Failed to parse streaming chunk: ${parseError}`, 'warn');
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { text, functionCall, rawParts };
}

/**
 * ============================================================================
 * SERVER-SENT EVENTS (SSE) STREAMING HELPERS
 * ============================================================================
 * Enables real-time streaming of AI responses, tool calls, and results
 */

/**
 * SSE Event Types
 */
type SSEEventType =
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
function createSSEEvent(event: SSEEventType, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create readable stream for SSE
 */
function createSSEStream(): { stream: ReadableStream; writer: WritableStreamDefaultWriter } {
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
async function sendSSE(writer: WritableStreamDefaultWriter, event: SSEEventType, data: any) {
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
async function buildFunctionResponseParts(
  toolName: string,
  result: string
): Promise<Array<Record<string, unknown>>> {
  const parts: Array<Record<string, unknown>> = [];

  // Check for image analysis marker
  const imageMarkerMatch = result.match(/\[IMAGE_ANALYSIS:(https?:\/\/[^\]]+)\]/);

  if (imageMarkerMatch) {
    const imageUrl = imageMarkerMatch[1];
    log(`Injecting image into conversation: ${imageUrl.substring(0, 50)}...`, 'info');

    try {
      // Fetch and convert image to base64
      const imageResponse = await fetch(imageUrl);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        // Use Deno's encodeBase64 which handles large buffers without stack overflow
        const base64Image = encodeBase64(new Uint8Array(imageBuffer));
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        const mimeType = contentType.split(';')[0].trim();

        // Add image as inline_data part first (so model sees image before instructions)
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Image
          }
        });

        // Add text instructions (without the marker)
        const textWithoutMarker = result.replace(/\[IMAGE_ANALYSIS:[^\]]+\]\n?/, '').trim();
        parts.push({
          functionResponse: {
            name: toolName,
            response: { result: textWithoutMarker }
          }
        });

        log('Image injected successfully into conversation', 'info');
        return parts;
      } else {
        log(`Failed to fetch image: ${imageResponse.status}`, 'error');
      }
    } catch (error) {
      log(`Error fetching image for injection: ${error}`, 'error');
    }
  }

  // Default: just return text function response
  parts.push({
    functionResponse: {
      name: toolName,
      response: { result }
    }
  });

  return parts;
}

/**
 * Pre-fetch focused trade data so the AI has instrument/session/date
 * context from turn 0 (prevents irrelevant tool calls).
 */
async function fetchFocusedTrade(
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
async function fetchTradeImages(
  trade: Record<string, unknown>
): Promise<Array<{ url: string; mimeType: string }>> {
  const images = trade.images as Array<Record<string, unknown>> | undefined;
  if (!images?.length) return [];

  const MAX_TRADE_IMAGES = 4;
  const toFetch = images.slice(0, MAX_TRADE_IMAGES);
  const results: Array<{ url: string; mimeType: string }> = [];

  await Promise.all(
    toFetch.map(async (img) => {
      const imageUrl = img.url as string | undefined;
      if (!imageUrl) return;

      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          log(`[TradeImages] Failed to fetch ${imageUrl.substring(0, 50)}: ${response.status}`, 'warn');
          return;
        }

        const buffer = await response.arrayBuffer();
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

// MCP helpers (initializeMCPSession, listMCPTools, callMCPTool, getCachedMCPTools,
// and the schema sanitizer) live in `_shared/orionMcp.ts` so both the chat
// agent and the run-orion-task batch handlers talk to the same MCP gateway
// with the same session + tool caches.

/**
 * Call Gemini API directly
 */
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  tools: GeminiFunctionDeclaration[]
): Promise<{ text?: string; functionCall?: ParsedFunctionCall; rawParts: Array<Record<string, unknown>> }> {
  const apiUrl = buildGeminiUrl(apiKey, false);

  // Build contents array
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I will help while maintaining strict security.' }] },
    ...conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const requestBody = {
    contents,
    tools: tools.length > 0 ? [{ function_declarations: tools }] : undefined,
    // Force function calling on initial request to prevent "I will search..." without action
    tool_config: tools.length > 0 ? {
      function_calling_config: {
        mode: "ANY"  // Forces model to call at least one function
      }
    } : undefined,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4000,
      thinkingConfig: { includeThoughts: true, thinkingLevel: THINKING_LEVEL }
    }
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const content = candidate?.content;
  const parts: Array<Record<string, unknown>> = content?.parts || [];

  // Check for function call
  const functionCallPart = parts.find((p: { functionCall?: unknown }) => p.functionCall);
  if (functionCallPart) {
    const extracted = extractFunctionCall(functionCallPart);
    if (extracted) return { functionCall: extracted, rawParts: parts };
  }

  // Get text response (exclude thought-summary parts so chain-of-thought doesn't leak into answer)
  const text = parts
    .filter((p: { text?: string; thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text || '')
    .join('');
  return { text, rawParts: parts };
}

/**
 * Call Gemini API with streaming support
 * Streams text chunks as they're generated in real-time
 */
async function callGeminiStreaming(
  apiKey: string,
  systemPrompt: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  tools: GeminiFunctionDeclaration[],
  writer: WritableStreamDefaultWriter,
  userImages?: Array<{ url: string; mimeType: string }>
): Promise<{ text?: string; functionCall?: ParsedFunctionCall; functionCalls?: ParsedFunctionCall[]; emptyBug?: boolean; rawParts?: Array<Record<string, unknown>> }> {
  const apiUrl = buildGeminiUrl(apiKey, true);

  // Build user message parts (text + optional images)
  const userMessageParts: Array<Record<string, unknown>> = [];

  // Add images first (if any) so model sees them before text
  if (userImages && userImages.length > 0) {
    log(`Injecting ${userImages.length} user images into request`, 'info');
    for (const img of userImages) {
      // Parse data URL to extract base64 data
      const dataUrlMatch = img.url.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUrlMatch) {
        const mimeType = dataUrlMatch[1];
        const base64Data = dataUrlMatch[2];
        userMessageParts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        });
        log(`Added image: ${mimeType}, ${base64Data.length} chars`, 'info');
      } else {
        log(`Skipping non-base64 image URL: ${img.url.substring(0, 50)}...`, 'warn');
      }
    }
  }

  // Add text message
  userMessageParts.push({ text: message });

  // Build contents array
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I will help while maintaining strict security.' }] },
    ...conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: userMessageParts }
  ];

  // When images are present, use AUTO mode so model can respond directly to images
  // without being forced to call a tool. Otherwise use ANY to prevent "I will search..." without action
  const hasImages = userImages && userImages.length > 0;
  const toolMode = hasImages ? "AUTO" : "ANY";

  const requestBody = {
    contents,
    tools: tools.length > 0 ? [{ function_declarations: tools }] : undefined,
    // Force function calling on initial request (unless images present - then allow direct analysis)
    tool_config: tools.length > 0 ? {
      function_calling_config: {
        mode: toolMode
      }
    } : undefined,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4000,
      thinkingConfig: { includeThoughts: true, thinkingLevel: THINKING_LEVEL }
    }
  };

  // Log request details for debugging
  log(`Gemini streaming request: ${contents.length} messages, ${tools.length} tools`, 'info');
  log(`Last user message: "${message.substring(0, 100)}..."`, 'info');

  let response: Response;
  try {
    log('Initiating Gemini fetch...', 'info');
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    log(`Gemini fetch completed with status: ${response.status}`, 'info');
  } catch (fetchError) {
    log(`Gemini fetch failed: ${fetchError}`, 'error');
    throw new Error(`Gemini fetch failed: ${fetchError}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    log(`Gemini API error response: ${errorText.substring(0, 500)}`, 'error');
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  log('Gemini streaming response started', 'info');

  // Process streaming response
  let fullText = '';
  let functionCall: ParsedFunctionCall | undefined;
  const functionCalls: ParsedFunctionCall[] = [];
  // Preserve ALL raw parts across chunks — Gemini 3.x may emit thoughtSignature
  // as its own standalone Part preceding a functionCall Part. Dropping any
  // Part here means the next turn's echo is missing context and the API 400s.
  const rawParts: Array<Record<string, unknown>> = [];
  let chunkCount = 0;

  if (!response.body) {
    log('Warning: Response body is null - no stream to process', 'warn');
    return { text: '', rawParts: [] };
  }

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let readCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        readCount++;

        // Log first read to confirm streaming is working
        if (readCount === 1) {
          log(`First stream read: ${value ? value.length : 0} bytes`, 'info');
        }
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || line.startsWith('data: [DONE]')) continue;

          // Remove "data: " prefix if present
          const jsonLine = line.startsWith('data: ') ? line.slice(6) : line;
          if (!jsonLine.trim()) continue;

          try {
            const chunk = JSON.parse(jsonLine);
            chunkCount++;
            const candidate = chunk.candidates?.[0];

            // Log first chunk for debugging
            if (chunkCount === 1) {
              log(`First Gemini chunk: ${JSON.stringify(chunk).substring(0, 500)}`, 'info');
            }

            // Check for blocked or empty responses
            if (!candidate) {
              // Check if response was blocked
              if (chunk.promptFeedback?.blockReason) {
                log(`Gemini blocked response: ${chunk.promptFeedback.blockReason}`, 'warn');
                log(`Block reason details: ${JSON.stringify(chunk.promptFeedback)}`, 'warn');
              } else {
                log(`Empty candidate in chunk: ${JSON.stringify(chunk).substring(0, 300)}`, 'warn');
              }
              continue;
            }

            // Check finish reason for issues
            const finishReason = candidate.finishReason;
            if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
              log(`Gemini finish reason: ${finishReason}`, 'warn');
              if (finishReason === 'SAFETY') {
                log('Response blocked by safety filters', 'warn');
              } else if (finishReason === 'RECITATION') {
                log('Response blocked due to recitation', 'warn');
              }
            }

            const content = candidate?.content;
            const parts = content?.parts || [];

            // KNOWN BUG: Gemini sometimes returns finishReason:STOP but empty parts
            // Detect this: candidate exists, finishReason is STOP, but no parts
            if (finishReason === 'STOP' && (!parts || parts.length === 0)) {
              log('Warning: Gemini empty content bug - finishReason:STOP but no parts (known API issue)', 'warn');
              // Continue processing - the empty response will be detected at the end
            }

            // Preserve every raw Part so we can echo the model turn verbatim
            // on the next API call (required for Gemini 3.x thoughtSignature).
            rawParts.push(...parts);

            // Extract ALL function calls (not just the first one).
            const functionCallParts = parts.filter((p: { functionCall?: unknown }) => p.functionCall);
            for (const functionCallPart of functionCallParts) {
              const call = extractFunctionCall(functionCallPart);
              if (!call) continue;
              functionCalls.push(call);
              // Keep backward compatibility - set first call
              if (!functionCall) {
                functionCall = call;
              }
            }

            // Extract text — buffer answer text (we need to check for function calls
            // first before deciding how to emit it). Thought-summary parts stream
            // immediately as reasoning_chunk and are kept separate from fullText.
            for (const part of parts) {
              if (!part.text) continue;
              if (part.thought) {
                await sendSSE(writer, 'reasoning_chunk', { text: part.text });
                continue;
              }
              fullText += part.text;
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            log(`Failed to parse streaming chunk: ${parseError}`, 'warn');
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Log final streaming result
  log(`Streaming complete: ${chunkCount} JSON chunks parsed, text=${fullText.length} chars, functionCalls=${functionCalls.length}`, 'info');

  // Stream text now that we know whether function calls are present
  if (functionCalls.length > 0 || functionCall) {
    // Text alongside function calls — intermediate narration
    if (fullText) {
      await sendSSE(writer, 'thought_chunk', { text: fullText });
    }
  } else if (fullText) {
    // Text only — final answer, stream as text_chunk
    await sendSSE(writer, 'text_chunk', { text: fullText });
  }

  // Return result - include text alongside function calls when available
  // This allows us to capture any text Gemini sends before/with function calls
  if (functionCalls.length > 1) {
    return { functionCalls, text: fullText || undefined, rawParts };
  } else if (functionCall) {
    return { functionCall, text: fullText || undefined, rawParts };
  }

  // No function calls - return text (may be empty if model returned nothing)
  if (!fullText) {
    log('Warning: Gemini returned empty response (no text, no function calls) - known API bug', 'warn');
    // Signal that this is the known empty bug so caller can retry
    return { text: '', emptyBug: true, rawParts };
  }

  return { text: fullText, rawParts };
}

/**
 * Validate user data isolation
 */
function validateUserDataIsolation(response: unknown, expectedUserId: string): { valid: boolean; reason?: string } {
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

/**
 * Handle streaming request with SSE
 */
function handleStreamingRequest(
  googleApiKey: string,
  systemPrompt: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  allTools: GeminiFunctionDeclaration[],
  userId: string,
  _calendarId: string | undefined,
  projectRef: string,
  supabaseAccessToken: string,
  supabaseUrl: string,
  userImages?: Array<{ url: string; mimeType: string }>,
  calendarTags?: string[]
): Response {
  // Create SSE stream
  const { stream, writer } = createSSEStream();

  // Process request in background (don't await - return stream immediately)
  (async () => {
    try {

      const functionCalls: Array<{ name: string; args: unknown; result: string }> = [];
      let finalText = '';
      let turnCount = 0;
      const maxTurns = 15;
      const maxRetries = 3;

      // Initial streaming call with retry logic for known Gemini empty response bug
      let result = await callGeminiStreaming(
        googleApiKey,
        systemPrompt,
        message,
        conversationHistory,
        allTools,
        writer,
        userImages // Pass user-attached images on initial request
      );

      // RETRY LOGIC: Handle known Gemini empty content bug
      // See: https://discuss.ai.google.dev/t/gemini-2-5-pro-with-empty-response-text/81175
      if (result.emptyBug) {
        log('Detected Gemini empty content bug, attempting retry with context enhancement', 'warn');

        // Get last assistant message from history for context
        const lastAssistantMsg = [...conversationHistory].reverse().find(m => m.role === 'assistant');
        const contextPrefix = lastAssistantMsg
          ? `(Continuing our conversation - you previously said: "${lastAssistantMsg.content.substring(0, 200)}...")\n\n`
          : '';

        for (let retryAttempt = 1; retryAttempt <= maxRetries; retryAttempt++) {
          // Wait before retry (exponential backoff: 1s, 2s, 4s)
          const delayMs = Math.pow(2, retryAttempt - 1) * 1000;
          log(`Retry ${retryAttempt}/${maxRetries} after ${delayMs}ms delay`, 'info');
          await new Promise(resolve => setTimeout(resolve, delayMs));

          // Different strategies for each retry
          let clarifiedMessage: string;
          let retryTools = allTools;

          if (retryAttempt === 1) {
            // Retry 1: Add context from conversation
            clarifiedMessage = `${contextPrefix}User response: "${message}"\n\nPlease respond to the user's message above.`;
          } else if (retryAttempt === 2) {
            // Retry 2: Simplify - use fewer tools (only custom tools, no MCP)
            clarifiedMessage = `${contextPrefix}User says: "${message}"\n\nProvide a helpful response.`;
            retryTools = allTools.filter(t =>
              ['execute_sql', 'search_web', 'get_market_price', 'create_note', 'update_memory'].includes(t.name)
            );
            log(`Retry 2: Using reduced tool set (${retryTools.length} tools)`, 'info');
          } else {
            // Retry 3: No tools - just get a response
            clarifiedMessage = `The user said: "${message}"\n\nBased on our conversation, please provide a helpful response. You can ask clarifying questions if needed.`;
            retryTools = [];
            log('Retry 3: No tools - forcing text response', 'info');
          }

          result = await callGeminiStreaming(
            googleApiKey,
            systemPrompt,
            clarifiedMessage,
            conversationHistory,
            retryTools,
            writer,
            userImages // Preserve user images across retries
          );

          if (!result.emptyBug && (result.text || result.functionCall || result.functionCalls)) {
            log(`Retry ${retryAttempt} succeeded`, 'info');
            break;
          }

          log(`Retry ${retryAttempt} also returned empty`, 'warn');
        }

        // If all retries failed, provide a fallback response
        if (result.emptyBug || (!result.text && !result.functionCall && !result.functionCalls)) {
          log('All retries failed - providing fallback response', 'warn');
          finalText = "I apologize, but I'm having trouble generating a response right now. This appears to be a temporary issue with the AI service. Please try rephrasing your question or try again in a moment.";
          await sendSSE(writer, 'text_chunk', { text: finalText });
        }
      }

      // Build conversation history for multi-turn function calling
      const conversationContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I will help while maintaining strict security.' }] },
        ...conversationHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      // Function calling loop — per Google docs, loop until no function calls remain.
      // Do NOT use finalText as a loop exit condition: the model may return text
      // alongside function calls (e.g. "Let me search...") which is not the final answer.
      while (turnCount < maxTurns) {
        turnCount++;

        // If we have text and NO function calls, we're done (final answer)
        if (result.text && !result.functionCall && !result.functionCalls) {
          finalText = result.text;
          break;
        }

        // Handle multiple function calls (parallel execution)
        if (result.functionCalls && result.functionCalls.length > 0) {
          log(`Executing ${result.functionCalls.length} functions in parallel`, 'info');

          // Send all tool_call events first
          for (const call of result.functionCalls) {
            await sendSSE(writer, 'tool_call', {
              name: call.name,
              args: call.args
            });
          }

          // Execute all tools in parallel
          const supabaseClient = createServiceClient();
          const executionPromises = result.functionCalls.map(async (call) => {
            try {
              const result = CUSTOM_TOOL_NAMES.has(call.name)
                ? await executeCustomTool(call.name, call.args, {
                  userId,
                  calendarId: _calendarId
                }, supabaseClient)
                : await callMCPTool(projectRef, supabaseAccessToken, call.name, call.args);
              return { call, result, success: true };
            } catch (error) {
              log(`Error executing ${call.name}: ${error}`, 'error');
              return { call, result: `Error: ${error}`, success: false };
            }
          });

          const results = await Promise.all(executionPromises);

          // Send all tool_result events and collect function response parts
          const userParts: Array<Record<string, unknown>> = [];

          for (const { call, result: funcResult } of results) {
            // Send tool_result event
            await sendSSE(writer, 'tool_result', {
              name: call.name,
              result: funcResult
            });

            // Add to function calls history
            functionCalls.push({ name: call.name, args: call.args, result: funcResult });

            // Build multimodal response parts (handles image injection)
            const responseParts = await buildFunctionResponseParts(call.name, funcResult);
            userParts.push(...responseParts);
          }

          // Echo the model turn VERBATIM — Gemini 3.x emits thoughtSignature
          // on its own Part preceding the functionCall, and reconstructing
          // from just {name,args} drops it, causing 400 INVALID_ARGUMENT on
          // the next call. Fall back to per-call synthesis only if rawParts
          // is missing (shouldn't happen for a well-formed response).
          const modelParts = result.rawParts && result.rawParts.length > 0
            ? result.rawParts
            : result.functionCalls!.map(buildFunctionCallPart);
          conversationContents.push({
            role: 'model',
            parts: modelParts
          });

          conversationContents.push({
            role: 'user',
            parts: userParts
          });
        }
        // Handle single function call (sequential execution - backward compatibility)
        else if (result.functionCall) {
          const call = result.functionCall;
          log(`Executing function: ${call.name}`, 'info');

          // Send tool_call event
          await sendSSE(writer, 'tool_call', {
            name: call.name,
            args: call.args
          });

          // Check for repeated calls
          const lastCall = functionCalls[functionCalls.length - 1];
          if (lastCall && lastCall.name === call.name &&
              JSON.stringify(lastCall.args) === JSON.stringify(call.args)) {
            log('Detected repeated function call - breaking loop', 'info');
            break;
          }

          // Check for too many search_web calls
          const searchWebCount = functionCalls.filter(fc => fc.name === 'search_web').length;
          if (call.name === 'search_web' && searchWebCount >= 3) {
            log('Too many search_web calls - breaking loop', 'info');
            break;
          }

          let functionResult: string;

          // Execute tool (custom or MCP)
          const supabaseClient = createServiceClient();
          if (CUSTOM_TOOL_NAMES.has(call.name)) {
            functionResult = await executeCustomTool(call.name, call.args, {
                  userId,
                  calendarId: _calendarId
                }, supabaseClient);
          } else {
            functionResult = await callMCPTool(projectRef, supabaseAccessToken, call.name, call.args);
          }

          functionCalls.push({ name: call.name, args: call.args, result: functionResult });

          // Send tool_result event
          await sendSSE(writer, 'tool_result', {
            name: call.name,
            result: functionResult
          });

          // Echo the model turn verbatim (preserves thoughtSignature Parts)
          const singleCallModelParts = result.rawParts && result.rawParts.length > 0
            ? result.rawParts
            : [buildFunctionCallPart(call)];
          conversationContents.push({
            role: 'model',
            parts: singleCallModelParts
          });

          // Build multimodal response parts (handles image injection)
          const responseParts = await buildFunctionResponseParts(call.name, functionResult);
          conversationContents.push({
            role: 'user',
            parts: responseParts
          });
        } else {
          // No function calls - check if we have text (final answer) or empty response
          if (!result.text && !finalText) {
            log('Warning: No function calls and no text in response - breaking loop', 'warn');
          }
          break;
        }

        // Continuation call — conversationContents is already in Gemini format.
        // If the model returns both text and a function call in the same turn,
        // the text was narration (streamed already); text_reset corrects the UI.
        const { text: newText, functionCall: newFunctionCall, rawParts: newRawParts } = await callGeminiWithContents(
          googleApiKey,
          conversationContents,
          allTools,
          { streaming: true, writer, maxOutputTokens: 8000 }
        );

        if (!newFunctionCall && newText) {
          // Text was already streamed as text_chunk — this is the final answer
          finalText = newText;
        } else if (newFunctionCall && newText) {
          // Text was streamed but was narration alongside a function call.
          // Reset the frontend's accumulated text and re-send as thought_chunk.
          await sendSSE(writer, 'text_reset', {});
          await sendSSE(writer, 'thought_chunk', { text: newText });
        }

        // Include text alongside function call if both present
        result = newFunctionCall
          ? { functionCall: newFunctionCall, text: newText || undefined, rawParts: newRawParts }
          : { text: newText, rawParts: newRawParts };
      }

      // Final fallback - if we still have no text but result has text
      if (!finalText && result.text) {
        finalText = result.text;
      }

      // Log completion with warning if no text was generated
      if (!finalText) {
        // Known Gemini behavior: after many tool calls the model stops generating text.
        // Official mitigation: make one final call with tool_config=NONE to force synthesis
        // from the accumulated tool results already in conversationContents.
        // See: https://discuss.ai.google.dev/t/gemini-2-5-flash-stuck-in-a-tool-call-loop
        log(`Warning: Completed in ${turnCount} turns with ${functionCalls.length} function calls but NO TEXT — forcing synthesis with tool_config=NONE`, 'warn');
        try {
          const synthesisResult = await callGeminiWithContents(
            googleApiKey,
            [
              ...conversationContents,
              { role: 'user', parts: [{ text: 'Please now summarise everything you found and give your final answer. Do not call any more tools.' }] }
            ],
            allTools,
            { streaming: false, maxOutputTokens: 4000, mode: 'NONE' }
          );
          if (synthesisResult.text) {
            finalText = synthesisResult.text;
            await sendSSE(writer, 'text_chunk', { text: finalText });
            log(`Forced synthesis succeeded (${finalText.length} chars)`, 'info');
          }
        } catch (synthErr) {
          log(`Forced synthesis failed: ${synthErr}`, 'error');
        }
        // Last-resort fallback if synthesis also fails
        if (!finalText) {
          finalText = "I gathered some data but ran into a temporary issue composing my response. Please try again.";
          await sendSSE(writer, 'text_chunk', { text: finalText });
        }
      } else {
        log(`Completed in ${turnCount} turns with ${functionCalls.length} function calls`, 'info');
      }

      // ID Validation Feedback Loop
      // If the AI response contains reference tags with invalid IDs, we give it another
      // chance to correct itself by sending a correction prompt back as feedback
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      let cleanedFinalText = finalText || '';
      const maxValidationRetries = 2;
      let validationRetryCount = 0;

      while (serviceKey && hasReferenceTags(cleanedFinalText) && validationRetryCount < maxValidationRetries) {
        log(`Validating reference IDs in response (attempt ${validationRetryCount + 1}/${maxValidationRetries})...`, 'info');
        const validationResult = await validateReferenceIds(
          cleanedFinalText,
          supabaseUrl,
          serviceKey,
          userId
        );

        if (validationResult.isValid) {
          log('ID Validation: All reference IDs are valid', 'info');
          break; // All IDs are valid, exit validation loop
        }

        // Invalid IDs detected - give AI feedback to correct
        validationRetryCount++;
        log(`ID Validation: Found ${validationResult.invalidCount} invalid refs (trades: ${validationResult.invalidIds.trades.length}, events: ${validationResult.invalidIds.events.length}, notes: ${validationResult.invalidIds.notes.length})`, 'warn');

        if (validationRetryCount >= maxValidationRetries) {
          // Max retries reached - strip invalid refs and continue
          log('Max validation retries reached - proceeding with partial response', 'warn');
          // Remove invalid reference tags from the response
          for (const id of validationResult.invalidIds.trades) {
            cleanedFinalText = cleanedFinalText.replace(new RegExp(`<trade-ref\\s+id="${id}"\\s*/?>(</trade-ref>)?`, 'gi'), '');
          }
          for (const id of validationResult.invalidIds.events) {
            cleanedFinalText = cleanedFinalText.replace(new RegExp(`<event-ref\\s+id="${id}"\\s*/?>(</event-ref>)?`, 'gi'), '');
          }
          for (const id of validationResult.invalidIds.notes) {
            cleanedFinalText = cleanedFinalText.replace(new RegExp(`<note-ref\\s+id="${id}"\\s*/?>(</note-ref>)?`, 'gi'), '');
          }
          break;
        }

        // Send correction prompt back to AI
        if (validationResult.correctionPrompt) {
          log('Sending correction prompt to AI for ID fix...', 'info');

          // Add the model's response (with invalid IDs) to conversation
          conversationContents.push({
            role: 'model',
            parts: [{ text: cleanedFinalText }]
          });

          // Add correction prompt as user message
          conversationContents.push({
            role: 'user',
            parts: [{ text: validationResult.correctionPrompt }]
          });

          // Stream the correction prompt to client
          await sendSSE(writer, 'text_chunk', { text: '\n\n[Correcting response...]\n\n' });

          // Correction pass — soft-fail (break validation loop) on any API error
          // rather than killing the whole request, since we already have a
          // usable (if imperfect) response from the prior turn.
          let correctedText = '';
          try {
            const result = await callGeminiWithContents(
              googleApiKey,
              conversationContents,
              allTools,
              { streaming: true, writer, maxOutputTokens: 8000 }
            );
            correctedText = result.text;
          } catch (error) {
            log(`Gemini correction call failed: ${error}`, 'error');
            break;
          }

          cleanedFinalText = correctedText;
          finalText = correctedText;
          log(`Received corrected response (${correctedText.length} chars)`, 'info');
        }
      }

      // Wrap calendar tag mentions in <tag-chip> so the frontend renders them as chips.
      // Single-pass: preserves existing HTML/tag-chip elements, wraps bare tag mentions.
      if (calendarTags && calendarTags.length > 0) {
        // Sort longest-first so "Confluence:3x Displacement" matches before "Confluence"
        const sortedTags = [...calendarTags].sort((a, b) => b.length - a.length);
        const escapedTags = sortedTags.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        // Group 1: existing <tag-chip>…</tag-chip> blocks or any HTML tag — preserve as-is
        // Group 2: a bare calendar tag name — wrap it
        const injectPattern = new RegExp(
          `(<tag-chip>[\\s\\S]*?<\\/tag-chip>|<[^>]+>)|(${escapedTags.join('|')})`,
          'g'
        );
        cleanedFinalText = cleanedFinalText.replace(
          injectPattern,
          (_match, htmlPart, tagName) => htmlPart !== undefined
            ? _match
            : `<tag-chip>${tagName}</tag-chip>`
        );
        log(`Tag-chip injection complete for ${sortedTags.length} calendar tags`, 'info');
      }

      // Format response with HTML and citations (using cleaned text)
      const { messageHtml, citations } = formatResponseWithHtmlAndCitations(
        cleanedFinalText,
        functionCalls as ToolCall[]
      );

      // Send citations
      if (citations.length > 0) {
        await sendSSE(writer, 'citation', { citations });
      }

      // Fetch embedded data (now using validated/cleaned text)
      if (serviceKey) {
        const embeddedData: EmbeddedData = await fetchEmbeddedData(
          cleanedFinalText,
          supabaseUrl,
          serviceKey,
          userId
        );

        const embeddedTrades = Object.fromEntries(embeddedData.trades);
        const embeddedEvents = Object.fromEntries(embeddedData.events);
        const embeddedNotes = Object.fromEntries(embeddedData.notes);

        // Send embedded data if available
        if (Object.keys(embeddedTrades).length > 0 || Object.keys(embeddedEvents).length > 0 || Object.keys(embeddedNotes).length > 0) {
          await sendSSE(writer, 'embedded_data', {
            embeddedTrades: Object.keys(embeddedTrades).length > 0 ? embeddedTrades : undefined,
            embeddedEvents: Object.keys(embeddedEvents).length > 0 ? embeddedEvents : undefined,
            embeddedNotes: Object.keys(embeddedNotes).length > 0 ? embeddedNotes : undefined
          });
        }
      }

      // Send done event (with cleaned/validated text)
      await sendSSE(writer, 'done', {
        success: !!cleanedFinalText,
        messageHtml,
        metadata: {
          functionCalls,
          model: MODEL,
          timestamp: new Date().toISOString(),
          turnCount
        }
      });

    } catch (error) {
      log(`Error in streaming handler: ${error}`, 'error');
      await sendSSE(writer, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      await writer.close();
    }
  })();

  // Return SSE stream immediately
  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  });
}


/**
 * All custom tool definitions and implementations are now in tools.ts
 */

/**
 * Main edge function handler
 */
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Handle warmup pings (no processing, just keep instance alive)
  if (req.headers.get('X-Warmup') === 'true') {
    log('Received warmup ping - keeping function warm', 'info');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Function warmed up',
        timestamp: new Date().toISOString(),
        cacheStatus: 'warm',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body: AgentRequest = await req.json();
    const { message, userId, calendarId, focusedTradeId, conversationHistory = [], calendarContext, images } = body;

    // Allow image-only messages (no text required if images present)
    const hasContent = message || (images && images.length > 0);
    if (!hasContent || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: message or images, and userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit number of images per request (token/cost management)
    const MAX_IMAGES_PER_REQUEST = 4;
    if (images && images.length > MAX_IMAGES_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Too many images. Maximum ${MAX_IMAGES_PER_REQUEST} images allowed per message.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI service is not configured. Please contact support.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use default message for image-only uploads
    const effectiveMessage = message || (images && images.length > 0
      ? `Please analyze ${images.length === 1 ? 'this image' : `these ${images.length} images`}.`
      : '');

    log(`Processing request for user ${userId}`, 'info');
    log(`Input message (first 200 chars): "${effectiveMessage.substring(0, 200)}"`, 'info');
    log(`Message length: ${effectiveMessage.length}, History length: ${conversationHistory.length}, Images: ${images?.length || 0}`, 'info');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    const supabaseAccessToken = Deno.env.get('AGENT_SUPABASE_ACCESS_TOKEN');

    if (!projectRef || !supabaseAccessToken) {
      throw new Error('Supabase configuration missing');
    }

    // Get MCP tools (with caching) filtered to the ones this agent needs —
    // execute_sql for queries and list_tables for schema discovery. Any other
    // MCP tools would just bloat the Gemini tool registry.
    log(`Getting MCP tools for project ${projectRef}`, 'info');
    const geminiMcpTools = await getCachedMCPTools(
      projectRef,
      supabaseAccessToken,
      ['execute_sql', 'list_tables']
    );
    log(`Using ${geminiMcpTools.length} MCP tools (filtered)`, 'info');

    // Combine all tools (MCP + Custom)
    const customTools = getAllCustomTools();
    const allTools = [...geminiMcpTools, ...customTools];

    // Pre-load agent memory (enforces memory availability from turn 0)
    const preloadedMemory = await fetchAgentMemory(userId, calendarId);

    // Pre-fetch focused trade data so the AI has full context from turn 0
    const preloadedTrade = focusedTradeId
      ? await fetchFocusedTrade(focusedTradeId, userId)
      : null;

    // Pre-fetch trade chart images so the AI can see them without a tool call
    const tradeImages = preloadedTrade
      ? await fetchTradeImages(preloadedTrade)
      : [];

    // Merge trade images with user-attached images (user images take priority)
    const allImages = [...tradeImages, ...(images || [])].slice(0, 4);
    if (tradeImages.length > 0) {
      log(`Injecting ${tradeImages.length} trade chart images into context`, 'info');
    }

    // Build system prompt with pre-loaded memory and trade context
    const systemPrompt = buildSecureSystemPrompt(userId, calendarId, calendarContext, focusedTradeId, preloadedMemory, preloadedTrade);

    log('Sending request to Gemini with tools', 'info');

    // Check if client wants streaming (query param is most reliable)
    const url = new URL(req.url);
    const streamParam = url.searchParams.get('stream');
    const acceptHeader = req.headers.get('Accept') || '';
    const streamHeader = req.headers.get('X-Stream') || '';
    const wantsStreaming = streamParam === 'true' || acceptHeader.includes('text/event-stream') || streamHeader === 'true';

    // Route to streaming or non-streaming path
    if (wantsStreaming) {
      log('Using streaming mode', 'info');
      return handleStreamingRequest(
        googleApiKey,
        systemPrompt,
        effectiveMessage,
        conversationHistory,
        allTools,
        userId,
        calendarId,
        projectRef,
        supabaseAccessToken,
        supabaseUrl,
        allImages.length > 0 ? allImages : images, // Trade + user images
        calendarContext?.tags
      );
    }

    // Non-streaming path (existing implementation)
    // Note: Non-streaming doesn't support images yet - use streaming mode for image analysis
    // Initial call
    let result = await callGemini(googleApiKey, systemPrompt, effectiveMessage, conversationHistory, allTools);

    const functionCalls: Array<{ name: string; args: unknown; result: string }> = [];
    let finalText = '';
    let turnCount = 0;
    const maxTurns = 15;

    // Build conversation history for multi-turn function calling
    const conversationContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I will help while maintaining strict security.' }] },
      ...conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    // Function calling loop — per Google docs, loop until no function calls remain.
    while (turnCount < maxTurns) {
      turnCount++;

      // Only treat text as final answer when there are NO function calls
      if (result.text && !result.functionCall) {
        finalText = result.text;
        break;
      }

      if (!result.functionCall) {
        // No function call and no text - shouldn't happen
        break;
      }

      const call = result.functionCall!;
      log(`Executing function: ${call.name}`, 'info');

      // Check if we're repeating the same function call (sign of being stuck)
      const lastCall = functionCalls[functionCalls.length - 1];
      if (lastCall && lastCall.name === call.name &&
          JSON.stringify(lastCall.args) === JSON.stringify(call.args)) {
        log('Detected repeated function call - breaking loop to avoid infinite loop', 'info');
        break;
      }

      // Check if we've made too many search_web calls (more than 3)
      const searchWebCount = functionCalls.filter(fc => fc.name === 'search_web').length;
      if (call.name === 'search_web' && searchWebCount >= 3) {
        log('Too many search_web calls - breaking loop', 'info');
        break;
      }

      let functionResult: string;

      // Check if it's a custom tool (from tools.ts)
      const supabaseClient = createServiceClient();
      if (CUSTOM_TOOL_NAMES.has(call.name)) {
        // Execute custom tool
        functionResult = await executeCustomTool(call.name, call.args, {
                  userId,
                  calendarId
                }, supabaseClient);
        functionCalls.push({ name: call.name, args: call.args, result: functionResult });
      } else {
        // Execute MCP tool via HTTP
        functionResult = await callMCPTool(projectRef, supabaseAccessToken, call.name, call.args);
        functionCalls.push({ name: call.name, args: call.args, result: functionResult });
      }

      // Echo the model turn verbatim (preserves thoughtSignature Parts)
      const modelTurnParts = result.rawParts && result.rawParts.length > 0
        ? result.rawParts
        : [buildFunctionCallPart(call)];
      conversationContents.push({
        role: 'model',
        parts: modelTurnParts
      });

      // Append function response to conversation history (handles image injection)
      const responseParts = await buildFunctionResponseParts(call.name, functionResult);
      conversationContents.push({
        role: 'user',
        parts: responseParts
      });

      // Non-streaming continuation with updated conversation history.
      const { text: newText, functionCall: newFunctionCall, rawParts: newRawParts } = await callGeminiWithContents(
        googleApiKey,
        conversationContents,
        allTools,
        { streaming: false, maxOutputTokens: 4000 }
      );
      result = newFunctionCall
        ? { functionCall: newFunctionCall, rawParts: newRawParts }
        : { text: newText, rawParts: newRawParts };
    }

    log(`Completed in ${turnCount} turns with ${functionCalls.length} function calls`, 'info');

    // Known Gemini behavior: after many tool calls the model stops generating text.
    // Same fix as the streaming path: force a final synthesis call with tool_config=NONE.
    if (!finalText) {
      log('No final text generated — forcing synthesis with tool_config=NONE', 'warn');
      try {
        const synthesisResult = await callGeminiWithContents(
          googleApiKey,
          [
            ...conversationContents,
            { role: 'user', parts: [{ text: 'Please now summarise everything you found and give your final answer. Do not call any more tools.' }] }
          ],
          allTools,
          { streaming: false, maxOutputTokens: 4000, mode: 'NONE' }
        );
        if (synthesisResult.text) {
          finalText = synthesisResult.text;
          log(`Forced synthesis succeeded (${finalText.length} chars)`, 'info');
        }
      } catch (synthErr) {
        log(`Forced synthesis failed: ${synthErr}`, 'error');
      }
      if (!finalText) {
        finalText = "I gathered some data but ran into a temporary issue composing my response. Please try again.";
      }
    }

    // ID Validation Feedback Loop (Non-streaming)
    // If the AI response contains reference tags with invalid IDs, we give it another
    // chance to correct itself by sending a correction prompt back as feedback
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let cleanedFinalText = finalText || '';
    const maxValidationRetries = 2;
    let validationRetryCount = 0;

    while (hasReferenceTags(cleanedFinalText) && validationRetryCount < maxValidationRetries) {
      log(`Validating reference IDs in response (attempt ${validationRetryCount + 1}/${maxValidationRetries})...`, 'info');
      const idValidationResult = await validateReferenceIds(
        cleanedFinalText,
        supabaseUrl,
        serviceKey,
        userId
      );

      if (idValidationResult.isValid) {
        log('ID Validation: All reference IDs are valid', 'info');
        break; // All IDs are valid, exit validation loop
      }

      // Invalid IDs detected - give AI feedback to correct
      validationRetryCount++;
      log(`ID Validation: Found ${idValidationResult.invalidCount} invalid refs (trades: ${idValidationResult.invalidIds.trades.length}, events: ${idValidationResult.invalidIds.events.length}, notes: ${idValidationResult.invalidIds.notes.length})`, 'warn');

      if (validationRetryCount >= maxValidationRetries) {
        // Max retries reached - strip invalid refs and continue
        log('Max validation retries reached - proceeding with partial response', 'warn');
        // Remove invalid reference tags from the response
        for (const id of idValidationResult.invalidIds.trades) {
          cleanedFinalText = cleanedFinalText.replace(new RegExp(`<trade-ref\\s+id="${id}"\\s*/?>(</trade-ref>)?`, 'gi'), '');
        }
        for (const id of idValidationResult.invalidIds.events) {
          cleanedFinalText = cleanedFinalText.replace(new RegExp(`<event-ref\\s+id="${id}"\\s*/?>(</event-ref>)?`, 'gi'), '');
        }
        for (const id of idValidationResult.invalidIds.notes) {
          cleanedFinalText = cleanedFinalText.replace(new RegExp(`<note-ref\\s+id="${id}"\\s*/?>(</note-ref>)?`, 'gi'), '');
        }
        break;
      }

      // Send correction prompt back to AI
      if (idValidationResult.correctionPrompt) {
        log('Sending correction prompt to AI for ID fix (non-streaming)...', 'info');

        // Add the model's response (with invalid IDs) to conversation
        conversationContents.push({
          role: 'model',
          parts: [{ text: cleanedFinalText }]
        });

        // Add correction prompt as user message
        conversationContents.push({
          role: 'user',
          parts: [{ text: idValidationResult.correctionPrompt }]
        });

        // Non-streaming correction — soft-fail (break validation loop) on API error.
        let correctedText = '';
        try {
          const result = await callGeminiWithContents(
            googleApiKey,
            conversationContents,
            allTools,
            { streaming: false, maxOutputTokens: 8000 }
          );
          correctedText = result.text;
        } catch (error) {
          log(`Gemini correction call failed: ${error}`, 'error');
          break;
        }

        cleanedFinalText = correctedText;
        finalText = correctedText;
        log(`Received corrected response (${correctedText.length} chars)`, 'info');
      }
    }

    // Format response with HTML and citations (using cleaned text)
    const { messageHtml, citations } = formatResponseWithHtmlAndCitations(
      cleanedFinalText,
      functionCalls as ToolCall[]
    );

    // Fetch embedded data for inline references (trade_id:xxx, event_id:xxx)
    log('Fetching embedded data for inline references', 'info');

    const embeddedData: EmbeddedData = await fetchEmbeddedData(
      cleanedFinalText,
      supabaseUrl,
      serviceKey,
      userId
    );

    // Convert Maps to objects for JSON serialization
    const embeddedTrades = Object.fromEntries(embeddedData.trades);
    const embeddedEvents = Object.fromEntries(embeddedData.events);
    const embeddedNotes = Object.fromEntries(embeddedData.notes);

    log(`Fetched ${embeddedData.trades.size} embedded trades, ${embeddedData.events.size} embedded events, and ${embeddedData.notes.size} embedded notes`, 'info');

    const formattedResponse = {
      success: !!cleanedFinalText,
      message: cleanedFinalText,
      messageHtml,
      citations,
      embeddedTrades: Object.keys(embeddedTrades).length > 0 ? embeddedTrades : undefined,
      embeddedEvents: Object.keys(embeddedEvents).length > 0 ? embeddedEvents : undefined,
      embeddedNotes: Object.keys(embeddedNotes).length > 0 ? embeddedNotes : undefined,
      metadata: {
        functionCalls,
        model: MODEL,
        timestamp: new Date().toISOString(),
      }
    };

    // Security validation
    const validationResult = validateUserDataIsolation(formattedResponse, userId);
    if (!validationResult.valid) {
      log(`Security violation: ${validationResult.reason}`, 'error');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Security validation failed',
          metadata: {
            functionCalls: [],
            model: MODEL,
            timestamp: new Date().toISOString()
          },
          error: 'Data leak detected',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Response validated - security check passed', 'info');

    return new Response(JSON.stringify(formattedResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log(`Error in AI agent: ${error instanceof Error ? error.message : 'Unknown'}`, 'error', error);

    const errorResponse = formatErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      MODEL
    );

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
