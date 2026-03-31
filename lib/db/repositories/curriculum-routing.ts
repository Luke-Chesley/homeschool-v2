import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import { learnerSkillStates, planItemCurriculumLinks } from "@/lib/db/schema";

const UNFINISHED_SCHEDULED_STATUSES = ["scheduled", "in_progress"] as const;

export type LearnerSkillStateRecord = InferSelectModel<typeof learnerSkillStates>;
export type PlanItemCurriculumLinkRecord = InferSelectModel<typeof planItemCurriculumLinks>;

export interface UpsertLearnerSkillStateSummaryInput {
  learnerId: string;
  sourceId: string;
  skillNodeId: string;
  status: LearnerSkillStateRecord["status"];
  statusReason: string | null;
  firstScheduledAt?: Date | null;
  lastScheduledAt?: Date | null;
  completedAt?: Date | null;
  masteredAt?: Date | null;
  lastActivityAttemptId?: string | null;
  lastOutcomeSummary: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function createCurriculumRoutingRepository(db: HomeschoolDb) {
  return {
    async findPlanItemCurriculumLink(planItemId: string) {
      return db.query.planItemCurriculumLinks.findFirst({
        where: eq(planItemCurriculumLinks.planItemId, planItemId),
      });
    },

    async findLearnerSkillState(learnerId: string, skillNodeId: string) {
      return db.query.learnerSkillStates.findFirst({
        where: and(
          eq(learnerSkillStates.learnerId, learnerId),
          eq(learnerSkillStates.skillNodeId, skillNodeId),
        ),
      });
    },

    async upsertLearnerSkillStateSummary(input: UpsertLearnerSkillStateSummaryInput) {
      const [state] = await db
        .insert(learnerSkillStates)
        .values({
          learnerId: input.learnerId,
          sourceId: input.sourceId,
          skillNodeId: input.skillNodeId,
          status: input.status,
          statusReason: input.statusReason,
          firstScheduledAt: input.firstScheduledAt ?? null,
          lastScheduledAt: input.lastScheduledAt ?? null,
          completedAt: input.completedAt ?? null,
          masteredAt: input.masteredAt ?? null,
          lastActivityAttemptId: input.lastActivityAttemptId ?? null,
          lastOutcomeSummary: input.lastOutcomeSummary,
          metadata: input.metadata ?? {},
        })
        .onConflictDoUpdate({
          target: [learnerSkillStates.learnerId, learnerSkillStates.skillNodeId],
          set: {
            sourceId: input.sourceId,
            status: input.status,
            statusReason: input.statusReason,
            firstScheduledAt: input.firstScheduledAt ?? null,
            lastScheduledAt: input.lastScheduledAt ?? null,
            completedAt: input.completedAt ?? null,
            masteredAt: input.masteredAt ?? null,
            lastActivityAttemptId: input.lastActivityAttemptId ?? null,
            lastOutcomeSummary: input.lastOutcomeSummary,
            metadata: input.metadata ?? {},
            updatedAt: new Date(),
          },
        })
        .returning();

      return state;
    },

    async countUnfinishedScheduledSkills(params: {
      learnerId: string;
      sourceId: string;
      excludeSkillNodeId?: string;
    }) {
      const whereClauses = [
        eq(learnerSkillStates.learnerId, params.learnerId),
        eq(learnerSkillStates.sourceId, params.sourceId),
        inArray(learnerSkillStates.status, [...UNFINISHED_SCHEDULED_STATUSES]),
      ];

      if (params.excludeSkillNodeId) {
        whereClauses.push(ne(learnerSkillStates.skillNodeId, params.excludeSkillNodeId));
      }

      const [result] = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(learnerSkillStates)
        .where(and(...whereClauses));

      return Number(result?.count ?? 0);
    },

    async listSkillStatesForSource(learnerId: string, sourceId: string) {
      return db
        .select()
        .from(learnerSkillStates)
        .where(
          and(
            eq(learnerSkillStates.learnerId, learnerId),
            eq(learnerSkillStates.sourceId, sourceId),
          ),
        )
        .orderBy(asc(learnerSkillStates.createdAt), asc(learnerSkillStates.skillNodeId));
    },
  };
}
