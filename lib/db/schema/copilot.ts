import { pgEnum, pgTable, text } from "drizzle-orm/pg-core";

import { learners } from "@/lib/db/schema/learners";
import { organizations, adultUsers } from "@/lib/db/schema/organizations";
import { planDays, plans, lessonSessions } from "@/lib/db/schema/planning";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const conversationScopeTypeEnum = pgEnum("conversation_scope_type", [
  "organization",
  "learner",
  "plan",
  "plan_day",
  "lesson_session",
]);

export const conversationRoleEnum = pgEnum("conversation_role", [
  "system",
  "user",
  "assistant",
  "tool",
]);

export const copilotActionStatusEnum = pgEnum("copilot_action_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "proposed",
  "accepted",
  "dismissed",
  "applied",
]);

export const conversationThreads = pgTable("conversation_threads", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("thread")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
  planId: text("plan_id").references(() => plans.id, { onDelete: "set null" }),
  planDayId: text("plan_day_id").references(() => planDays.id, { onDelete: "set null" }),
  lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
    onDelete: "set null",
  }),
  scopeType: conversationScopeTypeEnum("scope_type").notNull(),
  title: text("title"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("message")),
  threadId: text("thread_id")
    .notNull()
    .references(() => conversationThreads.id, { onDelete: "cascade" }),
  role: conversationRoleEnum("role").notNull(),
  authorAdultUserId: text("author_adult_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  content: text("content").notNull(),
  structuredContent: metadataColumn("structured_content"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const copilotActions = pgTable("copilot_actions", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("action")),
  threadId: text("thread_id")
    .notNull()
    .references(() => conversationThreads.id, { onDelete: "cascade" }),
  messageId: text("message_id").references(() => conversationMessages.id, {
    onDelete: "set null",
  }),
  actionType: text("action_type").notNull(),
  status: copilotActionStatusEnum("status").notNull().default("queued"),
  targetType: text("target_type"),
  targetId: text("target_id"),
  input: metadataColumn("input"),
  output: metadataColumn("output"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const adaptationInsights = pgTable("adaptation_insights", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("insight")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  planId: text("plan_id").references(() => plans.id, { onDelete: "set null" }),
  lessonSessionId: text("lesson_session_id").references(() => lessonSessions.id, {
    onDelete: "set null",
  }),
  signalType: text("signal_type").notNull(),
  summary: text("summary").notNull(),
  evidence: metadataColumn("evidence"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const recommendations = pgTable("recommendations", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("recommendation")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  insightId: text("insight_id").references(() => adaptationInsights.id, {
    onDelete: "set null",
  }),
  recommendationType: text("recommendation_type").notNull(),
  status: recommendationStatusEnum("status").notNull().default("proposed"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  payload: metadataColumn("payload"),
  acceptedAt: text("accepted_at"),
  dismissedAt: text("dismissed_at"),
  metadata: metadataColumn(),
  ...timestamps(),
});
