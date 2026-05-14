-- ============================================================
-- Reminders: batch_id for grouping reminders scheduled together
-- ============================================================
--
-- When manage_reminder(action="set") schedules >1 reminder in one call
-- (polling loops, multi-event batches), every row in that call gets the
-- same batch_id (UUID generated server-side). Solo reminders keep
-- batch_id = NULL.
--
-- Use cases:
--   1) Sibling-awareness at fire time — query for siblings sharing
--      batch_id to tell Orion "fire N of M, M-N remaining".
--   2) Atomic batch cancel — manage_reminder(action="cancel", batch_id)
--      cancels every pending row in the batch without touching unrelated
--      reminders the user has in the same conversation.
-- ============================================================

ALTER TABLE public.reminders
  ADD COLUMN batch_id UUID NULL;

-- Partial index for (1) fire-time sibling lookup and (2) batch cancel.
-- Pending-only because batch operations only care about future fires.
CREATE INDEX idx_reminders_batch_pending
  ON public.reminders(batch_id)
  WHERE status = 'pending' AND batch_id IS NOT NULL;

COMMENT ON COLUMN public.reminders.batch_id IS
  'Groups reminders scheduled together in a single manage_reminder(set) call. NULL for solo reminders. Server-assigned UUID; clients must not set this.';
