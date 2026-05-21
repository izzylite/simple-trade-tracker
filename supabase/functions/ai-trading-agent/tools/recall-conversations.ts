/**
 * recall_conversations — semantic search past chats + fetch paginated
 * transcripts. Actions: "search" (vector search) | "get" (paginated raw).
 *
 * Also owns the WRITE side of the recall feature (everything keeping the
 * conversation embeddings fresh):
 *   - `maybeUpdateEmbedding` — turn-end embed refresh, called from
 *     conversation persist sites.
 *   - `handleBackfillEmbeddings` — one-shot admin endpoint exposed via
 *     mode='backfill_embeddings' on the main agent function.
 *
 * Co-located so all recall-feature code lives in one file instead of
 * being split across conversationStore.ts and index.ts.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createServiceClient,
  errorResponse,
  log,
  successResponse,
} from "../../_shared/supabase.ts";
import { AGENT_MEMORY_TAG } from "../../_shared/noteTags.ts";
import { embedText, truncateForEmbedding } from "../../_shared/embed.ts";
import type { GeminiFunctionDeclaration, ToolContext } from "./types.ts";

/**
 * Constant-time string comparison for the dispatcher-secret bearer check
 * below. Inlined here (rather than imported from index.ts) so this file
 * doesn't reach back into the main handler — preserves the
 * tools/recall-conversations → _shared dependency direction.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export const recallConversationsTool: GeminiFunctionDeclaration = {
  name: "recall_conversations",
  description:
    `Search past chat conversations with this user, or fetch a paginated slice of one's transcript. Pick ONE \`action\`:

- action="search" — SEMANTIC search over past conversations (gemini-embedding-001 + pgvector cosine). Phrase the \`query\` like a natural-language description of what you're looking for ("position sizing during high vol", "FOMC bias change"), NOT as a strict keyword. The embedding will find conceptually related conversations even when exact words don't match. By default, ALL of the user's conversation history is searched — conversations are not auto-expired. Pass \`since_days\` ONLY if the user's request has an explicit recency signal ("this week", "yesterday", "in the last month"). Optional \`limit\` (default 5, max 10). Returns: [{ id, title, similarity, message_count, snippet }] ranked by relevance. Conversations under similarity 0.35 are filtered as noise. A new or just-edited conversation may not be searchable for a turn or two while its embedding refreshes — fall back to action="get" by id if you have it.
- action="get" — fetch a PAGINATED slice of one conversation. Needs \`conversation_id\` (from a prior search — do NOT guess ids). Returns the LAST N messages by default. Optional \`limit\` (default 50, max 100) and \`offset\` (default 0, counts from the END — offset=0 is the most recent page, offset=50 with limit=50 returns the previous page). Response includes how many older/newer messages exist so you can page deeper if needed.

ONLY use when the user explicitly references a past chat ("last time", "yesterday we discussed", "you told me before", "show me what we said about X"). For structured "what happened / when did" questions, prefer manage_event(action="recall") — faster and more precise. ${AGENT_MEMORY_TAG} notes (manage_note search) remain the primary long-term memory.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["search", "get"],
        description: "Search conversations or fetch one transcript page.",
      },
      query: {
        type: "string",
        description:
          "Search term against titles + message content (action=search).",
      },
      since_days: {
        type: "number",
        description:
          "Optional date filter (action=search). If omitted, ALL conversations are searched — this is the right default for vague references like 'last time we discussed X'. Pass a value ONLY when the user explicitly anchors recency: 7 for 'this week', 30 for 'this month', 90 for 'this quarter'. Applied as a hard SQL filter BEFORE similarity ranking, so matches outside the window are invisible — be conservative.",
      },
      limit: {
        type: "number",
        description:
          "action=search: max conversations to return (default 5, max 10). action=get: max messages per page (default 50, max 100).",
      },
      offset: {
        type: "number",
        description:
          "action=get only: number of recent messages to skip. 0 = latest page (default). 50 = skip the latest 50, return the page before that. Use to walk backwards through a long conversation.",
      },
      conversation_id: {
        type: "string",
        description: "Conversation id from a search result (action=get).",
      },
    },
    required: ["action"],
  },
};

interface ConversationMessage {
  role?: string;
  content?: string;
  timestamp?: string;
}

// Below this cosine similarity we consider a "match" to be noise. Embedding
// search will ALWAYS return top-K rows from the index regardless of how
// poor the match is — filtering by threshold prevents Orion from reporting
// irrelevant conversations as relevant. Tuned empirically; the
// gemini-embedding-001 RETRIEVAL pair tends to score genuine matches >0.4
// and unrelated content <0.3.
const SEARCH_SIMILARITY_FLOOR = 0.35;

async function searchConversations(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  sinceDays: number | undefined,
  limit: number = 5,
): Promise<string> {
  try {
    const boundedLimit = Math.max(1, Math.min(10, Math.floor(limit)));
    // No default time window — conversations don't auto-expire, so the user's
    // full history should be searchable unless Orion explicitly narrows it.
    // Passing null to the RPC bypasses the updated_at predicate entirely.
    const sinceIso = typeof sinceDays === "number" && sinceDays > 0
      ? new Date(Date.now() - sinceDays * 86400 * 1000).toISOString()
      : null;
    const q = (query || "").trim();
    if (!q) return "Query is required for search_conversations.";

    // Embed the query with RETRIEVAL_QUERY task type. Documents in the
    // column were embedded with RETRIEVAL_DOCUMENT — the asymmetric pair is
    // not optional for gemini-embedding-001.
    let queryEmbedding: number[];
    try {
      queryEmbedding = await embedText(q, "RETRIEVAL_QUERY");
    } catch (embedErr) {
      const msg = embedErr instanceof Error ? embedErr.message : String(embedErr);
      log(`recall_conversations: query embed failed: ${msg}`, "error");
      return `Failed to search conversations: query embedding error.`;
    }

    // Call the SECURITY DEFINER RPC — Supabase JS doesn't expose pgvector
    // operators directly, so we wrap the vector ORDER BY in a function.
    // Ask for boundedLimit * 2 results then post-filter by similarity floor,
    // so a noisy top-1 doesn't crowd out a genuine top-3.
    const { data, error } = await supabase.rpc("match_conversations", {
      p_user_id: userId,
      p_query_embedding: queryEmbedding,
      p_since_iso: sinceIso,
      p_match_limit: boundedLimit * 2,
    });

    if (error) {
      log(`recall_conversations RPC error: ${error.message}`, "error");
      return `Failed to search conversations: ${error.message}`;
    }

    const rows = ((data ?? []) as Array<{
      id: string;
      title: string | null;
      message_count: number;
      created_at: string;
      updated_at: string;
      similarity: number;
      snippet: string;
    }>)
      .filter((r) => r.similarity >= SEARCH_SIMILARITY_FLOOR)
      .slice(0, boundedLimit);

    if (rows.length === 0) {
      const scopeNote = sinceIso
        ? ` in the last ${sinceDays} days`
        : "";
      const widenHint = sinceIso
        ? " — try widening or dropping since_days, or rephrasing"
        : " — try rephrasing the query (semantic embeddings reward natural-language descriptions over keywords)";
      return (
        `No past conversations semantically matched "${q}"${scopeNote}. ` +
        `Note: conversations that haven't been indexed yet (very new, or pre-2026-05-19) ` +
        `won't appear here${widenHint}.`
      );
    }

    const lines = rows.map((r, i) => {
      const snippet = (r.snippet ?? "")
        .substring(0, 200)
        .replace(/\s+/g, " ");
      return (
        `[${i + 1}] id=${r.id}  similarity=${r.similarity.toFixed(2)}\n` +
        `    Title: ${r.title ?? "(untitled)"}\n` +
        `    ${r.message_count} messages | updated ${r.updated_at}\n` +
        `    Opening: ${snippet}${snippet.length >= 200 ? "..." : ""}`
      );
    });

    return `Found ${rows.length} conversation${
      rows.length === 1 ? "" : "s"
    } semantically matching "${q}":\n\n${
      lines.join("\n\n")
    }\n\nUse recall_conversations(action="get", conversation_id=...) to read the transcript of any result.`;
  } catch (error) {
    return `Failed to search conversations: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

// Bound the tool result to a manageable token budget. 50 messages averaging
// ~500 chars each ≈ 25K chars ≈ 6K tokens — well under any single-turn cost
// concern even on top of system prompt + tool defs. Hard ceiling of 100 lets
// the model burst to a larger page on explicit ask, but never to the
// hundreds-of-messages range that motivated this cap.
const GET_DEFAULT_LIMIT = 50;
const GET_MAX_LIMIT = 100;

async function getConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  limit: number,
  offset: number,
): Promise<string> {
  try {
    if (!conversationId) return "conversation_id is required.";

    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, title, message_count, created_at, updated_at, messages")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      log(`Error fetching conversation: ${error.message}`, "error");
      return `Failed to fetch conversation: ${error.message}`;
    }
    if (!data) {
      return `Conversation ${conversationId} not found (or not owned by this user).`;
    }

    // Fire-and-forget last_accessed_at bump via touch_ai_conversation RPC.
    // Day-gated server-side, so spamming get() doesn't write-amplify. Wrap
    // in waitUntil so a slow Postgres call never delays the tool result —
    // the bump is incidental to the actual fetch the model is waiting on.
    // Wrap in async IIFE so the supabase thenable becomes a real Promise
    // (waitUntil's typing rejects PromiseLike).
    // Catch both the error-in-result-object case (supabase.rpc convention)
    // AND any thrown exception (network, runtime). Without the outer catch,
    // a thrown rpc call becomes an unhandled rejection — fine in waitUntil
    // (logged by the runtime), but a Deno warning/crash in local/dev where
    // no waitUntil is registered.
    const touchTask: Promise<void> = (async () => {
      try {
        const { error: touchErr } = await supabase.rpc("touch_ai_conversation", {
          p_conversation_id: conversationId,
          p_user_id: userId,
        });
        if (touchErr) {
          log("touch_ai_conversation (action=get) failed", "warn", {
            conversationId,
            error: touchErr.message,
          });
        }
      } catch (err) {
        log("touch_ai_conversation (action=get) threw", "warn", {
          conversationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    const er = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(touchTask);
    // Local/dev: runs unobserved, but the inner try/catch keeps it from
    // becoming an unhandled rejection.

    const messages = (data.messages as ConversationMessage[] | null) ?? [];
    const total = messages.length;
    if (total === 0) {
      return `Conversation "${data.title ?? "(untitled)"}" has no messages.`;
    }

    // Page from the END (latest first). offset=0 returns the last `limit`
    // messages; offset=50 with limit=50 returns the page before that.
    // Clamp aggressively — a bad limit/offset from the model shouldn't blow
    // up the response or return a confusing empty slice.
    const boundedLimit = Math.max(1, Math.min(GET_MAX_LIMIT, Math.floor(limit)));
    const boundedOffset = Math.max(0, Math.floor(offset));
    // sliceEnd is exclusive index of the last message in the page; sliceStart
    // is inclusive. We want the page that ENDS `boundedOffset` messages
    // before the tail.
    const sliceEnd = Math.max(0, total - boundedOffset);
    const sliceStart = Math.max(0, sliceEnd - boundedLimit);
    const page = messages.slice(sliceStart, sliceEnd);
    if (page.length === 0) {
      return (
        `Conversation "${data.title ?? "(untitled)"}" has ${total} messages but ` +
        `offset=${boundedOffset} is past the start. Reduce offset to read older content.`
      );
    }

    const transcript = page.map((m) => {
      const role = m?.role === "assistant" ? "orion" : m?.role ?? "user";
      const ts = m?.timestamp ?? "";
      const content = (m?.content ?? "").trim();
      return `[${ts}] ${role}: ${content}`;
    }).join("\n\n");

    // Tell the model exactly what slice it got and what's still available
    // so it can decide to page deeper without guessing. "older" = closer to
    // the start of the conversation; "newer" = closer to the tail (which
    // would only be non-zero if the model passed a non-default offset).
    const olderCount = sliceStart;
    const newerCount = total - sliceEnd;
    const sliceHeader =
      `Conversation "${data.title ?? "(untitled)"}" — showing messages ${sliceStart + 1}-${sliceEnd} of ${total} ` +
      `(${olderCount} older, ${newerCount} newer not shown). ` +
      `created ${data.created_at}, last updated ${data.updated_at}.`;
    const pagingHint = olderCount > 0
      ? `\n\nTo read older messages, call recall_conversations(action="get", conversation_id="${data.id}", offset=${boundedOffset + boundedLimit}, limit=${boundedLimit}).`
      : "";

    return `${sliceHeader}\n\n${transcript}${pagingHint}`;
  } catch (error) {
    return `Failed to fetch conversation: ${
      error instanceof Error ? error.message : "Unknown"
    }`;
  }
}

export async function executeRecallConversations(
  args: Record<string, unknown>,
  context: ToolContext,
  supabase?: SupabaseClient,
): Promise<string> {
  if (!supabase) return "Supabase client not available for conversation lookup";
  const userId = context.userId || "";
  if (!userId) return "User ID not available in context";

  const action = typeof args.action === "string" ? args.action : "";

  if (action === "search") {
    const query = typeof args.query === "string" ? args.query : "";
    // No default — undefined means "search the user's full conversation
    // history." Orion supplies a value only when the request has an explicit
    // recency anchor (see tool description).
    const sinceDays = typeof args.since_days === "number"
      ? args.since_days
      : undefined;
    const limit = typeof args.limit === "number" ? args.limit : 5;
    return await searchConversations(supabase, userId, query, sinceDays, limit);
  }
  if (action === "get") {
    const conversationId = typeof args.conversation_id === "string"
      ? args.conversation_id
      : "";
    const limit = typeof args.limit === "number" ? args.limit : GET_DEFAULT_LIMIT;
    const offset = typeof args.offset === "number" ? args.offset : 0;
    return await getConversation(supabase, userId, conversationId, limit, offset);
  }
  return JSON.stringify({
    success: false,
    error: `recall_conversations: unknown action "${action}". Use search|get.`,
  });
}

// ===========================================================================
// WRITE SIDE: keep ai_conversations.embedding fresh
// ===========================================================================
// Below this line is everything that maintains the embedding column the
// search action above depends on. Moved from conversationStore.ts and
// index.ts so all recall-feature code lives in one place.

/**
 * Re-embed a conversation every N new messages. Bounds embedding API cost
 * to one call per N turns regardless of how chatty the conversation gets.
 * Cost at gemini-embedding-001 rates (~$0.000225 per call) is effectively
 * free, but the gate keeps it from being wasteful on every turn.
 */
const EMBED_EVERY_N_MESSAGES: number = (() => {
  const v = Number(Deno.env.get("ORION_EMBED_EVERY_N_MESSAGES"));
  return Number.isFinite(v) && v > 0 ? v : 5;
})();

// Char budget for the assembled embed input. Tighter than the 1800-token
// EMBED_INPUT_TOKEN_LIMIT in _shared/embed.ts because we apply
// priority-based budgeting BELOW (not just front-truncation), and we want
// to keep headroom for the chars/4 → tokens heuristic to slip.
const EMBED_CHAR_BUDGET = 6000;

// Per-bullet cap in TOPICS RAISED. 80 keeps each topic distinct + readable.
const TOPIC_CHAR_CAP = 80;

// How many trailing messages to include in LATEST EXCHANGE, each clipped to
// LATEST_PER_MSG_CHAR_CAP. Lower than the conversation cap (250K prompt
// tokens) because the LATEST section is a "nice-to-have" — TOPICS RAISED
// is the source of truth for what the conversation covered.
const LATEST_MSG_COUNT = 6;
const LATEST_PER_MSG_CHAR_CAP = 400;

/**
 * Build the text we feed to the embedding model.
 *
 * Shape (Option C — drift-resistant, zero per-turn LLM cost):
 *   <title>
 *
 *   TOPICS RAISED:
 *   - <first ~80 chars of each user msg, chronological>
 *
 *   LATEST EXCHANGE:
 *   user/orion: <last ~6 messages>
 *
 * Priority-based budgeting (so we don't lose drift resistance on long
 * conversations):
 *   1. Title — always included (~50 chars).
 *   2. TOPICS RAISED — protected first. We allocate the LARGER portion of
 *      the budget to topics because dropping topics is what causes drift.
 *   3. LATEST EXCHANGE — fills remaining budget. Drops trailing messages
 *      or per-message content if budget exhausted.
 *
 * If TOPICS alone exceeds the budget (very long conversations, hundreds of
 * user messages), we DOWNSAMPLE topics uniformly to preserve coverage
 * across the whole conversation — keeping every Nth topic — rather than
 * cutting off the oldest. That preserves the drift-resistance property
 * (oldest topics survive) at the cost of resolution.
 */
function buildEmbedInput(
  title: string,
  // deno-lint-ignore no-explicit-any
  messages: any[],
): string {
  // Extract user-message topic lines from the full messages array.
  const allTopics: string[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    if (m.role !== "user") continue;
    if (typeof m.content !== "string") continue;
    const cleaned = m.content.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const clipped = cleaned.length > TOPIC_CHAR_CAP
      ? cleaned.slice(0, TOPIC_CHAR_CAP) + "…"
      : cleaned;
    allTopics.push(`- ${clipped}`);
  }

  const titlePart = title ? `${title}\n\n` : "";
  // Reserve budget for title + headers + section separators.
  const fixedOverhead = titlePart.length + "TOPICS RAISED:\n".length +
    "\n\nLATEST EXCHANGE:\n".length;

  // Latest exchange: last N messages, each clipped. Built first so we know
  // how much budget remains for TOPICS.
  const latestLines: string[] = [];
  for (const m of messages.slice(-LATEST_MSG_COUNT)) {
    if (!m || typeof m !== "object") continue;
    if (typeof m.content !== "string") continue;
    const role = m.role === "assistant" ? "orion" : "user";
    const cleaned = m.content.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const clipped = cleaned.length > LATEST_PER_MSG_CHAR_CAP
      ? cleaned.slice(0, LATEST_PER_MSG_CHAR_CAP) + "…"
      : cleaned;
    latestLines.push(`${role}: ${clipped}`);
  }
  const latestSection = latestLines.length > 0
    ? latestLines.join("\n\n")
    : "";

  // Allocation: give TOPICS the majority of the budget, then LATEST. Cap
  // LATEST at a third of the budget so a chatty last-6-messages can't
  // crowd out TOPICS.
  const remainingBudget = Math.max(0, EMBED_CHAR_BUDGET - fixedOverhead);
  const latestBudget = Math.min(
    latestSection.length,
    Math.floor(remainingBudget / 3),
  );
  const topicsBudget = remainingBudget - latestBudget;

  // Fit TOPICS into topicsBudget. If they don't fit, DOWNSAMPLE uniformly
  // (keep every Nth topic) so coverage spans the whole conversation. This
  // is what protects drift resistance on long threads.
  const topicsLines = fitTopicsToBudget(allTopics, topicsBudget);
  const topicsSection = topicsLines.length > 0
    ? `TOPICS RAISED:\n${topicsLines.join("\n")}`
    : "";

  // Trim LATEST to its allocated budget too (if a single long message blew
  // past LATEST_PER_MSG_CHAR_CAP × LATEST_MSG_COUNT estimation).
  const trimmedLatest = latestSection.length > latestBudget
    ? latestSection.slice(0, latestBudget) + "…"
    : latestSection;
  const latestPart = trimmedLatest
    ? `LATEST EXCHANGE:\n${trimmedLatest}`
    : "";

  return [titlePart.trim(), topicsSection, latestPart]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Fit a list of topic bullets into `budget` chars. If they already fit,
 * return as-is. Otherwise downsample uniformly so the FIRST and LAST
 * topics always survive (preserving the start-of-thread and
 * end-of-thread coverage that makes Option C drift-resistant).
 */
function fitTopicsToBudget(topics: string[], budget: number): string[] {
  if (topics.length === 0 || budget <= 0) return [];

  // Cumulative size if we kept everything (including newline separators).
  const totalChars = topics.reduce((sum, t) => sum + t.length + 1, 0);
  if (totalChars <= budget) return topics;

  // Estimate how many we can keep. +1 per topic for the joining newline.
  const avgLen = totalChars / topics.length;
  const maxKeep = Math.max(2, Math.floor(budget / avgLen));
  if (maxKeep >= topics.length) return topics;

  // Uniform downsample. Anchor first + last; pick intermediates evenly.
  const result: string[] = [];
  for (let i = 0; i < maxKeep; i++) {
    const idx = Math.round((i * (topics.length - 1)) / (maxKeep - 1));
    result.push(topics[idx]);
  }
  // De-dupe in case rounding picked the same index twice (small maxKeep).
  return Array.from(new Set(result));
}

/**
 * Re-embed a conversation if it has accumulated `EMBED_EVERY_N_MESSAGES`
 * new messages since the last embed. Designed to run INSIDE the
 * assistant-persist `EdgeRuntime.waitUntil` task (after the assistant
 * message lands).
 *
 * On any error: log and skip the update. The counter doesn't advance, so
 * the next turn's check fires it again. Idempotent and self-healing.
 *
 * `opts.force` skips the threshold check — used by the backfill endpoint
 * to embed even short conversations on first run.
 *
 * Returns `{ updated: boolean }` for observability.
 */
export async function maybeUpdateEmbedding(
  serviceClient: ReturnType<typeof createServiceClient>,
  conversationId: string,
  userId: string,
  opts: { force?: boolean } = {},
): Promise<{ updated: boolean }> {
  try {
    const { data: convo, error: readErr } = await serviceClient
      .from("ai_conversations")
      .select("id, title, messages, embedded_at_message_count")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr || !convo) {
      // Row vanished (e.g. /clear during turn) — no-op is correct.
      return { updated: false };
    }

    // deno-lint-ignore no-explicit-any
    const messages: any[] = Array.isArray(convo.messages) ? convo.messages : [];
    if (messages.length === 0) {
      // No messages to embed (e.g. just-cleared conversation).
      return { updated: false };
    }

    const lastEmbedCount = Number(convo.embedded_at_message_count ?? 0);
    // Embed on the FIRST assistant turn (≥2 messages, never embedded yet),
    // then re-embed every EMBED_EVERY_N_MESSAGES after. Without the
    // first-turn rule, short conversations (a 3-message "research X and save
    // a note" exchange) would never reach the threshold and stay invisible
    // to semantic recall. The first embed costs one call per conversation
    // (~$0.0003) — cheap insurance that every real conversation is
    // searchable. Edit-resend resets embedded_at_message_count to 0, so
    // this rule also re-embeds promptly after a truncation.
    const neverEmbedded = lastEmbedCount === 0;
    const firstChance = neverEmbedded && messages.length >= 2;
    const reachedThreshold =
      messages.length - lastEmbedCount >= EMBED_EVERY_N_MESSAGES;
    if (!opts.force && !firstChance && !reachedThreshold) {
      // Under threshold and not the first-turn embed — wait for more turns.
      // Backfill passes force=true to bypass entirely.
      return { updated: false };
    }

    // Atomic claim: CAS-bump embedded_at_message_count from lastEmbedCount
    // to messages.length BEFORE doing the expensive embed call. Only one
    // worker can win this CAS for a given snapshot — concurrent callers
    // (reminder fire vs chat-turn persist) that read the same lastEmbedCount
    // will lose the CAS and exit without paying for an embed.
    //
    // This is the gate that prevents the wasted Gemini call. The previous
    // .lt write predicate prevented stale OVERWRITE after the embed call
    // landed, but didn't stop the duplicate embed from happening. Bumping
    // the count first turns the count itself into a lock-free claim token.
    //
    // Note: the predicate is `.eq(lastEmbedCount)`. If anyone else has
    // already advanced the count (mid-embed claim by another worker, OR
    // a completed embedding from a newer snapshot), the predicate fails
    // and we exit. force=true (backfill) still respects this — backfill
    // serializes anyway, so contention there is impossible by construction.
    const { data: claimed, error: claimErr } = await serviceClient
      .from("ai_conversations")
      .update({ embedded_at_message_count: messages.length })
      .eq("id", conversationId)
      .eq("user_id", userId)
      .eq("embedded_at_message_count", lastEmbedCount)
      .select("id")
      .maybeSingle();
    if (claimErr) {
      log("maybeUpdateEmbedding claim failed", "warn", {
        conversationId,
        error: claimErr.message,
      });
      return { updated: false };
    }
    if (!claimed) {
      // CAS lost — another worker advanced the count between our read and
      // our claim. They're either mid-embed or finished. Either way, no
      // wasted embed call on our side.
      return { updated: false };
    }

    // From here we hold the claim. ANY exit without a successful embedding
    // write must roll back the count so the next turn re-fires the gate;
    // otherwise the row sits with count=messages.length but a stale (or
    // null) embedding, and the gate won't trigger again until +N more
    // messages accumulate. The finally block handles all exit paths.
    let committed = false;
    try {
      const title = typeof convo.title === "string" ? convo.title : "";
      const rawInput = buildEmbedInput(title, messages);
      const input = truncateForEmbedding(rawInput);
      if (!input.trim()) return { updated: false };

      // RETRIEVAL_DOCUMENT — indexing for later retrieval. The query side
      // uses RETRIEVAL_QUERY (see searchConversations above). Asymmetric
      // task types are NOT optional — same type on both sides measurably
      // degrades recall.
      const vec = await embedText(input, "RETRIEVAL_DOCUMENT");

      // Commit: write the embedding. Count is already at messages.length
      // from the claim, so the predicate is .eq (we still hold it), not .lt.
      // If a newer claim leapfrogged us in the race window (possible only
      // if EMBED_EVERY_N_MESSAGES more messages arrived during our embed
      // call — rare), our write no-ops and the newer claim's embedding wins.
      const { data: updated, error: writeErr } = await serviceClient
        .from("ai_conversations")
        .update({ embedding: vec })
        .eq("id", conversationId)
        .eq("user_id", userId)
        .eq("embedded_at_message_count", messages.length)
        .select("id")
        .maybeSingle();
      if (writeErr) {
        log("maybeUpdateEmbedding write failed", "warn", {
          conversationId,
          error: writeErr.message,
        });
        return { updated: false };
      }
      if (!updated) {
        log("maybeUpdateEmbedding skipped — leapfrogged by newer claim", "info", {
          conversationId,
          ourSnapshotLength: messages.length,
        });
        return { updated: false };
      }
      committed = true;
      return { updated: true };
    } finally {
      if (!committed) {
        // Release the claim. CAS-conditional on count still equalling our
        // claim value — if a newer claim leapfrogged us, theirs stands and
        // our rollback no-ops cleanly. Best-effort: a failed rollback only
        // means the gate won't re-fire until +N more messages, which is
        // acceptable degradation for a rare error path.
        try {
          await serviceClient
            .from("ai_conversations")
            .update({ embedded_at_message_count: lastEmbedCount })
            .eq("id", conversationId)
            .eq("user_id", userId)
            .eq("embedded_at_message_count", messages.length);
        } catch (rollbackErr) {
          log("maybeUpdateEmbedding rollback failed — gate may stall until +N msgs", "warn", {
            conversationId,
            error: rollbackErr instanceof Error
              ? rollbackErr.message
              : String(rollbackErr),
          });
        }
      }
    }
  } catch (err) {
    // Embed API failure should NOT propagate. The persist already
    // succeeded by the time we get here; a missing embedding just means
    // this conversation is temporarily unsearchable via semantic recall
    // (action="get" still works fine). Next turn's check retries.
    log("maybeUpdateEmbedding threw — skipping (will retry next turn)", "warn", {
      conversationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { updated: false };
  }
}

/**
 * One-shot backfill: embed every ai_conversations row with NULL embedding.
 *
 * Auth: `X-Reminders-Dispatcher-Secret` header matched against the
 * `REMINDERS_DISPATCHER_SECRET` env var. Same pattern the reminders cron
 * uses; it's the only known-working pg_net → ai-trading-agent auth path
 * (the `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY` route 401s
 * silently at runtime; see "edge fn deploys reset verify_jwt" memory note).
 *
 * Idempotent — only touches rows where `embedding IS NULL`, so re-running
 * after a previous partial run picks up where it stopped. Caller should
 * re-invoke while `remaining > 0` in the response.
 *
 * Body: `{ limit?: number }` — chunk size (default 500, max 1000). At
 * ~250ms per embed + ~50ms per UPDATE, 500 rows fits the 130s edge
 * function budget comfortably.
 */
export async function handleBackfillEmbeddings(req: Request): Promise<Response> {
  const dispatcherSecret = req.headers.get("X-Reminders-Dispatcher-Secret") ?? "";
  const expected = Deno.env.get("REMINDERS_DISPATCHER_SECRET") ?? "";
  if (!expected) {
    return errorResponse("REMINDERS_DISPATCHER_SECRET not configured", 500);
  }
  if (!constantTimeEqual(dispatcherSecret, expected)) {
    return errorResponse("Unauthorized: dispatcher secret required", 401);
  }

  let body: { limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — use defaults.
  }
  const limit = Math.max(1, Math.min(1000, Math.floor(body.limit ?? 500)));

  const serviceClient = createServiceClient();
  const { data: rows, error: selectErr } = await serviceClient
    .from("ai_conversations")
    .select("id, user_id")
    .is("embedding", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (selectErr) {
    return errorResponse(`select failed: ${selectErr.message}`, 500);
  }
  if (!rows || rows.length === 0) {
    return successResponse(
      { embedded: 0, skipped: 0, errors: 0, remaining: 0 },
      "No conversations need embedding",
    );
  }

  // Sequential. Concurrent embed calls would compete for the same
  // GOOGLE_API_KEY rate-limit bucket; sequential at ~250ms/call is fast
  // enough and matches the "drain one at a time" pattern the API key
  // pool uses elsewhere.
  let embedded = 0;
  let skipped = 0;
  const startMs = Date.now();
  const BUDGET_MS = 130_000;

  for (const row of rows) {
    if (Date.now() - startMs > BUDGET_MS) {
      log(
        `backfill: wall-clock budget hit after ${embedded + skipped} rows`,
        "warn",
      );
      break;
    }
    const result = await maybeUpdateEmbedding(
      serviceClient,
      row.id,
      row.user_id,
      { force: true },
    );
    if (result.updated) embedded++;
    else skipped++;
  }

  const { count: remainingCount } = await serviceClient
    .from("ai_conversations")
    .select("id", { count: "exact", head: true })
    .is("embedding", null);

  return successResponse(
    {
      embedded,
      skipped,
      errors: 0,
      processed: rows.length,
      remaining: remainingCount ?? 0,
      elapsed_ms: Date.now() - startMs,
    },
    embedded > 0
      ? `Embedded ${embedded} conversations (${
        remainingCount ?? 0
      } still NULL — re-invoke if non-zero).`
      : `Processed ${rows.length} rows; nothing embedded (all under threshold or errored).`,
  );
}
