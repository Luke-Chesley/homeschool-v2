import { index, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { adultUsers, organizations } from "@/lib/db/schema/organizations";
import { lessonSessions, planItems } from "@/lib/db/schema/planning";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";
import { standardNodes } from "@/lib/db/schema/standards";
import { activityAttempts } from "@/lib/db/schema/activities";
import { learners } from "@/lib/db/schema/learners";

export const progressRecordStatusEnum = pgEnum("progress_record_status", [
  "not_started",
  "in_progress",
  "completed",
  "mastered",
  "needs_review",
]);

export const observationNoteTypeEnum = pgEnum("observation_note_type", [
  "general",
  "behavior",
  "mastery",
  "adaptation_signal",
]);

export const progressModelEnum = pgEnum("progress_model", [
  "binary_completion",
  "percent_completion",
  "rubric_score",
  "mastery_band",
  "reviewer_approval",
  "competency_demonstrated",
]);

export const progressRecords = pgTable(
  "progress_records",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("progress")),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    planItemId: text("plan_item_id").references(() => planItems.id, { onDelete: "set null" }),
    lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
      onDelete: "set null",
    }),
    activityAttemptId: text("activity_attempt_id").references(() => activityAttempts.id, {
      onDelete: "set null",
    }),
    status: progressRecordStatusEnum("status").notNull().default("not_started"),
    progressModel: progressModelEnum("progress_model")
      .notNull()
      .default("percent_completion"),
    progressValue: integer("progress_value"),
    reviewState: text("review_state").notNull().default("not_required"),
    masteryLevel: text("mastery_level"),
    completionPercent: integer("completion_percent"),
    timeSpentMinutes: integer("time_spent_minutes"),
    parentNote: text("parent_note"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    progressRecordsAttemptIdx: index("progress_records_attempt_idx").on(table.activityAttemptId),
    progressRecordsLearnerCreatedIdx: index("progress_records_learner_created_idx").on(
      table.learnerId,
      table.createdAt,
    ),
    progressRecordsSessionPlanItemCreatedIdx: index(
      "progress_records_session_plan_item_created_idx",
    ).on(table.lessonSessionId, table.planItemId, table.createdAt),
  }),
);

export const progressRecordStandards = pgTable(
  "progress_record_standards",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("progstd")),
    progressRecordId: text("progress_record_id")
      .notNull()
      .references(() => progressRecords.id, { onDelete: "cascade" }),
    standardNodeId: text("standard_node_id")
      .notNull()
      .references(() => standardNodes.id, { onDelete: "cascade" }),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    progressStandardUnique: uniqueIndex("progress_record_standards_unique_idx").on(
      table.progressRecordId,
      table.standardNodeId,
    ),
  }),
);

export const observationNotes = pgTable("observation_notes", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("note")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  planItemId: text("plan_item_id").references(() => planItems.id, { onDelete: "set null" }),
  lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
    onDelete: "set null",
  }),
  authorAdultUserId: text("author_adult_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  noteType: observationNoteTypeEnum("note_type").notNull().default("general"),
  body: text("body").notNull(),
  metadata: metadataColumn(),
  ...timestamps(),
});
