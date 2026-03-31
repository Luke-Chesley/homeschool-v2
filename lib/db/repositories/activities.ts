import { and, asc, desc, eq, sql } from "drizzle-orm";
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

    async upsertActivity(input: NewInteractiveActivity) {
      const [activity] = await db
        .insert(interactiveActivities)
        .values(input)
        .onConflictDoUpdate({
          target: interactiveActivities.id,
          set: {
            organizationId: input.organizationId,
            learnerId: input.learnerId,
            planItemId: input.planItemId,
            lessonSessionId: input.lessonSessionId,
            artifactId: input.artifactId,
            activityType: input.activityType,
            status: input.status,
            title: input.title,
            schemaVersion: input.schemaVersion,
            definition: input.definition,
            masteryRubric: input.masteryRubric,
            metadata: input.metadata,
            updatedAt: new Date(),
          },
        })
        .returning();

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

    async findActivityById(activityId: string) {
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

    async listAttemptsForActivityAndLearner(activityId: string, learnerId: string) {
      return db
        .select()
        .from(activityAttempts)
        .where(
          and(
            eq(activityAttempts.activityId, activityId),
            eq(activityAttempts.learnerId, learnerId),
          ),
        )
        .orderBy(desc(activityAttempts.attemptNumber), desc(activityAttempts.createdAt));
    },

    async listAttemptsForLearner(learnerId: string) {
      return db
        .select()
        .from(activityAttempts)
        .where(eq(activityAttempts.learnerId, learnerId))
        .orderBy(desc(activityAttempts.createdAt), desc(activityAttempts.attemptNumber));
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

    async findInProgressAttemptForSession(sessionId: string, learnerId: string) {
      const [attempt] = await db
        .select()
        .from(activityAttempts)
        .where(
          and(
            eq(activityAttempts.learnerId, learnerId),
            eq(activityAttempts.status, "in_progress"),
            sql`${activityAttempts.metadata} ->> 'sessionId' = ${sessionId}`,
          ),
        )
        .orderBy(desc(activityAttempts.attemptNumber), desc(activityAttempts.createdAt))
        .limit(1);

      return attempt ?? null;
    },

    async findLatestAttemptForSession(sessionId: string, learnerId: string) {
      const [attempt] = await db
        .select()
        .from(activityAttempts)
        .where(
          and(
            eq(activityAttempts.learnerId, learnerId),
            sql`${activityAttempts.metadata} ->> 'sessionId' = ${sessionId}`,
          ),
        )
        .orderBy(desc(activityAttempts.attemptNumber), desc(activityAttempts.createdAt))
        .limit(1);

      return attempt ?? null;
    },

    async getAttempt(attemptId: string) {
      return db.query.activityAttempts.findFirst({
        where: eq(activityAttempts.id, attemptId),
      });
    },

    async findAttemptById(attemptId: string) {
      return db.query.activityAttempts.findFirst({
        where: eq(activityAttempts.id, attemptId),
      });
    },

    async updateAttempt(id: string, input: Partial<NewActivityAttempt>) {
      const [attempt] = await db
        .update(activityAttempts)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(activityAttempts.id, id))
        .returning();

      return attempt ?? null;
    },
  };
}
