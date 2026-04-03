import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import { goalMappings, standardFrameworks, standardNodes } from "@/lib/db/schema";

export type NewStandardFramework = InferInsertModel<typeof standardFrameworks>;
export type NewStandardNode = InferInsertModel<typeof standardNodes>;
export type NewGoalMapping = InferInsertModel<typeof goalMappings>;

export function createStandardsRepository(db: HomeschoolDb) {
  return {
    async createFramework(input: NewStandardFramework) {
      const [framework] = await db.insert(standardFrameworks).values(input).returning();
      return framework;
    },

    async createNode(input: NewStandardNode) {
      const [node] = await db.insert(standardNodes).values(input).returning();
      return node;
    },

    async mapGoal(input: NewGoalMapping) {
      const [mapping] = await db.insert(goalMappings).values(input).returning();
      return mapping;
    },

    async listFrameworks() {
      return db.select().from(standardFrameworks).orderBy(asc(standardFrameworks.name));
    },

    async listFrameworksForOrganization(organizationId: string) {
      return db
        .select()
        .from(standardFrameworks)
        .where(
          or(
            eq(standardFrameworks.organizationId, organizationId),
            isNull(standardFrameworks.organizationId),
          ),
        )
        .orderBy(asc(standardFrameworks.name));
    },

    async listNodesByFramework(frameworkId: string) {
      return db
        .select()
        .from(standardNodes)
        .where(eq(standardNodes.frameworkId, frameworkId))
        .orderBy(asc(standardNodes.depth), asc(standardNodes.ordering), asc(standardNodes.code));
    },

    async listChildren(frameworkId: string, parentId: string | null) {
      return db
        .select()
        .from(standardNodes)
        .where(
          parentId
            ? and(eq(standardNodes.frameworkId, frameworkId), eq(standardNodes.parentId, parentId))
            : and(eq(standardNodes.frameworkId, frameworkId), isNull(standardNodes.parentId)),
        )
        .orderBy(asc(standardNodes.ordering), asc(standardNodes.code));
    },

    async listNodesByCodes(codes: string[]) {
      if (codes.length === 0) {
        return [];
      }

      return db
        .select()
        .from(standardNodes)
        .where(inArray(standardNodes.code, codes))
        .orderBy(asc(standardNodes.code));
    },

    async searchNodes(params: {
      frameworkId: string;
      query: string;
      subject?: string;
      gradeBand?: string;
    }) {
      const whereClauses = [
        eq(standardNodes.frameworkId, params.frameworkId),
        or(
          ilike(standardNodes.code, `%${params.query}%`),
          ilike(standardNodes.title, `%${params.query}%`),
          ilike(standardNodes.description, `%${params.query}%`),
        ),
      ];

      if (params.subject) {
        whereClauses.push(eq(standardNodes.subject, params.subject));
      }

      if (params.gradeBand) {
        whereClauses.push(eq(standardNodes.gradeBand, params.gradeBand));
      }

      return db
        .select()
        .from(standardNodes)
        .where(and(...whereClauses))
        .orderBy(asc(standardNodes.depth), asc(standardNodes.code));
    },
  };
}
