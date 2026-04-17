DO $$ BEGIN
 CREATE TYPE "public"."compliance_program_status" AS ENUM('draft', 'active', 'completed', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."compliance_grade_band" AS ENUM('elementary', 'secondary');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."compliance_period_type" AS ENUM('month', 'quarter', 'year', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."compliance_snapshot_status" AS ENUM('draft', 'final');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."compliance_evaluation_type" AS ENUM('parent_summary', 'teacher_letter', 'standardized_test', 'portfolio_review', 'external_assessment');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."compliance_evaluation_status" AS ENUM('draft', 'completed', 'waived', 'not_applicable');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."compliance_task_type" AS ENUM('notice', 'ihip', 'quarterly_report', 'annual_evaluation', 'affidavit', 'portfolio_ready', 'termination', 'transfer_letter', 'attendance_summary', 'progress_snapshot', 'test_evidence', 'health_attestation');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."compliance_task_status" AS ENUM('upcoming', 'ready', 'completed', 'overdue', 'not_applicable');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."compliance_report_kind" AS ENUM('attendance_summary', 'quarterly_report', 'annual_summary', 'evaluation_packet', 'portfolio_checklist', 'transcript_skeleton');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."compliance_report_status" AS ENUM('draft', 'final');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."homeschool_attendance_status" ADD VALUE IF NOT EXISTS 'excused';
--> statement-breakpoint
ALTER TYPE "public"."homeschool_attendance_status" ADD VALUE IF NOT EXISTS 'non_instructional';
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."homeschool_attendance_source" AS ENUM('manual', 'derived_from_sessions', 'imported');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."portfolio_entry_status" AS ENUM('inbox', 'saved', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."portfolio_artifact_kind" AS ENUM('work_sample', 'photo', 'pdf', 'test_result', 'evaluator_letter', 'report_card', 'reading_log_export', 'checklist_attachment', 'note', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."compliance_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"learner_id" text NOT NULL,
	"school_year_label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"jurisdiction_code" text NOT NULL,
	"pathway_code" text NOT NULL,
	"requirement_profile_version" text NOT NULL,
	"grade_band" "public"."compliance_grade_band" DEFAULT 'elementary' NOT NULL,
	"status" "public"."compliance_program_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."compliance_progress_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"compliance_program_id" text NOT NULL,
	"period_type" "public"."compliance_period_type" NOT NULL,
	"period_label" text NOT NULL,
	"period_start_date" date,
	"period_end_date" date,
	"summary_text" text NOT NULL,
	"subject_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strengths" text DEFAULT '' NOT NULL,
	"struggles" text DEFAULT '' NOT NULL,
	"next_steps" text DEFAULT '' NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "public"."compliance_snapshot_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."compliance_evaluation_records" (
	"id" text PRIMARY KEY NOT NULL,
	"compliance_program_id" text NOT NULL,
	"evaluation_type" "public"."compliance_evaluation_type" NOT NULL,
	"completed_at" timestamp with time zone,
	"result_summary" text NOT NULL,
	"document_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evaluator_name" text,
	"evaluator_role" text,
	"status" "public"."compliance_evaluation_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."compliance_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"compliance_program_id" text NOT NULL,
	"task_type" "public"."compliance_task_type" NOT NULL,
	"title" text NOT NULL,
	"due_date" date NOT NULL,
	"status" "public"."compliance_task_status" DEFAULT 'upcoming' NOT NULL,
	"completion_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"completed_by_adult_user_id" text,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "public"."compliance_report_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"compliance_program_id" text NOT NULL,
	"report_kind" "public"."compliance_report_kind" NOT NULL,
	"period_label" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" "public"."compliance_report_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."compliance_programs" ADD CONSTRAINT "compliance_programs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."compliance_programs" ADD CONSTRAINT "compliance_programs_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."compliance_progress_snapshots" ADD CONSTRAINT "compliance_progress_snapshots_compliance_program_id_compliance_programs_id_fk" FOREIGN KEY ("compliance_program_id") REFERENCES "public"."compliance_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."compliance_evaluation_records" ADD CONSTRAINT "compliance_evaluation_records_compliance_program_id_compliance_programs_id_fk" FOREIGN KEY ("compliance_program_id") REFERENCES "public"."compliance_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."compliance_tasks" ADD CONSTRAINT "compliance_tasks_compliance_program_id_compliance_programs_id_fk" FOREIGN KEY ("compliance_program_id") REFERENCES "public"."compliance_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."compliance_tasks" ADD CONSTRAINT "compliance_tasks_completed_by_adult_user_id_adult_users_id_fk" FOREIGN KEY ("completed_by_adult_user_id") REFERENCES "public"."adult_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."compliance_report_drafts" ADD CONSTRAINT "compliance_report_drafts_compliance_program_id_compliance_programs_id_fk" FOREIGN KEY ("compliance_program_id") REFERENCES "public"."compliance_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "public"."homeschool_attendance_records" ADD COLUMN IF NOT EXISTS "compliance_program_id" text;
--> statement-breakpoint
ALTER TABLE "public"."homeschool_attendance_records" ADD COLUMN IF NOT EXISTS "source" "public"."homeschool_attendance_source" DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "public"."homeschool_attendance_records" ADD COLUMN IF NOT EXISTS "derived_session_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."homeschool_attendance_records" ADD CONSTRAINT "homeschool_attendance_records_compliance_program_id_compliance_programs_id_fk" FOREIGN KEY ("compliance_program_id") REFERENCES "public"."compliance_programs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "public"."evidence_records" ADD COLUMN IF NOT EXISTS "compliance_program_id" text;
--> statement-breakpoint
ALTER TABLE "public"."evidence_records" ADD COLUMN IF NOT EXISTS "portfolio_status" "public"."portfolio_entry_status" DEFAULT 'inbox' NOT NULL;
--> statement-breakpoint
ALTER TABLE "public"."evidence_records" ADD COLUMN IF NOT EXISTS "portfolio_artifact_kind" "public"."portfolio_artifact_kind";
--> statement-breakpoint
ALTER TABLE "public"."evidence_records" ADD COLUMN IF NOT EXISTS "portfolio_subject_key" text;
--> statement-breakpoint
ALTER TABLE "public"."evidence_records" ADD COLUMN IF NOT EXISTS "portfolio_period_label" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "public"."evidence_records" ADD CONSTRAINT "evidence_records_compliance_program_id_compliance_programs_id_fk" FOREIGN KEY ("compliance_program_id") REFERENCES "public"."compliance_programs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_programs_learner_status_idx" ON "public"."compliance_programs" USING btree ("learner_id","status","start_date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_programs_year_unique_idx" ON "public"."compliance_programs" USING btree ("learner_id","school_year_label","pathway_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_snapshots_program_period_idx" ON "public"."compliance_progress_snapshots" USING btree ("compliance_program_id","period_type","period_start_date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_snapshots_label_unique_idx" ON "public"."compliance_progress_snapshots" USING btree ("compliance_program_id","period_type","period_label");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_evaluation_program_idx" ON "public"."compliance_evaluation_records" USING btree ("compliance_program_id","completed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_tasks_program_due_idx" ON "public"."compliance_tasks" USING btree ("compliance_program_id","due_date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_tasks_title_unique_idx" ON "public"."compliance_tasks" USING btree ("compliance_program_id","task_type","title","due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_report_drafts_program_kind_idx" ON "public"."compliance_report_drafts" USING btree ("compliance_program_id","report_kind","updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_report_drafts_unique_idx" ON "public"."compliance_report_drafts" USING btree ("compliance_program_id","report_kind","period_label");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homeschool_attendance_program_date_idx" ON "public"."homeschool_attendance_records" USING btree ("compliance_program_id","attendance_date");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "homeschool_attendance_learner_date_unique_idx" ON "public"."homeschool_attendance_records" USING btree ("learner_id","attendance_date");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."compliance_programs" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."compliance_progress_snapshots" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."compliance_evaluation_records" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."compliance_tasks" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."compliance_report_drafts" TO "authenticated";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.can_access_compliance_program(target_program_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.compliance_programs cp
    where cp.id = target_program_id
      and private.can_access_learner(cp.learner_id)
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.can_manage_compliance_program(target_program_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.compliance_programs cp
    where cp.id = target_program_id
      and private.can_manage_organization(cp.organization_id)
      and private.can_manage_learner(cp.learner_id)
  )
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.can_access_compliance_program(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_compliance_program(text) TO authenticated;
--> statement-breakpoint
ALTER TABLE "public"."compliance_programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_progress_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_evaluation_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_report_drafts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "compliance_programs_select"
ON "public"."compliance_programs"
FOR SELECT TO "authenticated"
USING (private.can_access_learner(learner_id));
--> statement-breakpoint
CREATE POLICY "compliance_programs_manage_insert"
ON "public"."compliance_programs"
FOR INSERT TO "authenticated"
WITH CHECK (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
);
--> statement-breakpoint
CREATE POLICY "compliance_programs_manage_update"
ON "public"."compliance_programs"
FOR UPDATE TO "authenticated"
USING (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
)
WITH CHECK (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
);
--> statement-breakpoint
CREATE POLICY "compliance_programs_manage_delete"
ON "public"."compliance_programs"
FOR DELETE TO "authenticated"
USING (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
);
--> statement-breakpoint
CREATE POLICY "compliance_progress_snapshots_select"
ON "public"."compliance_progress_snapshots"
FOR SELECT TO "authenticated"
USING (private.can_access_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_progress_snapshots_manage_insert"
ON "public"."compliance_progress_snapshots"
FOR INSERT TO "authenticated"
WITH CHECK (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_progress_snapshots_manage_update"
ON "public"."compliance_progress_snapshots"
FOR UPDATE TO "authenticated"
USING (private.can_manage_compliance_program(compliance_program_id))
WITH CHECK (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_progress_snapshots_manage_delete"
ON "public"."compliance_progress_snapshots"
FOR DELETE TO "authenticated"
USING (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_evaluation_records_select"
ON "public"."compliance_evaluation_records"
FOR SELECT TO "authenticated"
USING (private.can_access_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_evaluation_records_manage_insert"
ON "public"."compliance_evaluation_records"
FOR INSERT TO "authenticated"
WITH CHECK (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_evaluation_records_manage_update"
ON "public"."compliance_evaluation_records"
FOR UPDATE TO "authenticated"
USING (private.can_manage_compliance_program(compliance_program_id))
WITH CHECK (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_evaluation_records_manage_delete"
ON "public"."compliance_evaluation_records"
FOR DELETE TO "authenticated"
USING (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_tasks_select"
ON "public"."compliance_tasks"
FOR SELECT TO "authenticated"
USING (private.can_access_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_tasks_manage_insert"
ON "public"."compliance_tasks"
FOR INSERT TO "authenticated"
WITH CHECK (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_tasks_manage_update"
ON "public"."compliance_tasks"
FOR UPDATE TO "authenticated"
USING (private.can_manage_compliance_program(compliance_program_id))
WITH CHECK (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_tasks_manage_delete"
ON "public"."compliance_tasks"
FOR DELETE TO "authenticated"
USING (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_report_drafts_select"
ON "public"."compliance_report_drafts"
FOR SELECT TO "authenticated"
USING (private.can_access_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_report_drafts_manage_insert"
ON "public"."compliance_report_drafts"
FOR INSERT TO "authenticated"
WITH CHECK (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_report_drafts_manage_update"
ON "public"."compliance_report_drafts"
FOR UPDATE TO "authenticated"
USING (private.can_manage_compliance_program(compliance_program_id))
WITH CHECK (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
CREATE POLICY "compliance_report_drafts_manage_delete"
ON "public"."compliance_report_drafts"
FOR DELETE TO "authenticated"
USING (private.can_manage_compliance_program(compliance_program_id));
--> statement-breakpoint
DROP POLICY IF EXISTS "homeschool_attendance_records_manage_insert" ON "public"."homeschool_attendance_records";
DROP POLICY IF EXISTS "homeschool_attendance_records_manage_update" ON "public"."homeschool_attendance_records";
DROP POLICY IF EXISTS "evidence_records_manage_insert" ON "public"."evidence_records";
DROP POLICY IF EXISTS "evidence_records_manage_update" ON "public"."evidence_records";
--> statement-breakpoint
CREATE POLICY "homeschool_attendance_records_manage_insert"
ON "public"."homeschool_attendance_records"
FOR INSERT TO "authenticated"
WITH CHECK (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
  AND (
    compliance_program_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM "public"."compliance_programs" cp
      WHERE cp.id = compliance_program_id
        AND cp.organization_id = homeschool_attendance_records.organization_id
        AND cp.learner_id = homeschool_attendance_records.learner_id
        AND private.can_manage_compliance_program(cp.id)
    )
  )
);
--> statement-breakpoint
CREATE POLICY "homeschool_attendance_records_manage_update"
ON "public"."homeschool_attendance_records"
FOR UPDATE TO "authenticated"
USING (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
)
WITH CHECK (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
  AND (
    compliance_program_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM "public"."compliance_programs" cp
      WHERE cp.id = compliance_program_id
        AND cp.organization_id = homeschool_attendance_records.organization_id
        AND cp.learner_id = homeschool_attendance_records.learner_id
        AND private.can_manage_compliance_program(cp.id)
    )
  )
);
--> statement-breakpoint
CREATE POLICY "evidence_records_manage_insert"
ON "public"."evidence_records"
FOR INSERT TO "authenticated"
WITH CHECK (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
  AND (
    compliance_program_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM "public"."compliance_programs" cp
      WHERE cp.id = compliance_program_id
        AND cp.organization_id = evidence_records.organization_id
        AND cp.learner_id = evidence_records.learner_id
        AND private.can_manage_compliance_program(cp.id)
    )
  )
);
--> statement-breakpoint
CREATE POLICY "evidence_records_manage_update"
ON "public"."evidence_records"
FOR UPDATE TO "authenticated"
USING (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
)
WITH CHECK (
  private.can_manage_organization(organization_id)
  AND private.can_manage_learner(learner_id)
  AND (
    compliance_program_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM "public"."compliance_programs" cp
      WHERE cp.id = compliance_program_id
        AND cp.organization_id = evidence_records.organization_id
        AND cp.learner_id = evidence_records.learner_id
        AND private.can_manage_compliance_program(cp.id)
    )
  )
);
