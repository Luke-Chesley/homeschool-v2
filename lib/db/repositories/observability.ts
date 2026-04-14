import { and, asc, desc, eq, gte } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import { productEvents } from "@/lib/db/schema";

export type NewProductEvent = InferInsertModel<typeof productEvents>;

export function createObservabilityRepository(db: HomeschoolDb) {
  return {
    async createProductEvent(input: NewProductEvent) {
      const [event] = await db.insert(productEvents).values(input).returning();
      return event;
    },

    async listProductEventsForOrganization(organizationId: string, options?: { since?: Date }) {
      return db
        .select()
        .from(productEvents)
        .where(
          and(
            eq(productEvents.organizationId, organizationId),
            options?.since ? gte(productEvents.createdAt, options.since) : undefined,
          ),
        )
        .orderBy(asc(productEvents.createdAt));
    },

    async listRecentProductEvents(organizationId: string, limit = 100) {
      return db
        .select()
        .from(productEvents)
        .where(eq(productEvents.organizationId, organizationId))
        .orderBy(desc(productEvents.createdAt))
        .limit(limit);
    },
  };
}
