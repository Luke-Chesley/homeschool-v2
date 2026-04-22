import "@/lib/server-only";

import { z } from "zod";

import {
  CurriculumAiChatTurnSchema,
  CurriculumAiGeneratedArtifactSchema,
  CurriculumAiChatMessageSchema,
  CurriculumAiLaunchPlanSchema,
  CurriculumAiProgressionSchema,
  CurriculumAiRevisionTurnSchema,
} from "@/lib/curriculum/ai-draft";
import {
  CurriculumSourceContinuationModeSchema,
  CurriculumSourceDeliveryPatternSchema,
  CurriculumSourceEntryStrategySchema,
  CurriculumSourceIntakeRouteSchema,
  CurriculumSourceInterpretKindSchema,
  CurriculumSourceRecommendedHorizonSchema,
} from "@/lib/curriculum/types";
import {
  IntakeSourcePackageContextSchema,
  LearningCoreInputFileSchema,
} from "@/lib/homeschool/intake/types";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation, previewLearningCoreOperation } from "./operations";

export const CurriculumGenerateRequestModeSchema = z.enum([
  "source_entry",
  "conversation_intake",
]);

export type CurriculumGenerateRequestMode = z.infer<
  typeof CurriculumGenerateRequestModeSchema
>;

export const CurriculumGeneratePacingExpectationsSchema = z.object({
  totalWeeks: z.number().int().positive().optional(),
  sessionsPerWeek: z.number().int().positive().optional(),
  sessionMinutes: z.number().int().positive().optional(),
  totalSessionsLowerBound: z.number().int().positive().optional(),
  totalSessionsUpperBound: z.number().int().positive().optional(),
});

export type CurriculumGeneratePacingExpectations = z.infer<
  typeof CurriculumGeneratePacingExpectationsSchema
>;

export const CurriculumGenerateConversationIntakeInputSchema = z
  .object({
    learnerName: z.string().trim().min(1),
    titleCandidate: z.string().trim().min(1).max(160).nullable().optional(),
    requestMode: z.literal("conversation_intake"),
    messages: z.array(CurriculumAiChatMessageSchema).min(1),
    requirementHints: z.record(z.string(), z.unknown()).nullable().optional(),
    pacingExpectations: CurriculumGeneratePacingExpectationsSchema.nullable().optional(),
    granularityGuidance: z.array(z.string()).optional(),
    correctionNotes: z.array(z.string()).optional(),
  })
  .strict();

export type CurriculumGenerateConversationIntakeInput = z.infer<
  typeof CurriculumGenerateConversationIntakeInputSchema
>;

export const CurriculumGenerateSourceEntryInputSchema = z
  .object({
    learnerName: z.string().trim().min(1),
    titleCandidate: z.string().trim().min(1).max(160).nullable().optional(),
    requestMode: z.literal("source_entry"),
    requestedRoute: CurriculumSourceIntakeRouteSchema,
    routedRoute: CurriculumSourceIntakeRouteSchema,
    sourceKind: CurriculumSourceInterpretKindSchema,
    entryStrategy: CurriculumSourceEntryStrategySchema,
    entryLabel: z.string().trim().min(1).max(240).nullable().optional(),
    continuationMode: CurriculumSourceContinuationModeSchema,
    deliveryPattern: CurriculumSourceDeliveryPatternSchema,
    recommendedHorizon: CurriculumSourceRecommendedHorizonSchema,
    sourceText: z.string().trim().min(1),
    sourcePackages: z.array(IntakeSourcePackageContextSchema),
    sourceFiles: z.array(LearningCoreInputFileSchema),
    detectedChunks: z.array(z.string()),
    assumptions: z.array(z.string()),
  })
  .strict();

export type CurriculumGenerateSourceEntryInput = z.infer<
  typeof CurriculumGenerateSourceEntryInputSchema
>;

export const CurriculumGenerateInputSchema = z.discriminatedUnion("requestMode", [
  CurriculumGenerateSourceEntryInputSchema,
  CurriculumGenerateConversationIntakeInputSchema,
]);

export type CurriculumGenerateInput = z.infer<typeof CurriculumGenerateInputSchema>;

export const CurriculumRevisionInputSchema = z
  .object({
    learnerName: z.string().trim().min(1),
    currentCurriculum: CurriculumAiGeneratedArtifactSchema.nullable().optional(),
    currentRequest: z.string().trim().min(1).nullable().optional(),
    messages: z.array(CurriculumAiChatMessageSchema).default([]),
    correctionNotes: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export type CurriculumRevisionInput = z.infer<typeof CurriculumRevisionInputSchema>;

const CurriculumIntakeInputSchema = z.object({
  learnerName: z.string().trim().min(1),
  messages: z.array(CurriculumAiChatMessageSchema).default([]),
  requirementHints: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function executeCurriculumIntake(params: {
  input: z.input<typeof CurriculumIntakeInputSchema>;
  surface?: string;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return executeLearningCoreOperation(
    "curriculum_intake",
    buildLearningCoreEnvelope({
      input: CurriculumIntakeInputSchema.parse(params.input),
      surface: params.surface ?? "curriculum",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "api",
      presentationContext: {
        audience: "parent",
        displayIntent: "review",
      },
    }),
    CurriculumAiChatTurnSchema,
  );
}

export async function executeCurriculumGenerate(params: {
  input: CurriculumGenerateInput;
  surface?: string;
  organizationId?: string | null;
  learnerId?: string | null;
  workflowMode?: string | null;
  userAuthoredContext?: {
    note?: string | null;
    parentGoal?: string | null;
    teacherNote?: string | null;
  };
}) {
  return executeLearningCoreOperation(
    "curriculum_generate",
    buildLearningCoreEnvelope({
      input: CurriculumGenerateInputSchema.parse(params.input),
      surface: params.surface ?? "curriculum",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      workflowMode: params.workflowMode,
      requestOrigin: "api",
      userAuthoredContext: params.userAuthoredContext,
      presentationContext: {
        audience: "internal",
        displayIntent: "final",
      },
    }),
    CurriculumAiGeneratedArtifactSchema,
  );
}

export async function previewCurriculumRevision(params: {
  input: CurriculumRevisionInput;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return previewLearningCoreOperation(
    "curriculum_revise",
    buildLearningCoreEnvelope({
      input: CurriculumRevisionInputSchema.parse(params.input),
      surface: "curriculum",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "api",
      debug: true,
      presentationContext: {
        audience: "internal",
        displayIntent: "preview",
        shouldReturnPromptPreview: true,
      },
    }),
  );
}

export async function executeCurriculumRevision(params: {
  input: CurriculumRevisionInput;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return executeLearningCoreOperation(
    "curriculum_revise",
    buildLearningCoreEnvelope({
      input: CurriculumRevisionInputSchema.parse(params.input),
      surface: "curriculum",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "api",
      presentationContext: {
        audience: "parent",
        displayIntent: "review",
      },
    }),
    CurriculumAiRevisionTurnSchema,
  );
}

export async function previewProgressionGenerate(params: {
  input: Record<string, unknown>;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return previewLearningCoreOperation(
    "progression_generate",
    buildLearningCoreEnvelope({
      input: params.input,
      surface: "curriculum",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "server_action",
      debug: true,
      presentationContext: {
        audience: "internal",
        displayIntent: "preview",
        shouldReturnPromptPreview: true,
      },
    }),
  );
}

export async function executeProgressionGenerate(params: {
  input: Record<string, unknown>;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return executeLearningCoreOperation(
    "progression_generate",
    buildLearningCoreEnvelope({
      input: params.input,
      surface: "curriculum",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "server_action",
      presentationContext: {
        audience: "internal",
        displayIntent: "final",
      },
    }),
    CurriculumAiProgressionSchema,
  );
}

export async function previewLaunchPlanGenerate(params: {
  input: Record<string, unknown>;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return previewLearningCoreOperation(
    "launch_plan_generate",
    buildLearningCoreEnvelope({
      input: params.input,
      surface: "curriculum",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "server_action",
      debug: true,
      presentationContext: {
        audience: "internal",
        displayIntent: "preview",
        shouldReturnPromptPreview: true,
      },
    }),
  );
}

export async function executeLaunchPlanGenerate(params: {
  input: Record<string, unknown>;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return executeLearningCoreOperation(
    "launch_plan_generate",
    buildLearningCoreEnvelope({
      input: params.input,
      surface: "curriculum",
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      requestOrigin: "server_action",
      presentationContext: {
        audience: "internal",
        displayIntent: "final",
      },
    }),
    CurriculumAiLaunchPlanSchema,
  );
}
