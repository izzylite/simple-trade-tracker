-- Semantic recall for ai_conversations via Gemini embeddings + pgvector.
--
-- Replaces the ILIKE-on-messages substring match in recall_conversations
-- (action="search") with vector similarity over a per-conversation embedding.
-- One vector per conversation (not per turn) — keeps the schema flat (single
-- column on the existing row, no separate table), and matches the actual
-- recall pattern: users ask "which past chat was about X", then drill into
-- specifics via action="get".
--
-- Model: gemini-embedding-001 at outputDimensionality=768 (Matryoshka
-- truncation from native 3072). 768 keeps the table ~4× smaller than 3072
-- with negligible MTEB quality delta and fits HNSW comfortably.
--
-- Generation: at turn end, inside the existing appendAssistantMessage
-- waitUntil task. Gated by `messages.length - embedded_at_message_count >= N`
-- so we don't re-embed every turn — bounds cost to one Gemini embed call
-- per ~5 turns regardless of conversation length.
--
-- Task type asymmetry (critical correctness): index with RETRIEVAL_DOCUMENT,
-- search with RETRIEVAL_QUERY. Google trains them asymmetrically and using
-- the same type for both measurably degrades recall. Enforced in
-- _shared/embed.ts.
--
-- L2 normalization: gemini-embedding-001 at non-3072 dims does NOT
-- auto-normalize. We normalize manually in the embed helper so cosine
-- similarity in pgvector gives correct rankings.

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedded_at_message_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ai_conversations.embedding IS
  'L2-normalized 768-dim Gemini embedding of (title + recent message tail). Used by recall_conversations(action="search") via HNSW cosine search. NULL = not yet embedded (existing conversations pre-backfill, or never reached embed threshold).';

COMMENT ON COLUMN public.ai_conversations.embedded_at_message_count IS
  'Value of messages.length at last embedding write. Used by the turn-end persist task to gate re-embedding: skip unless messages.length - this >= EMBED_EVERY_N_MESSAGES (default 5).';

-- HNSW index for cosine similarity. m=16, ef_construction=64 are the
-- pgvector defaults that produce a quality/build-time balance suitable for
-- our scale (10s of thousands of rows expected at saturation). vector_cosine_ops
-- because we L2-normalize before storage — cosine and inner-product give
-- identical results on normalized vectors, but cosine is the safer default
-- if a future writer ever forgets to normalize.
CREATE INDEX IF NOT EXISTS ai_conversations_embedding_hnsw_idx
  ON public.ai_conversations
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
