-- Add orion_task_results to the realtime publication so the frontend
-- postgres_changes INSERT subscription (useOrionTasks hook) fires when
-- the dispatcher creates a new result — this is what lights the red dot
-- on the Orion FAB and prepends the new card to the Tasks feed.
--
-- Wrapped in DO block to keep the migration idempotent (re-running
-- won't error if the table is already in the publication).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'orion_task_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orion_task_results;
  END IF;
END$$;
