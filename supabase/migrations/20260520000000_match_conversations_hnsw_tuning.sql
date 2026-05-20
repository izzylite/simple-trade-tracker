-- Tune match_conversations RPC for higher-scale recall quality + better snippet.
--
-- Three changes from the original 20260519000003 version, all from an audit
-- pass before public launch:
--
-- 1. hnsw.iterative_scan = 'strict_order' (pgvector 0.8+ feature)
--    Without this, HNSW does post-filter: it pulls top-N candidates by
--    distance, THEN applies the WHERE user_id = ... predicate. At scale
--    (1M+ rows across users) the top-40 candidates may contain zero rows
--    for the requesting user, silently returning empty results. Iterative
--    scan instead keeps pulling candidates until the predicate yields
--    enough rows. `strict_order` preserves the distance ordering — required
--    for "rank by similarity".
--
-- 2. hnsw.ef_search = 100 (default 40)
--    Bumps the index search width. At single-user scale this is essentially
--    free latency-wise (~sub-ms difference), and it materially improves
--    recall quality once the index gets larger.
--
-- 3. Snippet now derives from the FIRST USER message instead of the LAST
--    message. The previous snippet returned messages[-1] which is often a
--    reminder fire ("FOMC press conference in 10 minutes") or a one-word
--    reply ("yes") — useless for the model to gauge what the conversation
--    was about. The first user message is almost always a better
--    single-line representation of intent. Renamed the column to `snippet`
--    so it doesn't lie about its content (was `last_message_content`).
--
-- Note: SET options on the function declaration apply for the duration of
-- the function call only — no global GUC change, no leak into other queries.

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
  snippet TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET hnsw.iterative_scan = 'strict_order'
SET hnsw.ef_search = '100'
AS $$
  SELECT
    c.id,
    c.title,
    c.message_count,
    c.created_at,
    c.updated_at,
    (1 - (c.embedding <=> p_query_embedding))::real AS similarity,
    -- First user message, first 300 chars. Almost always a better
    -- single-line intent indicator than the last message (which can be
    -- a reminder fire or "yes" reply).
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
    ) AS snippet
  FROM public.ai_conversations c
  WHERE c.user_id = p_user_id
    AND c.embedding IS NOT NULL
    AND (p_since_iso IS NULL OR c.updated_at >= p_since_iso)
    AND jsonb_array_length(COALESCE(c.messages, '[]'::jsonb)) > 0
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT GREATEST(1, LEAST(p_match_limit, 25));
$$;

COMMENT ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) IS
  'Vector-search RPC for recall_conversations(action=search). p_query_embedding must be generated with taskType=RETRIEVAL_QUERY. Returns top-K matches by cosine similarity, optionally filtered by updated_at >= p_since_iso. Hard caps match_limit to 25. Uses pgvector 0.8 iterative_scan=strict_order so per-user filtering works correctly at scale.';

REVOKE EXECUTE ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) TO service_role;
