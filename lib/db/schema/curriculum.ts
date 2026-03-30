import { type AnyPgColumn, integer, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { learners } from "@/lib/db/schema/learners";
import { organizations } from "@/lib/db/schema/organizations";
import { metadataColumn, orderingColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";
import { standardNodes } from "@/lib/db/schema/standards";

export const curriculumSourceKindEnum = pgEnum("curriculum_source_kind", [
  "upload",
  "manual",
  "ai_draft",
  "external_link",
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
  provenance: text("provenance"),
  summary: text("summary"),
  metadata: metadataColumn(),
  ...timestamps(),
});

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
