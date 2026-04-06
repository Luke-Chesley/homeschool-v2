-- Migration: lesson draft ownership
-- Adds lesson_draft_fingerprint to interactive_activities so activities
-- can be tied to a specific lesson draft version rather than a plan item.
--
-- The fingerprint identifies which lesson draft content produced the activity.
-- When the draft changes materially, the fingerprint changes and the old
-- activity is detected as stale, triggering regeneration.
--
-- Existing rows get NULL (legacy activities have no draft fingerprint).

ALTER TABLE "interactive_activities"
  ADD COLUMN IF NOT EXISTS "lesson_draft_fingerprint" text;

-- Index for fast lookup by session + fingerprint (primary ownership query)
CREATE INDEX IF NOT EXISTS "interactive_activities_session_fingerprint_idx"
  ON "interactive_activities" ("lesson_session_id", "lesson_draft_fingerprint")
  WHERE "lesson_session_id" IS NOT NULL AND "lesson_draft_fingerprint" IS NOT NULL;
