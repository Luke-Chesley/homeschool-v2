import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import {
  activityAttempts,
  activityEvidence,
  activityStandards,
  generatedArtifacts,
  interactiveActivities,
} from "@/lib/db/schema";

export type NewGeneratedArtifact = InferInsertModel<typeof generatedArtifacts>;
export type NewInteractiveActivity = InferInsertModel<typeof interactiveActivities>;
export type NewActivityStandard = InferInsertModel<typeof activityStandards>;
export type NewActivityAttempt = InferInsertModel<typeof activityAttempts>;
export type NewActivityEvidence = InferInsertModel<typeof activityEvidence>;

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

    async findActivityBySessionId(sessionId: string) {
      const [activity] = await db
        .select()
        .from(interactiveActivities)
        .where(sql`${interactiveActivities.metadata} ->> 'sessionId' = ${sessionId}`)
        .limit(1);

      return activity ?? null;
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

    async listActivitiesForSession(sessionId: string) {
      return db
        .select()
        .from(interactiveActivities)
        .where(eq(interactiveActivities.lessonSessionId, sessionId))
        .orderBy(asc(interactiveActivities.createdAt));
    },

    async findPrimaryActivityForSession(sessionId: string) {
      return db.query.interactiveActivities.findFirst({
        where: eq(interactiveActivities.lessonSessionId, sessionId),
        orderBy: [asc(interactiveActivities.createdAt)],
      });
    },

    /**
     * Find the activity for a specific lesson draft version (session + fingerprint).
     * Returns the activity if it matches the current fingerprint, or null if none exists.
     */
    async findActivityForLessonDraft(lessonSessionId: string, lessonDraftFingerprint: string) {
      return db.query.interactiveActivities.findFirst({
        where: and(
          eq(interactiveActivities.lessonSessionId, lessonSessionId),
          eq(interactiveActivities.lessonDraftFingerprint, lessonDraftFingerprint),
        ),
        orderBy: [asc(interactiveActivities.createdAt)],
      });
    },

    /**
     * Find any published activity for a session, regardless of fingerprint.
     * Used to detect stale activities (fingerprint mismatch = stale).
     */
    async findPublishedActivityForSession(lessonSessionId: string) {
      return db.query.interactiveActivities.findFirst({
        where: and(
          eq(interactiveActivities.lessonSessionId, lessonSessionId),
          eq(interactiveActivities.status, "published"),
        ),
        orderBy: [desc(interactiveActivities.createdAt)],
      });
    },

    /**
     * Mark all published activities for a session as stale (archived).
     * Called before generating a new activity for a changed lesson draft.
     */
    async archiveActivitiesForSession(lessonSessionId: string) {
      await db
        .update(interactiveActivities)
        .set({ status: "archived", updatedAt: new Date() })
        .where(
          and(
            eq(interactiveActivities.lessonSessionId, lessonSessionId),
            eq(interactiveActivities.status, "published"),
          ),
        );
    },

    async listPublishedActivitiesForLearner(learnerId: string) {
      return db
        .select()
        .from(interactiveActivities)
        .where(
          and(
            eq(interactiveActivities.learnerId, learnerId),
            eq(interactiveActivities.status, "published"),
          ),
        )
        .orderBy(asc(interactiveActivities.createdAt));
    },

    async listArtifactsForPlanItem(planItemId: string) {
      return db
        .select()
        .from(generatedArtifacts)
        .where(eq(generatedArtifacts.planItemId, planItemId))
        .orderBy(desc(generatedArtifacts.createdAt));
    },

    async updateArtifact(id: string, input: Partial<NewGeneratedArtifact>) {
      const [artifact] = await db
        .update(generatedArtifacts)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(generatedArtifacts.id, id))
        .returning();

      return artifact ?? null;
    },

    async findArtifactById(artifactId: string) {
      return db.query.generatedArtifacts.findFirst({
        where: eq(generatedArtifacts.id, artifactId),
      });
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
            eq(activityAttempts.lessonSessionId, sessionId),
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
            eq(activityAttempts.lessonSessionId, sessionId),
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

    // -------------------------------------------------------------------------
    // Activity evidence (structured evidence capture for v2 ActivitySpec)
    // -------------------------------------------------------------------------

    async createEvidence(input: NewActivityEvidence) {
      const [record] = await db.insert(activityEvidence).values(input).returning();
      return record;
    },

    async listEvidenceForAttempt(attemptId: string) {
      return db
        .select()
        .from(activityEvidence)
        .where(eq(activityEvidence.attemptId, attemptId))
        .orderBy(asc(activityEvidence.capturedAt));
    },

    async listEvidenceForLearner(learnerId: string) {
      return db
        .select()
        .from(activityEvidence)
        .where(eq(activityEvidence.learnerId, learnerId))
        .orderBy(desc(activityEvidence.capturedAt));
    },

    async listEvidenceForSession(lessonSessionId: string) {
      return db
        .select()
        .from(activityEvidence)
        .where(eq(activityEvidence.lessonSessionId, lessonSessionId))
        .orderBy(asc(activityEvidence.capturedAt));
    },

    async listEvidenceForActivity(activityId: string) {
      return db
        .select()
        .from(activityEvidence)
        .where(eq(activityEvidence.activityId, activityId))
        .orderBy(asc(activityEvidence.capturedAt));
    },

    async updateEvidenceReviewState(id: string, reviewState: string) {
      const [record] = await db
        .update(activityEvidence)
        .set({ reviewState, updatedAt: new Date() })
        .where(eq(activityEvidence.id, id))
        .returning();
      return record ?? null;
    },

    // -------------------------------------------------------------------------
    // Activity spec helpers (v2 activities — activityType = "activity_spec")
    // -------------------------------------------------------------------------

    async createActivitySpec(input: NewInteractiveActivity) {
      return this.createActivity({ ...input, activityType: "activity_spec" });
    },

    async listSpecActivitiesForLearner(learnerId: string) {
      return db
        .select()
        .from(interactiveActivities)
        .where(
          and(
            eq(interactiveActivities.learnerId, learnerId),
            eq(interactiveActivities.activityType, "activity_spec"),
          ),
        )
        .orderBy(asc(interactiveActivities.createdAt));
    },
  };
}
