DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'organization_workflow_mode'
  ) THEN
    CREATE TYPE organization_workflow_mode AS ENUM (
      'family_guided',
      'educator_led',
      'manager_led',
      'cohort_based',
      'self_guided'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'organization_reporting_mode'
  ) THEN
    CREATE TYPE organization_reporting_mode AS ENUM (
      'progress_journal',
      'standards_tracking',
      'competency_tracking',
      'certification_tracking',
      'onboarding_completion'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'organization_template'
  ) THEN
    CREATE TYPE organization_template AS ENUM (
      'homeschool',
      'tutoring_practice',
      'classroom_support',
      'workforce_onboarding',
      'certification_prep',
      'bootcamp',
      'self_guided'
    );
  END IF;
END $$;

ALTER TYPE membership_role ADD VALUE IF NOT EXISTS 'coach';
ALTER TYPE membership_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE membership_role ADD VALUE IF NOT EXISTS 'reviewer';

CREATE TABLE IF NOT EXISTS organization_platform_settings (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_mode organization_workflow_mode NOT NULL DEFAULT 'family_guided',
  reporting_mode organization_reporting_mode NOT NULL DEFAULT 'progress_journal',
  template_key organization_template NOT NULL DEFAULT 'homeschool',
  primary_guide_label text NOT NULL DEFAULT 'Parent',
  learner_label text NOT NULL DEFAULT 'Learner',
  session_label text NOT NULL DEFAULT 'Lesson',
  module_label text NOT NULL DEFAULT 'Module',
  activity_label text NOT NULL DEFAULT 'Practice',
  checkpoint_label text NOT NULL DEFAULT 'Checkpoint',
  terminology jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_platform_settings_org_idx
  ON organization_platform_settings (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'framework_type'
  ) THEN
    CREATE TYPE framework_type AS ENUM (
      'academic_standard',
      'competency_framework',
      'role_matrix',
      'exam_blueprint',
      'custom_goal'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'objective_node_type'
  ) THEN
    CREATE TYPE objective_node_type AS ENUM (
      'domain',
      'strand',
      'competency',
      'objective',
      'checkpoint'
    );
  END IF;
END $$;

ALTER TABLE standard_frameworks
  ADD COLUMN IF NOT EXISTS organization_id text REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS framework_type framework_type NOT NULL DEFAULT 'academic_standard',
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE standard_nodes
  ADD COLUMN IF NOT EXISTS objective_type objective_node_type NOT NULL DEFAULT 'objective',
  ADD COLUMN IF NOT EXISTS completion_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mastery_rubric jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'session_workspace_type'
  ) THEN
    CREATE TYPE session_workspace_type AS ENUM (
      'homeschool_day',
      'classroom_block',
      'bootcamp_lab',
      'onboarding_session',
      'self_guided_queue'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'session_completion_status'
  ) THEN
    CREATE TYPE session_completion_status AS ENUM (
      'not_started',
      'completed_as_planned',
      'partially_completed',
      'skipped',
      'needs_review',
      'needs_follow_up'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'session_review_state'
  ) THEN
    CREATE TYPE session_review_state AS ENUM (
      'not_required',
      'awaiting_review',
      'approved',
      'revision_requested',
      'insufficient_evidence'
    );
  END IF;
END $$;

ALTER TABLE lesson_sessions
  ADD COLUMN IF NOT EXISTS organization_id text REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_id text REFERENCES plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_day_id text REFERENCES plan_days(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workspace_type session_workspace_type NOT NULL DEFAULT 'homeschool_day',
  ADD COLUMN IF NOT EXISTS completion_status session_completion_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS review_state session_review_state NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_minutes integer,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by_adult_user_id text REFERENCES adult_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retrospective text,
  ADD COLUMN IF NOT EXISTS next_action text;

UPDATE lesson_sessions session
SET organization_id = plans.organization_id,
    plan_id = plan_items.plan_id,
    plan_day_id = plan_items.plan_day_id
FROM plan_items
JOIN plans ON plans.id = plan_items.plan_id
WHERE session.plan_item_id = plan_items.id
  AND session.organization_id IS NULL;

ALTER TYPE generated_artifact_status ADD VALUE IF NOT EXISTS 'superseded';
ALTER TYPE generated_artifact_status ADD VALUE IF NOT EXISTS 'archived';

ALTER TYPE interactive_activity_type ADD VALUE IF NOT EXISTS 'rubric_response';
ALTER TYPE interactive_activity_type ADD VALUE IF NOT EXISTS 'checklist';
ALTER TYPE interactive_activity_type ADD VALUE IF NOT EXISTS 'file_submission';
ALTER TYPE interactive_activity_type ADD VALUE IF NOT EXISTS 'scenario_decision_tree';
ALTER TYPE interactive_activity_type ADD VALUE IF NOT EXISTS 'step_validation';
ALTER TYPE interactive_activity_type ADD VALUE IF NOT EXISTS 'supervisor_sign_off';
ALTER TYPE interactive_activity_type ADD VALUE IF NOT EXISTS 'oral_video_evidence';

ALTER TABLE generated_artifacts
  ADD COLUMN IF NOT EXISTS prompt_template_id text,
  ADD COLUMN IF NOT EXISTS generation_job_id text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS provider_id text,
  ADD COLUMN IF NOT EXISTS model_id text,
  ADD COLUMN IF NOT EXISTS input_hash text,
  ADD COLUMN IF NOT EXISTS superseded_by_artifact_id text REFERENCES generated_artifacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS qa_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE activity_attempts
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'not_required';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'progress_model'
  ) THEN
    CREATE TYPE progress_model AS ENUM (
      'binary_completion',
      'percent_completion',
      'rubric_score',
      'mastery_band',
      'reviewer_approval',
      'competency_demonstrated'
    );
  END IF;
END $$;

ALTER TABLE progress_records
  ADD COLUMN IF NOT EXISTS progress_model progress_model NOT NULL DEFAULT 'percent_completion',
  ADD COLUMN IF NOT EXISTS progress_value integer,
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'not_required';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'prompt_template_status'
  ) THEN
    CREATE TYPE prompt_template_status AS ENUM ('active', 'archived');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ai_job_status'
  ) THEN
    CREATE TYPE ai_job_status AS ENUM (
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS prompt_templates (
  id text PRIMARY KEY,
  organization_id text REFERENCES organizations(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  status prompt_template_status NOT NULL DEFAULT 'active',
  label text NOT NULL,
  system_prompt text NOT NULL,
  user_template text,
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  created_by_adult_user_id text REFERENCES adult_users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS prompt_templates_scope_task_version_idx
  ON prompt_templates (organization_id, task_name, version);

CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  learner_id text REFERENCES learners(id) ON DELETE SET NULL,
  plan_item_id text REFERENCES plan_items(id) ON DELETE SET NULL,
  lesson_session_id text REFERENCES lesson_sessions(id) ON DELETE SET NULL,
  requested_by_adult_user_id text REFERENCES adult_users(id) ON DELETE SET NULL,
  prompt_template_id text,
  artifact_id text,
  task_name text NOT NULL,
  status ai_job_status NOT NULL DEFAULT 'queued',
  provider_id text,
  model_id text,
  prompt_version text,
  input_hash text,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'evidence_type'
  ) THEN
    CREATE TYPE evidence_type AS ENUM (
      'note',
      'file_upload',
      'artifact_output',
      'activity_outcome',
      'photo',
      'audio_video_metadata',
      'external_assessment',
      'review_note'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'evidence_review_state'
  ) THEN
    CREATE TYPE evidence_review_state AS ENUM (
      'draft',
      'submitted',
      'awaiting_review',
      'approved',
      'revision_requested',
      'insufficient_evidence'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'feedback_scope'
  ) THEN
    CREATE TYPE feedback_scope AS ENUM (
      'session',
      'activity',
      'progress',
      'artifact',
      'review'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'feedback_type'
  ) THEN
    CREATE TYPE feedback_type AS ENUM (
      'narrative',
      'rubric',
      'approval',
      'revision_request',
      'coaching',
      'reflection'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'review_subject_type'
  ) THEN
    CREATE TYPE review_subject_type AS ENUM (
      'session',
      'evidence',
      'activity_attempt',
      'artifact',
      'recommendation'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'review_queue_state'
  ) THEN
    CREATE TYPE review_queue_state AS ENUM (
      'awaiting_review',
      'approved',
      'revision_requested',
      'insufficient_evidence',
      'closed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS evidence_records (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  learner_id text NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  lesson_session_id text REFERENCES lesson_sessions(id) ON DELETE SET NULL,
  plan_item_id text REFERENCES plan_items(id) ON DELETE SET NULL,
  activity_attempt_id text REFERENCES activity_attempts(id) ON DELETE SET NULL,
  progress_record_id text REFERENCES progress_records(id) ON DELETE SET NULL,
  artifact_id text REFERENCES generated_artifacts(id) ON DELETE SET NULL,
  evidence_type evidence_type NOT NULL,
  review_state evidence_review_state NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  body text,
  storage_path text,
  audience text NOT NULL DEFAULT 'shared',
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_by_adult_user_id text REFERENCES adult_users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_record_objectives (
  id text PRIMARY KEY,
  evidence_record_id text NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
  standard_node_id text NOT NULL REFERENCES standard_nodes(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_record_objectives_unique_idx
  ON evidence_record_objectives (evidence_record_id, standard_node_id);

CREATE TABLE IF NOT EXISTS feedback_entries (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  learner_id text NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  author_adult_user_id text REFERENCES adult_users(id) ON DELETE SET NULL,
  lesson_session_id text REFERENCES lesson_sessions(id) ON DELETE SET NULL,
  plan_item_id text REFERENCES plan_items(id) ON DELETE SET NULL,
  activity_attempt_id text REFERENCES activity_attempts(id) ON DELETE SET NULL,
  progress_record_id text REFERENCES progress_records(id) ON DELETE SET NULL,
  evidence_record_id text REFERENCES evidence_records(id) ON DELETE SET NULL,
  artifact_id text REFERENCES generated_artifacts(id) ON DELETE SET NULL,
  scope_type feedback_scope NOT NULL,
  feedback_type feedback_type NOT NULL DEFAULT 'narrative',
  rating integer,
  body text NOT NULL,
  action_items jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'shared',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_queue_items (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  learner_id text REFERENCES learners(id) ON DELETE SET NULL,
  subject_type review_subject_type NOT NULL,
  subject_id text NOT NULL,
  state review_queue_state NOT NULL DEFAULT 'awaiting_review',
  assigned_adult_user_id text REFERENCES adult_users(id) ON DELETE SET NULL,
  decision_summary text,
  due_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
