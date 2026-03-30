import { type AnyPgColumn, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { learners } from "@/lib/db/schema/learners";
import { organizations } from "@/lib/db/schema/organizations";
import { lessonSessions, planItems } from "@/lib/db/schema/planning";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";
import { standardNodes } from "@/lib/db/schema/standards";

export const generatedArtifactTypeEnum = pgEnum("generated_artifact_type", [
  "lesson_plan",
  "worksheet",
  "quiz",
  "rubric",
  "explanation",
  "extension",
  "simplified_version",
  "interactive_blueprint",
]);

export const generatedArtifactStatusEnum = pgEnum("generated_artifact_status", [
  "queued",
  "generating",
  "ready",
  "failed",
]);

export const interactiveActivityTypeEnum = pgEnum("interactive_activity_type", [
  "quiz",
  "matching",
  "flashcards",
  "sequencing",
  "guided_practice",
  "reflection",
  "reading_check",
  "simulation",
]);

export const interactiveActivityStatusEnum = pgEnum("interactive_activity_status", [
  "draft",
  "published",
  "archived",
]);

export const activityAttemptStatusEnum = pgEnum("activity_attempt_status", [
  "in_progress",
  "submitted",
  "graded",
  "abandoned",
]);

export const generatedArtifacts = pgTable("generated_artifacts", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("artifact")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
  planItemId: text("plan_item_id").references(() => planItems.id, { onDelete: "set null" }),
  lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
    onDelete: "set null",
  }),
  artifactType: generatedArtifactTypeEnum("artifact_type").notNull(),
  title: text("title").notNull(),
  status: generatedArtifactStatusEnum("status").notNull().default("queued"),
  body: text("body"),
  promptVersion: text("prompt_version"),
  lineageParentId: text("lineage_parent_id").references(
    (): AnyPgColumn => generatedArtifacts.id,
    {
      onDelete: "set null",
    },
  ),
  sourceContext: metadataColumn("source_context"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const interactiveActivities = pgTable("interactive_activities", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("activity")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
  planItemId: text("plan_item_id").references(() => planItems.id, { onDelete: "set null" }),
  lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
    onDelete: "set null",
  }),
  artifactId: text("artifact_id").references(() => generatedArtifacts.id, {
    onDelete: "set null",
  }),
  activityType: interactiveActivityTypeEnum("activity_type").notNull(),
  status: interactiveActivityStatusEnum("status").notNull().default("draft"),
  title: text("title").notNull(),
  schemaVersion: text("schema_version").notNull().default("1"),
  definition: metadataColumn("definition"),
  masteryRubric: metadataColumn("mastery_rubric"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const activityStandards = pgTable(
  "activity_standards",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("actstd")),
    activityId: text("activity_id")
      .notNull()
      .references(() => interactiveActivities.id, { onDelete: "cascade" }),
    standardNodeId: text("standard_node_id")
      .notNull()
      .references(() => standardNodes.id, { onDelete: "cascade" }),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    activityStandardUnique: uniqueIndex("activity_standards_unique_idx").on(
      table.activityId,
      table.standardNodeId,
    ),
  }),
);

export const activityAttempts = pgTable("activity_attempts", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("attempt")),
  activityId: text("activity_id")
    .notNull()
    .references(() => interactiveActivities.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
    onDelete: "set null",
  }),
  status: activityAttemptStatusEnum("status").notNull().default("in_progress"),
  attemptNumber: integer("attempt_number").notNull().default(1),
  scorePercent: integer("score_percent"),
  responses: metadataColumn("responses"),
  startedAt: text("started_at"),
  submittedAt: text("submitted_at"),
  completedAt: text("completed_at"),
  metadata: metadataColumn(),
  ...timestamps(),
});
