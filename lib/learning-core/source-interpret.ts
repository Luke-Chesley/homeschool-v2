import "@/lib/server-only";

import { z } from "zod";

import {
  CURRICULUM_GENERATION_HORIZONS,
  CURRICULUM_INTAKE_CONFIDENCE_LEVELS,
  FAST_PATH_INTAKE_ROUTES,
  SOURCE_CONTINUATION_MODES,
  SOURCE_ENTRY_STRATEGIES,
  SOURCE_INTERPRET_SOURCE_KINDS,
} from "@/lib/homeschool/onboarding/types";
import type {
  CurriculumGenerationHorizon,
  CurriculumIntakeConfidence,
  FastPathIntakeRoute,
  SourceContinuationMode,
  SourceEntryStrategy,
  SourceInterpretSourceKind,
} from "@/lib/homeschool/onboarding/types";
import {
  IntakeSourcePackageContextSchema,
  LearningCoreInputFileSchema,
  type LearningCoreInputFile,
  type IntakeSourcePackageContext,
  type IntakeSourcePackageModality,
} from "@/lib/homeschool/intake/types";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation } from "./operations";

const SourceInterpretInputSchema = z.object({
  learnerName: z.string().trim().min(1).optional().nullable(),
  requestedRoute: z.enum(FAST_PATH_INTAKE_ROUTES),
  inputModalities: z
    .array(z.enum(["text", "outline", "photo", "image", "pdf", "file"]))
    .min(1),
  rawText: z.string().optional().nullable(),
  extractedText: z.string().min(1),
  extractedStructure: z.record(z.string(), z.unknown()).optional().nullable(),
  assetRefs: z.array(z.string()).default([]),
  sourcePackages: z.array(IntakeSourcePackageContextSchema).default([]),
  sourceFiles: z.array(LearningCoreInputFileSchema).default([]),
  titleCandidate: z.string().optional().nullable(),
});

export type LearningCoreSourceInterpretInput = z.infer<typeof SourceInterpretInputSchema>;

export const SourceInterpretArtifactSchema = z.object({
  sourceKind: z.enum(SOURCE_INTERPRET_SOURCE_KINDS),
  entryStrategy: z.enum(SOURCE_ENTRY_STRATEGIES),
  entryLabel: z.string().nullable().optional(),
  continuationMode: z.enum(SOURCE_CONTINUATION_MODES),
  suggestedTitle: z.string().min(1),
  confidence: z.enum(CURRICULUM_INTAKE_CONFIDENCE_LEVELS),
  recommendedHorizon: z.enum(CURRICULUM_GENERATION_HORIZONS),
  assumptions: z.array(z.string()),
  detectedChunks: z.array(z.string()),
  followUpQuestion: z.string().nullable().optional(),
  needsConfirmation: z.boolean(),
});

export type LearningCoreSourceInterpretArtifact = {
  sourceKind: SourceInterpretSourceKind;
  entryStrategy: SourceEntryStrategy;
  entryLabel?: string | null;
  continuationMode: SourceContinuationMode;
  suggestedTitle: string;
  confidence: CurriculumIntakeConfidence;
  recommendedHorizon: CurriculumGenerationHorizon;
  assumptions: string[];
  detectedChunks: string[];
  followUpQuestion?: string | null;
  needsConfirmation: boolean;
};

export async function executeSourceInterpret(params: {
  input: {
    learnerName?: string | null;
    requestedRoute: FastPathIntakeRoute;
    inputModalities: IntakeSourcePackageModality[];
    rawText?: string | null;
    extractedText: string;
    extractedStructure?: Record<string, unknown> | null;
    assetRefs?: string[];
    sourcePackages?: IntakeSourcePackageContext[];
    sourceFiles?: LearningCoreInputFile[];
    titleCandidate?: string | null;
  };
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
