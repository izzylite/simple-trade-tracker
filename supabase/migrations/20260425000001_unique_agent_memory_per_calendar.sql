-- Enforce one AGENT_MEMORY note per (user_id, calendar_id).
--
-- Background: orionMemory.ts treats memory as a singleton per calendar
-- (.single() on fetch, append-merge on write). If two concurrent sessions
-- both miss the row and call createInitialMemory in parallel, we end up
-- with two AGENT_MEMORY rows and every subsequent updateMemory throws
-- PGRST116 ("multiple rows returned"). This index makes that race fail
-- loudly at the second insert so the writer can fall back to merge.
--
-- The index is partial because AGENT_MEMORY is one of many tag values; the
-- uniqueness constraint must only apply to rows that contain it.

-- Drop any duplicate AGENT_MEMORY rows before adding the index. Keeps the
-- earliest-created row (oldest content is most-merged) and removes the rest.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, calendar_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM notes
  WHERE 'AGENT_MEMORY' = ANY(tags)
)
DELETE FROM notes
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS notes_agent_memory_singleton_idx
  ON notes (user_id, calendar_id)
  WHERE 'AGENT_MEMORY' = ANY(tags);

COMMENT ON INDEX notes_agent_memory_singleton_idx IS
  'Enforces one AGENT_MEMORY note per (user, calendar). See updateMemory in ai-trading-agent/tools.ts.';
