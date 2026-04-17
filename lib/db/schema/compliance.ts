import { sql } from "drizzle-orm";
import {
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { learners } from "@/lib/db/schema/learners";
import { adultUsers, organizations } from "@/lib/db/schema/organizations";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const complianceProgramStatusEnum = pgEnum("compliance_program_status", [
  "draft",
  "active",
  "completed",
  "archived",
]);

export const complianceGradeBandEnum = pgEnum("compliance_grade_band", [
  "elementary",
  "secondary",
]);

export const compliancePeriodTypeEnum = pgEnum("compliance_period_type", [
  "month",
  "quarter",
  "year",
  "custom",
]);

export const complianceSnapshotStatusEnum = pgEnum("compliance_snapshot_status", [
  "draft",
  "final",
]);

export const complianceEvaluationTypeEnum = pgEnum("compliance_evaluation_type", [
  "parent_summary",
  "teacher_letter",
  "standardized_test",
  "portfolio_review",
  "external_assessment",
]);

export const complianceEvaluationStatusEnum = pgEnum("compliance_evaluation_status", [
  "draft",
  "completed",
  "waived",
  "not_applicable",
]);

export const complianceTaskTypeEnum = pgEnum("compliance_task_type", [
  "notice",
  "ihip",
  "quarterly_report",
  "annual_evaluation",
  "affidavit",
  "portfolio_ready",
  "termination",
  "transfer_letter",
  "attendance_summary",
  "progress_snapshot",
  "test_evidence",
  "health_attestation",
]);

export const complianceTaskStatusEnum = pgEnum("compliance_task_status", [
  "upcoming",
  "ready",
  "completed",
  "overdue",
  "not_applicable",
]);

export const complianceReportKindEnum = pgEnum("compliance_report_kind", [
  "attendance_summary",
  "quarterly_report",
  "annual_summary",
  "evaluation_packet",
  "portfolio_checklist",
  "transcript_skeleton",
]);

export const complianceReportStatusEnum = pgEnum("compliance_report_status", [
  "draft",
  "final",
]);

export const compliancePrograms = pgTable(
  "compliance_programs",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("program")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    schoolYearLabel: text("school_year_label").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    jurisdictionCode: text("jurisdiction_code").notNull(),
    pathwayCode: text("pathway_code").notNull(),
    requirementProfileVersion: text("requirement_profile_version").notNull(),
    gradeBand: complianceGradeBandEnum("grade_band").notNull().default("elementary"),
    status: complianceProgramStatusEnum("status").notNull().default("draft"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    complianceProgramsLearnerStatusIdx: index("compliance_programs_learner_status_idx").on(
      table.learnerId,
      table.status,
      table.startDate,
    ),
    complianceProgramsYearUnique: uniqueIndex("compliance_programs_year_unique_idx").on(
      table.learnerId,
      table.schoolYearLabel,
      table.pathwayCode,
    ),
  }),
);

export const complianceProgressSnapshots = pgTable(
  "compliance_progress_snapshots",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("snapshot")),
    complianceProgramId: text("compliance_program_id")
      .notNull()
      .references(() => compliancePrograms.id, { onDelete: "cascade" }),
    periodType: compliancePeriodTypeEnum("period_type").notNull(),
    periodLabel: text("period_label").notNull(),
    periodStartDate: date("period_start_date"),
    periodEndDate: date("period_end_date"),
    summaryText: text("summary_text").notNull(),
    subjectNotes: jsonb("subject_notes")
      .$type<Array<{ subject: string; note: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    strengths: text("strengths").notNull().default(""),
    struggles: text("struggles").notNull().default(""),
    nextSteps: text("next_steps").notNull().default(""),
    evidenceRefs: jsonb("evidence_refs").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    status: complianceSnapshotStatusEnum("status").notNull().default("draft"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    complianceSnapshotsProgramPeriodIdx: index("compliance_snapshots_program_period_idx").on(
      table.complianceProgramId,
      table.periodType,
      table.periodStartDate,
    ),
    complianceSnapshotsLabelUnique: uniqueIndex("compliance_snapshots_label_unique_idx").on(
      table.complianceProgramId,
      table.periodType,
      table.periodLabel,
    ),
  }),
);

export const complianceEvaluationRecords = pgTable(
  "compliance_evaluation_records",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("ceval")),
    complianceProgramId: text("compliance_program_id")
      .notNull()
      .references(() => compliancePrograms.id, { onDelete: "cascade" }),
    evaluationType: complianceEvaluationTypeEnum("evaluation_type").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    resultSummary: text("result_summary").notNull(),
    documentRefs: jsonb("document_refs").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    evaluatorName: text("evaluator_name"),
    evaluatorRole: text("evaluator_role"),
    status: complianceEvaluationStatusEnum("status").notNull().default("draft"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    complianceEvaluationProgramIdx: index("compliance_evaluation_program_idx").on(
      table.complianceProgramId,
      table.completedAt,
    ),
  }),
);

export const complianceTasks = pgTable(
  "compliance_tasks",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("ctask")),
    complianceProgramId: text("compliance_program_id")
      .notNull()
      .references(() => compliancePrograms.id, { onDelete: "cascade" }),
    taskType: complianceTaskTypeEnum("task_type").notNull(),
    title: text("title").notNull(),
    dueDate: date("due_date").notNull(),
    status: complianceTaskStatusEnum("status").notNull().default("upcoming"),
    completionRefs: jsonb("completion_refs").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    notes: text("notes"),
    completedByAdultUserId: text("completed_by_adult_user_id").references(() => adultUsers.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    complianceTasksProgramDueIdx: index("compliance_tasks_program_due_idx").on(
      table.complianceProgramId,
      table.dueDate,
    ),
    complianceTasksTitleUnique: uniqueIndex("compliance_tasks_title_unique_idx").on(
      table.complianceProgramId,
      table.taskType,
      table.title,
      table.dueDate,
    ),
  }),
);

export const complianceReportDrafts = pgTable(
  "compliance_report_drafts",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("creport")),
    complianceProgramId: text("compliance_program_id")
      .notNull()
      .references(() => compliancePrograms.id, { onDelete: "cascade" }),
    reportKind: complianceReportKindEnum("report_kind").notNull(),
    periodLabel: text("period_label").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    status: complianceReportStatusEnum("status").notNull().default("draft"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    complianceReportDraftsProgramKindIdx: index("compliance_report_drafts_program_kind_idx").on(
      table.complianceProgramId,
      table.reportKind,
      table.updatedAt,
    ),
    complianceReportDraftsUnique: uniqueIndex("compliance_report_drafts_unique_idx").on(
      table.complianceProgramId,
      table.reportKind,
      table.periodLabel,
    ),
  }),
);
