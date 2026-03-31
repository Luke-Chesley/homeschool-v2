CREATE TYPE "organization_type" AS ENUM ('household', 'tutor_practice', 'co_op', 'school_like');
CREATE TYPE "membership_role" AS ENUM ('owner', 'admin', 'educator', 'observer');
CREATE TYPE "learner_status" AS ENUM ('active', 'paused', 'archived');
CREATE TYPE "learning_goal_status" AS ENUM ('draft', 'active', 'completed', 'archived');
CREATE TYPE "curriculum_source_kind" AS ENUM ('upload', 'manual', 'ai_draft', 'external_link');
CREATE TYPE "curriculum_source_status" AS ENUM ('draft', 'active', 'archived', 'failed_import');
CREATE TYPE "curriculum_asset_status" AS ENUM ('pending', 'processing', 'ready', 'failed');
CREATE TYPE "curriculum_item_type" AS ENUM ('course', 'unit', 'lesson', 'activity', 'resource');
CREATE TYPE "curriculum_route_node_type" AS ENUM ('domain', 'strand', 'goal_group', 'skill');
CREATE TYPE "curriculum_route_prerequisite_kind" AS ENUM ('explicit', 'inferred');
CREATE TYPE "learner_branch_activation_status" AS ENUM ('active', 'paused', 'completed');
CREATE TYPE "learner_skill_state_status" AS ENUM ('not_started', 'recommended', 'scheduled', 'in_progress', 'completed', 'mastered', 'blocked', 'paused', 'skipped', 'out_of_sequence');
CREATE TYPE "weekly_route_status" AS ENUM ('draft', 'active', 'superseded', 'archived');
CREATE TYPE "weekly_route_item_state" AS ENUM ('queued', 'scheduled', 'in_progress', 'done', 'removed');
CREATE TYPE "weekly_route_override_kind" AS ENUM ('none', 'reordered', 'pinned', 'deferred', 'skip_acknowledged');
CREATE TYPE "route_override_event_type" AS ENUM ('reorder', 'pin', 'defer', 'skip_acknowledged', 'repair_applied', 'remove_from_week');
CREATE TYPE "plan_item_curriculum_origin" AS ENUM ('manual', 'curriculum_route', 'recovery', 'review');
CREATE TYPE "plan_status" AS ENUM ('draft', 'active', 'archived', 'completed');
CREATE TYPE "plan_day_status" AS ENUM ('planned', 'in_progress', 'completed', 'skipped');
CREATE TYPE "plan_item_status" AS ENUM ('planned', 'ready', 'completed', 'skipped', 'carried_over');
CREATE TYPE "lesson_session_status" AS ENUM ('planned', 'in_progress', 'completed', 'abandoned');
CREATE TYPE "generated_artifact_type" AS ENUM ('lesson_plan', 'worksheet', 'quiz', 'rubric', 'explanation', 'extension', 'simplified_version', 'interactive_blueprint');
CREATE TYPE "generated_artifact_status" AS ENUM ('queued', 'generating', 'ready', 'failed');
CREATE TYPE "interactive_activity_type" AS ENUM ('quiz', 'matching', 'flashcards', 'sequencing', 'guided_practice', 'reflection', 'reading_check', 'simulation');
CREATE TYPE "interactive_activity_status" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "activity_attempt_status" AS ENUM ('in_progress', 'submitted', 'graded', 'abandoned');
CREATE TYPE "progress_record_status" AS ENUM ('not_started', 'in_progress', 'completed', 'mastered', 'needs_review');
CREATE TYPE "observation_note_type" AS ENUM ('general', 'behavior', 'mastery', 'adaptation_signal');
CREATE TYPE "conversation_scope_type" AS ENUM ('organization', 'learner', 'plan', 'plan_day', 'lesson_session');
CREATE TYPE "conversation_role" AS ENUM ('system', 'user', 'assistant', 'tool');
CREATE TYPE "copilot_action_status" AS ENUM ('queued', 'running', 'completed', 'failed');
CREATE TYPE "recommendation_status" AS ENUM ('proposed', 'accepted', 'dismissed', 'applied');

CREATE TABLE "adult_users" (
  "id" text PRIMARY KEY NOT NULL,
  "auth_user_id" text NOT NULL,
  "email" text NOT NULL,
  "full_name" text,
  "avatar_url" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "adult_users_auth_user_id_idx" ON "adult_users" ("auth_user_id");
CREATE UNIQUE INDEX "adult_users_email_idx" ON "adult_users" ("email");

CREATE TABLE "organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "type" "organization_type" NOT NULL,
  "timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" ("slug");

CREATE TABLE "memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "adult_user_id" text NOT NULL REFERENCES "adult_users"("id") ON DELETE CASCADE,
  "role" "membership_role" NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "memberships_org_adult_idx" ON "memberships" ("organization_id", "adult_user_id");

CREATE TABLE "learners" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "first_name" text NOT NULL,
  "last_name" text,
  "display_name" text NOT NULL,
  "date_of_birth" date,
  "timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
  "status" "learner_status" DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "learner_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "grade_level" text,
  "reading_level" text,
  "support_needs" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "interests" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "schedule_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "learner_profiles_learner_idx" ON "learner_profiles" ("learner_id");

CREATE TABLE "learning_goals" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "subject" text,
  "target_date" date,
  "status" "learning_goal_status" DEFAULT 'draft' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "standard_frameworks" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "version" text,
  "jurisdiction" text,
  "subject" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "standard_nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "framework_id" text NOT NULL REFERENCES "standard_frameworks"("id") ON DELETE CASCADE,
  "parent_id" text REFERENCES "standard_nodes"("id") ON DELETE SET NULL,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "grade_band" text,
  "subject" text,
  "depth" integer DEFAULT 0 NOT NULL,
  "ordering" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "standard_nodes_framework_code_idx" ON "standard_nodes" ("framework_id", "code");

CREATE TABLE "goal_mappings" (
  "id" text PRIMARY KEY NOT NULL,
  "learning_goal_id" text NOT NULL REFERENCES "learning_goals"("id") ON DELETE CASCADE,
  "standard_node_id" text NOT NULL REFERENCES "standard_nodes"("id") ON DELETE CASCADE,
  "source" text DEFAULT 'manual' NOT NULL,
  "rationale" text,
  "confidence" integer DEFAULT 100 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "goal_mappings_goal_standard_idx" ON "goal_mappings" ("learning_goal_id", "standard_node_id");

CREATE TABLE "curriculum_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "learner_id" text REFERENCES "learners"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "kind" "curriculum_source_kind" NOT NULL,
  "status" "curriculum_source_status" DEFAULT 'draft' NOT NULL,
  "import_version" integer DEFAULT 1 NOT NULL,
  "provenance" text,
  "summary" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "curriculum_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "storage_bucket" text NOT NULL,
  "storage_path" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "status" "curriculum_asset_status" DEFAULT 'pending' NOT NULL,
  "extracted_text" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "curriculum_items" (
  "id" text PRIMARY KEY NOT NULL,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "learner_id" text REFERENCES "learners"("id") ON DELETE SET NULL,
  "parent_item_id" text REFERENCES "curriculum_items"("id") ON DELETE SET NULL,
  "item_type" "curriculum_item_type" NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "subject" text,
  "estimated_minutes" integer,
  "position" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "curriculum_item_standards" (
  "id" text PRIMARY KEY NOT NULL,
  "curriculum_item_id" text NOT NULL REFERENCES "curriculum_items"("id") ON DELETE CASCADE,
  "standard_node_id" text NOT NULL REFERENCES "standard_nodes"("id") ON DELETE CASCADE,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "curriculum_item_standards_unique_idx" ON "curriculum_item_standards" ("curriculum_item_id", "standard_node_id");

CREATE TABLE "curriculum_nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "parent_node_id" text REFERENCES "curriculum_nodes"("id") ON DELETE SET NULL,
  "normalized_type" "curriculum_route_node_type" NOT NULL,
  "title" text NOT NULL,
  "code" text,
  "description" text,
  "sequence_index" integer DEFAULT 0 NOT NULL,
  "depth" integer DEFAULT 0 NOT NULL,
  "normalized_path" text NOT NULL,
  "original_label" text,
  "original_type" text,
  "estimated_minutes" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "source_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "curriculum_nodes_source_path_idx" ON "curriculum_nodes" ("source_id", "normalized_path");

CREATE TABLE "curriculum_skill_prerequisites" (
  "id" text PRIMARY KEY NOT NULL,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "skill_node_id" text NOT NULL REFERENCES "curriculum_nodes"("id") ON DELETE CASCADE,
  "prerequisite_skill_node_id" text NOT NULL REFERENCES "curriculum_nodes"("id") ON DELETE CASCADE,
  "kind" "curriculum_route_prerequisite_kind" DEFAULT 'explicit' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "curriculum_skill_prerequisites_unique_idx" ON "curriculum_skill_prerequisites" ("skill_node_id", "prerequisite_skill_node_id");

CREATE TABLE "learner_route_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "target_items_per_day" integer DEFAULT 1 NOT NULL,
  "target_minutes_per_day" integer,
  "branch_weighting" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "planning_days" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "learner_route_profiles_learner_source_idx" ON "learner_route_profiles" ("learner_id", "source_id");

CREATE TABLE "learner_branch_activations" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "node_id" text NOT NULL REFERENCES "curriculum_nodes"("id") ON DELETE CASCADE,
  "status" "learner_branch_activation_status" DEFAULT 'active' NOT NULL,
  "started_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "learner_branch_activations_unique_idx" ON "learner_branch_activations" ("learner_id", "node_id");

CREATE TABLE "learner_skill_states" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "skill_node_id" text NOT NULL REFERENCES "curriculum_nodes"("id") ON DELETE CASCADE,
  "status" "learner_skill_state_status" DEFAULT 'not_started' NOT NULL,
  "status_reason" text,
  "first_scheduled_at" timestamp with time zone,
  "last_scheduled_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "mastered_at" timestamp with time zone,
  "last_activity_attempt_id" text,
  "last_outcome_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "learner_skill_states_learner_skill_idx" ON "learner_skill_states" ("learner_id", "skill_node_id");

CREATE TABLE "weekly_routes" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "week_start_date" date NOT NULL,
  "generation_version" text DEFAULT '1' NOT NULL,
  "generation_basis" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "weekly_route_status" DEFAULT 'draft' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "weekly_routes_learner_source_week_idx" ON "weekly_routes" ("learner_id", "source_id", "week_start_date");

CREATE TABLE "weekly_route_items" (
  "id" text PRIMARY KEY NOT NULL,
  "weekly_route_id" text NOT NULL REFERENCES "weekly_routes"("id") ON DELETE CASCADE,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "skill_node_id" text NOT NULL REFERENCES "curriculum_nodes"("id") ON DELETE CASCADE,
  "recommended_position" integer DEFAULT 0 NOT NULL,
  "current_position" integer DEFAULT 0 NOT NULL,
  "scheduled_date" date,
  "manual_override_kind" "weekly_route_override_kind" DEFAULT 'none' NOT NULL,
  "manual_override_note" text,
  "state" "weekly_route_item_state" DEFAULT 'queued' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "weekly_route_items_route_skill_idx" ON "weekly_route_items" ("weekly_route_id", "skill_node_id");

CREATE TABLE "route_override_events" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "weekly_route_item_id" text NOT NULL REFERENCES "weekly_route_items"("id") ON DELETE CASCADE,
  "event_type" "route_override_event_type" NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by_adult_user_id" text REFERENCES "adult_users"("id") ON DELETE SET NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "plans" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "status" "plan_status" DEFAULT 'draft' NOT NULL,
  "start_date" date,
  "end_date" date,
  "version_label" text,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "plan_weeks" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_id" text NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
  "week_index" integer NOT NULL,
  "week_start_date" date,
  "week_end_date" date,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "plan_weeks_plan_idx" ON "plan_weeks" ("plan_id", "week_index");

CREATE TABLE "plan_days" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_id" text NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
  "plan_week_id" text REFERENCES "plan_weeks"("id") ON DELETE SET NULL,
  "date" date NOT NULL,
  "status" "plan_day_status" DEFAULT 'planned' NOT NULL,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "plan_days_plan_date_idx" ON "plan_days" ("plan_id", "date");

CREATE TABLE "plan_items" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_id" text NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
  "plan_day_id" text NOT NULL REFERENCES "plan_days"("id") ON DELETE CASCADE,
  "curriculum_item_id" text REFERENCES "curriculum_items"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "description" text,
  "subject" text,
  "status" "plan_item_status" DEFAULT 'planned' NOT NULL,
  "scheduled_date" date,
  "estimated_minutes" integer,
  "ordering" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "plan_item_standards" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_item_id" text NOT NULL REFERENCES "plan_items"("id") ON DELETE CASCADE,
  "standard_node_id" text NOT NULL REFERENCES "standard_nodes"("id") ON DELETE CASCADE,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "plan_item_standards_unique_idx" ON "plan_item_standards" ("plan_item_id", "standard_node_id");

CREATE TABLE "plan_item_curriculum_links" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_item_id" text NOT NULL REFERENCES "plan_items"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL REFERENCES "curriculum_sources"("id") ON DELETE CASCADE,
  "skill_node_id" text NOT NULL REFERENCES "curriculum_nodes"("id") ON DELETE CASCADE,
  "weekly_route_item_id" text REFERENCES "weekly_route_items"("id") ON DELETE SET NULL,
  "origin" "plan_item_curriculum_origin" DEFAULT 'curriculum_route' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "plan_item_curriculum_links_plan_item_idx" ON "plan_item_curriculum_links" ("plan_item_id");
CREATE UNIQUE INDEX "plan_item_curriculum_links_weekly_item_idx" ON "plan_item_curriculum_links" ("weekly_route_item_id");

CREATE TABLE "lesson_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "plan_item_id" text NOT NULL REFERENCES "plan_items"("id") ON DELETE CASCADE,
  "session_date" date NOT NULL,
  "status" "lesson_session_status" DEFAULT 'planned' NOT NULL,
  "actual_minutes" integer,
  "summary" text,
  "notes" text,
  "deviation_reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "generated_artifacts" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "learner_id" text REFERENCES "learners"("id") ON DELETE SET NULL,
  "plan_item_id" text REFERENCES "plan_items"("id") ON DELETE SET NULL,
  "lesson_session_id" text REFERENCES "lesson_sessions"("id") ON DELETE SET NULL,
  "artifact_type" "generated_artifact_type" NOT NULL,
  "title" text NOT NULL,
  "status" "generated_artifact_status" DEFAULT 'queued' NOT NULL,
  "body" text,
  "prompt_version" text,
  "lineage_parent_id" text REFERENCES "generated_artifacts"("id") ON DELETE SET NULL,
  "source_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "interactive_activities" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "learner_id" text REFERENCES "learners"("id") ON DELETE SET NULL,
  "plan_item_id" text REFERENCES "plan_items"("id") ON DELETE SET NULL,
  "lesson_session_id" text REFERENCES "lesson_sessions"("id") ON DELETE SET NULL,
  "artifact_id" text REFERENCES "generated_artifacts"("id") ON DELETE SET NULL,
  "activity_type" "interactive_activity_type" NOT NULL,
  "status" "interactive_activity_status" DEFAULT 'draft' NOT NULL,
  "title" text NOT NULL,
  "schema_version" text DEFAULT '1' NOT NULL,
  "definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "mastery_rubric" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "activity_standards" (
  "id" text PRIMARY KEY NOT NULL,
  "activity_id" text NOT NULL REFERENCES "interactive_activities"("id") ON DELETE CASCADE,
  "standard_node_id" text NOT NULL REFERENCES "standard_nodes"("id") ON DELETE CASCADE,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "activity_standards_unique_idx" ON "activity_standards" ("activity_id", "standard_node_id");

CREATE TABLE "activity_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "activity_id" text NOT NULL REFERENCES "interactive_activities"("id") ON DELETE CASCADE,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "lesson_session_id" text REFERENCES "lesson_sessions"("id") ON DELETE SET NULL,
  "status" "activity_attempt_status" DEFAULT 'in_progress' NOT NULL,
  "attempt_number" integer DEFAULT 1 NOT NULL,
  "score_percent" integer,
  "responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" text,
  "submitted_at" text,
  "completed_at" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "learner_skill_states"
  ADD CONSTRAINT "learner_skill_states_last_activity_attempt_id_fkey"
  FOREIGN KEY ("last_activity_attempt_id")
  REFERENCES "activity_attempts"("id")
  ON DELETE SET NULL;

CREATE TABLE "progress_records" (
  "id" text PRIMARY KEY NOT NULL,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "plan_item_id" text REFERENCES "plan_items"("id") ON DELETE SET NULL,
  "lesson_session_id" text REFERENCES "lesson_sessions"("id") ON DELETE SET NULL,
  "activity_attempt_id" text REFERENCES "activity_attempts"("id") ON DELETE SET NULL,
  "status" "progress_record_status" DEFAULT 'not_started' NOT NULL,
  "mastery_level" text,
  "completion_percent" integer,
  "time_spent_minutes" integer,
  "parent_note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "progress_record_standards" (
  "id" text PRIMARY KEY NOT NULL,
  "progress_record_id" text NOT NULL REFERENCES "progress_records"("id") ON DELETE CASCADE,
  "standard_node_id" text NOT NULL REFERENCES "standard_nodes"("id") ON DELETE CASCADE,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "progress_record_standards_unique_idx" ON "progress_record_standards" ("progress_record_id", "standard_node_id");

CREATE TABLE "observation_notes" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "plan_item_id" text REFERENCES "plan_items"("id") ON DELETE SET NULL,
  "lesson_session_id" text REFERENCES "lesson_sessions"("id") ON DELETE SET NULL,
  "author_adult_user_id" text REFERENCES "adult_users"("id") ON DELETE SET NULL,
  "note_type" "observation_note_type" DEFAULT 'general' NOT NULL,
  "body" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "conversation_threads" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "learner_id" text REFERENCES "learners"("id") ON DELETE SET NULL,
  "plan_id" text REFERENCES "plans"("id") ON DELETE SET NULL,
  "plan_day_id" text REFERENCES "plan_days"("id") ON DELETE SET NULL,
  "lesson_session_id" text REFERENCES "lesson_sessions"("id") ON DELETE SET NULL,
  "scope_type" "conversation_scope_type" NOT NULL,
  "title" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "conversation_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL REFERENCES "conversation_threads"("id") ON DELETE CASCADE,
  "role" "conversation_role" NOT NULL,
  "author_adult_user_id" text REFERENCES "adult_users"("id") ON DELETE SET NULL,
  "content" text NOT NULL,
  "structured_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "model" text,
  "prompt_version" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "copilot_actions" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL REFERENCES "conversation_threads"("id") ON DELETE CASCADE,
  "message_id" text REFERENCES "conversation_messages"("id") ON DELETE SET NULL,
  "action_type" text NOT NULL,
  "status" "copilot_action_status" DEFAULT 'queued' NOT NULL,
  "target_type" text,
  "target_id" text,
  "input" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "adaptation_insights" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "plan_id" text REFERENCES "plans"("id") ON DELETE SET NULL,
  "lesson_session_id" text REFERENCES "lesson_sessions"("id") ON DELETE SET NULL,
  "signal_type" text NOT NULL,
  "summary" text NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "recommendations" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "learner_id" text NOT NULL REFERENCES "learners"("id") ON DELETE CASCADE,
  "insight_id" text REFERENCES "adaptation_insights"("id") ON DELETE SET NULL,
  "recommendation_type" text NOT NULL,
  "status" "recommendation_status" DEFAULT 'proposed' NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "accepted_at" text,
  "dismissed_at" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
