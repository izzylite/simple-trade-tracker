/**
 * Window-level embedding logic for recall_conversations.
 *
 * Co-located here (rather than buried inside recall-conversations.ts) for
 * two reasons:
 *   1. File-size hygiene — recall-conversations.ts is already ~800 lines.
 *   2. Conceptual axis — conv-level vs chunk-level retrieval are distinct
 *      concerns. Conv-level answers "which conversation matched", chunk-
 *      level answers "where inside it." Splitting along that axis keeps
 *      each file focused on one retrieval granularity.
 *
 * The chunk-write path runs INSIDE `maybeUpdateEmbedding`'s CAS-protected
 * block (see recall-conversations.ts). Both the conv-level and chunk-level
 * writes ride the same `embedded_at_message_count` claim so a race only
 * advances one side, never both.
 *
 * Window geometry (constants below) is the contract with the SQL side:
 *   - chunk_idx = floor(start_msg_idx / WINDOW_STRIDE) — deterministic, so
 *     UPSERT on (conversation_id, chunk_idx) replaces cleanly when a
 *     window is re-embedded.
 *   - end_msg_idx is the last message included (inclusive), not exclusive.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embedText, truncateForEmbedding } from "../../_shared/embed.ts";
import { log } from "../../_shared/supabase.ts";

// --- Window geometry ----------------------------------------------------

/** Messages per window. 8 ≈ 4 user/orion pairs — usually one subtopic. */
export const WINDOW_SIZE = 8;

/**
 * Stride between consecutive windows. 5 gives a 3-message overlap so topic
 * transitions don't fall in a gap between two adjacent windows. Also makes
 * chunk_idx = floor(start_msg_idx / STRIDE) a stable identifier.
 */
export const WINDOW_STRIDE = 5;

/**
 * Per-message char cap inside a window. 500 is enough to capture the
 * topical fingerprint of a long assistant reply (assistant content in
 * Orion chats averages 2500-3000 chars; the first ~500 carry the bulk of
 * the semantic signal). Worst-case window = 8 × 500 + separators ≈ 4080
 * chars — well under `truncateForEmbedding`'s ~30K char budget at 7500
 * tokens.
 */
export const MAX_CHARS_PER_MSG_IN_WINDOW = 500;

/**
 * Below this message count we skip chunk generation. Conversations under
 * 2 full windows don't have enough position-resolution to be worth the
 * write — the conversation-level embedding already covers everything.
 */
export const MIN_MSGS_FOR_CHUNKING = 16;

// --- Types --------------------------------------------------------------

interface RawMessage {
  role?: string;
  content?: string;
}

export interface PlannedChunk {
  chunkIdx: number;
  startMsgIdx: number;
  endMsgIdx: number;
  content: string;
}

export interface ChunkRegenPlan {
  /** Lowest chunk_idx that needs to be (re)written. */
  firstRegenIdx: number;
  /** Highest chunk_idx that should exist after this gate. */
  maxNewIdx: number;
  /** Windows whose embedding must be computed and upserted. */
  toGenerate: PlannedChunk[];
  /** True if the conversation is too short for chunking entirely. */
  belowThreshold: boolean;
}

// --- Pure helpers -------------------------------------------------------

/**
 * Build the text fed to embedText for one window. Same shape as the
 * LATEST EXCHANGE block in buildEmbedInput — `role: content` lines joined
 * by blank lines. Skips messages without textual content (e.g. pure tool-
 * call records) so a window full of assistant tool-calls doesn't degrade
 * to a near-empty embed input.
 */
export function assembleWindowContent(messages: RawMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "assistant" ? "orion" : "user";
    const raw = typeof m.content === "string" ? m.content : "";
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const clipped = cleaned.length > MAX_CHARS_PER_MSG_IN_WINDOW
      ? cleaned.slice(0, MAX_CHARS_PER_MSG_IN_WINDOW) + "…"
      : cleaned;
    lines.push(`${role}: ${clipped}`);
  }
  return lines.join("\n\n");
}

/**
 * Plan which chunks to regenerate given the current messages snapshot and
 * the last embedded_at_message_count.
 *
 * Regeneration set:
 *   - Any chunk whose intended window extends past `lastEmbedCount` — this
 *     covers BOTH "trailing partial window from last embed" AND "new
 *     chunks beyond the previous tail."
 *   - On edit-resend (lastEmbedCount = 0), every chunk is in the regen set.
 *
 * Anything strictly inside the immutable prefix (`chunk_idx * STRIDE +
 * WINDOW_SIZE <= lastEmbedCount`) is left alone — its messages haven't
 * changed since the last embed, so the chunk is still valid.
 *
 * The plan output is consumed by `writeChunkBatch` below.
 */
export function planChunkRegen(
  // deno-lint-ignore no-explicit-any
  messages: any[],
  lastEmbedCount: number,
): ChunkRegenPlan {
  const messageCount = messages.length;
  if (messageCount < MIN_MSGS_FOR_CHUNKING) {
    return {
      firstRegenIdx: 0,
      maxNewIdx: -1,
      toGenerate: [],
      belowThreshold: true,
    };
  }

  // Smallest chunk_idx whose window extends past lastEmbedCount.
  // Algebra: chunk_idx * STRIDE + WINDOW_SIZE > lastEmbedCount
  //       => chunk_idx > (lastEmbedCount - WINDOW_SIZE) / STRIDE
  //       => chunk_idx >= floor((lastEmbedCount - WINDOW_SIZE) / STRIDE) + 1
  // For lastEmbedCount=0 this gives chunk_idx >= 0 (regen everything).
  // For lastEmbedCount=50, WINDOW=8, STRIDE=5: > (50-8)/5 = 8.4, so >=9.
  const firstRegenIdx = lastEmbedCount === 0
    ? 0
    : Math.max(0, Math.floor((lastEmbedCount - WINDOW_SIZE) / WINDOW_STRIDE) + 1);

  // Highest chunk_idx that should exist. Last window's start is at
  // floor((messageCount - 1) / STRIDE) * STRIDE. We emit a final partial
  // window covering the tail rather than dropping it.
  const maxNewIdx = Math.floor((messageCount - 1) / WINDOW_STRIDE);

  const toGenerate: PlannedChunk[] = [];
  for (let idx = firstRegenIdx; idx <= maxNewIdx; idx++) {
    const startMsgIdx = idx * WINDOW_STRIDE;
    const endMsgIdx = Math.min(startMsgIdx + WINDOW_SIZE - 1, messageCount - 1);
    const slice = messages.slice(startMsgIdx, endMsgIdx + 1);
    const content = assembleWindowContent(slice);
    if (!content.trim()) {
      // All-empty window (e.g. a contiguous block of metadata-only messages).
      // Skip — no point storing a zero-information embedding.
      continue;
    }
    toGenerate.push({ chunkIdx: idx, startMsgIdx, endMsgIdx, content });
  }

  return {
    firstRegenIdx,
    maxNewIdx,
    toGenerate,
    belowThreshold: false,
  };
}

// --- Write path --------------------------------------------------------

/**
 * Embed and persist the chunks from `plan`. Runs sequentially (matches the
 * "drain one at a time" API-key pattern used elsewhere) so we don't fan
 * out on the GOOGLE_API_KEY rate-limit bucket.
 *
 * Order is DELETE-stale-then-UPSERT-new:
 *   1. UPSERT each (conversation_id, chunk_idx) — replaces existing or
 *      inserts new. After this step the table holds correct chunks for
 *      every index in [firstRegenIdx, maxNewIdx].
 *   2. DELETE chunks with chunk_idx > maxNewIdx — handles the edit-resend
 *      case where the conversation shrunk and the old tail is now stale.
 *
 * If step 1 fails mid-way, we have a partial set of new chunks. The next
 * gate fire re-runs the plan and finishes the job. If step 2 fails after
 * step 1, we have correct fresh chunks plus possibly orphan tail chunks
 * — still recoverable on next gate. Worst case is search returns a chunk
 * hint pointing at a message_idx that no longer exists; the caller in
 * recall-conversations.ts clamps that against `message_count` so it
 * degrades to "near-tail" rather than crashing.
 *
 * Returns the number of chunks successfully embedded and upserted.
 */
export async function writeChunkBatch(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  messageCount: number,
  plan: ChunkRegenPlan,
): Promise<{ embedded: number; errors: number }> {
  let embedded = 0;
  let errors = 0;

  for (const chunk of plan.toGenerate) {
    try {
      const input = truncateForEmbedding(chunk.content);
      if (!input.trim()) continue;
      const vec = await embedText(input, "RETRIEVAL_DOCUMENT");

      const { error: upsertErr } = await supabase
        .from("ai_conversation_chunks")
        .upsert(
          {
            conversation_id: conversationId,
            user_id: userId,
            chunk_idx: chunk.chunkIdx,
            start_msg_idx: chunk.startMsgIdx,
            end_msg_idx: chunk.endMsgIdx,
            message_count_at_embed: messageCount,
            embedding: vec,
          },
          { onConflict: "conversation_id,chunk_idx" },
        );
      if (upsertErr) {
        log("writeChunkBatch upsert failed", "warn", {
          conversationId,
          chunkIdx: chunk.chunkIdx,
          error: upsertErr.message,
        });
        errors++;
        continue;
      }
      embedded++;
    } catch (err) {
      log("writeChunkBatch embed/upsert threw", "warn", {
        conversationId,
        chunkIdx: chunk.chunkIdx,
        error: err instanceof Error ? err.message : String(err),
      });
      errors++;
    }
  }

  // Trim any orphan tail chunks beyond the new max. Skip the DELETE
  // entirely when belowThreshold is true and a conversation that was
  // previously chunked has dropped below MIN_MSGS_FOR_CHUNKING — that's
  // basically impossible (message count can grow but not shrink except
  // via edit-resend, and edit-resend resets to 0 which still leaves
  // chunks worth deleting). So the conservative DELETE below covers all
  // legitimate cases.
  const deleteThreshold = plan.belowThreshold ? -1 : plan.maxNewIdx;
  const { error: deleteErr } = await supabase
    .from("ai_conversation_chunks")
    .delete()
    .eq("conversation_id", conversationId)
    .gt("chunk_idx", deleteThreshold);
  if (deleteErr) {
    log("writeChunkBatch tail-delete failed", "warn", {
      conversationId,
      deleteThreshold,
      error: deleteErr.message,
    });
    // Don't increment errors — orphan tail chunks are recoverable on the
    // next gate. The embedding work succeeded.
  }

  return { embedded, errors };
}

/**
 * Drop all chunks for a conversation. Used by edit-resend's truncation
 * path as a defensive cleanup — `planChunkRegen` with lastEmbedCount=0
 * would also rewrite everything from chunk_idx=0, but doing the explicit
 * DELETE here means search RPC immediately stops returning stale chunk
 * hints (the window covering "the message you just edited away" would
 * otherwise live until the next gate fire).
 */
export async function deleteAllChunks(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("ai_conversation_chunks")
    .delete()
    .eq("conversation_id", conversationId);
  if (error) {
    log("deleteAllChunks failed", "warn", {
      conversationId,
      error: error.message,
    });
  }
}
