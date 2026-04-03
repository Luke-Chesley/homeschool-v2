import { and, asc, desc, eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import { lessonSessions, planDays, planItems, planItemStandards, plans, planWeeks } from "@/lib/db/schema";

export type NewPlan = InferInsertModel<typeof plans>;
export type NewPlanWeek = InferInsertModel<typeof planWeeks>;
export type NewPlanDay = InferInsertModel<typeof planDays>;
export type NewPlanItem = InferInsertModel<typeof planItems>;
export type NewPlanItemStandard = InferInsertModel<typeof planItemStandards>;
export type NewLessonSession = InferInsertModel<typeof lessonSessions>;

export function createPlanningRepository(db: HomeschoolDb) {
  return {
    async createPlan(input: NewPlan) {
      const [plan] = await db.insert(plans).values(input).returning();
      return plan;
    },

    async createPlanWeek(input: NewPlanWeek) {
      const [week] = await db.insert(planWeeks).values(input).returning();
      return week;
    },

    async createPlanDay(input: NewPlanDay) {
      const [day] = await db.insert(planDays).values(input).returning();
      return day;
    },

    async createPlanItem(input: NewPlanItem) {
      const [item] = await db.insert(planItems).values(input).returning();
      return item;
    },

    async attachStandard(input: NewPlanItemStandard) {
      const [link] = await db.insert(planItemStandards).values(input).returning();
      return link;
    },

    async createLessonSession(input: NewLessonSession) {
      const [session] = await db.insert(lessonSessions).values(input).returning();
      return session;
    },

    async findLessonSessionById(sessionId: string) {
      return db.query.lessonSessions.findFirst({
        where: eq(lessonSessions.id, sessionId),
      });
    },

    async listLessonSessionsForLearner(learnerId: string) {
      return db
        .select()
        .from(lessonSessions)
        .where(eq(lessonSessions.learnerId, learnerId))
        .orderBy(desc(lessonSessions.sessionDate), desc(lessonSessions.createdAt));
    },

    async findPlanItemById(planItemId: string) {
      return db.query.planItems.findFirst({
        where: eq(planItems.id, planItemId),
      });
    },

    async findLessonSessionForPlanItem(params: {
      organizationId: string;
      learnerId: string;
      planItemId: string;
      sessionDate: string;
    }) {
      return db.query.lessonSessions.findFirst({
        where: and(
          eq(lessonSessions.organizationId, params.organizationId),
          eq(lessonSessions.learnerId, params.learnerId),
          eq(lessonSessions.planItemId, params.planItemId),
          eq(lessonSessions.sessionDate, params.sessionDate),
        ),
        orderBy: [desc(lessonSessions.updatedAt)],
      });
    },

    async upsertLessonSession(input: NewLessonSession) {
      const existing = await db.query.lessonSessions.findFirst({
        where: and(
          eq(lessonSessions.organizationId, input.organizationId),
          eq(lessonSessions.learnerId, input.learnerId),
          eq(lessonSessions.planItemId, input.planItemId),
          eq(lessonSessions.sessionDate, input.sessionDate),
        ),
      });

      if (existing) {
        const [updated] = await db
          .update(lessonSessions)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(lessonSessions.id, existing.id))
          .returning();

        return updated;
      }

      const [created] = await db.insert(lessonSessions).values(input).returning();
      return created;
    },

    async updateLessonSession(
      sessionId: string,
      input: Partial<NewLessonSession>,
    ) {
      const [updated] = await db
        .update(lessonSessions)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(lessonSessions.id, sessionId))
        .returning();

      return updated ?? null;
    },

    async listPlansForLearner(learnerId: string) {
      return db.select().from(plans).where(eq(plans.learnerId, learnerId)).orderBy(asc(plans.createdAt));
    },

    async getPlanDayWorkspace(planDayId: string) {
      const day = await db.query.planDays.findFirst({
        where: eq(planDays.id, planDayId),
      });

      const items = await db
        .select()
        .from(planItems)
        .where(eq(planItems.planDayId, planDayId))
        .orderBy(asc(planItems.ordering), asc(planItems.createdAt));

      return {
        day,
        items,
      };
    },
  };
}
