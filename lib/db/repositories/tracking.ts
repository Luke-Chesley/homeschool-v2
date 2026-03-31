import { asc, eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import { observationNotes, progressRecords, progressRecordStandards } from "@/lib/db/schema";

export type NewProgressRecord = InferInsertModel<typeof progressRecords>;
export type NewProgressRecordStandard = InferInsertModel<typeof progressRecordStandards>;
export type NewObservationNote = InferInsertModel<typeof observationNotes>;

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
