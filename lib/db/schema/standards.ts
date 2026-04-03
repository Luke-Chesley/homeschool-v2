import { type AnyPgColumn, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { learningGoals } from "@/lib/db/schema/learners";
import { organizations } from "@/lib/db/schema/organizations";
import { metadataColumn, orderingColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const frameworkTypeEnum = pgEnum("framework_type", [
  "academic_standard",
  "competency_framework",
  "role_matrix",
  "exam_blueprint",
  "custom_goal",
]);

export const objectiveNodeTypeEnum = pgEnum("objective_node_type", [
  "domain",
  "strand",
  "competency",
  "objective",
  "checkpoint",
]);

export const standardFrameworks = pgTable("standard_frameworks", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("framework")),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  frameworkType: frameworkTypeEnum("framework_type").notNull().default("academic_standard"),
  version: text("version"),
  jurisdiction: text("jurisdiction"),
  subject: text("subject"),
  description: text("description"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const standardNodes = pgTable(
  "standard_nodes",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("standard")),
    frameworkId: text("framework_id")
      .notNull()
      .references(() => standardFrameworks.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnyPgColumn => standardNodes.id, {
      onDelete: "set null",
    }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    objectiveType: objectiveNodeTypeEnum("objective_type").notNull().default("objective"),
    gradeBand: text("grade_band"),
    subject: text("subject"),
    completionCriteria: metadataColumn("completion_criteria"),
    masteryRubric: metadataColumn("mastery_rubric"),
    depth: integer("depth").notNull().default(0),
    ordering: orderingColumn(),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    frameworkCodeUnique: uniqueIndex("standard_nodes_framework_code_idx").on(
      table.frameworkId,
      table.code,
    ),
  }),
);

export const goalMappings = pgTable(
  "goal_mappings",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("goalmap")),
    learningGoalId: text("learning_goal_id")
      .notNull()
      .references(() => learningGoals.id, { onDelete: "cascade" }),
    standardNodeId: text("standard_node_id")
      .notNull()
      .references(() => standardNodes.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("manual"),
    rationale: text("rationale"),
    confidence: integer("confidence").notNull().default(100),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    goalStandardUnique: uniqueIndex("goal_mappings_goal_standard_idx").on(
      table.learningGoalId,
      table.standardNodeId,
    ),
  }),
);
