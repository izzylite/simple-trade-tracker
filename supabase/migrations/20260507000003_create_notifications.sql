-- ============================================================
-- Notifications: cross-surface event log for the user inbox
-- ============================================================
--
-- A notification is a UI-visible signal that something happened the user
-- should know about, even if they were not looking at the originating
-- surface when it happened. v1 covers reminder fires (`type='reminder_fired'`)
-- so the notification layer can surface "Orion replied in another thread"
-- without the user keeping that thread open. The schema accommodates future
-- types (trade_alert, share_invite, weekly_recap) without migration.
--
-- Per-user cap: 100 rows. A trigger evicts oldest on insert.
-- ============================================================

CREATE TABLE public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at       TIMESTAMPTZ,
  dismissed_at  TIMESTAMPTZ,

  CONSTRAINT notifications_title_length
    CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT notifications_type_length
    CHECK (char_length(type) BETWEEN 1 AND 64)
);

-- Bell-list query: per-user, newest first. Powers both list fetch and the
-- cap-trim subquery below.
CREATE INDEX idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- Unread-count query: filtered partial index keeps it cheap.
CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id)
  WHERE read_at IS NULL;

-- ============================================================
-- 100-row cap per user. Fires after insert, deletes anything past row 100
-- ordered by created_at DESC for the affected user.
-- ============================================================
CREATE OR REPLACE FUNCTION public.trim_notifications_to_cap()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = NEW.user_id
    AND id IN (
      SELECT id FROM public.notifications
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      OFFSET 100
    );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trim_notifications_to_cap
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trim_notifications_to_cap();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own.
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users update their own (mark read, dismiss).
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users delete their own (clear-all uses a bulk delete from the client).
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- INSERT is intentionally NOT granted to authed users. Notifications are
-- written exclusively by service-role code paths (reminder fire path,
-- future event producers). A user-facing "create notification" is a
-- design smell — events drive notifications, not vice versa.

-- ============================================================
-- Realtime publication so the inbox updates without a refetch
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

COMMENT ON TABLE public.notifications IS
  'Per-user cross-surface event log. Capped at 100 rows per user via trigger. v1 producer: reminder fire path in ai-trading-agent.';
