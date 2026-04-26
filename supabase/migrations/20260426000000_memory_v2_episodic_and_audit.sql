-- Memory v2: episodic event log + destructive-op audit trail.
--
-- Adds two sibling concerns to the existing AGENT_MEMORY note:
--
--   1. agent_memory_events — append-only, time-stamped record of *what
--      happened* (user corrections, rule changes, pattern observations).
--      Lets the agent answer "have we discussed X / what changed last week"
--      without scraping chat history. Pruned at 180 days by a future cron.
--
--   2. memory_audit — paper trail for destructive memory ops (UPDATE /
--      REMOVE / COMPACT). Bounded at 100 rows per (user, calendar) via
--      an after-insert trigger so it stays small enough for ad-hoc
--      debugging without becoming a storage problem.
--
-- Both tables are scoped by (user_id, calendar_id) and FK'd to
-- public.users / public.calendars per the project convention
-- (see 20260418000000_create_orion_tasks.sql for the pattern).

-- ============================================================
-- 1. Episodic event types — soft enum for typo prevention.
-- ============================================================

CREATE TYPE public.agent_memory_event_type AS ENUM (
  'pattern_observed',     -- agent inferred a recurring pattern from data
  'user_correction',      -- user corrected something the agent claimed
  'strategy_discussion',  -- discussed a strategy / setup / rule
  'decision_made',        -- explicit choice agreed in conversation
  'rule_changed'          -- user changed an existing rule (stop, size, etc.)
);

-- ============================================================
-- 2. agent_memory_events
-- ============================================================

CREATE TABLE public.agent_memory_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  calendar_id UUID NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type  public.agent_memory_event_type NOT NULL,
  summary     TEXT NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Single sentence — guard against the agent dumping paragraphs into
  -- summary. 500 chars is enough for any reasonable one-liner and prevents
  -- the table from becoming a chat-log replica.
  CONSTRAINT agent_memory_events_summary_length CHECK (
    char_length(summary) BETWEEN 1 AND 500
  ),
  CONSTRAINT agent_memory_events_metadata_is_object CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

-- Most queries are "recent events for this calendar, optionally filtered by
-- type or tag" — index supports that shape directly.
CREATE INDEX idx_agent_memory_events_user_calendar_time
  ON public.agent_memory_events (user_id, calendar_id, occurred_at DESC);

CREATE INDEX idx_agent_memory_events_tags
  ON public.agent_memory_events USING GIN (tags);

-- RLS: users can read their own events; writes are service-role only,
-- mirroring how the AGENT_MEMORY note is written exclusively by the
-- update_memory tool path (no direct user inserts).
ALTER TABLE public.agent_memory_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events"
  ON public.agent_memory_events FOR SELECT
  USING (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policies — service role bypasses RLS.

COMMENT ON TABLE public.agent_memory_events IS
  'Episodic memory: time-stamped record of agent-user interactions. Append-only, pruned at 180d.';
COMMENT ON COLUMN public.agent_memory_events.summary IS
  'Single-sentence past-tense description (e.g. "User changed daily stop from $200 to $150").';
COMMENT ON COLUMN public.agent_memory_events.metadata IS
  'Optional structured context: {trade_ids, source_note_id, confidence, ...}.';

-- ============================================================
-- 3. memory_audit
-- ============================================================

CREATE TYPE public.memory_audit_op AS ENUM (
  'UPDATE',    -- bullet text replaced
  'REMOVE',    -- bullet deleted
  'COMPACT',   -- size-driven drop of low-score bullets
  'REPLACE_SECTION'  -- ACTIVE_FOCUS section bulk-replaced
);

CREATE TABLE public.memory_audit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  calendar_id UUID NOT NULL,
  op          public.memory_audit_op NOT NULL,
  section     TEXT NOT NULL,
  before_text TEXT,
  after_text  TEXT,
  match_score REAL,            -- jaccard for UPDATE/REMOVE; NULL for COMPACT/REPLACE_SECTION
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No FKs on user_id/calendar_id by design — audit rows should outlive the
-- target row's deletion so we can still investigate "what was that calendar?"
-- after a cascade. They get pruned by the cap-100 trigger anyway.

CREATE INDEX idx_memory_audit_recent
  ON public.memory_audit (user_id, calendar_id, created_at DESC);

-- Service-role only; this is internal debugging infra.
ALTER TABLE public.memory_audit ENABLE ROW LEVEL SECURITY;
-- No policies — any frontend read attempt returns zero rows.

COMMENT ON TABLE public.memory_audit IS
  'Audit trail of destructive memory ops. Capped at 100 rows per (user, calendar) by trigger.';

-- ============================================================
-- 4. Cap memory_audit at 100 rows per (user, calendar).
-- ============================================================
-- After every INSERT, delete the oldest rows beyond the 100 most recent
-- for that (user_id, calendar_id) pair. Keeps the table bounded without
-- needing a periodic job. The DELETE is scoped tightly so it's cheap
-- (uses idx_memory_audit_recent).

CREATE OR REPLACE FUNCTION public.cap_memory_audit_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.memory_audit
  WHERE id IN (
    SELECT id
    FROM public.memory_audit
    WHERE user_id = NEW.user_id
      AND calendar_id = NEW.calendar_id
    ORDER BY created_at DESC, id DESC  -- id tiebreaker for determinism
    OFFSET 100
  );
  RETURN NULL;  -- AFTER trigger, return value ignored
END;
$$;

CREATE TRIGGER cap_memory_audit_rows_trigger
  AFTER INSERT ON public.memory_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.cap_memory_audit_rows();

COMMENT ON FUNCTION public.cap_memory_audit_rows IS
  'Keeps memory_audit at 100 rows per (user, calendar). Fires after every INSERT.';
