import { and, asc, desc, eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import {
  activityAttempts,
  activityStandards,
  generatedArtifacts,
  interactiveActivities,
} from "@/lib/db/schema";

export type NewGeneratedArtifact = InferInsertModel<typeof generatedArtifacts>;
export type NewInteractiveActivity = InferInsertModel<typeof interactiveActivities>;
export type NewActivityStandard = InferInsertModel<typeof activityStandards>;
export type NewActivityAttempt = InferInsertModel<typeof activityAttempts>;

export function createActivitiesRepository(db: HomeschoolDb) {
  return {
    async createArtifact(input: NewGeneratedArtifact) {
      const [artifact] = await db.insert(generatedArtifacts).values(input).returning();
      return artifact;
    },

    async createActivity(input: NewInteractiveActivity) {
      const [activity] = await db.insert(interactiveActivities).values(input).returning();
      return activity;
    },

    async attachStandard(input: NewActivityStandard) {
      const [link] = await db.insert(activityStandards).values(input).returning();
      return link;
    },

    async createAttempt(input: NewActivityAttempt) {
      const [attempt] = await db.insert(activityAttempts).values(input).returning();
      return attempt;
    },

    async getActivity(activityId: string) {
      return db.query.interactiveActivities.findFirst({
        where: eq(interactiveActivities.id, activityId),
      });
    },

    async listActivitiesForLearner(learnerId: string) {
      return db
        .select()
        .from(interactiveActivities)
        .where(eq(interactiveActivities.learnerId, learnerId))
        .orderBy(asc(interactiveActivities.createdAt));
    },

    async listActivitiesForPlanItem(planItemId: string) {
      return db
        .select()
        .from(interactiveActivities)
        .where(eq(interactiveActivities.planItemId, planItemId))
        .orderBy(asc(interactiveActivities.createdAt));
    },

    async listAttemptsForActivity(activityId: string) {
      return db
        .select()
        .from(activityAttempts)
        .where(eq(activityAttempts.activityId, activityId))
        .orderBy(asc(activityAttempts.attemptNumber), asc(activityAttempts.createdAt));
    },

    async findInProgressAttempt(activityId: string, learnerId: string) {
      return db.query.activityAttempts.findFirst({
        where: and(
          eq(activityAttempts.activityId, activityId),
          eq(activityAttempts.learnerId, learnerId),
          eq(activityAttempts.status, "in_progress"),
        ),
        orderBy: [desc(activityAttempts.createdAt)],
      });
    },

    async getAttempt(attemptId: string) {
      return db.query.activityAttempts.findFirst({
        where: eq(activityAttempts.id, attemptId),
      });
    },

    async updateAttempt(
      attemptId: string,
      patch: Partial<
        Pick<
          NewActivityAttempt,
          | "status"
          | "responses"
          | "scorePercent"
          | "submittedAt"
          | "completedAt"
          | "metadata"
        >
      >,
    ) {
      const [attempt] = await db
        .update(activityAttempts)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(activityAttempts.id, attemptId))
        .returning();

      return attempt;
    },
  };
}
