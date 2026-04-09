import "@/lib/server-only";

import { StructuredLessonDraftSchema } from "@/lib/lesson-draft/validate";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation, previewLearningCoreOperation } from "./operations";

export interface LearningCoreSessionGenerateInput {
  title?: string;
  topic: string;
  resolvedTiming?: {
    resolvedTotalMinutes: number;
    sourceSessionMinutes?: number;
    lessonOverrideMinutes?: number;
    timingSource: string;
  };
  objectives?: string[];
  routeItems?: Array<{
    title: string;
    subject: string;
    estimatedMinutes: number;
    objective: string;
    lessonLabel: string;
    note?: string;
  }>;
  materials?: string[];
  lessonShape?: string;
  teacherContext?: {
    subject_comfort?: string;
    prep_tolerance?: string;
    teaching_style?: string;
    role?: string;
  };
  context?: Record<string, unknown>;
}

export async function previewSessionGenerate(params: {
  input: LearningCoreSessionGenerateInput;
  surface: string;
  organizationId?: string | null;
  learnerId?: string | null;
  lessonSessionId?: string | null;
  planItemIds?: string[];
  workflowMode?: string | null;
}) {
  return previewLearningCoreOperation(
    "session_generate",
    buildLearningCoreEnvelope({
      input: params.input,
      surface: params.surface,
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      lessonSessionId: params.lessonSessionId,
      planItemIds: params.planItemIds,
      workflowMode: params.workflowMode,
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

export async function executeSessionGenerate(params: {
  input: LearningCoreSessionGenerateInput;
  surface: string;
  organizationId?: string | null;
  learnerId?: string | null;
  lessonSessionId?: string | null;
  planItemIds?: string[];
  workflowMode?: string | null;
}) {
  return executeLearningCoreOperation(
    "session_generate",
    buildLearningCoreEnvelope({
      input: params.input,
      surface: params.surface,
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      lessonSessionId: params.lessonSessionId,
      planItemIds: params.planItemIds,
      workflowMode: params.workflowMode,
      requestOrigin: "api",
      presentationContext: {
        audience: "parent",
        displayIntent: "final",
      },
    }),
    StructuredLessonDraftSchema,
  );
}
