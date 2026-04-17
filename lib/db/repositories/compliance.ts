import { and, asc, desc, eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import {
  complianceEvaluationRecords,
  compliancePrograms,
  complianceProgressSnapshots,
  complianceReportDrafts,
  complianceTasks,
} from "@/lib/db/schema";

export type NewComplianceProgram = InferInsertModel<typeof compliancePrograms>;
export type NewComplianceProgressSnapshot = InferInsertModel<typeof complianceProgressSnapshots>;
export type NewComplianceEvaluationRecord = InferInsertModel<typeof complianceEvaluationRecords>;
export type NewComplianceTask = InferInsertModel<typeof complianceTasks>;
export type NewComplianceReportDraft = InferInsertModel<typeof complianceReportDrafts>;

export function createComplianceRepository(db: HomeschoolDb) {
  return {
    async createProgram(input: NewComplianceProgram) {
      const [program] = await db.insert(compliancePrograms).values(input).returning();
      return program;
    },

    async updateProgram(programId: string, patch: Partial<NewComplianceProgram>) {
      const [program] = await db
        .update(compliancePrograms)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(compliancePrograms.id, programId))
        .returning();
      return program ?? null;
    },

    async findProgramById(programId: string) {
      return db.query.compliancePrograms.findFirst({
        where: eq(compliancePrograms.id, programId),
      });
    },

    async findLatestProgramForLearner(learnerId: string) {
      return db.query.compliancePrograms.findFirst({
        where: eq(compliancePrograms.learnerId, learnerId),
        orderBy: [desc(compliancePrograms.startDate), desc(compliancePrograms.createdAt)],
      });
    },

    async findActiveProgramForLearner(learnerId: string) {
      return db.query.compliancePrograms.findFirst({
        where: and(
          eq(compliancePrograms.learnerId, learnerId),
          eq(compliancePrograms.status, "active"),
        ),
        orderBy: [desc(compliancePrograms.startDate), desc(compliancePrograms.createdAt)],
      });
    },

    async listProgramsForLearner(learnerId: string) {
      return db.query.compliancePrograms.findMany({
        where: eq(compliancePrograms.learnerId, learnerId),
        orderBy: [desc(compliancePrograms.startDate), desc(compliancePrograms.createdAt)],
      });
    },

    async listSnapshotsForProgram(complianceProgramId: string) {
      return db.query.complianceProgressSnapshots.findMany({
        where: eq(complianceProgressSnapshots.complianceProgramId, complianceProgramId),
        orderBy: [desc(complianceProgressSnapshots.periodStartDate), desc(complianceProgressSnapshots.createdAt)],
      });
    },

    async createSnapshot(input: NewComplianceProgressSnapshot) {
      const [snapshot] = await db.insert(complianceProgressSnapshots).values(input).returning();
      return snapshot;
    },

    async updateSnapshot(snapshotId: string, patch: Partial<NewComplianceProgressSnapshot>) {
      const [snapshot] = await db
        .update(complianceProgressSnapshots)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(complianceProgressSnapshots.id, snapshotId))
        .returning();
      return snapshot ?? null;
    },

    async listEvaluationRecordsForProgram(complianceProgramId: string) {
      return db.query.complianceEvaluationRecords.findMany({
        where: eq(complianceEvaluationRecords.complianceProgramId, complianceProgramId),
        orderBy: [desc(complianceEvaluationRecords.completedAt), desc(complianceEvaluationRecords.createdAt)],
      });
    },

    async createEvaluationRecord(input: NewComplianceEvaluationRecord) {
      const [record] = await db.insert(complianceEvaluationRecords).values(input).returning();
      return record;
    },

    async updateEvaluationRecord(recordId: string, patch: Partial<NewComplianceEvaluationRecord>) {
      const [record] = await db
        .update(complianceEvaluationRecords)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(complianceEvaluationRecords.id, recordId))
        .returning();
      return record ?? null;
    },

    async listTasksForProgram(complianceProgramId: string) {
      return db.query.complianceTasks.findMany({
        where: eq(complianceTasks.complianceProgramId, complianceProgramId),
        orderBy: [asc(complianceTasks.dueDate), asc(complianceTasks.createdAt)],
      });
    },

    async createTask(input: NewComplianceTask) {
      const [task] = await db.insert(complianceTasks).values(input).returning();
      return task;
    },

    async updateTask(taskId: string, patch: Partial<NewComplianceTask>) {
      const [task] = await db
        .update(complianceTasks)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(complianceTasks.id, taskId))
        .returning();
      return task ?? null;
    },

    async listReportDraftsForProgram(complianceProgramId: string) {
      return db.query.complianceReportDrafts.findMany({
        where: eq(complianceReportDrafts.complianceProgramId, complianceProgramId),
        orderBy: [asc(complianceReportDrafts.reportKind), desc(complianceReportDrafts.updatedAt)],
      });
    },

    async createReportDraft(input: NewComplianceReportDraft) {
      const [draft] = await db.insert(complianceReportDrafts).values(input).returning();
      return draft;
    },

    async updateReportDraft(draftId: string, patch: Partial<NewComplianceReportDraft>) {
      const [draft] = await db
        .update(complianceReportDrafts)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(complianceReportDrafts.id, draftId))
        .returning();
      return draft ?? null;
    },
  };
}
