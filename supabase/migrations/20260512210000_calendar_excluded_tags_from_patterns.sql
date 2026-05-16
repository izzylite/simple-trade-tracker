-- Replace the dead `score_settings` blob with a focused column for the only
-- setting still in use: tags excluded from tag-pattern analysis on the
-- Performance page. The scoring feature (ScoreSection) was removed; nothing
-- else read `score_settings`.

ALTER TABLE calendars
  ADD COLUMN IF NOT EXISTS excluded_tags_from_patterns TEXT[] DEFAULT '{}';

-- Best-effort backfill from the old JSONB blob (no-op if absent/empty).
UPDATE calendars
SET excluded_tags_from_patterns = ARRAY(
  SELECT jsonb_array_elements_text(score_settings -> 'excludedTagsFromPatterns')
)
WHERE score_settings ? 'excludedTagsFromPatterns'
  AND jsonb_typeof(score_settings -> 'excludedTagsFromPatterns') = 'array';

ALTER TABLE calendars DROP COLUMN IF EXISTS score_settings;
