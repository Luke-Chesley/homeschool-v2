import { asc, eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import { intakeSourceAssets, intakeSourcePackages } from "@/lib/db/schema";

export type NewIntakeSourcePackage = InferInsertModel<typeof intakeSourcePackages>;
export type NewIntakeSourceAsset = InferInsertModel<typeof intakeSourceAssets>;

export function createAiIntakeRepository(db: HomeschoolDb) {
  return {
    async createPackage(input: NewIntakeSourcePackage) {
      const [pkg] = await db.insert(intakeSourcePackages).values(input).returning();
      return pkg;
    },

    async updatePackage(
      id: string,
      patch: Partial<NewIntakeSourcePackage>,
    ) {
      const [pkg] = await db
        .update(intakeSourcePackages)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(intakeSourcePackages.id, id))
        .returning();
      return pkg;
    },

    async getPackage(id: string) {
      return db.query.intakeSourcePackages.findFirst({
        where: eq(intakeSourcePackages.id, id),
      });
    },

    async createAsset(input: NewIntakeSourceAsset) {
      const [asset] = await db.insert(intakeSourceAssets).values(input).returning();
      return asset;
    },

    async listAssetsForPackage(packageId: string) {
      return db
        .select()
        .from(intakeSourceAssets)
        .where(eq(intakeSourceAssets.packageId, packageId))
        .orderBy(asc(intakeSourceAssets.createdAt));
    },
  };
}
