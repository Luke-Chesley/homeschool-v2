import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { learners } from "@/lib/db/schema/learners";
import { adultUsers, organizations } from "@/lib/db/schema/organizations";
import { lessonSessions, planItems } from "@/lib/db/schema/planning";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const promptTemplateStatusEnum = pgEnum("prompt_template_status", [
  "active",
  "archived",
]);

export const aiJobStatusEnum = pgEnum("ai_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("prompt")),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    taskName: text("task_name").notNull(),
    version: text("version").notNull().default("1.0.0"),
    status: promptTemplateStatusEnum("status").notNull().default("active"),
    label: text("label").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    userTemplate: text("user_template"),
    notes: text("notes"),
    isDefault: boolean("is_default").notNull().default(false),
    createdByAdultUserId: text("created_by_adult_user_id").references(() => adultUsers.id, {
      onDelete: "set null",
    }),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    promptTemplateUnique: uniqueIndex("prompt_templates_scope_task_version_idx").on(
      table.organizationId,
      table.taskName,
      table.version,
    ),
  }),
);

export const aiGenerationJobs = pgTable("ai_generation_jobs", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("aijob")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
  planItemId: text("plan_item_id").references(() => planItems.id, { onDelete: "set null" }),
  lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
    onDelete: "set null",
  }),
  requestedByAdultUserId: text("requested_by_adult_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  promptTemplateId: text("prompt_template_id"),
  artifactId: text("artifact_id"),
  taskName: text("task_name").notNull(),
  status: aiJobStatusEnum("status").notNull().default("queued"),
  providerId: text("provider_id"),
  modelId: text("model_id"),
  promptVersion: text("prompt_version"),
  inputHash: text("input_hash"),
  inputs: metadataColumn("inputs"),
  output: metadataColumn("output"),
  errorMessage: text("error_message"),
  attempts: integer("attempts").notNull().default(0),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  metadata: metadataColumn(),
  ...timestamps(),
});
