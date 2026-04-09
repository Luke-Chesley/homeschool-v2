import "@/lib/server-only";

import { z } from "zod";

import { postLearningCore } from "./client";

const LearningCoreEnvelopeSchema = z.object({
  input: z.record(z.string(), z.unknown()),
  app_context: z.record(z.string(), z.unknown()),
  presentation_context: z.record(z.string(), z.unknown()),
  user_authored_context: z.record(z.string(), z.unknown()),
  request_id: z.string().optional().nullable(),
});

export const LearningCorePromptPreviewSchema = z.object({
  operation_name: z.string().min(1),
  skill_name: z.string().min(1),
  skill_version: z.string().min(1),
  request_id: z.string().min(1),
  allowed_tools: z.array(z.string()),
  system_prompt: z.string().min(1),
  user_prompt: z.string().min(1),
  request_envelope: LearningCoreEnvelopeSchema,
});

export const LearningCoreLineageSchema = z.object({
  operation_name: z.string().min(1),
  skill_name: z.string().min(1),
  skill_version: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  executed_at: z.string().min(1),
});

export const LearningCoreTraceSchema = z.object({
  request_id: z.string().min(1),
  operation_name: z.string().min(1),
  allowed_tools: z.array(z.string()),
  prompt_preview: z.object({
    system_prompt: z.string().min(1),
    user_prompt: z.string().min(1),
  }),
  request_envelope: LearningCoreEnvelopeSchema,
  executed_at: z.string().min(1),
});

export function buildLearningCoreExecuteResponseSchema<TArtifact extends z.ZodTypeAny>(
  artifactSchema: TArtifact,
) {
  return z.object({
    operation_name: z.string().min(1),
    artifact: artifactSchema,
    lineage: LearningCoreLineageSchema,
    trace: LearningCoreTraceSchema,
    prompt_preview: z
      .object({
        system_prompt: z.string().min(1),
        user_prompt: z.string().min(1),
      })
      .nullable()
      .optional(),
  });
}

export async function previewLearningCoreOperation(
  operationName: string,
  envelope: unknown,
) {
  const payload = await postLearningCore(
    `/v1/operations/${operationName}/prompt-preview`,
    envelope,
  );
  return LearningCorePromptPreviewSchema.parse(payload);
}

export async function executeLearningCoreOperation<TArtifact extends z.ZodTypeAny>(
  operationName: string,
  envelope: unknown,
  artifactSchema: TArtifact,
) {
  const payload = await postLearningCore(
    `/v1/operations/${operationName}/execute`,
    envelope,
  );
  return buildLearningCoreExecuteResponseSchema(artifactSchema).parse(payload);
}
