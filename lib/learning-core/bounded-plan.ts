import "@/lib/server-only";

import { z } from "zod";

import {
  CURRICULUM_GENERATION_HORIZONS,
  FAST_PATH_INTAKE_ROUTES,
  SOURCE_INTERPRET_SOURCE_KINDS,
} from "@/lib/homeschool/onboarding/types";
import type {
  CurriculumGenerationHorizon,
  FastPathIntakeRoute,
  SourceInterpretSourceKind,
} from "@/lib/homeschool/onboarding/types";
import {
  IntakeSourcePackageContextSchema,
  LearningCoreInputFileSchema,
  type LearningCoreInputFile,
  type IntakeSourcePackageContext,
} from "@/lib/homeschool/intake/types";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation } from "./operations";

const BoundedPlanLessonSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  subject: z.string().optional().nullable(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  materials: z.array(z.string()).default([]),
  objectives: z.array(z.string()).default([]),
  linkedSkillTitles: z.array(z.string()).default([]),
});

const BoundedPlanUnitSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedWeeks: z.number().int().positive().optional().nullable(),
  estimatedSessions: z.number().int().positive().optional().nullable(),
  lessons: z.array(BoundedPlanLessonSchema).min(1),
});

const ProgressionEdgeSchema = z.object({
  fromSkillRef: z.string().min(1),
  toSkillRef: z.string().min(1),
  kind: z.enum(["hardPrerequisite", "recommendedBefore", "revisitAfter", "coPractice"]),
});

const ProgressionPhaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  skillRefs: z.array(z.string()).default([]),
});

const ProgressionArtifactSchema = z.object({
  phases: z.array(ProgressionPhaseSchema).default([]),
  edges: z.array(ProgressionEdgeSchema).default([]),
});

const BoundedPlanInputSchema = z.object({
  learnerName: z.string().trim().min(1),
  requestedRoute: z.enum(FAST_PATH_INTAKE_ROUTES),
  routedRoute: z.enum(FAST_PATH_INTAKE_ROUTES),
  sourceKind: z.enum(SOURCE_INTERPRET_SOURCE_KINDS),
  chosenHorizon: z.enum(CURRICULUM_GENERATION_HORIZONS),
  sourceText: z.string().min(1),
  sourcePackages: z.array(IntakeSourcePackageContextSchema).default([]),
  sourceFiles: z.array(LearningCoreInputFileSchema).default([]),
  titleCandidate: z.string().optional().nullable(),
  detectedChunks: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
});

export type LearningCoreBoundedPlanInput = z.infer<typeof BoundedPlanInputSchema>;

export const BoundedPlanArtifactSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  subjects: z.array(z.string()).default([]),
  horizon: z.enum(CURRICULUM_GENERATION_HORIZONS),
  rationale: z.array(z.string()).default([]),
  document: z.record(z.string(), z.unknown()),
  units: z.array(BoundedPlanUnitSchema).min(1),
  progression: ProgressionArtifactSchema.nullable().optional(),
  suggestedSessionMinutes: z.number().int().positive().nullable().optional(),
});

export type LearningCoreBoundedPlanArtifact = {
  title: string;
  description: string;
  subjects: string[];
  horizon: CurriculumGenerationHorizon;
  rationale: string[];
  document: Record<string, unknown>;
  units: Array<{
    title: string;
    description: string;
    estimatedWeeks?: number | null;
    estimatedSessions?: number | null;
    lessons: Array<{
      title: string;
      description: string;
      subject?: string | null;
      estimatedMinutes?: number | null;
      materials: string[];
      objectives: string[];
      linkedSkillTitles: string[];
    }>;
  }>;
  progression?: {
    phases: Array<{
      title: string;
      description?: string | null;
      skillRefs: string[];
    }>;
    edges: Array<{
      fromSkillRef: string;
      toSkillRef: string;
      kind: "hardPrerequisite" | "recommendedBefore" | "revisitAfter" | "coPractice";
    }>;
  } | null;
  suggestedSessionMinutes?: number | null;
};

export async function executeBoundedPlanGenerate(params: {
  input: {
    learnerName: string;
    requestedRoute: FastPathIntakeRoute;
    routedRoute: FastPathIntakeRoute;
    sourceKind: SourceInterpretSourceKind;
    chosenHorizon: CurriculumGenerationHorizon;
    sourceText: string;
    sourcePackages?: IntakeSourcePackageContext[];
    sourceFiles?: LearningCoreInputFile[];
    titleCandidate?: string | null;
    detectedChunks?: string[];
    assumptions?: string[];
  };
  surface: string;
  organizationId?: string | null;
  learnerId?: string | null;
  workflowMode?: string | null;
}) {
  return executeLearningCoreOperation(
    "bounded_plan_generate",
    buildLearningCoreEnvelope({
      input: BoundedPlanInputSchema.parse(params.input),
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
    BoundedPlanArtifactSchema,
  );
}
