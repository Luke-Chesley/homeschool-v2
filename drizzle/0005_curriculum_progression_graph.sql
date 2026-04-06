-- Migration: curriculum progression graph
-- Adds structured progression support to the curriculum model:
--   1. New enum values for prerequisite kinds (hard, soft, revisit, co-practice)
--   2. curriculum_phases table for progression phase membership
--   3. curriculum_phase_nodes join table

-- Extend the prerequisite kind enum with progression-aware edge types
ALTER TYPE "curriculum_route_prerequisite_kind"
  ADD VALUE IF NOT EXISTS 'hardPrerequisite';
ALTER TYPE "curriculum_route_prerequisite_kind"
  ADD VALUE IF NOT EXISTS 'recommendedBefore';
ALTER TYPE "curriculum_route_prerequisite_kind"
  ADD VALUE IF NOT EXISTS 'revisitAfter';
ALTER TYPE "curriculum_route_prerequisite_kind"
  ADD VALUE IF NOT EXISTS 'coPractice';

-- Phases group skills into pedagogical progression bands
CREATE TABLE IF NOT EXISTS "curriculum_phases" (
  "id" text PRIMARY KEY NOT NULL,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "position" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "curriculum_phases_source_idx"
  ON "curriculum_phases" ("source_id");

-- Phase membership: which skills belong to which phase
CREATE TABLE IF NOT EXISTS "curriculum_phase_nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "phase_id" text NOT NULL REFERENCES "curriculum_phases"("id") ON DELETE CASCADE,
  "curriculum_node_id" text NOT NULL REFERENCES "curriculum_nodes"("id") ON DELETE CASCADE,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_phase_node_idx"
  ON "curriculum_phase_nodes" ("phase_id", "curriculum_node_id");
