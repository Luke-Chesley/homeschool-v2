-- Migration: structured activity runtime
-- Adds activity_spec type to interactive_activity_type enum and creates
-- the activity_evidence table for structured evidence capture.

-- Add new activity type value to existing enum
ALTER TYPE "interactive_activity_type" ADD VALUE IF NOT EXISTS 'activity_spec';

-- Create activity_evidence table for normalized evidence records
CREATE TABLE IF NOT EXISTS "activity_evidence" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "activity_id" text NOT NULL REFERENCES "interactive_activities"("id") ON DELETE CASCADE,
  "attempt_id" text REFERENCES "activity_attempts"("id") ON DELETE SET NULL,
  "lesson_session_id" text REFERENCES "lesson_sessions"("id") ON DELETE SET NULL,
  "component_id" text NOT NULL,
  "component_type" text NOT NULL,
  "evidence_kind" text NOT NULL,
  "value" jsonb,
  "summary" text,
  "linked_objective_ids" jsonb NOT NULL DEFAULT '[]',
  "linked_skill_ids" jsonb NOT NULL DEFAULT '[]',
  "review_state" text NOT NULL DEFAULT 'not_required',
  "captured_at" timestamptz,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Index for querying evidence by learner + activity
CREATE INDEX IF NOT EXISTS "activity_evidence_learner_activity_idx"
  ON "activity_evidence" ("learner_id", "activity_id");

-- Index for querying evidence by attempt
CREATE INDEX IF NOT EXISTS "activity_evidence_attempt_idx"
  ON "activity_evidence" ("attempt_id");

-- Index for querying evidence by lesson session
CREATE INDEX IF NOT EXISTS "activity_evidence_session_idx"
  ON "activity_evidence" ("lesson_session_id")
  WHERE "lesson_session_id" IS NOT NULL;
