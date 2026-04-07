-- Migration: progression state tracking
-- Makes progression absence a first-class state for every curriculum source.
-- Stores the outcome, attempt history, and provenance of each generation run.

CREATE TYPE "curriculum_progression_status" AS ENUM (
  'not_attempted',
  'explicit_ready',
  'explicit_failed',
  'fallback_only',
  'stale'
);

CREATE TYPE "curriculum_progression_provenance" AS ENUM (
  'initial_generation',
  'manual_regeneration',
  'fallback_inference'
);

CREATE TABLE IF NOT EXISTS "curriculum_progression_state" (
  "id" text PRIMARY KEY NOT NULL,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "status" "curriculum_progression_status" NOT NULL DEFAULT 'not_attempted',
  "last_attempt_at" timestamp with time zone,
  "last_failure_reason" text,
  "last_accepted_phase_count" integer NOT NULL DEFAULT 0,
  "last_accepted_edge_count" integer NOT NULL DEFAULT 0,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "using_inferred_fallback" boolean NOT NULL DEFAULT false,
  "provenance" "curriculum_progression_provenance",
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "curriculum_progression_state_source_idx"
  ON "curriculum_progression_state" ("source_id");
