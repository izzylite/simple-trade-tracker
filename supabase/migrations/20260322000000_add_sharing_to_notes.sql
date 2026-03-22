-- Add sharing columns to notes table
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS share_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_link TEXT,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

-- Index for public lookups by share_id
CREATE INDEX IF NOT EXISTS idx_notes_share_id ON notes (share_id) WHERE share_id IS NOT NULL;
