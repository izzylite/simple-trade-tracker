/**
 * Suggest Tag Definition Edge Function
 *
 * Generates short, trader-voice definitions for one or more tags using Gemini.
 * Used by:
 *  - TagManagementContent "Suggest definitions" CTAs (batch)
 *  - TagCreateDialog "Draft with Orion" button (single)
 *
 * Why a dedicated function (not ai-trading-agent):
 *   The agent loop is built for multi-turn tool use with conversation history.
 *   Tag definitions are a one-shot, schema-enforced JSON output. Routing this
 *   through Orion would pay the full agent overhead (tool cache warmup, system
 *   prompt cost, persistence) for a 200-token completion.
 *
 * Auth: requires user JWT. We don't persist anything — the frontend writes the
 * accepted definitions to tag_definitions after the user reviews them.
 */
import { corsHeaders, handleCors, log, parseJsonBody, errorResponse } from '../_shared/supabase.ts';
import { callGemini } from '../_shared/gemini.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SuggestRequest {
  tags: string[];
  /** Existing definitions for OTHER tags — used as voice-matching examples. */
  examples?: Array<{ tag: string; definition: string }>;
}

interface Suggestion {
  tag: string;
  definition: string;
}

const MAX_TAGS_PER_REQUEST = 25;
const MAX_EXAMPLES = 5;

const systemInstruction = `You are a writing assistant for a trading-journal app. The user has tags they apply to trades (e.g. "Setup:Order Block", "Mistake:FOMO entry"). You write a short definition for each tag so the AI analyst can understand what the trader means by it.

RULES
- Output exactly one definition per requested tag.
- Each definition is 1–2 sentences, ≤ 240 characters. Plain prose, no markdown, no quotes.
- Start with what the tag IS, not "this tag refers to…". Be concrete.
- If a group prefix is present (Setup, Mistake, Emotion, Strategy, Timeframe, etc.), interpret the tag in that context.
- Where natural, append one short example beginning with "Example:" (same field, same string).
- Match the voice of the examples you're shown if any are provided.
- Never refuse. If a tag is ambiguous, pick the most common trading interpretation and define it.`;

const responseSchema = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          definition: { type: 'string' },
        },
        required: ['tag', 'definition'],
      },
    },
  },
  required: ['suggestions'],
};

function buildUserPrompt(tags: string[], examples: SuggestRequest['examples']): string {
  const lines: string[] = [];

  if (examples && examples.length > 0) {
    lines.push('Voice examples from this trader\'s existing definitions:');
    for (const ex of examples.slice(0, MAX_EXAMPLES)) {
      lines.push(`- ${ex.tag}: ${ex.definition}`);
    }
    lines.push('');
  }

  lines.push('Write a definition for each of these tags:');
  for (const tag of tags) {
    lines.push(`- ${tag}`);
  }
  lines.push('');
  lines.push('Return JSON matching the schema. One object per tag, in the same order.');

  return lines.join('\n');
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  // Auth — verify the caller has a valid Supabase JWT. We don't need the user
  // object for the LLM call itself; the gate is just to keep this endpoint
  // from being abused as a free Gemini proxy.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing Authorization header', 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return errorResponse('Unauthorized', 401);

  const body = await parseJsonBody<SuggestRequest>(req);
  if (!body) return errorResponse('Invalid JSON body');

  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
    : [];

  if (tags.length === 0) return errorResponse('tags must be a non-empty array');
  if (tags.length > MAX_TAGS_PER_REQUEST) {
    return errorResponse(`Too many tags (max ${MAX_TAGS_PER_REQUEST} per request)`);
  }

  const examples = Array.isArray(body.examples)
    ? body.examples
        .filter(
          (e): e is Suggestion =>
            !!e && typeof e.tag === 'string' && typeof e.definition === 'string',
        )
        .slice(0, MAX_EXAMPLES)
    : [];

  try {
    log(`Generating definitions for ${tags.length} tag(s)`, 'info');

    const result = await callGemini({
      systemInstruction,
      contents: [
        { role: 'user', parts: [{ text: buildUserPrompt(tags, examples) }] },
      ],
      responseSchema,
      temperature: 0.6,
      maxOutputTokens: 2048,
    });

    let parsed: { suggestions?: Suggestion[] };
    try {
      parsed = JSON.parse(result.text || '{}');
    } catch (parseErr) {
      log('Failed to parse Gemini JSON response', 'error', {
        text: result.text?.substring(0, 300),
      });
      return errorResponse('AI response was not valid JSON', 502);
    }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    // Fill any tags the model dropped, preserving requested order.
    const byTag = new Map<string, string>();
    for (const s of suggestions) {
      if (s && typeof s.tag === 'string' && typeof s.definition === 'string') {
        byTag.set(s.tag, s.definition.trim());
      }
    }
    const ordered: Suggestion[] = tags.map((tag) => ({
      tag,
      definition: byTag.get(tag) ?? '',
    }));

    return new Response(
      JSON.stringify({ success: true, suggestions: ordered }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log('suggest-tag-definition failed', 'error', { message });
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
