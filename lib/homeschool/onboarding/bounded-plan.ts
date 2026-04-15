import "@/lib/server-only";

import type { ImportedCurriculumDocument } from "@/lib/curriculum/local-json-import";
import { importStructuredCurriculumDocument } from "@/lib/curriculum/service";
import { executeBoundedPlanGenerate } from "@/lib/learning-core/bounded-plan";
import type { HomeschoolFastPathPreview } from "@/lib/homeschool/onboarding/types";

function countLessons(units: ImportedCurriculumDocument["units"] = []) {
  return units.reduce((total, unit) => total + unit.lessons.length, 0);
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

function toImportedBoundedPlanDocument(params: {
  artifact: Awaited<ReturnType<typeof executeBoundedPlanGenerate>>["artifact"];
  intakeMetadata: Record<string, unknown>;
  preview: HomeschoolFastPathPreview;
  lineage: Awaited<ReturnType<typeof executeBoundedPlanGenerate>>["lineage"];
}): ImportedCurriculumDocument {
  const subjects = params.artifact.subjects.length > 0 ? params.artifact.subjects : ["Integrated Studies"];
  const units = params.artifact.units.map((unit) => ({
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
  const pacing =
    params.artifact.suggestedSessionMinutes != null
      ? {
          sessionMinutes: params.artifact.suggestedSessionMinutes,
          totalSessions: countLessons(units),
        }
      : undefined;

  return {
    title: params.artifact.title,
    description: params.artifact.description,
    kind: "ai_draft",
    subjects,
    gradeLevels: [],
    document: buildImportDocumentFromUnits({ subjects, units }),
    units,
    metadata: {
      intake: params.intakeMetadata,
      pacing,
      boundedPlan: {
        provisional: true,
        horizon: params.preview.chosenHorizon,
        sourceKind: params.preview.sourceKind,
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
  preview: HomeschoolFastPathPreview;
  intakeMetadata: Record<string, unknown>;
}) {
  const generation = await executeBoundedPlanGenerate({
    input: {
      learnerName: params.learnerName,
      requestedRoute: params.preview.requestedRoute,
      routedRoute: params.preview.intakeRoute,
      sourceKind: params.preview.sourceKind,
      chosenHorizon: params.preview.chosenHorizon,
      sourceText: params.sourceText,
      titleCandidate: params.preview.title,
      detectedChunks: params.preview.detectedChunks,
      assumptions: params.preview.assumptions,
    },
    surface: "onboarding",
    organizationId: params.organizationId,
    workflowMode: "fast_path",
  });

  const curriculum = await importStructuredCurriculumDocument({
    householdId: params.organizationId,
    imported: toImportedBoundedPlanDocument({
      artifact: generation.artifact,
      intakeMetadata: params.intakeMetadata,
      preview: params.preview,
      lineage: generation.lineage,
    }),
  });

  return {
    curriculum,
    artifact: generation.artifact,
    lineage: generation.lineage,
  };
}
