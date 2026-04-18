import "@/lib/server-only";

import type { ImportedCurriculumDocument } from "@/lib/curriculum/local-json-import";
import type {
  IntakeSourcePackageContext,
  LearningCoreInputFile,
} from "@/lib/homeschool/intake/types";
import { importStructuredCurriculumDocument } from "@/lib/curriculum/service";
import { executeBoundedPlanGenerate } from "@/lib/learning-core/bounded-plan";
import type { HomeschoolFastPathPreview } from "@/lib/homeschool/onboarding/types";

type ImportedCurriculumUnits = NonNullable<ImportedCurriculumDocument["units"]>;

function countLessons(units: ImportedCurriculumUnits = []) {
  return units.reduce((total, unit) => total + unit.lessons.length, 0);
}

function getInitialSliceLabel(params: {
  preview: HomeschoolFastPathPreview;
  units: ImportedCurriculumUnits;
}) {
  const preferredPreviewLabel = params.preview.sliceNotes.find((value) => value.trim().length > 0)?.trim();
  if (preferredPreviewLabel) {
    return preferredPreviewLabel;
  }

  return params.units[0]?.title ?? null;
}

function buildImportDocumentFromUnits(params: {
  subjects: string[];
  units: Array<{
    title: string;
    lessons: Array<{
      title: string;
      subject?: string | null;
    }>;
  }>;
}) {
  const fallbackSubject = params.subjects[0] ?? "Integrated Studies";
  const document: Record<string, Record<string, string[]>> = {};

  for (const unit of params.units) {
    const groupedLessons = new Map<string, string[]>();

    for (const lesson of unit.lessons) {
      const subject = lesson.subject ?? fallbackSubject;
      const titles = groupedLessons.get(subject) ?? [];
      titles.push(lesson.title);
      groupedLessons.set(subject, titles);
    }

    if (groupedLessons.size === 0) {
      groupedLessons.set(fallbackSubject, [unit.title]);
    }

    for (const [subject, lessonTitles] of groupedLessons.entries()) {
      document[subject] ??= {};
      document[subject]![unit.title] = lessonTitles;
    }
  }

  return document;
}

function toImportedUnits(
  artifact: Awaited<ReturnType<typeof executeBoundedPlanGenerate>>["artifact"],
): ImportedCurriculumUnits {
  return artifact.units.map((unit) => ({
    title: unit.title,
    description: unit.description,
    estimatedWeeks: unit.estimatedWeeks ?? undefined,
    estimatedSessions: unit.estimatedSessions ?? undefined,
    lessons: unit.lessons.map((lesson) => ({
      title: lesson.title,
      description: lesson.description,
      subject: lesson.subject ?? undefined,
      estimatedMinutes: lesson.estimatedMinutes ?? undefined,
      materials: lesson.materials,
      objectives: lesson.objectives,
      linkedSkillTitles: lesson.linkedSkillTitles,
    })),
  }));
}

function toImportedBoundedPlanDocument(params: {
  artifact: Awaited<ReturnType<typeof executeBoundedPlanGenerate>>["artifact"];
  units: ImportedCurriculumUnits;
  intakeMetadata: Record<string, unknown>;
  preview: HomeschoolFastPathPreview;
  lineage: Awaited<ReturnType<typeof executeBoundedPlanGenerate>>["lineage"];
}): ImportedCurriculumDocument {
  const subjects = params.artifact.subjects.length > 0 ? params.artifact.subjects : ["Integrated Studies"];
  const pacing =
    params.artifact.suggestedSessionMinutes != null
      ? {
          sessionMinutes: params.artifact.suggestedSessionMinutes,
          totalSessions: countLessons(params.units),
        }
      : undefined;

  return {
    title: params.artifact.title,
    description: params.artifact.description,
    kind: "ai_draft",
    subjects,
    gradeLevels: [],
    document: buildImportDocumentFromUnits({ subjects, units: params.units }),
    units: params.units,
    metadata: {
      intake: params.intakeMetadata,
      pacing,
      boundedPlan: {
        provisional: true,
        horizon: params.preview.chosenHorizon,
        sourceKind: params.preview.sourceKind,
        sourceScale: params.preview.sourceScale ?? null,
        sliceStrategy: params.preview.sliceStrategy ?? null,
        sliceNotes: params.preview.sliceNotes,
        initialSliceUsed: params.preview.initialSliceUsed,
        scopeSummary: params.preview.scopeSummary,
        requestedRoute: params.preview.requestedRoute,
        routedRoute: params.preview.intakeRoute,
        rationale: params.artifact.rationale,
        suggestedSessionMinutes: params.artifact.suggestedSessionMinutes ?? null,
        createdFromFastPath: true,
        learningCoreLineage: params.lineage,
      },
    },
  };
}

export async function createFastPathBoundedCurriculum(params: {
  organizationId: string;
  learnerName: string;
  sourceText: string;
  sourcePackages?: IntakeSourcePackageContext[];
  sourceFiles?: LearningCoreInputFile[];
  preview: HomeschoolFastPathPreview;
  intakeMetadata: Record<string, unknown>;
}) {
  const generation = await executeBoundedPlanGenerate({
    input: {
      learnerName: params.learnerName,
      requestedRoute: params.preview.requestedRoute,
      routedRoute: params.preview.intakeRoute,
      sourceKind: params.preview.sourceKind,
      sourceScale: params.preview.sourceScale ?? null,
      sliceStrategy: params.preview.sliceStrategy ?? null,
      sliceNotes: params.preview.sliceNotes,
      chosenHorizon: params.preview.chosenHorizon,
      sourceText: params.sourceText,
      sourcePackages: params.sourcePackages ?? [],
      sourceFiles: params.sourceFiles ?? [],
      titleCandidate: params.preview.title,
      detectedChunks: params.preview.detectedChunks,
      assumptions: params.preview.assumptions,
    },
    surface: "onboarding",
    organizationId: params.organizationId,
    workflowMode: "fast_path",
  });

  const importedUnits = toImportedUnits(generation.artifact);
  const lessonCount = countLessons(importedUnits);
  const initialSliceLabel = getInitialSliceLabel({
    preview: params.preview,
    units: importedUnits,
  });
  const lastGeneratedLessonTitle =
    importedUnits.flatMap((unit) => unit.lessons).at(-1)?.title ?? null;
  const launchContext = {
    lessonCount,
    horizon: params.preview.chosenHorizon,
    scopeSummary: params.preview.scopeSummary,
    sourceScale: params.preview.sourceScale ?? null,
    sliceStrategy: params.preview.sliceStrategy ?? null,
    initialSliceUsed: params.preview.initialSliceUsed,
    initialSliceLabel,
    lastGeneratedLessonTitle,
  };

  const curriculum = await importStructuredCurriculumDocument({
    householdId: params.organizationId,
    imported: toImportedBoundedPlanDocument({
      artifact: generation.artifact,
      units: importedUnits,
      intakeMetadata: {
        ...params.intakeMetadata,
        initialSliceLabel,
        initialLessonCount: lessonCount,
        lastGeneratedLessonTitle,
        boundedPlanLineage: generation.lineage,
      },
      preview: params.preview,
      lineage: generation.lineage,
    }),
  });

  return {
    curriculum,
    artifact: generation.artifact,
    lineage: generation.lineage,
    launchContext,
  };
}
