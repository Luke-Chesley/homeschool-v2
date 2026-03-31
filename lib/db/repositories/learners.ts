import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import { learnerProfiles, learners, learningGoals } from "@/lib/db/schema";

export type NewLearner = InferInsertModel<typeof learners>;
export type NewLearnerProfile = InferInsertModel<typeof learnerProfiles>;
export type NewLearningGoal = InferInsertModel<typeof learningGoals>;

export function createLearnerRepository(db: HomeschoolDb) {
  return {
    async createLearner(input: NewLearner) {
      const [learner] = await db.insert(learners).values(input).returning();
      return learner;
    },

    async upsertLearner(input: NewLearner) {
      const [learner] = await db
        .insert(learners)
        .values(input)
        .onConflictDoUpdate({
          target: learners.id,
          set: {
            organizationId: input.organizationId,
            firstName: input.firstName,
            lastName: input.lastName,
            displayName: input.displayName,
            dateOfBirth: input.dateOfBirth,
            timezone: input.timezone,
            status: input.status,
            metadata: input.metadata,
            updatedAt: new Date(),
          },
        })
        .returning();

      return learner;
    },

    async upsertProfile(input: NewLearnerProfile) {
      const [profile] = await db
        .insert(learnerProfiles)
        .values(input)
        .onConflictDoUpdate({
          target: learnerProfiles.learnerId,
          set: {
            gradeLevel: input.gradeLevel,
            readingLevel: input.readingLevel,
            supportNeeds: input.supportNeeds,
            interests: input.interests,
            schedulePreferences: input.schedulePreferences,
            notes: input.notes,
            metadata: input.metadata,
            updatedAt: new Date(),
          },
        })
        .returning();

      return profile;
    },

    async createGoal(input: NewLearningGoal) {
      const [goal] = await db.insert(learningGoals).values(input).returning();
      return goal;
    },

    async findLearnerById(learnerId: string) {
      return db.query.learners.findFirst({
        where: eq(learners.id, learnerId),
      });
    },

    async getLearnerSnapshot(learnerId: string) {
      const learner = await this.findLearnerById(learnerId);
      const profile = await db.query.learnerProfiles.findFirst({
        where: eq(learnerProfiles.learnerId, learnerId),
      });
      const goals = await db.select().from(learningGoals).where(eq(learningGoals.learnerId, learnerId));

      return {
        learner,
        profile,
        goals,
      };
    },

    async listByOrganization(organizationId: string) {
      return db.select().from(learners).where(eq(learners.organizationId, organizationId));
    },
  };
}
