import { type AnyPgColumn, boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { DEFAULT_TARGET_ITEMS_PER_DAY } from "@/lib/curriculum-routing/defaults";
import { activityAttempts } from "@/lib/db/schema/activities";
import { curriculumSources } from "@/lib/db/schema/curriculum";
import { learners } from "@/lib/db/schema/learners";
import { adultUsers } from "@/lib/db/schema/organizations";
import { planItems } from "@/lib/db/schema/planning";
import { metadataColumn, orderingColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const curriculumRouteNodeTypeEnum = pgEnum("curriculum_route_node_type", [
  "domain",
  "strand",
  "goal_group",
  "skill",
]);

export const curriculumRoutePrerequisiteKindEnum = pgEnum("curriculum_route_prerequisite_kind", [
  "explicit",
  "inferred",
  "hardPrerequisite",
  "recommendedBefore",
  "revisitAfter",
  "coPractice",
]);

export const learnerBranchActivationStatusEnum = pgEnum("learner_branch_activation_status", [
  "active",
  "paused",
  "completed",
]);

export const learnerSkillStateStatusEnum = pgEnum("learner_skill_state_status", [
  "not_started",
  "recommended",
  "scheduled",
  "in_progress",
  "completed",
  "mastered",
  "blocked",
  "paused",
  "skipped",
  "out_of_sequence",
]);

export const weeklyRouteStatusEnum = pgEnum("weekly_route_status", [
  "draft",
  "active",
  "superseded",
  "archived",
]);

export const weeklyRouteItemStateEnum = pgEnum("weekly_route_item_state", [
  "queued",
  "scheduled",
  "in_progress",
  "done",
  "removed",
]);

export const weeklyRouteOverrideKindEnum = pgEnum("weekly_route_override_kind", [
  "none",
  "reordered",
  "pinned",
  "deferred",
  "skip_acknowledged",
]);

export const routeOverrideEventTypeEnum = pgEnum("route_override_event_type", [
  "reorder",
  "pin",
  "defer",
  "skip_acknowledged",
  "repair_applied",
  "remove_from_week",
]);

export const planItemCurriculumOriginEnum = pgEnum("plan_item_curriculum_origin", [
  "manual",
  "curriculum_route",
  "recovery",
  "review",
]);

export const curriculumNodes = pgTable(
  "curriculum_nodes",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("cnode")),
    sourceId: text("source_id")
      .notNull()
      .references(() => curriculumSources.id, { onDelete: "cascade" }),
    parentNodeId: text("parent_node_id").references((): AnyPgColumn => curriculumNodes.id, {
      onDelete: "set null",
    }),
    normalizedType: curriculumRouteNodeTypeEnum("normalized_type").notNull(),
    title: text("title").notNull(),
    code: text("code"),
    description: text("description"),
    sequenceIndex: orderingColumn("sequence_index"),
    depth: integer("depth").notNull().default(0),
    normalizedPath: text("normalized_path").notNull(),
    originalLabel: text("original_label"),
    originalType: text("original_type"),
    estimatedMinutes: integer("estimated_minutes"),
    isActive: boolean("is_active").notNull().default(true),
    sourcePayload: metadataColumn("source_payload"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    curriculumNodePathUnique: uniqueIndex("curriculum_nodes_source_path_idx").on(
      table.sourceId,
      table.normalizedPath,
    ),
  }),
);

export const curriculumSkillPrerequisites = pgTable(
  "curriculum_skill_prerequisites",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("cprereq")),
    sourceId: text("source_id")
      .notNull()
      .references(() => curriculumSources.id, { onDelete: "cascade" }),
    skillNodeId: text("skill_node_id")
      .notNull()
      .references(() => curriculumNodes.id, { onDelete: "cascade" }),
    prerequisiteSkillNodeId: text("prerequisite_skill_node_id")
      .notNull()
      .references(() => curriculumNodes.id, { onDelete: "cascade" }),
    kind: curriculumRoutePrerequisiteKindEnum("kind").notNull().default("explicit"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    prerequisiteEdgeUnique: uniqueIndex("curriculum_skill_prerequisites_unique_idx").on(
      table.skillNodeId,
      table.prerequisiteSkillNodeId,
    ),
  }),
);

export const learnerRouteProfiles = pgTable(
  "learner_route_profiles",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("routeprofile")),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => curriculumSources.id, { onDelete: "cascade" }),
    targetItemsPerDay: integer("target_items_per_day").notNull().default(DEFAULT_TARGET_ITEMS_PER_DAY),
    targetMinutesPerDay: integer("target_minutes_per_day"),
    branchWeighting: metadataColumn("branch_weighting"),
    planningDays: metadataColumn("planning_days"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    learnerRouteProfileUnique: uniqueIndex("learner_route_profiles_learner_source_idx").on(
      table.learnerId,
      table.sourceId,
    ),
  }),
);

export const learnerBranchActivations = pgTable(
  "learner_branch_activations",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("branch")),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => curriculumSources.id, { onDelete: "cascade" }),
    nodeId: text("node_id")
      .notNull()
      .references(() => curriculumNodes.id, { onDelete: "cascade" }),
    status: learnerBranchActivationStatusEnum("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    learnerBranchActivationUnique: uniqueIndex("learner_branch_activations_unique_idx").on(
      table.learnerId,
      table.nodeId,
    ),
  }),
);

export const learnerSkillStates = pgTable(
  "learner_skill_states",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("skillstate")),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => curriculumSources.id, { onDelete: "cascade" }),
    skillNodeId: text("skill_node_id")
      .notNull()
      .references(() => curriculumNodes.id, { onDelete: "cascade" }),
    status: learnerSkillStateStatusEnum("status").notNull().default("not_started"),
    statusReason: text("status_reason"),
    firstScheduledAt: timestamp("first_scheduled_at", { withTimezone: true }),
    lastScheduledAt: timestamp("last_scheduled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    masteredAt: timestamp("mastered_at", { withTimezone: true }),
    lastActivityAttemptId: text("last_activity_attempt_id").references(() => activityAttempts.id, {
      onDelete: "set null",
    }),
    lastOutcomeSummary: metadataColumn("last_outcome_summary"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    learnerSkillStateUnique: uniqueIndex("learner_skill_states_learner_skill_idx").on(
      table.learnerId,
      table.skillNodeId,
    ),
  }),
);

export const weeklyRoutes = pgTable(
  "weekly_routes",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("wroute")),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => curriculumSources.id, { onDelete: "cascade" }),
    weekStartDate: date("week_start_date").notNull(),
    generationVersion: text("generation_version").notNull().default("1"),
    generationBasis: metadataColumn("generation_basis"),
    status: weeklyRouteStatusEnum("status").notNull().default("draft"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    weeklyRouteUnique: uniqueIndex("weekly_routes_learner_source_week_idx").on(
      table.learnerId,
      table.sourceId,
      table.weekStartDate,
    ),
  }),
);

export const weeklyRouteItems = pgTable(
  "weekly_route_items",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("wrouteitem")),
    weeklyRouteId: text("weekly_route_id")
      .notNull()
      .references(() => weeklyRoutes.id, { onDelete: "cascade" }),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    skillNodeId: text("skill_node_id")
      .notNull()
      .references(() => curriculumNodes.id, { onDelete: "cascade" }),
    recommendedPosition: orderingColumn("recommended_position"),
    currentPosition: orderingColumn("current_position"),
    scheduledDate: date("scheduled_date"),
    scheduledSlotIndex: integer("scheduled_slot_index"),
    manualOverrideKind: weeklyRouteOverrideKindEnum("manual_override_kind").notNull().default("none"),
    manualOverrideNote: text("manual_override_note"),
    state: weeklyRouteItemStateEnum("state").notNull().default("queued"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    weeklyRouteItemUnique: uniqueIndex("weekly_route_items_route_skill_date_idx").on(
      table.weeklyRouteId,
      table.skillNodeId,
      table.scheduledDate,
    ),
    weeklyRouteItemPositionIdx: index("weekly_route_items_route_position_idx").on(
      table.weeklyRouteId,
      table.currentPosition,
      table.createdAt,
    ),
  }),
);

export const routeOverrideEvents = pgTable("route_override_events", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("routeevent")),
  learnerId: text("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  weeklyRouteItemId: text("weekly_route_item_id")
    .notNull()
    .references(() => weeklyRouteItems.id, { onDelete: "cascade" }),
  eventType: routeOverrideEventTypeEnum("event_type").notNull(),
  payload: metadataColumn("payload"),
  createdByAdultUserId: text("created_by_adult_user_id").references(() => adultUsers.id, {
    onDelete: "set null",
  }),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const planItemCurriculumLinks = pgTable(
  "plan_item_curriculum_links",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("planroute")),
    planItemId: text("plan_item_id")
      .notNull()
      .references(() => planItems.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => curriculumSources.id, { onDelete: "cascade" }),
    skillNodeId: text("skill_node_id")
      .notNull()
      .references(() => curriculumNodes.id, { onDelete: "cascade" }),
    weeklyRouteItemId: text("weekly_route_item_id").references(() => weeklyRouteItems.id, {
      onDelete: "set null",
    }),
    origin: planItemCurriculumOriginEnum("origin").notNull().default("curriculum_route"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    planItemCurriculumLinkPlanItemUnique: uniqueIndex("plan_item_curriculum_links_plan_item_idx").on(
      table.planItemId,
    ),
    planItemCurriculumLinkWeeklyItemUnique: uniqueIndex("plan_item_curriculum_links_weekly_item_idx").on(
      table.weeklyRouteItemId,
    ),
  }),
);
