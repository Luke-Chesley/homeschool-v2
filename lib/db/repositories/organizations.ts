import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import { adultUsers, memberships, organizations, learners } from "@/lib/db/schema";

export type NewOrganization = InferInsertModel<typeof organizations>;
export type NewAdultUser = InferInsertModel<typeof adultUsers>;
export type NewMembership = InferInsertModel<typeof memberships>;

export function createOrganizationRepository(db: HomeschoolDb) {
  return {
    async createOrganization(input: NewOrganization) {
      const [organization] = await db.insert(organizations).values(input).returning();
      return organization;
    },

    async upsertOrganization(input: NewOrganization) {
      const [organization] = await db
        .insert(organizations)
        .values(input)
        .onConflictDoUpdate({
          target: organizations.id,
          set: {
            name: input.name,
            slug: input.slug,
            type: input.type,
            timezone: input.timezone,
            metadata: input.metadata,
            updatedAt: new Date(),
          },
        })
        .returning();

      return organization;
    },

    async createAdultUser(input: NewAdultUser) {
      const [adultUser] = await db.insert(adultUsers).values(input).returning();
      return adultUser;
    },

    async addMembership(input: NewMembership) {
      const [membership] = await db.insert(memberships).values(input).returning();
      return membership;
    },

    async findOrganizationById(organizationId: string) {
      return db.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
      });
    },

    async listMemberships(organizationId: string) {
      return db
        .select({
          membership: memberships,
          adultUser: adultUsers,
        })
        .from(memberships)
        .innerJoin(adultUsers, eq(adultUsers.id, memberships.adultUserId))
        .where(eq(memberships.organizationId, organizationId));
    },

    async listLearners(organizationId: string) {
      return db.select().from(learners).where(eq(learners.organizationId, organizationId));
    },
  };
}
