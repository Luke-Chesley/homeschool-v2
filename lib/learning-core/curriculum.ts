import "@/lib/server-only";

import {
  CurriculumAiChatTurnSchema,
  CurriculumAiGeneratedArtifactSchema,
  CurriculumAiProgressionSchema,
  CurriculumAiRevisionTurnSchema,
} from "@/lib/curriculum/ai-draft";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation, previewLearningCoreOperation } from "./operations";

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
  input: Record<string, unknown>;
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
      input: params.input,
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
