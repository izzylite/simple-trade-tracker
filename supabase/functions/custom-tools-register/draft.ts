// draft_schema: Gemini drafts a formal tool name + description + args
// schema + sample args from the user's natural-language description.
//
// Returns a freshly generated HMAC secret ONCE in the response. The
// client must hold it through audit + test_fire + save, and surface it
// in the UI so the user can configure their webhook to verify
// signatures. After save we never re-emit it; it lives only in vault.

import { callGemini } from "../_shared/gemini.ts";
import { corsHeaders, errorResponse } from "../_shared/supabase.ts";
import { validateWebhookUrl } from "../_shared/customTools/urlValidator.ts";
import { generateWebhookSecret } from "../_shared/customTools/signing.ts";
import type {
  ArgsSchema,
  DraftedSchema,
} from "../_shared/customTools/types.ts";

interface DraftSchemaRequest {
  description: string;
  webhook_url: string;
}

const SYSTEM_INSTRUCTION =
  `You design function declarations for Google Gemini's function-calling API.

The user describes a webhook-backed tool in natural language. You produce a formal function declaration for an AI assistant ("Orion") that helps traders. Orion will decide whether to call this tool mid-conversation based on the description you write.

NEVER include the user's webhook URL (or any fragment of it) in your output. The URL is supplied for context only.

NAMING
- name is snake_case, starts with a letter, only [a-z0-9_], ≤ 54 chars.
- Choose a name that reflects the verb + subject (e.g. "get_squeeze_signal", "fetch_open_positions", "lookup_position_size").

DESCRIPTION — most important field
- 2–4 sentences. ≤ 1024 chars, but use the minimum that captures intent. Every token here is sent to Gemini on every Orion turn the user enables this tool — verbose descriptions cost the user on every call, forever.
- State plainly what the tool returns and which trading question it answers.
- Include explicit "do not call" guidance: situations where the tool is the wrong fit. Without this Orion overcalls.
- Never use commanding language like "ALWAYS", "must", "first", "most important", "highly recommended", "preferred". The user-facing model decides; the description informs.
- Voice: plain English, no jargon-for-jargon's-sake, no marketing, no emoji. Write like a senior trader explaining a tool to a junior in a one-line Slack message.

ARGS_SCHEMA_JSON (note: emit as a JSON STRING, not an object)
- The value of args_schema_json is a STRINGIFIED JSON Schema with top-level type:"object", a properties map, and an optional required array. Escape inner quotes — this is a string field, not an object field.
- Each property has type (string | number | integer | boolean) and a description.
- Use enum where there's a closed set (timeframe: ["1m","5m","1h"]).
- Prefer a small surface (1–4 args). If the description implies more, push some into the response shape, not the args.
- If the tool needs no input beyond the implicit user identity (e.g. "my open positions"), the stringified schema has properties:{} and required:[]. Do NOT invent placeholder args.

SAMPLE_ARGS_JSON (note: emit as a JSON STRING, not an object)
- One plausible filled-in object matching args_schema, encoded as a JSON string.
- Use realistic trader values (symbol "ES" or "AAPL", timeframe "1h", not "foo").
- If args_schema has no properties, return the string "{}".

HANDLING UNCLEAR INPUT
- If the user's description is too vague to produce a meaningful schema (e.g. "my custom thing returns data"), produce a 1-arg tool that mirrors their wording and let them edit it. Use a generic name like fetch_<noun>_data. Do not invent capabilities not implied by the input.

# EXAMPLE 1 — symbol + timeframe tool
User description: "Returns my proprietary Squeeze indicator signal — whether the squeeze is on or off and the momentum direction — for a given symbol and timeframe."
Output:
{
  "name": "get_squeeze_signal",
  "description": "Returns my proprietary Squeeze indicator state (on/off plus momentum direction) for a symbol and timeframe. Use when the user explicitly asks about squeeze setups or low-volatility breakouts. Do not call for general price questions, news, or fundamentals — dedicated tools handle those.",
  "args_schema_json": "{\\"type\\":\\"object\\",\\"properties\\":{\\"symbol\\":{\\"type\\":\\"string\\",\\"description\\":\\"Ticker symbol, e.g. AAPL, ES, BTC-USD\\"},\\"timeframe\\":{\\"type\\":\\"string\\",\\"description\\":\\"Chart timeframe\\",\\"enum\\":[\\"1m\\",\\"5m\\",\\"15m\\",\\"1h\\",\\"4h\\",\\"1D\\"]}},\\"required\\":[\\"symbol\\",\\"timeframe\\"]}",
  "sample_args_json": "{\\"symbol\\":\\"ES\\",\\"timeframe\\":\\"1h\\"}"
}

# EXAMPLE 2 — args-less tool
User description: "Get my current open positions and unrealized PnL from my prop firm dashboard."
Output:
{
  "name": "get_open_positions",
  "description": "Returns the user's current open positions and unrealized PnL from their prop firm dashboard. Use when the user asks about their positions, exposure, or live PnL. Do not call for historical trade analysis — that's in the journal.",
  "args_schema_json": "{\\"type\\":\\"object\\",\\"properties\\":{},\\"required\\":[]}",
  "sample_args_json": "{}"
}

Output strict JSON matching the schema. No prose around the JSON.`;

// args_schema and sample_args are passed as JSON-encoded STRINGS to
// sidestep Gemini's responseSchema limitation — it rejects/hangs on
// `type:"object"` fields without explicit nested properties. We
// JSON.parse them after the structured response comes back.
const responseSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    args_schema_json: { type: "string" },
    sample_args_json: { type: "string" },
  },
  required: ["name", "description", "args_schema_json", "sample_args_json"],
};

function buildUserPrompt(description: string, webhookUrl: string): string {
  return [
    "The user wants to register a custom tool with these details:",
    "",
    "Webhook URL (for context only — do not echo):",
    `  ${webhookUrl}`,
    "",
    "Natural-language description:",
    `  ${description}`,
    "",
    "Produce the function declaration as JSON matching the schema.",
  ].join("\n");
}

const NAME_REGEX = /^[a-z][a-z0-9_]*$/;

function isValidArgsSchema(value: unknown): value is ArgsSchema {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.type !== "object") return false;
  if (!v.properties || typeof v.properties !== "object") return false;
  return true;
}

function ok(payload: DraftedSchema & { secret: string }): Response {
  return new Response(JSON.stringify({ success: true, draft: payload }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleDraftSchema(
  body: Record<string, unknown>,
): Promise<Response> {
  const req: DraftSchemaRequest = {
    description:
      typeof body.description === "string" ? body.description.trim() : "",
    webhook_url:
      typeof body.webhook_url === "string" ? body.webhook_url.trim() : "",
  };

  if (req.description.length < 10 || req.description.length > 2000) {
    return errorResponse("description must be 10–2000 chars");
  }

  const urlCheck = await validateWebhookUrl(req.webhook_url);
  if (!urlCheck.valid) {
    return errorResponse(`webhook_url rejected: ${urlCheck.reason}`);
  }

  const result = await callGemini({
    systemInstruction: SYSTEM_INSTRUCTION,
    contents: [
      {
        role: "user",
        parts: [{ text: buildUserPrompt(req.description, req.webhook_url) }],
      },
    ],
    responseSchema,
    temperature: 0.4,
    maxOutputTokens: 2048,
  });

  interface GeminiDraftEnvelope {
    name?: string;
    description?: string;
    args_schema_json?: string;
    sample_args_json?: string;
  }

  let envelope: GeminiDraftEnvelope;
  try {
    envelope = JSON.parse(result.text || "{}");
  } catch {
    return errorResponse("Gemini returned malformed JSON", 502);
  }

  const name = (envelope.name ?? "").trim();
  if (!NAME_REGEX.test(name) || name.length > 54) {
    return errorResponse(
      `Gemini produced invalid name '${name}' — retry with a clearer description`,
      502,
    );
  }

  const description = (envelope.description ?? "").trim();
  if (description.length < 10 || description.length > 1024) {
    return errorResponse("Gemini produced out-of-bounds description", 502);
  }

  let argsSchema: unknown;
  try {
    argsSchema = JSON.parse(envelope.args_schema_json ?? "");
  } catch {
    return errorResponse("Gemini produced invalid args_schema JSON", 502);
  }
  if (!isValidArgsSchema(argsSchema)) {
    return errorResponse("Gemini produced invalid args_schema shape", 502);
  }

  let sampleArgs: unknown;
  try {
    sampleArgs = JSON.parse(envelope.sample_args_json ?? "");
  } catch {
    return errorResponse("Gemini produced invalid sample_args JSON", 502);
  }
  if (!sampleArgs || typeof sampleArgs !== "object" || Array.isArray(sampleArgs)) {
    return errorResponse("Gemini produced invalid sample_args shape", 502);
  }

  const secret = generateWebhookSecret();
  return ok({
    name,
    registered_name: `user_tool_${name}`,
    description,
    args_schema: argsSchema,
    sample_args: sampleArgs as Record<string, unknown>,
    secret,
  });
}
