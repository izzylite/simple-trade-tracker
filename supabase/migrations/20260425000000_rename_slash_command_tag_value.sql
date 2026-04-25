-- ============================================================================
-- Rename the slash-command note tag value: 'SlashCommand' -> 'SLASH_COMMAND'
-- ============================================================================
--
-- Context:
--   The frontend (`src/types/note.ts`) and edge functions
--   (`supabase/functions/_shared/noteTags.ts`) both treat the slash-command
--   tag value as `SLASH_COMMAND` to match the SCREAMING_SNAKE_CASE naming of
--   every other system tag (GUIDELINE, GAME_PLAN, LESSON_LEARNED, ...).
--
--   Existing rows in `public.notes` were written with the old camelCase
--   value `SlashCommand`. Without this migration, those notes would no
--   longer be recognized as slash-command notes by the chat input's "/"
--   popup or by Orion's create/update/delete permission checks.
--
-- Effect:
--   For every notes row whose `tags` array contains the exact string
--   'SlashCommand', replace that element in-place with 'SLASH_COMMAND'.
--   Leaves all other tags on the row untouched.
--
-- Idempotency:
--   Safe to run repeatedly. After a successful run, the WHERE clause
--   matches no rows so reruns are no-ops.
-- ============================================================================

UPDATE public.notes
SET tags = array_replace(tags, 'SlashCommand', 'SLASH_COMMAND')
WHERE 'SlashCommand' = ANY(tags);
