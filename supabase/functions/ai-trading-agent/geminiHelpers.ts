/**
 * Gemini API URL builder, request-shape helpers, token preflight, and
 * usage-metadata logging. All helpers are pure functions over the config
 * constants imported from agentConfig.ts.
 */

import { log } from '../_shared/supabase.ts';
import type { GeminiFunctionDeclaration } from './tools.ts';
import {
  MODEL,
  THINKING_LEVEL,
  MEDIA_RESOLUTION,
  GEMINI_SEED,
  ENABLE_CODE_EXECUTION,
  PREFLIGHT_KB_THRESHOLD,
  PROMPT_TOKEN_LIMIT,
  GEMINI_API_BASE,
} from './agentConfig.ts';

export function buildGeminiUrl(apiKey: string, streaming: boolean): string {
  return streaming
    ? `${GEMINI_API_BASE}/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`
    : `${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`;
}

/**
 * Build the `tools` array shape Gemini expects, combining custom function
 * declarations with optional built-in tools (currently just code_execution).
 * Built-ins live alongside function_declarations as sibling tool entries —
 * the model picks the right one per call.
 */
export function buildToolsArray(
  customTools: GeminiFunctionDeclaration[]
): Array<Record<string, unknown>> | undefined {
  const entries: Array<Record<string, unknown>> = [];
  if (customTools.length > 0) {
    entries.push({ function_declarations: customTools });
  }
  if (ENABLE_CODE_EXECUTION) {
    entries.push({ code_execution: {} });
  }
  return entries.length > 0 ? entries : undefined;
}

/**
 * Build the `tool_config` block. When mixing code_execution (a built-in /
 * server-side tool) with function_declarations, Gemini requires the
 * include_server_side_tool_invocations flag — otherwise the API 400s with
 * "Please enable tool_config.include_server_side_tool_invocations to use
 * Built-in tools with Function calling."
 */
export function buildToolConfig(
  customTools: GeminiFunctionDeclaration[],
  mode: 'AUTO' | 'ANY' | 'NONE'
): Record<string, unknown> | undefined {
  if (customTools.length === 0) return undefined;
  const cfg: Record<string, unknown> = {
    function_calling_config: { mode },
  };
  if (ENABLE_CODE_EXECUTION) {
    cfg.include_server_side_tool_invocations = true;
  }
  return cfg;
}

/**
 * Build the generationConfig shared across every Gemini call. Keeps
 * temperature, mediaResolution, optional seed, and thinkingConfig in ONE
 * place so a tuning change touches one spot instead of three.
 */
export function buildGenerationConfig(
  maxOutputTokens: number,
  thinkingLevel: string = THINKING_LEVEL,
): Record<string, unknown> {
  const cfg: Record<string, unknown> = {
    // Gemini 3 default — lower values cause function-calling loops.
    temperature: 1.0,
    maxOutputTokens,
    // Vision token control. Set explicitly so the cost profile is deterministic.
    mediaResolution: MEDIA_RESOLUTION,
    // Per-turn thinking level. Chat threads the user's Fast/Balanced/Deep
    // choice here; other callers omit it and fall back to THINKING_LEVEL.
    thinkingConfig: { includeThoughts: true, thinkingLevel },
  };
  if (GEMINI_SEED !== undefined) {
    cfg.seed = GEMINI_SEED;
  }
  return cfg;
}

/**
 * Preflight check using models:countTokens. Skipped (returns ok=true) when
 * PREFLIGHT_KB_THRESHOLD is 0 (default off) or the serialised body is below
 * the byte-size threshold. When enabled, refuses the call if the count would
 * blow PROMPT_TOKEN_LIMIT — cheaper to fail fast than to pay for an
 * impossible-to-fulfil request.
 */
export async function preflightTokenCount(
  apiKey: string,
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>,
  systemInstruction: string | undefined
): Promise<{ ok: true } | { ok: false; tokenCount: number; reason: string }> {
  if (PREFLIGHT_KB_THRESHOLD === 0) return { ok: true };
  const bodyForSize = { contents, systemInstruction };
  const bytes = JSON.stringify(bodyForSize).length;
  if (bytes / 1024 < PREFLIGHT_KB_THRESHOLD) return { ok: true };

  try {
    const url = `${GEMINI_API_BASE}/${MODEL}:countTokens?key=${apiKey}`;
    const reqBody: Record<string, unknown> = { contents };
    if (systemInstruction) {
      reqBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });
    if (!resp.ok) {
      // Soft-fail: don't block the request because the preflight itself failed.
      log(`Preflight countTokens HTTP ${resp.status} — skipping check`, 'warn');
      return { ok: true };
    }
    const data = await resp.json();
    const tokenCount = Number(data?.totalTokens ?? 0);
    if (tokenCount > PROMPT_TOKEN_LIMIT) {
      return { ok: false, tokenCount, reason: `request would use ${tokenCount} tokens, limit ${PROMPT_TOKEN_LIMIT}` };
    }
    return { ok: true };
  } catch (err) {
    log(`Preflight countTokens threw: ${err instanceof Error ? err.message : String(err)} — skipping check`, 'warn');
    return { ok: true };
  }
}

/**
 * Log Gemini usageMetadata — lets us verify implicit caching is actually
 * hitting. `cachedContentTokenCount` > 0 means the prefix (systemInstruction +
 * stable history) matched the on-disk cache and we're paying the discounted
 * rate for those tokens. Safe to call with undefined (silent no-op).
 * See https://ai.google.dev/gemini-api/docs/caching#implicit-caching
 */
export function logUsageMetadata(
  source: string,
  usage: Record<string, unknown> | undefined
): void {
  if (!usage) return;
  const prompt = Number(usage.promptTokenCount ?? 0);
  const cached = Number(usage.cachedContentTokenCount ?? 0);
  const candidates = Number(usage.candidatesTokenCount ?? 0);
  const thoughts = Number(usage.thoughtsTokenCount ?? 0);
  const total = Number(usage.totalTokenCount ?? 0);
  const hitRate = prompt > 0 ? ((cached / prompt) * 100).toFixed(1) : '0.0';
  log(
    `[Usage:${source}] prompt=${prompt} cached=${cached} (${hitRate}%) ` +
    `candidates=${candidates} thoughts=${thoughts} total=${total}`,
    'info'
  );
}
