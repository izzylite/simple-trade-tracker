import { log } from './supabase.ts';

/**
 * Non-streaming Gemini helper shared between `ai-trading-agent` (for one-shot
 * corrections / continuations) and `run-orion-task` (batch briefing generation).
 *
 * Deliberately does NOT cover streaming — the SSE writer lifecycle is chat-
 * specific and dragging it into a shared helper would make the abstraction
 * leak. Each agent keeps its own streaming plumbing on top of this.
 */

const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

export function getDefaultGeminiModel(): string {
  return Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<Record<string, unknown>>;
}

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
  /**
   * Gemini 3.x emits `thoughtSignature` either on the Part itself or nested
   * inside functionCall. It MUST be echoed back verbatim in the next turn's
   * model parts or the API 400s with "Function call is missing a
   * thought_signature in functionCall parts". Callers that do multi-round
   * tool loops should pass `rawParts` through instead of reconstructing.
   */
  thoughtSignature?: string;
}

export interface CallGeminiParams {
  systemInstruction?: string;
  contents: GeminiContent[];
  tools?: GeminiFunctionDeclaration[];
  /**
   * Function calling mode. 'AUTO' lets the model decide, 'ANY' forces a tool
   * call, 'NONE' disables tool use even if tools are declared (used on the
   * final turn of a tool loop to guarantee a text response).
   */
  toolMode?: 'AUTO' | 'ANY' | 'NONE';
  /** Enforced JSON schema. Incompatible with `tools` per the Gemini API. */
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  /**
   * Gemini 3.x thinking level. Silently ignored by 2.5-flash, so safe to
   * always pass through — lets chat callers control depth without the
   * batch callers having to care.
   */
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  model?: string;
}

export interface CallGeminiResult {
  /** Concatenated text from non-thought parts. Empty if tool calls only. */
  text: string;
  /** All parallel functionCall parts, in the order Gemini emitted them. */
  functionCalls: GeminiFunctionCall[];
  /**
   * Raw parts from the response. Preserve and echo back verbatim on the
   * next turn of a tool loop so thoughtSignature round-trips.
   */
  rawParts: Array<Record<string, unknown>>;
}

export function extractFunctionCalls(
  parts: Array<Record<string, unknown>>
): GeminiFunctionCall[] {
  const calls: GeminiFunctionCall[] = [];
  for (const part of parts) {
    const fc = part.functionCall as
      | { name?: string; args?: Record<string, unknown>; thoughtSignature?: string }
      | undefined;
    if (!fc?.name) continue;
    const thoughtSignature =
      (part as { thoughtSignature?: string }).thoughtSignature ??
      fc.thoughtSignature;
    calls.push({
      name: fc.name,
      args: fc.args ?? {},
      thoughtSignature,
    });
  }
  return calls;
}

// Retry on 429 (quota) and 5xx (transient) — these are the errors worth
// retrying; 400/401/403 are caller errors and should surface immediately.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

export async function callGemini(params: CallGeminiParams): Promise<CallGeminiResult> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured');
  }

  const model = params.model ?? getDefaultGeminiModel();
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    contents: params.contents,
    generationConfig: {
      temperature: params.temperature ?? 0.3,
      maxOutputTokens: params.maxOutputTokens ?? 8192,
      ...(params.responseSchema
        ? {
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
          }
        : {}),
      ...(params.thinkingLevel
        ? { thinkingConfig: { includeThoughts: true, thinkingLevel: params.thinkingLevel } }
        : {}),
    },
  };

  if (params.systemInstruction) {
    body.systemInstruction = { parts: [{ text: params.systemInstruction }] };
  }

  if (params.tools && params.tools.length > 0) {
    body.tools = [{ function_declarations: params.tools }];
    body.tool_config = {
      function_calling_config: { mode: params.toolMode ?? 'AUTO' },
    };
  }

  const fetchBody = JSON.stringify(body);
  let response!: Response;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: fetchBody,
    });
    if (response.ok || !RETRYABLE_STATUSES.has(response.status)) break;
    log('Gemini transient error, retrying', 'warn', {
      attempt,
      status: response.status,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    log('Gemini API error', 'error', {
      status: response.status,
      body: errorText.substring(0, 500),
    });
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const rawParts: Array<Record<string, unknown>> =
    data.candidates?.[0]?.content?.parts ?? [];

  const text = rawParts
    .filter((p: { text?: string; thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text || '')
    .join('');

  const functionCalls = extractFunctionCalls(rawParts);

  return { text, functionCalls, rawParts };
}
