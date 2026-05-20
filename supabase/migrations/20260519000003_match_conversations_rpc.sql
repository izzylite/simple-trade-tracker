-- RPC: match_conversations
--
-- Vector-search front-end for recall_conversations(action="search"). The
-- Supabase JS client doesn't expose pgvector operators (<=>, <#>, <->)
-- directly, so we wrap the query in a SECURITY DEFINER function.
--
-- Returns conversations belonging to `p_user_id`, optionally filtered by
-- `p_since_iso` (updated_at >= ...) and ranked by cosine similarity against
-- `p_query_embedding`. Higher `similarity` = better match (cosine distance
-- 0 = identical → similarity 1).
--
-- The query embedding MUST be generated with taskType=RETRIEVAL_QUERY
-- (callers in _shared/embed.ts). Documents in the column are embedded with
-- RETRIEVAL_DOCUMENT. Reusing the same task type at both ends measurably
-- degrades recall — Google trains the two asymmetrically.

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
  last_message_content TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.title,
    c.message_count,
    c.created_at,
    c.updated_at,
    -- pgvector's <=> is cosine DISTANCE (0..2). Convert to SIMILARITY (1..-1)
    -- so callers can rank descending and apply a threshold naturally.
    (1 - (c.embedding <=> p_query_embedding))::real AS similarity,
    -- Snippet of the last message for the model to skim. Stays under 300
    -- chars to keep tool-result token cost predictable.
    COALESCE(
      LEFT(
        (c.messages -> (jsonb_array_length(c.messages) - 1) ->> 'content'),
        300
      ),
      ''
    ) AS last_message_content
  FROM public.ai_conversations c
  WHERE c.user_id = p_user_id
    AND c.embedding IS NOT NULL
    AND (p_since_iso IS NULL OR c.updated_at >= p_since_iso)
    AND jsonb_array_length(COALESCE(c.messages, '[]'::jsonb)) > 0
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT GREATEST(1, LEAST(p_match_limit, 25));
$$;

COMMENT ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) IS
  'Vector-search RPC for recall_conversations(action=search). p_query_embedding must be generated with taskType=RETRIEVAL_QUERY. Returns top-K matches by cosine similarity, optionally filtered by updated_at >= p_since_iso. Hard caps match_limit to 25 to bound tool result size.';

-- Lock down execution. service_role is what edge functions use; we keep it
-- off `anon` and `authenticated` because the embedding column is internal —
-- no frontend should be running vector search directly.
REVOKE EXECUTE ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_conversations(UUID, vector, TIMESTAMPTZ, INT) TO service_role;
