import { date, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { curriculumItems } from "@/lib/db/schema/curriculum";
import { learners } from "@/lib/db/schema/learners";
import { organizations } from "@/lib/db/schema/organizations";
import { metadataColumn, orderingColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";
import { standardNodes } from "@/lib/db/schema/standards";

export const planStatusEnum = pgEnum("plan_status", [
  "draft",
  "active",
  "archived",
  "completed",
]);

export const planDayStatusEnum = pgEnum("plan_day_status", [
  "planned",
  "in_progress",
  "completed",
  "skipped",
]);

export const planItemStatusEnum = pgEnum("plan_item_status", [
  "planned",
  "ready",
  "completed",
  "skipped",
  "carried_over",
]);

export const lessonSessionStatusEnum = pgEnum("lesson_session_status", [
  "planned",
  "in_progress",
  "completed",
  "abandoned",
]);

export const plans = pgTable("plans", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("plan")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: planStatusEnum("status").notNull().default("draft"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  versionLabel: text("version_label"),
  notes: text("notes"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const planWeeks = pgTable(
  "plan_weeks",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("week")),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    weekIndex: integer("week_index").notNull(),
    weekStartDate: date("week_start_date"),
    weekEndDate: date("week_end_date"),
    notes: text("notes"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    planWeekUnique: uniqueIndex("plan_weeks_plan_idx").on(table.planId, table.weekIndex),
  }),
);

export const planDays = pgTable(
  "plan_days",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("day")),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    planWeekId: text("plan_week_id").references(() => planWeeks.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    status: planDayStatusEnum("status").notNull().default("planned"),
    notes: text("notes"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    planDayUnique: uniqueIndex("plan_days_plan_date_idx").on(table.planId, table.date),
  }),
);

export const planItems = pgTable("plan_items", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("planitem")),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  planDayId: text("plan_day_id")
    .notNull()
    .references(() => planDays.id, { onDelete: "cascade" }),
  curriculumItemId: text("curriculum_item_id").references(() => curriculumItems.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject"),
  status: planItemStatusEnum("status").notNull().default("planned"),
  scheduledDate: date("scheduled_date"),
  estimatedMinutes: integer("estimated_minutes"),
  ordering: orderingColumn(),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const planItemStandards = pgTable(
  "plan_item_standards",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("planstd")),
    planItemId: text("plan_item_id")
      .notNull()
      .references(() => planItems.id, { onDelete: "cascade" }),
    standardNodeId: text("standard_node_id")
      .notNull()
      .references(() => standardNodes.id, { onDelete: "cascade" }),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    planItemStandardUnique: uniqueIndex("plan_item_standards_unique_idx").on(
      table.planItemId,
      table.standardNodeId,
    ),
  }),
);

export const lessonSessions = pgTable("lesson_sessions", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("session")),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  planItemId: text("plan_item_id")
    .notNull()
    .references(() => planItems.id, { onDelete: "cascade" }),
  sessionDate: date("session_date").notNull(),
  status: lessonSessionStatusEnum("status").notNull().default("planned"),
  actualMinutes: integer("actual_minutes"),
  summary: text("summary"),
  notes: text("notes"),
  deviationReason: text("deviation_reason"),
  metadata: metadataColumn(),
  ...timestamps(),
});
