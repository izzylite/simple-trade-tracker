/**
 * Gemini embedding helper — `gemini-embedding-2` at 768 dims.
 *
 * Used by ai-trading-agent for semantic recall over past conversations
 * (recall_conversations action="search"). One call site for both index-time
 * (RETRIEVAL_DOCUMENT) and search-time (RETRIEVAL_QUERY). Asymmetric task
 * intent is still load-bearing — `2` removed the `task_type` API parameter
 * but Google's guidance is to express the same asymmetry by prepending a
 * task instruction to the input string itself.
 *
 * Migration from `gemini-embedding-001` happened 2026-05-20 because 001
 * is scheduled for shutdown 2026-07-14. v1 and v2 vector spaces are NOT
 * compatible; all stored vectors had to be re-embedded in one pass. See
 * `tools/recall-conversations.ts` for the backfill endpoint.
 *
 * What changed vs the v1 helper:
 *   - Model: gemini-embedding-001 → gemini-embedding-2
 *   - Removed `task_type` field from the request body (no longer accepted)
 *   - Now prepends task-instruction prefix to the input text
 *   - Removed manual L2 normalize (v2 auto-normalizes at every dim;
 *     v1 only auto-normalized at native 3072)
 *   - Input cap bumped 2048 → 8192 tokens (v2's larger context)
 *
 * Same GOOGLE_API_KEY as the chat path — no separate auth, no Vertex JWT.
 *
 * Docs: https://ai.google.dev/gemini-api/docs/embeddings
 */

import { log } from './supabase.ts';

const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

const EMBED_MODEL = 'gemini-embedding-2';

/**
 * Output dimensions via Matryoshka truncation. 768 chosen over native 3072
 * because:
 *   - 4× smaller in storage (~3KB vs ~12KB per row)
 *   - HNSW index build cost scales with dim
 *   - MTEB quality delta vs 3072 is small enough to be invisible at our scale
 * If you change this you MUST also change the vector(768) column type and
 * re-embed every existing row — pgvector enforces dim at the column level.
 */
const OUTPUT_DIM = 768;

/**
 * Max input tokens per embedContent call. v2's hard cap is 8192 (4× v1's
 * 2048); we leave headroom so the chars/4 truncation heuristic doesn't
 * have to be exact. The bumped budget mostly benefits long TOPICS lists —
 * see buildEmbedInput in tools/recall-conversations.ts.
 */
export const EMBED_INPUT_TOKEN_LIMIT = 7500;

export type EmbedTaskType =
  | 'RETRIEVAL_DOCUMENT'   // index-time: documents being stored for later retrieval
  | 'RETRIEVAL_QUERY'      // search-time: the user's query vector
  | 'SEMANTIC_SIMILARITY'  // symmetric similarity (rare for us)
  | 'CLASSIFICATION'
  | 'CLUSTERING'
  | 'QUESTION_ANSWERING'
  | 'FACT_VERIFICATION'
  | 'CODE_RETRIEVAL_QUERY';

/**
 * Map our task-type enum (kept stable across the v1→v2 migration so
 * call-sites didn't change) to v2's text-prefix convention. The prefix
 * shape follows Google's documented examples — `"task: <intent> | <role>:
 * <content>"` where role disambiguates the asymmetric pair.
 *
 * Reusing the same prefix on both ends defeats the asymmetry — same risk
 * as reusing the same task_type in v1 — so DOCUMENT and QUERY must remain
 * distinct strings.
 */
function buildTaskPrefix(taskType: EmbedTaskType): string {
  switch (taskType) {
    case 'RETRIEVAL_DOCUMENT':
      return 'task: question answering | text: ';
    case 'RETRIEVAL_QUERY':
      return 'task: question answering | query: ';
    case 'SEMANTIC_SIMILARITY':
      return 'task: semantic similarity | text: ';
    case 'CLASSIFICATION':
      return 'task: classification | text: ';
    case 'CLUSTERING':
      return 'task: clustering | text: ';
    case 'QUESTION_ANSWERING':
      return 'task: question answering | text: ';
    case 'FACT_VERIFICATION':
      return 'task: fact verification | text: ';
    case 'CODE_RETRIEVAL_QUERY':
      return 'task: code retrieval | query: ';
  }
}

/**
 * Generate an L2-normalized 768-dim embedding for `text`.
 *
 * Throws on API error — callers in background tasks (waitUntil) should
 * try/catch and log, since a failed embed should not break the persist path.
 */
export async function embedText(
  text: string,
  taskType: EmbedTaskType,
): Promise<number[]> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY missing for embedText');
  }

  // Don't embed empty/whitespace-only text — Gemini returns a 400 with an
  // unhelpful "Input cannot be empty" message that wastes a request.
  if (!text || !text.trim()) {
    throw new Error('embedText: input text is empty');
  }

  // v2 expresses task intent via input prefix instead of a `task_type`
  // field. Same asymmetric pair behavior as v1 — RETRIEVAL_DOCUMENT and
  // RETRIEVAL_QUERY must map to different prefixes.
  const prefixedText = buildTaskPrefix(taskType) + text;

  const url = `${GEMINI_API_BASE}/${EMBED_MODEL}:embedContent`;
  const body = {
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text: prefixedText }] },
    outputDimensionality: OUTPUT_DIM,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    log(`embedText HTTP ${resp.status}: ${errText.substring(0, 300)}`, 'error');
    throw new Error(`embedText failed: ${resp.status} - ${errText.substring(0, 200)}`);
  }

  const data = await resp.json() as {
    embedding?: { values?: number[] };
  };
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== OUTPUT_DIM) {
    throw new Error(
      `embedText: unexpected response shape, expected ${OUTPUT_DIM}-dim vector, ` +
      `got ${values?.length ?? 'undefined'}`
    );
  }

  // v2 auto-normalizes at every output dim (v1 only auto-normalized at
  // native 3072 and required manual L2 for truncated dims). Returning the
  // raw values is correct. The defensive zero-vector check stays because
  // an upstream bug producing all-zeros would silently corrupt pgvector
  // cosine-distance results.
  const isZero = values.every((v) => v === 0);
  if (isZero) {
    throw new Error('embedText: degenerate zero vector from Gemini');
  }
  return values;
}

/**
 * Serialize a number[] embedding into the pgvector text format used by
 * Postgres/PostgREST: `[0.1,0.2,0.3,...]`. The Supabase JS client accepts
 * a JS number[] directly for vector columns, so this is provided as a
 * fallback for raw SQL paths (e.g., RPC functions, bulk inserts).
 */
export function vectorToLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * Truncate `text` to roughly `EMBED_INPUT_TOKEN_LIMIT` tokens using the
 * chars/4 heuristic. The embedding endpoint will reject inputs over its
 * hard cap (8192 for v2) with a 400 — better to chop here than to fail
 * the embed.
 *
 * Truncates from the START so the tail (most recent content) is preserved.
 * Important for conversation embedding: the trailing exchange is usually
 * the topically-active part the user wants to recall.
 *
 * NOTE: the task-prefix from buildTaskPrefix is short (~40 chars) and
 * applied AFTER this truncation, so it doesn't meaningfully shift the
 * token budget. If we ever add a much larger prefix, account for it here.
 */
export function truncateForEmbedding(text: string): string {
  const maxChars = EMBED_INPUT_TOKEN_LIMIT * 4;
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}
