import { asc, eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import {
  adaptationInsights,
  conversationMessages,
  conversationThreads,
  copilotActions,
  recommendations,
} from "@/lib/db/schema";

export type NewConversationThread = InferInsertModel<typeof conversationThreads>;
export type NewConversationMessage = InferInsertModel<typeof conversationMessages>;
export type NewCopilotAction = InferInsertModel<typeof copilotActions>;
export type NewAdaptationInsight = InferInsertModel<typeof adaptationInsights>;
export type NewRecommendation = InferInsertModel<typeof recommendations>;

export function createCopilotRepository(db: HomeschoolDb) {
  return {
    async createThread(input: NewConversationThread) {
      const [thread] = await db.insert(conversationThreads).values(input).returning();
      return thread;
    },

    async createMessage(input: NewConversationMessage) {
      const [message] = await db.insert(conversationMessages).values(input).returning();
      return message;
    },

    async createAction(input: NewCopilotAction) {
      const [action] = await db.insert(copilotActions).values(input).returning();
      return action;
    },

    async getThread(threadId: string) {
      return db.query.conversationThreads.findFirst({
        where: eq(conversationThreads.id, threadId),
      });
    },

    async listMessagesForThread(threadId: string) {
      return db
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.threadId, threadId))
        .orderBy(asc(conversationMessages.createdAt));
    },

    async listActionsForThread(threadId: string) {
      return db
        .select()
        .from(copilotActions)
        .where(eq(copilotActions.threadId, threadId))
        .orderBy(asc(copilotActions.createdAt));
    },

    async updateActionStatus(actionId: string, status: NewCopilotAction["status"]) {
      const [action] = await db
        .update(copilotActions)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(copilotActions.id, actionId))
        .returning();

      return action;
    },

    async createInsight(input: NewAdaptationInsight) {
      const [insight] = await db.insert(adaptationInsights).values(input).returning();
      return insight;
    },

    async createRecommendation(input: NewRecommendation) {
      const [recommendation] = await db.insert(recommendations).values(input).returning();
      return recommendation;
    },

    async listThreadsForOrganization(organizationId: string) {
      return db
        .select()
        .from(conversationThreads)
        .where(eq(conversationThreads.organizationId, organizationId))
        .orderBy(asc(conversationThreads.createdAt));
    },

    async listRecommendationsForLearner(learnerId: string) {
      return db
        .select()
        .from(recommendations)
        .where(eq(recommendations.learnerId, learnerId))
        .orderBy(asc(recommendations.createdAt));
    },
  };
}
