-- Extend match_conversations RPC to return the best-matching chunk hint
-- per ranked conversation.
--
-- Search side of the window-embedding feature: after the existing conv-
-- level HNSW match picks the top-K conversations, a LATERAL subquery finds
-- the single chunk within each one with the highest cosine similarity to
-- the same query embedding. The chunk's (chunk_idx, start_msg_idx,
-- end_msg_idx, similarity) come back as additional columns so callers in
-- recall_conversations(action="search") can hand `start_msg_idx` to
-- action="get" — landing Orion on the right passage instead of the tail.
--
-- For conversations under MIN_MSGS_FOR_CHUNKING (no chunks generated yet),
-- the LATERAL returns NULL for all best_chunk_* columns. The caller falls
-- back to default tail-paging — which is correct for short conversations
-- where the conv-level embedding has already seen everything.
--
-- One round-trip: same query embedding fuels both the conv-level HNSW scan
-- and the per-conversation chunk-level HNSW scan. No second embed call.
--
-- WHY plpgsql + set_config() (instead of SQL + function-level SETs):
-- The previous RPC used `LANGUAGE sql ... SET hnsw.iterative_scan = ...`.
-- Applying via MCP supabase role 42501s on the function-level SET. Using
-- `set_config(..., true)` inside the plpgsql body sets the same GUC
-- transaction-locally and works from any role that can call the function.
--
-- WHY conv_*/bc_* aliases on every CTE column:
-- plpgsql resolves bare column names against the RETURNS TABLE column list
-- too — leaving identical names (id, title, etc.) in inner CTEs collides
-- with "column reference X is ambiguous" at runtime. Renaming the inner
-- columns sidesteps it.

DROP FUNCTION IF EXISTS public.match_conversations(UUID, vector, TIMESTAMPTZ, INT);

CREATE OR REPLACE FUNCTION public.match_conversations(
  p_user_id UUID,
  p_query_embedding vector(768),
  p_since_iso TIMESTAMPTZ DEFAULT NULL,
  p_match_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  message_count INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity REAL,
  snippet TEXT,
  best_chunk_idx INT,
  best_chunk_start_msg_idx INT,
  best_chunk_end_msg_idx INT,
  best_chunk_similarity REAL
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('hnsw.iterative_scan', 'strict_order', true);
  PERFORM set_config('hnsw.ef_search', '100', true);

  RETURN QUERY
  WITH matches AS (
    SELECT
      c.id            AS conv_id,
      c.title         AS conv_title,
      c.message_count AS conv_message_count,
      c.created_at    AS conv_created_at,
      c.updated_at    AS conv_updated_at,
      (1 - (c.embedding <=> p_query_embedding))::real AS conv_similarity,
      COALESCE(
        LEFT(
          (
            SELECT msg ->> 'content'
            FROM jsonb_array_elements(COALESCE(c.messages, '[]'::jsonb)) AS msg
            WHERE msg ->> 'role' = 'user'
              AND msg ->> 'content' IS NOT NULL
              AND LENGTH(msg ->> 'content') > 0
            LIMIT 1
          ),
          300
        ),
        ''
      ) AS conv_snippet
    FROM public.ai_conversations c
    WHERE c.user_id = p_user_id
      AND c.embedding IS NOT NULL
      AND (p_since_iso IS NULL OR c.updated_at >= p_since_iso)
      AND jsonb_array_length(COALESCE(c.messages, '[]'::jsonb)) > 0
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT GREATEST(1, LEAST(p_match_limit, 25))
  ),
  with_best_chunk AS (
    SELECT
      m.conv_id, m.conv_title, m.conv_message_count, m.conv_created_at,
      m.conv_updated_at, m.conv_similarity, m.conv_snippet,
      bc.chunk_idx        AS bc_chunk_idx,
      bc.start_msg_idx    AS bc_start_msg_idx,
      bc.end_msg_idx      AS bc_end_msg_idx,
      bc.chunk_similarity AS bc_similarity
    FROM matches m
    LEFT JOIN LATERAL (
      SELECT
        ch.chunk_idx,
        ch.start_msg_idx,
        ch.end_msg_idx,
        (1 - (ch.embedding <=> p_query_embedding))::real AS chunk_similarity
      FROM public.ai_conversation_chunks ch
      WHERE ch.conversation_id = m.conv_id
      ORDER BY ch.embedding <=> p_query_embedding
      LIMIT 1
    ) bc ON TRUE
  ),
  bumped AS (
    -- Side-effect CTE: bumps last_accessed_at on high-confidence matches
    -- (similarity >= 0.5) whose last bump was >1 day ago.
    UPDATE public.ai_conversations c
    SET last_accessed_at = NOW()
    WHERE c.id IN (
        SELECT m2.conv_id FROM matches m2 WHERE m2.conv_similarity >= 0.5
      )
      AND c.last_accessed_at < NOW() - INTERVAL '1 day'
    RETURNING c.id
  )
  SELECT
    w.conv_id, w.conv_title, w.conv_message_count, w.conv_created_at,
    w.conv_updated_at, w.conv_similarity, w.conv_snippet,
    w.bc_chunk_idx, w.bc_start_msg_idx, w.bc_end_msg_idx, w.bc_similarity
  FROM with_best_chunk w;
END;
$$;

COMMENT ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) IS
  'Vector-search RPC for recall_conversations(action=search). p_query_embedding must use taskType=RETRIEVAL_QUERY. Returns top-K matches by conv-level cosine similarity (cap 25), each enriched with a best_chunk_* hint pointing at the most relevant slice within that conversation (NULL if conversation has no chunks). Bumps last_accessed_at on similarity>=0.5 + last_accessed_at older than 1 day. pgvector iterative_scan=strict_order set transaction-locally via set_config to work around MCP role permission limits.';

REVOKE EXECUTE ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) TO service_role;
