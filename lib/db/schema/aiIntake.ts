import { index, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

import { learners } from "@/lib/db/schema/learners";
import { organizations } from "@/lib/db/schema/organizations";
import { metadataColumn, prefixedId, timestamps } from "@/lib/db/schema/shared";

export const intakeSourcePackageModalityEnum = pgEnum("intake_source_package_modality", [
  "text",
  "outline",
  "photo",
  "image",
  "pdf",
  "file",
]);

export const intakeSourcePackageStatusEnum = pgEnum("intake_source_package_status", [
  "draft",
  "ready",
  "failed",
]);

export const intakeSourceAssetExtractionStatusEnum = pgEnum(
  "intake_source_asset_extraction_status",
  ["pending", "ready", "requires_review", "failed"],
);

export const intakeSourcePackages = pgTable(
  "intake_source_packages",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("ipkg")),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    learnerId: text("learner_id").references(() => learners.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    modality: intakeSourcePackageModalityEnum("modality").notNull(),
    status: intakeSourcePackageStatusEnum("status").notNull().default("draft"),
    normalizedText: text("normalized_text").notNull().default(""),
    sourceFingerprint: text("source_fingerprint"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    intakeSourcePackagesOrgIdx: index("intake_source_packages_org_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    intakeSourcePackagesLearnerIdx: index("intake_source_packages_learner_idx").on(
      table.learnerId,
      table.createdAt,
    ),
  }),
);

export const intakeSourceAssets = pgTable(
  "intake_source_assets",
  {
    id: text("id").primaryKey().$defaultFn(() => prefixedId("iasset")),
    packageId: text("package_id")
      .notNull()
      .references(() => intakeSourcePackages.id, { onDelete: "cascade" }),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size"),
    extractionStatus: intakeSourceAssetExtractionStatusEnum("extraction_status")
      .notNull()
      .default("pending"),
    extractedText: text("extracted_text"),
    metadata: metadataColumn(),
    ...timestamps(),
  },
  (table) => ({
    intakeSourceAssetsPackageIdx: index("intake_source_assets_package_idx").on(table.packageId),
  }),
);
