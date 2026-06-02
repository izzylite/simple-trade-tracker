/**
 * callGeminiStreaming — Gemini streaming API caller.
 *
 * Streams text/reasoning chunks via SSE as they arrive, collects
 * functionCall parts, and returns the aggregated result for the
 * function-calling loop to consume.
 */

import { log } from '../_shared/supabase.ts';
import type { GeminiFunctionDeclaration } from './tools.ts';
import type { ThinkingLevel } from './agentConfig.ts';
import {
  buildGeminiUrl,
  geminiHeaders,
  buildToolsArray,
  buildToolConfig,
  buildGenerationConfig,
  preflightTokenCount,
  logUsageMetadata,
} from './geminiHelpers.ts';
import {
  type ParsedFunctionCall,
  extractFunctionCall,
} from './functionCallHelpers.ts';
import { sendSSE } from './sseHelpers.ts';

/**
 * Call Gemini API with streaming support.
 * Streams text chunks as they're generated in real-time.
 */
export async function callGeminiStreaming(
  apiKey: string,
  systemPrompt: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  tools: GeminiFunctionDeclaration[],
  writer: WritableStreamDefaultWriter,
  userImages?: Array<{ url: string; mimeType: string }>,
  thinkingLevel?: ThinkingLevel
): Promise<{
  text?: string;
  functionCall?: ParsedFunctionCall;
  functionCalls?: ParsedFunctionCall[];
  emptyBug?: boolean;
  rawParts?: Array<Record<string, unknown>>;
  usageMetadata?: Record<string, unknown>;
}> {
  const apiUrl = buildGeminiUrl(true);

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

  // Build contents array — systemPrompt goes into the top-level
  // `systemInstruction` field (Gemini docs standard), not a fake role:user
  // turn. Keeps the system prompt at the front of the cache prefix for
  // implicit caching.
  const contents = [
    ...conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: userMessageParts }
  ];

  // AUTO across the board — model decides whether the turn needs a tool.
  // Forcing "ANY" doubled round-trips on conversational replies (thanks,
  // clarifications, post-tool synthesis). The text_reset SSE path below
  // already handles the "narrate then call" drift case, and TIER 1
  // ACTION-ORIENTED in the system prompt enforces tool-with-narration.
  // hasImages retained for future per-mode tweaks but no longer needed here.
  const toolMode = "AUTO";

  // Optional preflight: if the request is big (long history + images), call
  // countTokens first and refuse if we'd exceed the model's 1M context.
  // Disabled by default (PREFLIGHT_KB_THRESHOLD=0); set GEMINI_PREFLIGHT_KB
  // env var to enable. Cheap way to fail fast on accidental oversize sends.
  const preflight = await preflightTokenCount(apiKey, contents, systemPrompt);
  if (preflight.ok === false) {
    log(`Preflight rejected: ${preflight.reason}`, 'warn');
    throw new Error(
      `Request too large for the model's context window (${preflight.tokenCount} tokens). ` +
      `Trim history or attached images and retry.`
    );
  }

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: buildToolsArray(tools),
    // Force function calling on initial request (unless images present - then allow direct analysis)
    tool_config: buildToolConfig(tools, toolMode),
    // 8000 (not 4000) so thinking tokens can't starve the visible output budget
    // on the first/heaviest turn → MAX_TOKENS with empty text. Matches the 8000
    // used on continuation turns. See: https://ai.google.dev/gemini-api/docs/thinking
    generationConfig: buildGenerationConfig(8000, thinkingLevel),
  };

  // Log request details for debugging
  log(`Gemini streaming request: ${contents.length} messages, ${tools.length} tools`, 'info');
  log(`Last user message: "${message.substring(0, 100)}..."`, 'info');

  // Serialize once so the body is reused across retry attempts without re-serializing.
  const serializedBody = JSON.stringify(requestBody);

  // Retry on transient 5xx / 429 — matches the retry policy in _shared/gemini.ts.
  // callGeminiStreaming previously had zero HTTP-level retries; callGeminiWithContents
  // (continuation turns) delegates to _shared/gemini.ts which already retries.
  // 2 retries keeps total overhead at 3s (1s+2s) — well inside the wall-clock budget.
  const STREAMING_RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
  const STREAMING_MAX_RETRIES = 2;
  let response!: Response;
  for (let attempt = 0; attempt <= STREAMING_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      log(`Gemini streaming retry ${attempt}/${STREAMING_MAX_RETRIES}`, 'warn');
    }
    try {
      log('Initiating Gemini fetch...', 'info');
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: geminiHeaders(apiKey),
        body: serializedBody,
      });
      log(`Gemini fetch completed with status: ${response.status}`, 'info');
    } catch (fetchError) {
      if (attempt < STREAMING_MAX_RETRIES) {
        log(`Gemini fetch failed (attempt ${attempt + 1}): ${fetchError}`, 'warn');
        continue;
      }
      log(`Gemini fetch failed: ${fetchError}`, 'error');
      throw new Error(`Gemini fetch failed: ${fetchError}`);
    }
    if (response.ok || !STREAMING_RETRY_STATUSES.has(response.status)) break;
    log(`Gemini transient error (attempt ${attempt + 1}), status: ${response.status}`, 'warn');
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
  // usageMetadata appears on the last streamed chunk — capture it so we can
  // log implicit-cache behavior once the stream ends.
  let lastUsageMetadata: Record<string, unknown> | undefined;

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
          const trimmed = jsonLine.trim();
          if (!trimmed) continue;
          // Skip structural fragments from pretty-printed JSON array wrappers
          // ('}', '  }', '[', ']', ','). See the matching filter in
          // callGeminiWithContents — same Gemini SSE quirk.
          if (!trimmed.startsWith('{')) continue;

          try {
            const chunk = JSON.parse(jsonLine);
            chunkCount++;
            const candidate = chunk.candidates?.[0];

            // Capture usageMetadata — Gemini streams it on the final chunk
            // (sometimes earlier ones too; keep the latest non-empty value).
            if (chunk.usageMetadata) {
              lastUsageMetadata = chunk.usageMetadata;
            }

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
            // MAX_TOKENS with no visible text = thinking starved the output
            // budget (the dominant empty cause on Gemini-3-Flash). Log it as a
            // distinct, greppable root cause so it isn't mistaken for the STOP
            // empty bug — the fix is a bigger maxOutputTokens / lower thinking.
            if (finishReason === 'MAX_TOKENS' && !parts.some((p: { text?: string; thought?: boolean }) => p.text && !p.thought)) {
              log('Warning: Gemini MAX_TOKENS with empty visible text — thinking starved the output budget; raise maxOutputTokens or lower thinkingLevel', 'warn');
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
  logUsageMetadata('callGeminiStreaming', lastUsageMetadata);

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
    return { functionCalls, text: fullText || undefined, rawParts, usageMetadata: lastUsageMetadata };
  } else if (functionCall) {
    return { functionCall, text: fullText || undefined, rawParts, usageMetadata: lastUsageMetadata };
  }

  // No function calls - return text (may be empty if model returned nothing)
  if (!fullText) {
    log('Warning: Gemini returned empty response (no text, no function calls) - known API bug', 'warn');
    // Signal that this is the known empty bug so caller can retry
    return { text: '', emptyBug: true, rawParts, usageMetadata: lastUsageMetadata };
  }

  return { text: fullText, rawParts, usageMetadata: lastUsageMetadata };
}
