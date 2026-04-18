import "@/lib/server-only";

import { z } from "zod";

import {
  CurriculumSourceContinuationModeSchema,
  CurriculumSourceEntryStrategySchema,
  CurriculumSourceIntakeConfidenceSchema,
  CurriculumSourceIntakeRouteSchema,
  CurriculumSourceInterpretKindSchema,
  CurriculumSourceRecommendedHorizonSchema,
} from "@/lib/curriculum/types";
import {
  IntakeSourcePackageContextSchema,
  IntakeSourcePackageModalitySchema,
  LearningCoreInputFileSchema,
} from "@/lib/homeschool/intake/types";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation } from "./operations";

export const SourceInterpretInputSchema = z
  .object({
    learnerName: z.string().nullable().optional(),
    requestedRoute: CurriculumSourceIntakeRouteSchema,
    inputModalities: z.array(IntakeSourcePackageModalitySchema).default([]),
    rawText: z.string().optional().nullable(),
    extractedText: z.string().min(1),
    extractedStructure: z.record(z.string(), z.unknown()).optional().nullable(),
    assetRefs: z.array(z.string()).default([]),
    sourcePackages: z.array(IntakeSourcePackageContextSchema).default([]),
    sourceFiles: z.array(LearningCoreInputFileSchema).default([]),
    titleCandidate: z.string().optional().nullable(),
  })
  .strict();

export type LearningCoreSourceInterpretInput = z.infer<typeof SourceInterpretInputSchema>;

export const SourceInterpretArtifactSchema = z
  .object({
    sourceKind: CurriculumSourceInterpretKindSchema,
    entryStrategy: CurriculumSourceEntryStrategySchema,
    entryLabel: z.string().nullable().optional(),
    continuationMode: CurriculumSourceContinuationModeSchema,
    suggestedTitle: z.string(),
    confidence: CurriculumSourceIntakeConfidenceSchema,
    recommendedHorizon: CurriculumSourceRecommendedHorizonSchema,
    assumptions: z.array(z.string()),
    detectedChunks: z.array(z.string()).min(1),
    followUpQuestion: z.string().nullable().optional(),
    needsConfirmation: z.boolean(),
  })
  .strict();

export type LearningCoreSourceInterpretArtifact = z.infer<
  typeof SourceInterpretArtifactSchema
>;

export async function executeSourceInterpret(params: {
  input: LearningCoreSourceInterpretInput;
  surface: string;
  organizationId?: string | null;
  learnerId?: string | null;
  workflowMode?: string | null;
}) {
  return executeLearningCoreOperation(
    "source_interpret",
    buildLearningCoreEnvelope({
      input: SourceInterpretInputSchema.parse(params.input),
      surface: params.surface,
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      workflowMode: params.workflowMode,
      requestOrigin: "api",
      presentationContext: {
        audience: "internal",
        displayIntent: "review",
      },
    }),
    SourceInterpretArtifactSchema,
  );
}
