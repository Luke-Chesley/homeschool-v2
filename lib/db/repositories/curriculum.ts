import { asc, eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import {
  curriculumAssets,
  curriculumItems,
  curriculumItemStandards,
  curriculumSources,
} from "@/lib/db/schema";

export type NewCurriculumSource = InferInsertModel<typeof curriculumSources>;
export type NewCurriculumAsset = InferInsertModel<typeof curriculumAssets>;
export type NewCurriculumItem = InferInsertModel<typeof curriculumItems>;
export type NewCurriculumItemStandard = InferInsertModel<typeof curriculumItemStandards>;

export function createCurriculumRepository(db: HomeschoolDb) {
  return {
    async createSource(input: NewCurriculumSource) {
      const [source] = await db.insert(curriculumSources).values(input).returning();
      return source;
    },

    async createAsset(input: NewCurriculumAsset) {
      const [asset] = await db.insert(curriculumAssets).values(input).returning();
      return asset;
    },

    async createItem(input: NewCurriculumItem) {
      const [item] = await db.insert(curriculumItems).values(input).returning();
      return item;
    },

    async attachStandard(input: NewCurriculumItemStandard) {
      const [link] = await db.insert(curriculumItemStandards).values(input).returning();
      return link;
    },

    async listSourcesForOrganization(organizationId: string) {
      return db
        .select()
        .from(curriculumSources)
        .where(eq(curriculumSources.organizationId, organizationId))
        .orderBy(asc(curriculumSources.createdAt));
    },

    async listItemsForSource(sourceId: string) {
      return db
        .select()
        .from(curriculumItems)
        .where(eq(curriculumItems.sourceId, sourceId))
        .orderBy(asc(curriculumItems.position), asc(curriculumItems.createdAt));
    },
  };
}
