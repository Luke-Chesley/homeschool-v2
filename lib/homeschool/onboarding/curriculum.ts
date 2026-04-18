import "@/lib/server-only";

import { importStructuredCurriculumDocument } from "@/lib/curriculum/service";
import type { ImportedCurriculumDocument } from "@/lib/curriculum/local-json-import";
import type {
  IntakeSourcePackageContext,
  LearningCoreInputFile,
} from "@/lib/homeschool/intake/types";
import { executeCurriculumGenerate } from "@/lib/learning-core/curriculum";

import type { HomeschoolFastPathPreview } from "./types";

type LearningCoreCurriculumArtifact = Awaited<
  ReturnType<typeof executeCurriculumGenerate>
>["artifact"];

type LearningCoreCurriculumLineage = Awaited<
  ReturnType<typeof executeCurriculumGenerate>
>["lineage"];

type ConversationCurriculumMessage = {
  role: "user" | "assistant";
  content: string;
};

function countLessons(
  units: NonNullable<ImportedCurriculumDocument["units"]> = [],
) {
  return units.reduce((total, unit) => total + unit.lessons.length, 0);
}

function toImportedCurriculumDocument(params: {
  artifact: LearningCoreCurriculumArtifact;
  metadata?: Record<string, unknown>;
}): ImportedCurriculumDocument {
  return {
    title: params.artifact.source.title,
    description: params.artifact.source.description,
    kind: "ai_draft",
    academicYear: params.artifact.source.academicYear,
    subjects: params.artifact.source.subjects,
    gradeLevels: params.artifact.source.gradeLevels,
    document: params.artifact.document,
    progression: params.artifact.progression ?? undefined,
    units: params.artifact.units,
    metadata: {
      intakeSummary: params.artifact.intakeSummary,
      teachingApproach: params.artifact.source.teachingApproach,
      successSignals: params.artifact.source.successSignals,
      parentNotes: params.artifact.source.parentNotes,
      rationale: params.artifact.source.rationale,
      pacing: params.artifact.pacing,
      launchPlan: params.artifact.launchPlan,
      generatedUnitCount: params.artifact.units.length,
      generatedLessonCount: countLessons(params.artifact.units),
      ...params.metadata,
    },
  };
}

async function importLearningCoreCurriculumArtifact(params: {
  organizationId: string;
  artifact: LearningCoreCurriculumArtifact;
  metadata?: Record<string, unknown>;
}) {
  const curriculum = await importStructuredCurriculumDocument({
    householdId: params.organizationId,
    imported: toImportedCurriculumDocument({
      artifact: params.artifact,
      metadata: params.metadata,
    }),
  });

  return {
    curriculum,
    lessonCount: countLessons(params.artifact.units),
  };
}

export async function createCurriculumFromSourceEntry(params: {
  organizationId: string;
  learnerId?: string | null;
  learnerName: string;
  titleCandidate?: string | null;
  requestedRoute: "single_lesson" | "weekly_plan" | "outline" | "topic" | "manual_shell";
  routedRoute: "single_lesson" | "weekly_plan" | "outline" | "topic" | "manual_shell";
  sourceKind:
    | "bounded_material"
    | "timeboxed_plan"
    | "structured_sequence"
    | "comprehensive_source"
    | "topic_seed"
    | "shell_request"
    | "ambiguous";
  entryStrategy:
    | "use_as_is"
    | "explicit_range"
    | "sequential_start"
    | "section_start"
    | "timebox_start"
    | "scaffold_only";
  entryLabel?: string | null;
  continuationMode: "none" | "sequential" | "timebox" | "manual_review";
  recommendedHorizon: "single_day" | "few_days" | "one_week" | "two_weeks" | "starter_module";
  sourceText: string;
  sourcePackages?: IntakeSourcePackageContext[];
  sourceFiles?: LearningCoreInputFile[];
  detectedChunks?: string[];
  assumptions?: string[];
  surface?: string;
  workflowMode?: string | null;
  metadata?: Record<string, unknown>;
  metadataBuilder?: (generation: {
    artifact: LearningCoreCurriculumArtifact;
    lineage: LearningCoreCurriculumLineage;
  }) => Record<string, unknown>;
}) {
  const generation = await executeCurriculumGenerate({
    input: {
      learnerName: params.learnerName,
      titleCandidate: params.titleCandidate ?? null,
      requestMode: "source_entry",
      requestedRoute: params.requestedRoute,
      routedRoute: params.routedRoute,
      sourceKind: params.sourceKind,
      entryStrategy: params.entryStrategy,
      entryLabel: params.entryLabel ?? null,
      continuationMode: params.continuationMode,
      recommendedHorizon: params.recommendedHorizon,
      sourceText: params.sourceText,
      sourcePackages: params.sourcePackages ?? [],
      sourceFiles: params.sourceFiles ?? [],
      detectedChunks: params.detectedChunks ?? [],
      assumptions: params.assumptions ?? [],
    },
    surface: params.surface ?? "curriculum",
    organizationId: params.organizationId,
    learnerId: params.learnerId ?? null,
    workflowMode: params.workflowMode ?? null,
  });

  const imported = await importLearningCoreCurriculumArtifact({
    organizationId: params.organizationId,
    artifact: generation.artifact,
    metadata: params.metadataBuilder
      ? params.metadataBuilder({
          artifact: generation.artifact,
          lineage: generation.lineage,
        })
      : params.metadata,
  });

  return {
    curriculum: imported.curriculum,
    artifact: generation.artifact,
    lineage: generation.lineage,
    launchPlan: generation.artifact.launchPlan,
    lessonCount: imported.lessonCount,
  };
}

export async function createFastPathCurriculumFromSource(params: {
  organizationId: string;
  learnerId?: string | null;
  learnerName: string;
  sourceText: string;
  sourcePackages?: IntakeSourcePackageContext[];
  sourceFiles?: LearningCoreInputFile[];
  preview: HomeschoolFastPathPreview;
  intakeMetadata: Record<string, unknown>;
  sourceInterpretLineage?: Record<string, unknown>;
}) {
  const generation = await createCurriculumFromSourceEntry({
    organizationId: params.organizationId,
    learnerId: params.learnerId ?? null,
    learnerName: params.learnerName,
    titleCandidate: params.preview.title,
    requestedRoute: params.preview.requestedRoute,
    routedRoute: params.preview.intakeRoute,
    sourceKind: params.preview.sourceKind,
    entryStrategy: params.preview.entryStrategy,
    entryLabel: params.preview.entryLabel ?? null,
    continuationMode: params.preview.continuationMode,
    recommendedHorizon: params.preview.chosenHorizon,
    sourceText: params.sourceText,
    sourcePackages: params.sourcePackages ?? [],
    sourceFiles: params.sourceFiles ?? [],
    detectedChunks: params.preview.detectedChunks,
    assumptions: params.preview.assumptions,
    surface: "onboarding",
    workflowMode: "fast_path",
    metadataBuilder: ({ artifact, lineage }) => ({
      intake: params.intakeMetadata,
      sourceModel: {
        sourceKind: params.preview.sourceKind,
        entryStrategy: params.preview.entryStrategy,
        entryLabel: params.preview.entryLabel ?? null,
        continuationMode: params.preview.continuationMode,
        detectedChunks: params.preview.detectedChunks,
        assumptions: params.preview.assumptions,
        sourcePackageIds:
          ((params.intakeMetadata.sourcePackageIds as string[] | undefined) ?? []),
        sourceModalities:
          ((params.intakeMetadata.sourceModalities as string[] | undefined) ?? []),
      },
      launchPlan: artifact.launchPlan,
      curriculumLineage: {
        requestMode: "source_entry",
        sourceInterpret: params.sourceInterpretLineage ?? null,
        curriculumGenerate: lineage,
      },
    }),
  });

  return {
    curriculum: generation.curriculum,
    artifact: generation.artifact,
    lineage: generation.lineage,
    launchContext: generation.launchPlan,
    lessonCount: generation.lessonCount,
  };
}

export async function createCurriculumFromConversationIntake(params: {
  organizationId: string;
  learnerId?: string | null;
  learnerName: string;
  titleCandidate?: string | null;
  messages: ConversationCurriculumMessage[];
  requirementHints?: Record<string, unknown> | null;
  pacingExpectations?: Record<string, unknown> | null;
  granularityGuidance?: string[];
  correctionNotes?: string[];
  surface?: string;
  workflowMode?: string | null;
  metadata?: Record<string, unknown>;
  userAuthoredContext?: {
    note?: string | null;
    parentGoal?: string | null;
    teacherNote?: string | null;
  };
}) {
  const generation = await executeCurriculumGenerate({
    input: {
      learnerName: params.learnerName,
      titleCandidate: params.titleCandidate ?? null,
      requestMode: "conversation_intake",
      messages: params.messages,
      requirementHints: params.requirementHints ?? undefined,
      pacingExpectations: params.pacingExpectations ?? undefined,
      granularityGuidance: params.granularityGuidance ?? [],
      correctionNotes: params.correctionNotes ?? [],
    },
    surface: params.surface ?? "curriculum",
    organizationId: params.organizationId,
    learnerId: params.learnerId ?? null,
    workflowMode: params.workflowMode ?? null,
    userAuthoredContext: params.userAuthoredContext,
  });

  const imported = await importLearningCoreCurriculumArtifact({
    organizationId: params.organizationId,
    artifact: generation.artifact,
    metadata: {
      ...params.metadata,
      curriculumLineage: {
        requestMode: "conversation_intake",
        curriculumGenerate: generation.lineage,
      },
    },
  });

  return {
    curriculum: imported.curriculum,
    artifact: generation.artifact,
    lineage: generation.lineage,
    launchPlan: generation.artifact.launchPlan,
    lessonCount: imported.lessonCount,
  };
}
