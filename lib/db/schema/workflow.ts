import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { activityAttempts, generatedArtifacts } from "@/lib/db/schema/activities";
import { adultUsers, organizations } from "@/lib/db/schema/organizations";
import { lessonSessions, planItems } from "@/lib/db/schema/planning";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";
import { standardNodes } from "@/lib/db/schema/standards";
import { progressRecords } from "@/lib/db/schema/tracking";
import { learners } from "@/lib/db/schema/learners";

export const evidenceTypeEnum = pgEnum("evidence_type", [
  "note",
  "file_upload",
  "artifact_output",
  "activity_outcome",
  "photo",
  "audio_video_metadata",
  "external_assessment",
  "review_note",
]);

export const evidenceReviewStateEnum = pgEnum("evidence_review_state", [
  "draft",
  "submitted",
  "awaiting_review",
  "approved",
  "revision_requested",
  "insufficient_evidence",
]);

export const feedbackScopeEnum = pgEnum("feedback_scope", [
  "session",
  "activity",
  "progress",
  "artifact",
  "review",
]);

export const feedbackTypeEnum = pgEnum("feedback_type", [
  "narrative",
  "rubric",
  "approval",
  "revision_request",
  "coaching",
  "reflection",
]);

export const reviewSubjectTypeEnum = pgEnum("review_subject_type", [
  "session",
  "evidence",
  "activity_attempt",
  "artifact",
  "recommendation",
]);

export const reviewQueueStateEnum = pgEnum("review_queue_state", [
  "awaiting_review",
  "approved",
  "revision_requested",
  "insufficient_evidence",
  "closed",
]);

export const evidenceRecords = pgTable("evidence_records", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("evidence")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
    onDelete: "set null",
  }),
  planItemId: text("plan_item_id").references(() => planItems.id, {
    onDelete: "set null",
  }),
  activityAttemptId: text("activity_attempt_id").references(() => activityAttempts.id, {
    onDelete: "set null",
  }),
  progressRecordId: text("progress_record_id").references(() => progressRecords.id, {
    onDelete: "set null",
  }),
  artifactId: text("artifact_id").references(() => generatedArtifacts.id, {
    onDelete: "set null",
  }),
  evidenceType: evidenceTypeEnum("evidence_type").notNull(),
  reviewState: evidenceReviewStateEnum("review_state")
    .notNull()
    .default("draft"),
  title: text("title").notNull(),
  body: text("body"),
  storagePath: text("storage_path"),
  audience: text("audience").notNull().default("shared"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  createdByAdultUserId: text("created_by_adult_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const evidenceRecordObjectives = pgTable(
  "evidence_record_objectives",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("evobj")),
    evidenceRecordId: text("evidence_record_id")
      .notNull()
      .references(() => evidenceRecords.id, { onDelete: "cascade" }),
    standardNodeId: text("standard_node_id")
      .notNull()
      .references(() => standardNodes.id, { onDelete: "cascade" }),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    evidenceObjectiveUnique: uniqueIndex("evidence_record_objectives_unique_idx").on(
      table.evidenceRecordId,
      table.standardNodeId,
    ),
  }),
);

export const feedbackEntries = pgTable("feedback_entries", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("feedback")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  authorAdultUserId: text("author_adult_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
    onDelete: "set null",
  }),
  planItemId: text("plan_item_id").references(() => planItems.id, {
    onDelete: "set null",
  }),
  activityAttemptId: text("activity_attempt_id").references(() => activityAttempts.id, {
    onDelete: "set null",
  }),
  progressRecordId: text("progress_record_id").references(() => progressRecords.id, {
    onDelete: "set null",
  }),
  evidenceRecordId: text("evidence_record_id").references(() => evidenceRecords.id, {
    onDelete: "set null",
  }),
  artifactId: text("artifact_id").references(() => generatedArtifacts.id, {
    onDelete: "set null",
  }),
  scopeType: feedbackScopeEnum("scope_type").notNull(),
  feedbackType: feedbackTypeEnum("feedback_type").notNull().default("narrative"),
  rating: integer("rating"),
  body: text("body").notNull(),
  actionItems: metadataColumn("action_items"),
  visibility: text("visibility").notNull().default("shared"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const reviewQueueItems = pgTable("review_queue_items", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("review")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
  subjectType: reviewSubjectTypeEnum("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  state: reviewQueueStateEnum("state").notNull().default("awaiting_review"),
  assignedAdultUserId: text("assigned_adult_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  decisionSummary: text("decision_summary"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  metadata: metadataColumn(),
  ...timestamps(),
});
