-- Update match_conversations RPC to bump last_accessed_at on high-
-- confidence matches.
--
-- Adds a data-modifying CTE that bumps last_accessed_at = NOW() for every
-- row in the result set with similarity >= 0.5 AND last_accessed_at older
-- than 1 day. The two gates do different jobs:
--
--   - similarity >= 0.5 — only bumps GENUINE matches. Without this, every
--     conversation that scrapes past the 0.35 noise floor as a marginal
--     "best of a thin set" answer would extend its own TTL forever
--     (self-fulfilling immortality loop). 0.5 means "Orion is reasonably
--     confident this is what was asked for" — the bar we want for TTL
--     extension.
--
--   - last_accessed_at < NOW() - INTERVAL '1 day' — day-gate against
--     write amplification. A hot conversation surfacing in 50 recalls a
--     day still only writes once.
--
-- The CTE writes as a side effect of the SELECT — atomic with the read,
-- single round trip, no separate UPDATE call from the edge function.
-- Data-modifying CTEs always execute even when their output isn't used
-- by the outer SELECT.
--
-- LANGUAGE change: was STABLE (read-only), now VOLATILE (writes). STABLE
-- promised the function wouldn't modify data, which is no longer true. No
-- plan-cache reuse penalty in practice because each call has a unique
-- p_query_embedding anyway.

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
VOLATILE
SECURITY DEFINER
SET search_path = public
SET hnsw.iterative_scan = 'strict_order'
SET hnsw.ef_search = '100'
AS $$
  WITH matches AS (
    SELECT
      c.id,
      c.title,
      c.message_count,
      c.created_at,
      c.updated_at,
      (1 - (c.embedding <=> p_query_embedding))::real AS similarity,
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
    LIMIT GREATEST(1, LEAST(p_match_limit, 25))
  ),
  bumped AS (
    -- Side-effect CTE: bumps last_accessed_at on high-confidence matches
    -- whose last bump was >1 day ago. Result is discarded; only the
    -- write matters. Data-modifying CTEs always execute.
    UPDATE public.ai_conversations
    SET last_accessed_at = NOW()
    WHERE id IN (
        SELECT id FROM matches WHERE similarity >= 0.5
      )
      AND last_accessed_at < NOW() - INTERVAL '1 day'
    RETURNING id
  )
  SELECT * FROM matches;
$$;

COMMENT ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) IS
  'Vector-search RPC for recall_conversations(action=search). p_query_embedding must use taskType=RETRIEVAL_QUERY. Returns top-K matches by cosine similarity (cap 25). Bumps last_accessed_at on matches with similarity>=0.5 + last_accessed_at older than 1 day (TTL extension via use). pgvector 0.8 iterative_scan=strict_order for correct cross-user filtering at scale.';

REVOKE EXECUTE ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) TO service_role;
