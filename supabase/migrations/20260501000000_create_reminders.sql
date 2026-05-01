-- ============================================================
-- Reminders: chat-driven, time-fired AI turns bound to a conversation
-- ============================================================
--
-- A reminder is a stored "future Orion turn". The user (via Orion in
-- chat) sets one with trigger_at + instructions + conversation_id.
-- At fire time the dispatcher (or a local timer in the browser) atomically
-- claims the row via claim_reminder() and POSTs to ai-trading-agent in
-- mode='reminder', which loads the conversation history, injects a
-- reminder-aware system hint, and appends the assistant message with
-- metadata.triggered_by='reminder:<id>'.
--
-- Status flow: pending -> firing -> fired | failed | cancelled
-- ============================================================

CREATE TYPE public.reminder_status AS ENUM (
  'pending',
  'firing',
  'fired',
  'failed',
  'cancelled'
);

CREATE TABLE public.reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  trigger_at      TIMESTAMPTZ NOT NULL,
  instructions    TEXT NOT NULL,
  description     TEXT,
  status          public.reminder_status NOT NULL DEFAULT 'pending',
  fired_at        TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reminders_instructions_length
    CHECK (char_length(instructions) BETWEEN 1 AND 1000),
  CONSTRAINT reminders_description_length
    CHECK (description IS NULL OR char_length(description) <= 200),
  CONSTRAINT reminders_trigger_within_year
    CHECK (trigger_at <= created_at + INTERVAL '1 year')
);

CREATE INDEX idx_reminders_due
  ON public.reminders(trigger_at)
  WHERE status = 'pending';

CREATE INDEX idx_reminders_user_status
  ON public.reminders(user_id, status);

CREATE INDEX idx_reminders_conversation
  ON public.reminders(conversation_id);

CREATE OR REPLACE FUNCTION public.update_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reminders_updated_at_trigger
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reminders_updated_at();

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
  ON public.reminders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own reminders"
  ON public.reminders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reminders"
  ON public.reminders FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own reminders"
  ON public.reminders FOR DELETE
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;

COMMENT ON TABLE public.reminders IS
  'Chat-driven reminders that fire as Orion turns into the originating conversation.';
