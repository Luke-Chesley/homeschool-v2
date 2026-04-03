import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

import type { HomeschoolDb } from "@/lib/db/client";
import { aiGenerationJobs, promptTemplates } from "@/lib/db/schema";

export type NewPromptTemplate = InferInsertModel<typeof promptTemplates>;
export type NewAiGenerationJob = InferInsertModel<typeof aiGenerationJobs>;

export function createAiPlatformRepository(db: HomeschoolDb) {
  return {
    async upsertPromptTemplate(input: NewPromptTemplate) {
      const normalizedVersion = typeof input.version === "string" ? input.version : "1.0.0";
      const existing =
        input.organizationId == null
          ? await db.query.promptTemplates.findFirst({
              where: and(
                isNull(promptTemplates.organizationId),
                eq(promptTemplates.taskName, input.taskName),
                eq(promptTemplates.version, normalizedVersion),
              ),
            })
          : null;

      if (existing) {
        const [updated] = await db
          .update(promptTemplates)
          .set({
            status: input.status,
            label: input.label,
            systemPrompt: input.systemPrompt,
            userTemplate: input.userTemplate,
            notes: input.notes,
            isDefault: input.isDefault,
            createdByAdultUserId: input.createdByAdultUserId,
            metadata: input.metadata,
            updatedAt: new Date(),
          })
          .where(eq(promptTemplates.id, existing.id))
          .returning();

        return updated;
      }

      const [prompt] = await db
        .insert(promptTemplates)
        .values({
          ...input,
          version: normalizedVersion,
        })
        .onConflictDoUpdate({
          target: [promptTemplates.organizationId, promptTemplates.taskName, promptTemplates.version],
          set: {
            status: input.status,
            label: input.label,
            systemPrompt: input.systemPrompt,
            userTemplate: input.userTemplate,
            notes: input.notes,
            isDefault: input.isDefault,
            createdByAdultUserId: input.createdByAdultUserId,
            metadata: input.metadata,
            updatedAt: new Date(),
          },
        })
        .returning();

      return prompt;
    },

    async listPromptTemplates(taskName?: string, organizationId?: string | null) {
      if (organizationId) {
        return db
          .select()
          .from(promptTemplates)
          .where(
            taskName
              ? and(eq(promptTemplates.organizationId, organizationId), eq(promptTemplates.taskName, taskName))
              : eq(promptTemplates.organizationId, organizationId),
          )
          .orderBy(asc(promptTemplates.taskName), asc(promptTemplates.version));
      }

      return db
        .select()
        .from(promptTemplates)
        .where(
          taskName
            ? and(isNull(promptTemplates.organizationId), eq(promptTemplates.taskName, taskName))
            : isNull(promptTemplates.organizationId),
        )
        .orderBy(asc(promptTemplates.taskName), asc(promptTemplates.version));
    },

    async findPromptTemplate(params: {
      taskName: string;
      version: string;
      organizationId?: string | null;
    }) {
      if (params.organizationId) {
        const orgPrompt = await db.query.promptTemplates.findFirst({
          where: and(
            eq(promptTemplates.organizationId, params.organizationId),
            eq(promptTemplates.taskName, params.taskName),
            eq(promptTemplates.version, params.version),
          ),
        });
        if (orgPrompt) {
          return orgPrompt;
        }
      }

      return db.query.promptTemplates.findFirst({
        where: and(
          isNull(promptTemplates.organizationId),
          eq(promptTemplates.taskName, params.taskName),
          eq(promptTemplates.version, params.version),
        ),
      });
    },

    async createJob(input: NewAiGenerationJob) {
      const [job] = await db.insert(aiGenerationJobs).values(input).returning();
      return job;
    },

    async findJobById(jobId: string) {
      return db.query.aiGenerationJobs.findFirst({
        where: eq(aiGenerationJobs.id, jobId),
      });
    },

    async updateJob(jobId: string, input: Partial<NewAiGenerationJob>) {
      const [job] = await db
        .update(aiGenerationJobs)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(aiGenerationJobs.id, jobId))
        .returning();

      return job ?? null;
    },

    async listJobsForOrganization(organizationId: string) {
      return db
        .select()
        .from(aiGenerationJobs)
        .where(eq(aiGenerationJobs.organizationId, organizationId))
        .orderBy(desc(aiGenerationJobs.createdAt));
    },
  };
}
