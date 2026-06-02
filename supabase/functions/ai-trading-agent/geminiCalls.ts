/**
 * Core Gemini API callers.
 *
 * callGemini          — non-streaming, used by the reminder path and the
 *                       non-streaming chat path's initial request.
 * callGeminiWithContents — shared caller for sites that already have `contents`
 *                          in Gemini parts format (continuation + correction
 *                          passes inside the function-calling loop).
 */

import { log } from '../_shared/supabase.ts';
import { callGemini as sharedCallGemini } from '../_shared/gemini.ts';
import type { GeminiFunctionDeclaration } from './tools.ts';
import { THINKING_LEVEL } from './agentConfig.ts';
import type { ThinkingLevel } from './agentConfig.ts';
import {
  buildGeminiUrl,
  geminiHeaders,
  buildToolsArray,
  buildToolConfig,
  buildGenerationConfig,
  logUsageMetadata,
} from './geminiHelpers.ts';
import {
  type ParsedFunctionCall,
  extractFunctionCall,
} from './functionCallHelpers.ts';
import { sendSSE } from './sseHelpers.ts';

/**
 * Call Gemini API directly (non-streaming).
 */
export async function callGemini(
  apiKey: string,
  systemPrompt: string,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  tools: GeminiFunctionDeclaration[]
): Promise<{
  text?: string;
  functionCall?: ParsedFunctionCall;
  functionCalls?: ParsedFunctionCall[];
  rawParts: Array<Record<string, unknown>>;
  usageMetadata?: Record<string, unknown>;
  finishReason?: string;
}> {
  const apiUrl = buildGeminiUrl(false);

  // Build contents array — systemPrompt goes in the top-level `systemInstruction`
  // field (Gemini docs standard) rather than a fake role:user turn. This keeps
  // the system prompt at the front of the cache prefix for implicit caching
  // and drops the synthetic "Understood" model acknowledgement.
  const contents = [
    ...conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: buildToolsArray(tools),
    // AUTO lets the model skip tool calls on pure conversational turns
    // (thanks, clarifications, summaries) — the previous "ANY" hammer forced
    // a useless function call on every request, doubling round-trips.
    // TIER 1 ACTION-ORIENTED rule + the text_reset SSE path in the streaming
    // call cover the "narrate then call" drift case.
    tool_config: buildToolConfig(tools, 'AUTO'),
    // 8000 matches the streaming initial call — 4000 could truncate complex
    // first-turn responses on the non-streaming path.
    generationConfig: buildGenerationConfig(8000),
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: geminiHeaders(apiKey),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const usageMetadata = data?.usageMetadata;
  logUsageMetadata('callGemini', usageMetadata);
  const candidate = data.candidates?.[0];

  // Surface SAFETY/RECITATION blocks explicitly — without this, a blocked
  // response returns empty parts and looks identical to the known empty-bug,
  // masking the real cause in logs.
  const finishReason: string | undefined = candidate?.finishReason;
  if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    log(`callGemini finishReason=${finishReason}`, 'warn');
  }

  const content = candidate?.content;
  const parts: Array<Record<string, unknown>> = content?.parts || [];

  // Check for function calls — collect ALL parts (parallel calls), not just
  // the first. Returning a single call here would drop the rest and unbalance
  // the next turn's functionResponse count → Gemini 400.
  const functionCallParts = parts.filter((p: { functionCall?: unknown }) => p.functionCall);
  if (functionCallParts.length > 0) {
    const extractedCalls = functionCallParts
      .map((p) => extractFunctionCall(p))
      .filter((c): c is ParsedFunctionCall => !!c);
    if (extractedCalls.length > 0) {
      return {
        functionCall: extractedCalls[0],
        functionCalls: extractedCalls.length > 1 ? extractedCalls : undefined,
        rawParts: parts,
        usageMetadata,
      };
    }
  }

  // Get text response (exclude thought-summary parts so chain-of-thought doesn't leak into answer)
  const text = parts
    .filter((p: { text?: string; thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text || '')
    .join('');
  return { text, rawParts: parts, usageMetadata, finishReason };
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
export async function callGeminiWithContents(
  apiKey: string,
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>,
  tools: GeminiFunctionDeclaration[],
  opts: {
    streaming: boolean;
    writer?: WritableStreamDefaultWriter;
    maxOutputTokens?: number;
    mode?: 'AUTO' | 'ANY' | 'NONE';
    systemInstruction?: string;
    /** Per-turn thinking level. Omit to fall back to THINKING_LEVEL. */
    thinkingLevel?: ThinkingLevel;
  }
): Promise<{
  text: string;
  functionCall?: ParsedFunctionCall;
  /**
   * Set when the model emitted MULTIPLE parallel functionCall parts in one
   * turn. The loop must execute ALL of them and return one functionResponse
   * per call, or Gemini 400s on the next turn (functionCall/functionResponse
   * count mismatch). Convention mirrors callGeminiStreaming: `functionCalls`
   * is populated only when length > 1; a single call uses `functionCall`.
   */
  functionCalls?: ParsedFunctionCall[];
  rawParts: Array<Record<string, unknown>>;
  usageMetadata?: Record<string, unknown>;
  finishReason?: string;
}> {
  // Non-streaming: delegate to the shared `_shared/gemini.ts` helper.
  // The shared version handles body construction, error handling, and
  // part extraction; we just map the return shape (shared returns
  // `functionCalls: []`, this consumer uses `functionCall` for the single
  // case and `functionCalls` for the parallel case).
  if (!opts.streaming) {
    const result = await sharedCallGemini({
      systemInstruction: opts.systemInstruction,
      contents: contents as Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }>,
      tools: tools.length > 0 ? tools : undefined,
      toolMode: opts.mode,
      // 8000 (not 4000) so thinking tokens can't starve the visible output
      // budget → MAX_TOKENS with empty text. Matches every real call site +
      // the streaming branch below; the old 4000 was a latent truncation
      // footgun for any caller relying on the default.
      maxOutputTokens: opts.maxOutputTokens ?? 8000,
      thinkingLevel: (opts.thinkingLevel ?? THINKING_LEVEL) as ThinkingLevel,
    });
    logUsageMetadata('callGeminiWithContents:non-streaming', result.usageMetadata);
    return {
      text: result.text,
      functionCall: result.functionCalls.length >= 1 ? result.functionCalls[0] : undefined,
      functionCalls: result.functionCalls.length > 1 ? result.functionCalls : undefined,
      rawParts: result.rawParts,
      usageMetadata: result.usageMetadata,
      finishReason: result.finishReason,
    };
  }

  // Streaming path stays local — SSE writer lifecycle is chat-specific
  // (reasoning/text/tool_call event emission) and would leak into a shared
  // helper. Body shape mirrors `_shared/gemini.ts` so behavior stays in sync.
  const body: Record<string, unknown> = {
    contents,
    tools: buildToolsArray(tools),
    tool_config: buildToolConfig(tools, opts.mode ?? 'AUTO'),
    generationConfig: buildGenerationConfig(
      opts.maxOutputTokens ?? 8000,
      opts.thinkingLevel,
    ),
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const response = await fetch(buildGeminiUrl(true), {
    method: 'POST',
    headers: geminiHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  let text = '';
  let functionCall: ParsedFunctionCall | undefined;
  // Accumulate ALL functionCall parts across chunks. The previous single
  // `functionCall` (last-wins) silently dropped parallel calls on continuation
  // turns, producing a model turn with N functionCall parts but only 1
  // functionResponse → Gemini 400 + lost tool results.
  const functionCalls: ParsedFunctionCall[] = [];
  const rawParts: Array<Record<string, unknown>> = [];
  let lastUsageMetadata: Record<string, unknown> | undefined;
  let lastFinishReason: string | undefined;

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
        const trimmed = jsonLine.trim();
        if (!trimmed) continue;
        // Skip structural fragments from pretty-printed JSON array wrappers
        // ('}', '  }', '[', ']', ','). Gemini's `alt=sse` stream occasionally
        // intersperses these between data events; they aren't JSON objects
        // on their own, and trying to parse them spams warnings without
        // affecting the actual chunk parsing.
        if (!trimmed.startsWith('{')) continue;
        try {
          const chunk = JSON.parse(jsonLine);
          if (chunk.usageMetadata) lastUsageMetadata = chunk.usageMetadata;
          if (chunk.candidates?.[0]?.finishReason) lastFinishReason = chunk.candidates[0].finishReason;
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
          const fcParts = parts.filter((p: { functionCall?: unknown }) => p.functionCall);
          for (const fcPart of fcParts) {
            const extracted = extractFunctionCall(fcPart);
            if (!extracted) continue;
            functionCalls.push(extracted);
            if (!functionCall) functionCall = extracted; // keep first for back-compat
          }
        } catch (parseError) {
          log(`Failed to parse streaming chunk: ${parseError}`, 'warn');
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  logUsageMetadata('callGeminiWithContents', lastUsageMetadata);
  return {
    text,
    functionCall: functionCalls.length >= 1 ? functionCalls[0] : undefined,
    functionCalls: functionCalls.length > 1 ? functionCalls : undefined,
    rawParts,
    usageMetadata: lastUsageMetadata,
    finishReason: lastFinishReason,
  };
}
