import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { curriculumItems } from "@/lib/db/schema/curriculum";
import { learners } from "@/lib/db/schema/learners";
import { adultUsers, organizations } from "@/lib/db/schema/organizations";
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

export const planDaySlotOriginEnum = pgEnum("plan_day_slot_origin", [
  "manual",
  "system_generated",
  "template",
  "carryover",
]);

export const planDaySlotStatusEnum = pgEnum("plan_day_slot_status", [
  "planned",
  "in_progress",
  "completed",
  "skipped",
  "canceled",
]);

export const lessonSessionStatusEnum = pgEnum("lesson_session_status", [
  "planned",
  "in_progress",
  "completed",
  "abandoned",
]);

export const sessionWorkspaceTypeEnum = pgEnum("session_workspace_type", [
  "homeschool_day",
  "classroom_block",
  "bootcamp_lab",
  "onboarding_session",
  "self_guided_queue",
]);

export const sessionCompletionStatusEnum = pgEnum("session_completion_status", [
  "not_started",
  "completed_as_planned",
  "partially_completed",
  "skipped",
  "needs_review",
  "needs_follow_up",
]);

export const sessionReviewStateEnum = pgEnum("session_review_state", [
  "not_required",
  "awaiting_review",
  "approved",
  "revision_requested",
  "insufficient_evidence",
]);

export const plans = pgTable(
  "plans",
  {
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
  },
  (table) => ({
    planOrganizationLearnerUpdatedIdx: index("plans_org_learner_updated_idx").on(
      table.organizationId,
      table.learnerId,
      table.updatedAt,
      table.createdAt,
    ),
  }),
);

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

export const planDaySlots = pgTable(
  "plan_day_slots",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("slot")),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    planDayId: text("plan_day_id")
      .notNull()
      .references(() => planDays.id, { onDelete: "cascade" }),
    slotIndex: integer("slot_index").notNull(),
    title: text("title").notNull(),
    origin: planDaySlotOriginEnum("origin").notNull().default("manual"),
    status: planDaySlotStatusEnum("status").notNull().default("planned"),
    plannedMinutes: integer("planned_minutes"),
    startsAtMinutes: integer("starts_at_minutes"),
    endsAtMinutes: integer("ends_at_minutes"),
    notes: text("notes"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    planDaySlotsPlanIdx: index("plan_day_slots_plan_idx").on(table.planId, table.createdAt),
    planDaySlotsPlanDayIdx: index("plan_day_slots_plan_day_idx").on(
      table.planDayId,
      table.slotIndex,
      table.createdAt,
    ),
    planDaySlotsUnique: uniqueIndex("plan_day_slots_day_slot_idx").on(
      table.planDayId,
      table.slotIndex,
    ),
  }),
);

export const planItems = pgTable(
  "plan_items",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("planitem")),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    planDayId: text("plan_day_id")
      .notNull()
      .references(() => planDays.id, { onDelete: "cascade" }),
    planDaySlotId: text("plan_day_slot_id").references(() => planDaySlots.id, {
      onDelete: "set null",
    }),
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
  },
  (table) => ({
    planItemsPlanIdx: index("plan_items_plan_idx").on(table.planId),
    planItemsPlanDayOrderIdx: index("plan_items_plan_day_order_idx").on(
      table.planDayId,
      table.ordering,
      table.createdAt,
    ),
    planItemsPlanDaySlotIdx: index("plan_items_plan_day_slot_idx").on(
      table.planDaySlotId,
      table.ordering,
      table.createdAt,
    ),
  }),
);
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
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  planId: text("plan_id").references(() => plans.id, { onDelete: "set null" }),
  planDayId: text("plan_day_id").references(() => planDays.id, { onDelete: "set null" }),
  planDaySlotId: text("plan_day_slot_id").references(() => planDaySlots.id, {
    onDelete: "set null",
  }),
  planItemId: text("plan_item_id")
    .notNull()
    .references(() => planItems.id, { onDelete: "cascade" }),
  sessionDate: date("session_date").notNull(),
  workspaceType: sessionWorkspaceTypeEnum("workspace_type")
    .notNull()
    .default("homeschool_day"),
  status: lessonSessionStatusEnum("status").notNull().default("planned"),
  completionStatus: sessionCompletionStatusEnum("completion_status")
    .notNull()
    .default("not_started"),
  reviewState: sessionReviewStateEnum("review_state")
    .notNull()
    .default("not_required"),
  reviewRequired: boolean("review_required").notNull().default(false),
  actualMinutes: integer("actual_minutes"),
  scheduledMinutes: integer("scheduled_minutes"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedByAdultUserId: text("reviewed_by_adult_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  summary: text("summary"),
  notes: text("notes"),
  retrospective: text("retrospective"),
  nextAction: text("next_action"),
  deviationReason: text("deviation_reason"),
  metadata: metadataColumn(),
  ...timestamps(),
});
