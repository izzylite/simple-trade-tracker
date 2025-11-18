-- Migration: Add tags array to notes table
-- Created: 2025-11-18
-- Description: Adds tags column to notes table to support categorization and filtering,
--              particularly for AGENT_MEMORY tag used by the AI trading agent.

-- Step 1: Add tags column (TEXT array, same as trades table)
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}' NOT NULL;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN public.notes.tags IS 'Array of tags for categorizing and filtering notes. Commonly used tags: AGENT_MEMORY (AI persistent memory), STRATEGY, GAME_PLAN, INSIGHT, LESSON_LEARNED';

-- Step 3: Create GIN index for efficient tag queries (same pattern as trades)
CREATE INDEX IF NOT EXISTS idx_notes_tags
  ON public.notes USING GIN(tags);

-- Step 4: Create index for filtering by specific tags in calendar context
CREATE INDEX IF NOT EXISTS idx_notes_calendar_tags
  ON public.notes(calendar_id, updated_at DESC)
  WHERE 'AGENT_MEMORY' = ANY(tags);

-- Step 5: Create index for AI assistant notes with tags
CREATE INDEX IF NOT EXISTS idx_notes_assistant_tags
  ON public.notes(calendar_id, by_assistant)
  WHERE by_assistant = true AND tags IS NOT NULL AND array_length(tags, 1) > 0;

-- Step 6: Update existing AI memory notes to have AGENT_MEMORY tag
UPDATE public.notes
SET tags = ARRAY['AGENT_MEMORY']
WHERE by_assistant = true
  AND title ILIKE '%Trading Agent Memory%'
  AND (tags IS NULL OR array_length(tags, 1) = 0 OR NOT ('AGENT_MEMORY' = ANY(tags)));

-- Step 7: Add helpful comment about common tag patterns
COMMENT ON TABLE public.notes IS 'Notes table - stores user and AI-created notes with optional reminder functionality and tag-based categorization. Tag patterns: AGENT_MEMORY (AI memory), STRATEGY (trading strategies), GAME_PLAN (daily/weekly plans), INSIGHT (discovered patterns), LESSON_LEARNED (mistakes/learnings).';
