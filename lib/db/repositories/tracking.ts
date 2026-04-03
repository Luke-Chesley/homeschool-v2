import { asc, eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import {
  evidenceRecordObjectives,
  evidenceRecords,
  feedbackEntries,
  observationNotes,
  progressRecords,
  progressRecordStandards,
  reviewQueueItems,
} from "@/lib/db/schema";

export type NewProgressRecord = InferInsertModel<typeof progressRecords>;
export type NewProgressRecordStandard = InferInsertModel<typeof progressRecordStandards>;
export type NewObservationNote = InferInsertModel<typeof observationNotes>;
export type NewEvidenceRecord = InferInsertModel<typeof evidenceRecords>;
export type NewEvidenceRecordObjective = InferInsertModel<typeof evidenceRecordObjectives>;
export type NewFeedbackEntry = InferInsertModel<typeof feedbackEntries>;
export type NewReviewQueueItem = InferInsertModel<typeof reviewQueueItems>;

export function createTrackingRepository(db: HomeschoolDb) {
  return {
    async createProgressRecord(input: NewProgressRecord) {
      const [record] = await db.insert(progressRecords).values(input).returning();
      return record;
    },

    async findProgressByAttemptId(activityAttemptId: string) {
      return db.query.progressRecords.findFirst({
        where: eq(progressRecords.activityAttemptId, activityAttemptId),
      });
    },

    async attachStandard(input: NewProgressRecordStandard) {
      const [link] = await db.insert(progressRecordStandards).values(input).returning();
      return link;
    },

    async addObservationNote(input: NewObservationNote) {
      const [note] = await db.insert(observationNotes).values(input).returning();
      return note;
    },

    async createEvidenceRecord(input: NewEvidenceRecord) {
      const [record] = await db.insert(evidenceRecords).values(input).returning();
      return record;
    },

    async attachObjectiveToEvidence(input: NewEvidenceRecordObjective) {
      const [link] = await db.insert(evidenceRecordObjectives).values(input).returning();
      return link;
    },

    async createFeedbackEntry(input: NewFeedbackEntry) {
      const [entry] = await db.insert(feedbackEntries).values(input).returning();
      return entry;
    },

    async enqueueReviewItem(input: NewReviewQueueItem) {
      const [entry] = await db.insert(reviewQueueItems).values(input).returning();
      return entry;
    },

    async listEvidenceForLearner(learnerId: string) {
      return db
        .select()
        .from(evidenceRecords)
        .where(eq(evidenceRecords.learnerId, learnerId))
        .orderBy(asc(evidenceRecords.createdAt));
    },

    async listReviewQueueForOrganization(organizationId: string) {
      return db
        .select()
        .from(reviewQueueItems)
        .where(eq(reviewQueueItems.organizationId, organizationId))
        .orderBy(asc(reviewQueueItems.createdAt));
    },

    async listProgressForLearner(learnerId: string) {
      return db
        .select()
        .from(progressRecords)
        .where(eq(progressRecords.learnerId, learnerId))
        .orderBy(asc(progressRecords.createdAt));
    },

    async listNotesForLearner(learnerId: string) {
      return db
        .select()
        .from(observationNotes)
        .where(eq(observationNotes.learnerId, learnerId))
        .orderBy(asc(observationNotes.createdAt));
    },
  };
}
