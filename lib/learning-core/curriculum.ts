import "@/lib/server-only";

import { z } from "zod";

import {
  CurriculumAiChatTurnSchema,
  CurriculumAiGeneratedArtifactSchema,
  CurriculumAiChatMessageSchema,
  CurriculumAiProgressionSchema,
  CurriculumAiRevisionTurnSchema,
} from "@/lib/curriculum/ai-draft";
import {
  IntakeSourcePackageContextSchema,
  LearningCoreInputFileSchema,
} from "@/lib/homeschool/intake/types";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation, previewLearningCoreOperation } from "./operations";

const CurriculumGenerateInputSchema = z.object({
  learnerName: z.string().trim().min(1),
  messages: z.array(CurriculumAiChatMessageSchema).default([]),
  requirementHints: z.record(z.string(), z.unknown()).nullable().optional(),
  pacingExpectations: z.record(z.string(), z.unknown()).nullable().optional(),
  granularityGuidance: z.array(z.string()).default([]),
  correctionNotes: z.array(z.string()).default([]),
  sourcePackages: z.array(IntakeSourcePackageContextSchema).default([]),
  sourceFiles: z.array(LearningCoreInputFileSchema).default([]),
});

export async function executeCurriculumIntake(params: {
  input: Record<string, unknown>;
  surface?: string;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return executeLearningCoreOperation(
    "curriculum_intake",
    buildLearningCoreEnvelope({
      input: params.input,
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
  input: z.infer<typeof CurriculumGenerateInputSchema>;
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
  input: Record<string, unknown>;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return previewLearningCoreOperation(
    "curriculum_revise",
    buildLearningCoreEnvelope({
      input: params.input,
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
  input: Record<string, unknown>;
  organizationId?: string | null;
  learnerId?: string | null;
}) {
  return executeLearningCoreOperation(
    "curriculum_revise",
    buildLearningCoreEnvelope({
      input: params.input,
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
