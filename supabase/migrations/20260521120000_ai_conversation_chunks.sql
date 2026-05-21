-- Window-level embeddings for ai_conversations.
--
-- One row per fixed-size sliding window over the messages array. Lets
-- recall_conversations(action="search") return not just "which conversation
-- matched" but "which slice within it matched" — so action="get" can land
-- on the relevant passage instead of defaulting to the conversation tail.
--
-- WHY a separate table (vs JSONB column on ai_conversations):
--   - p95 conversation has ~50 windows × 768-dim float32 = ~150 KB of vector
--     data per long conversation. JSONB column would TOAST these and force-
--     load them into memory on EVERY ai_conversations read (including the
--     existing match_conversations RPC and history-list queries).
--   - JSONB-of-vectors can't use pgvector HNSW. Doing cosine in SQL against
--     JSONB requires deserialization per row — slow and unindexable.
--   - Normalized table gives a proper pgvector HNSW index and clean cascade-
--     delete semantics via FK ON DELETE CASCADE.
--
-- WHY both an embedding-level HNSW index AND a (conversation_id, chunk_idx)
-- btree index:
--   - HNSW for the search-time cosine match (the whole point of the table).
--   - (conversation_id, chunk_idx) for write-side ops (DELETE stale chunks
--     before re-embedding, ORDER BY chunk_idx when displaying).
--
-- WHY (user_id) btree:
--   - RLS policy filters by user_id; without an index, RLS adds a seq scan
--     to every chunk query at scale.
--
-- Window geometry (set in the application code, not enforced here):
--   - WINDOW_SIZE = 8 messages per window
--   - WINDOW_STRIDE = 5 (3-message overlap between consecutive windows
--     absorbs topic-transitions that would otherwise fall in a gap)
--   - MIN_MSGS_FOR_CHUNKING = 16 (below this, the conversation-level
--     embedding already covers everything — no chunks generated)
--   - chunk_idx = floor(start_msg_idx / WINDOW_STRIDE), so chunk_idx is
--     deterministic from start_msg_idx and the upsert key works correctly.

CREATE TABLE IF NOT EXISTS public.ai_conversation_chunks (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id          UUID NOT NULL
                              REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL
                              REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_idx                INTEGER NOT NULL,
  start_msg_idx            INTEGER NOT NULL,
  end_msg_idx              INTEGER NOT NULL,
  message_count_at_embed   INTEGER NOT NULL,
  embedding                vector(768) NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, chunk_idx),
  CHECK (start_msg_idx >= 0),
  CHECK (end_msg_idx >= start_msg_idx),
  CHECK (chunk_idx >= 0)
);

COMMENT ON TABLE public.ai_conversation_chunks IS
  'Window-level (vector(768)) embeddings of ai_conversations.messages. Used by recall_conversations(action="search") to return a best-chunk hint alongside the conversation match — lets action="get" jump straight to the relevant slice instead of defaulting to the tail. One row per sliding window (WINDOW_SIZE=8, WINDOW_STRIDE=5). chunk_idx is deterministic from start_msg_idx so upserts on (conversation_id, chunk_idx) replace cleanly when windows are re-embedded.';

COMMENT ON COLUMN public.ai_conversation_chunks.chunk_idx IS
  'Deterministic from start_msg_idx: chunk_idx = floor(start_msg_idx / WINDOW_STRIDE). Stable across re-embeds — same window always lands on the same chunk_idx.';

COMMENT ON COLUMN public.ai_conversation_chunks.message_count_at_embed IS
  'Snapshot of ai_conversations.messages.length when this window was embedded. Trailing partial windows (end_msg_idx == message_count_at_embed - 1 AND (end - start + 1) < WINDOW_SIZE) get re-embedded on the next gate fire so they grow into full-size windows as the conversation continues.';

-- HNSW index for cosine similarity. Matches the index on
-- ai_conversations.embedding (vector_cosine_ops, m=16, ef_construction=64).
-- Embeddings are L2-normalized by gemini-embedding-2 (auto-normalize at
-- every output dim), so cosine and inner-product are equivalent — sticking
-- with cosine for safety if a future writer forgets to normalize.
CREATE INDEX IF NOT EXISTS ai_conversation_chunks_embedding_hnsw_idx
  ON public.ai_conversation_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Supports write-side DELETE WHERE conversation_id = X AND chunk_idx >= Y
-- (used to drop stale windows before re-embed) and ORDER BY chunk_idx.
CREATE INDEX IF NOT EXISTS ai_conversation_chunks_convo_idx
  ON public.ai_conversation_chunks (conversation_id, chunk_idx);

-- Supports RLS predicate. Without this, every user_id-filtered query forces
-- a seq scan of the chunks table.
CREATE INDEX IF NOT EXISTS ai_conversation_chunks_user_idx
  ON public.ai_conversation_chunks (user_id);

-- RLS: users read their own chunks. Writes happen only from edge functions
-- via service_role (which bypasses RLS), so no INSERT/UPDATE/DELETE policy
-- is needed for end-users.
ALTER TABLE public.ai_conversation_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own conversation chunks"
  ON public.ai_conversation_chunks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Lock down explicit grants. service_role gets full access (used by edge
-- functions). authenticated gets only what RLS permits (SELECT own).
REVOKE ALL ON public.ai_conversation_chunks FROM PUBLIC;
GRANT SELECT ON public.ai_conversation_chunks TO authenticated;
GRANT ALL ON public.ai_conversation_chunks TO service_role;
