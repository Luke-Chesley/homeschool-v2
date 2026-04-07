import { type AnyPgColumn, boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { learners } from "@/lib/db/schema/learners";
import { organizations } from "@/lib/db/schema/organizations";
import { curriculumNodes } from "@/lib/db/schema/curriculumRouting";
import { metadataColumn, orderingColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";
import { standardNodes } from "@/lib/db/schema/standards";

export const curriculumSourceKindEnum = pgEnum("curriculum_source_kind", [
  "upload",
  "manual",
  "ai_draft",
  "external_link",
]);

export const curriculumSourceStatusEnum = pgEnum("curriculum_source_status", [
  "draft",
  "active",
  "archived",
  "failed_import",
]);

export const curriculumAssetStatusEnum = pgEnum("curriculum_asset_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const curriculumItemTypeEnum = pgEnum("curriculum_item_type", [
  "course",
  "unit",
  "lesson",
  "activity",
  "resource",
]);

export const curriculumSources = pgTable("curriculum_sources", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("source")),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  kind: curriculumSourceKindEnum("kind").notNull(),
  status: curriculumSourceStatusEnum("status").notNull().default("draft"),
  importVersion: integer("import_version").notNull().default(1),
  provenance: text("provenance"),
  summary: text("summary"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const curriculumPhases = pgTable("curriculum_phases", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("phase")),
  sourceId: text("source_id")
    .notNull()
    .references(() => curriculumSources.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  position: orderingColumn("position"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const curriculumPhaseNodes = pgTable(
  "curriculum_phase_nodes",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("phnode")),
    phaseId: text("phase_id")
      .notNull()
      .references(() => curriculumPhases.id, { onDelete: "cascade" }),
    curriculumNodeId: text("curriculum_node_id")
      .notNull()
      .references(() => curriculumNodes.id, { onDelete: "cascade" }),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    uniquePhaseNode: uniqueIndex("unique_phase_node_idx").on(table.phaseId, table.curriculumNodeId),
  }),
);

export const curriculumProgressionStatusEnum = pgEnum("curriculum_progression_status", [
  "not_attempted",
  "explicit_ready",
  "explicit_failed",
  "fallback_only",
  "stale",
]);

export const curriculumProgressionProvenanceEnum = pgEnum("curriculum_progression_provenance", [
  "initial_generation",
  "manual_regeneration",
  "fallback_inference",
]);

export const curriculumProgressionState = pgTable(
  "curriculum_progression_state",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("progstate")),
    sourceId: text("source_id")
      .notNull()
      .references(() => curriculumSources.id, { onDelete: "cascade" }),
    status: curriculumProgressionStatusEnum("status").notNull().default("not_attempted"),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastFailureReason: text("last_failure_reason"),
    lastAcceptedPhaseCount: integer("last_accepted_phase_count").notNull().default(0),
    lastAcceptedEdgeCount: integer("last_accepted_edge_count").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    usingInferredFallback: boolean("using_inferred_fallback").notNull().default(false),
    provenance: curriculumProgressionProvenanceEnum("provenance"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    progressionStateSourceUnique: uniqueIndex("curriculum_progression_state_source_idx").on(
      table.sourceId,
    ),
  }),
);

export const curriculumAssets = pgTable("curriculum_assets", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("asset")),
  sourceId: text("source_id")
    .notNull()
    .references(() => curriculumSources.id, { onDelete: "cascade" }),
  storageBucket: text("storage_bucket").notNull(),
  storagePath: text("storage_path").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  status: curriculumAssetStatusEnum("status").notNull().default("pending"),
  extractedText: text("extracted_text"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const curriculumItems = pgTable("curriculum_items", {
  id: text("id").primaryKey().$defaultFn(() => prefixedId("item")),
  sourceId: text("source_id")
    .notNull()
    .references(() => curriculumSources.id, { onDelete: "cascade" }),
  learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
  parentItemId: text("parent_item_id").references((): AnyPgColumn => curriculumItems.id, {
    onDelete: "set null",
  }),
  itemType: curriculumItemTypeEnum("item_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  subject: text("subject"),
  estimatedMinutes: integer("estimated_minutes"),
  position: orderingColumn("position"),
  metadata: metadataColumn(),
  ...timestamps(),
});

export const curriculumItemStandards = pgTable(
  "curriculum_item_standards",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("currstd")),
    curriculumItemId: text("curriculum_item_id")
      .notNull()
      .references(() => curriculumItems.id, { onDelete: "cascade" }),
    standardNodeId: text("standard_node_id")
      .notNull()
      .references(() => standardNodes.id, { onDelete: "cascade" }),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    curriculumItemStandardUnique: uniqueIndex("curriculum_item_standards_unique_idx").on(
      table.curriculumItemId,
      table.standardNodeId,
    ),
  }),
);
