import "@/lib/server-only";

import { z } from "zod";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation } from "./operations";

export const TopicSuggestInputSchema = z
  .object({
    query: z.string().trim().min(2).max(120),
    learner: z.string().trim().min(1).max(120).nullable().optional(),
    timeframe: z.string().trim().min(1).max(120).nullable().optional(),
    local_suggestions: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
    max_suggestions: z.number().int().min(1).max(8).default(8),
  })
  .strict();

const TopicSuggestArtifactSchema = z.object({
  suggestions: z.array(
    z.object({
      topic: z.string().trim().min(2).max(80),
    }),
  ),
});

export type TopicSuggestInput = z.infer<typeof TopicSuggestInputSchema>;

export async function executeTopicSuggest(params: {
  input: TopicSuggestInput;
  surface?: string;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return executeLearningCoreOperation(
    "topic_suggest",
    buildLearningCoreEnvelope({
      input: TopicSuggestInputSchema.parse(params.input),
      surface: params.surface ?? "curriculum",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "api",
      presentationContext: {
        audience: "parent",
        displayIntent: "preview",
      },
    }),
    TopicSuggestArtifactSchema,
  );
}
