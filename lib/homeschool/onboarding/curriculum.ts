import "@/lib/server-only";

import type { CurriculumSourceModel } from "@/lib/curriculum/types";
import {
  applyCurriculumArtifactToCurriculumSource,
  importStructuredCurriculumDocument,
} from "@/lib/curriculum/service";
import type { ImportedCurriculumDocument } from "@/lib/curriculum/local-json-import";
import {
  generateCurriculumLaunchPlan,
  persistCurriculumLaunchPlan,
} from "@/lib/curriculum/ai-draft-service";
import { regenerateCurriculumProgression } from "@/lib/curriculum/progression-regeneration";
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

export function buildPersistedSourceModel(params: {
  requestedRoute: "single_lesson" | "weekly_plan" | "outline" | "topic" | "manual_shell";
  routedRoute: "single_lesson" | "weekly_plan" | "outline" | "topic" | "manual_shell";
  confidence: "low" | "medium" | "high";
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
  deliveryPattern: "task_first" | "skill_first" | "concept_first" | "timeboxed" | "mixed";
  recommendedHorizon: "single_day" | "few_days" | "one_week" | "two_weeks" | "starter_module";
  assumptions: string[];
  detectedChunks: string[];
  followUpQuestion?: string | null;
  needsConfirmation: boolean;
  sourcePackages?: IntakeSourcePackageContext[];
  sourcePackageIds?: string[];
  sourcePackageId?: string | null;
  sourceModalities?: Array<IntakeSourcePackageContext["modality"]>;
  sourceModality?: IntakeSourcePackageContext["modality"];
  lineage?: Record<string, unknown>;
}): CurriculumSourceModel {
  const sourcePackages = params.sourcePackages ?? [];
  const sourcePackageIds = params.sourcePackageIds ?? sourcePackages.map((sourcePackage) => sourcePackage.id);
  const sourceModalities = params.sourceModalities ?? [
    ...new Set(sourcePackages.map((sourcePackage) => sourcePackage.modality)),
  ];

  return {
    requestedRoute: params.requestedRoute,
    routedRoute: params.routedRoute,
    confidence: params.confidence,
    sourceKind: params.sourceKind,
    entryStrategy: params.entryStrategy,
    entryLabel: params.entryLabel ?? null,
    continuationMode: params.continuationMode,
    deliveryPattern: params.deliveryPattern,
    recommendedHorizon: params.recommendedHorizon,
    assumptions: params.assumptions,
    detectedChunks: params.detectedChunks,
    followUpQuestion: params.followUpQuestion ?? null,
    needsConfirmation: params.needsConfirmation,
    sourcePackageIds,
    sourcePackages,
    sourceModalities,
    sourcePackageId: params.sourcePackageId ?? null,
    sourceModality:
      params.sourceModality
      ?? (sourceModalities.length === 1 ? sourceModalities[0] : undefined),
    lineage: params.lineage,
  };
}

function countUnitSkillRefs(
  units: NonNullable<ImportedCurriculumDocument["units"]> = [],
) {
  return new Set(units.flatMap((unit) => unit.skillRefs)).size;
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
    units: params.artifact.units,
    metadata: {
      intakeSummary: params.artifact.intakeSummary,
      teachingApproach: params.artifact.source.teachingApproach,
      successSignals: params.artifact.source.successSignals,
      parentNotes: params.artifact.source.parentNotes,
      rationale: params.artifact.source.rationale,
      pacing: params.artifact.pacing,
      generatedUnitCount: params.artifact.units.length,
      generatedSkillCount: countUnitSkillRefs(params.artifact.units),
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
    skillCount: countUnitSkillRefs(params.artifact.units),
  };
}

async function generatePostImportPlanningArtifacts(params: {
  organizationId: string;
  learnerId?: string | null;
  learnerName: string;
  curriculumSourceId: string;
  chosenHorizon: "single_day" | "few_days" | "one_week" | "two_weeks" | "starter_module";
}) {
  const progressionResult = await regenerateCurriculumProgression({
    sourceId: params.curriculumSourceId,
    householdId: params.organizationId,
    learnerDisplayName: params.learnerName,
  });

  if (progressionResult.kind === "failure") {
    throw new Error(`Progression generation failed: ${progressionResult.reason}`);
  }

  const launchPlanResult = await generateCurriculumLaunchPlan({
    householdId: params.organizationId,
    sourceId: params.curriculumSourceId,
    learner: { displayName: params.learnerName },
    chosenHorizon: params.chosenHorizon,
    progression: progressionResult.progression,
  });

  if (!launchPlanResult.launchPlan) {
    throw new Error(
      launchPlanResult.failureReason ?? "Launch plan generation failed.",
    );
  }

  const sourceWithLaunchPlan = await persistCurriculumLaunchPlan({
    householdId: params.organizationId,
    sourceId: params.curriculumSourceId,
    launchPlan: launchPlanResult.launchPlan,
  });
  if (!sourceWithLaunchPlan.launchPlan) {
    throw new Error("Launch plan persistence did not produce a readable source launch plan.");
  }

  return {
    launchPlan: sourceWithLaunchPlan.launchPlan,
    progressionResult,
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
  deliveryPattern: "task_first" | "skill_first" | "concept_first" | "timeboxed" | "mixed";
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
      deliveryPattern: params.deliveryPattern,
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

  const planningArtifacts = await generatePostImportPlanningArtifacts({
    organizationId: params.organizationId,
    learnerId: params.learnerId ?? null,
    learnerName: params.learnerName,
    curriculumSourceId: imported.curriculum.id,
    chosenHorizon: params.recommendedHorizon,
  });

  return {
    curriculum: imported.curriculum,
    artifact: generation.artifact,
    lineage: generation.lineage,
    launchPlan: planningArtifacts.launchPlan,
    skillCount: imported.skillCount,
  };
}

export async function applyCurriculumSourceEntryToExistingSource(params: {
  sourceId: string;
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
  deliveryPattern: "task_first" | "skill_first" | "concept_first" | "timeboxed" | "mixed";
  recommendedHorizon: "single_day" | "few_days" | "one_week" | "two_weeks" | "starter_module";
  sourceText: string;
  sourcePackages?: IntakeSourcePackageContext[];
  sourceFiles?: LearningCoreInputFile[];
  detectedChunks?: string[];
  assumptions?: string[];
  surface?: string;
  workflowMode?: string | null;
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
      deliveryPattern: params.deliveryPattern,
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

  const imported = await applyCurriculumArtifactToCurriculumSource({
    sourceId: params.sourceId,
    householdId: params.organizationId,
    artifact: generation.artifact,
  });

  const planningArtifacts = await generatePostImportPlanningArtifacts({
    organizationId: params.organizationId,
    learnerId: params.learnerId ?? null,
    learnerName: params.learnerName,
    curriculumSourceId: imported.sourceId,
    chosenHorizon: params.recommendedHorizon,
  });

  return {
    curriculum: imported,
    artifact: generation.artifact,
    lineage: generation.lineage,
    launchPlan: planningArtifacts.launchPlan,
    skillCount: imported.skillCount,
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
    deliveryPattern: params.preview.deliveryPattern,
    recommendedHorizon: params.preview.chosenHorizon,
    sourceText: params.sourceText,
    sourcePackages: params.sourcePackages ?? [],
    sourceFiles: params.sourceFiles ?? [],
    detectedChunks: params.preview.detectedChunks,
    assumptions: params.preview.assumptions,
    surface: "onboarding",
    workflowMode: "fast_path",
    metadataBuilder: ({ lineage }) => ({
      intake: params.intakeMetadata,
      sourceModel: buildPersistedSourceModel({
        requestedRoute: params.preview.requestedRoute,
        routedRoute: params.preview.intakeRoute,
        confidence: params.preview.confidence,
        sourceKind: params.preview.sourceKind,
        entryStrategy: params.preview.entryStrategy,
        entryLabel: params.preview.entryLabel ?? null,
        continuationMode: params.preview.continuationMode,
        deliveryPattern: params.preview.deliveryPattern,
        recommendedHorizon: params.preview.recommendedHorizon,
        assumptions: params.preview.assumptions,
        detectedChunks: params.preview.detectedChunks,
        followUpQuestion: params.preview.followUpQuestion ?? null,
        needsConfirmation: params.preview.needsConfirmation,
        sourcePackages: params.sourcePackages ?? [],
        sourcePackageIds:
          ((params.intakeMetadata.sourcePackageIds as string[] | undefined) ?? []),
        sourcePackageId:
          ((params.intakeMetadata.sourcePackageId as string | null | undefined) ?? null),
        sourceModalities:
          (
            params.intakeMetadata.sourceModalities as Array<IntakeSourcePackageContext["modality"]> | undefined
          ) ?? [],
        sourceModality:
          params.intakeMetadata.sourceModality as IntakeSourcePackageContext["modality"] | undefined,
        lineage: params.sourceInterpretLineage,
      }),
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
    skillCount: generation.skillCount,
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

  const progressionResult = await regenerateCurriculumProgression({
    sourceId: imported.curriculum.id,
    householdId: params.organizationId,
    learnerDisplayName: params.learnerName,
  });
  if (progressionResult.kind === "failure") {
    throw new Error(`Progression generation failed: ${progressionResult.reason}`);
  }

  return {
    curriculum: imported.curriculum,
    artifact: generation.artifact,
    lineage: generation.lineage,
    launchPlan: null,
    skillCount: imported.skillCount,
  };
}
