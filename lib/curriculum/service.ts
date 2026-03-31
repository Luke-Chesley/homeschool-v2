/**
 * Curriculum service layer.
 *
 * Exposes the domain operations used by server components and route handlers.
 * All access goes through the repository interface, so real vs. mock
 * implementations are transparent.
 *
 * Integration points:
 * - `triggerIndexing()` should enqueue an Inngest event when the ingestion
 *   pipeline (plan 02 / ingestion workers) is ready.
 * - `scheduleAiDraft()` should dispatch to the AI task registry (plan 08).
 */

import { getCurriculumRepository } from "./mock-repository";
import { loadLocalCurriculumJson } from "./local-json-import";
import type {
  CurriculumSource,
  CurriculumTree,
  CreateCurriculumSourceInput,
  CreateCurriculumUnitInput,
  CreateCurriculumLessonInput,
  CreateCurriculumObjectiveInput,
} from "./types";

function repo() {
  return getCurriculumRepository();
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function listCurriculumSources(householdId: string): Promise<CurriculumSource[]> {
  return repo().listSources(householdId);
}

export async function getCurriculumSource(id: string) {
  return repo().getSource(id);
}

export async function createCurriculumSource(input: CreateCurriculumSourceInput) {
  const source = await repo().createSource(input);
  // Integration point: trigger ingestion/indexing job for upload-kind sources
  if (source.kind === "upload" && source.storagePath) {
    await triggerIndexing(source.id);
  }
  return source;
}

export async function importCurriculumSourceFromLocalJson(householdId: string) {
  const imported = await loadLocalCurriculumJson();
  const source = await repo().createSource({
    householdId,
    title: imported.title,
    description: imported.description,
    kind: imported.kind,
    academicYear: imported.academicYear,
    subjects: imported.subjects,
    gradeLevels: imported.gradeLevels,
  });

  for (const [unitIndex, unitDraft] of imported.units.entries()) {
    const unit = await repo().createUnit({
      sourceId: source.id,
      title: unitDraft.title,
      description: undefined,
      sequence: unitIndex,
      estimatedWeeks: undefined,
    });

    for (const [lessonIndex, lessonDraft] of unitDraft.lessons.entries()) {
      const lesson = await repo().createLesson({
        unitId: unit.id,
        title: lessonDraft.title,
        description: undefined,
        sequence: lessonIndex,
        estimatedMinutes: undefined,
        materials: [],
      });

      for (const objectiveText of lessonDraft.objectives) {
        await repo().createObjective({
          lessonId: lesson.id,
          unitId: undefined,
          description: objectiveText,
          standardIds: [],
          customGoalIds: [],
        });
      }
    }
  }

  return source;
}

export async function updateCurriculumSource(
  id: string,
  patch: Partial<CreateCurriculumSourceInput>
) {
  return repo().updateSource(id, patch);
}

export async function deleteCurriculumSource(id: string) {
  return repo().deleteSource(id);
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export async function listCurriculumUnits(sourceId: string) {
  return repo().listUnits(sourceId);
}

export async function createCurriculumUnit(input: CreateCurriculumUnitInput) {
  return repo().createUnit(input);
}

export async function updateCurriculumUnit(
  id: string,
  patch: Partial<CreateCurriculumUnitInput>
) {
  return repo().updateUnit(id, patch);
}

export async function deleteCurriculumUnit(id: string) {
  return repo().deleteUnit(id);
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function listCurriculumLessons(unitId: string) {
  return repo().listLessons(unitId);
}

export async function createCurriculumLesson(input: CreateCurriculumLessonInput) {
  return repo().createLesson(input);
}

export async function updateCurriculumLesson(
  id: string,
  patch: Partial<CreateCurriculumLessonInput>
) {
  return repo().updateLesson(id, patch);
}

export async function deleteCurriculumLesson(id: string) {
  return repo().deleteLesson(id);
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

export async function listObjectivesForLesson(lessonId: string) {
  return repo().listObjectives({ lessonId });
}

export async function listObjectivesForUnit(unitId: string) {
  return repo().listObjectives({ unitId });
}

export async function createCurriculumObjective(input: CreateCurriculumObjectiveInput) {
  return repo().createObjective(input);
}

export async function updateCurriculumObjective(
  id: string,
  patch: Partial<CreateCurriculumObjectiveInput>
) {
  return repo().updateObjective(id, patch);
}

export async function deleteCurriculumObjective(id: string) {
  return repo().deleteObjective(id);
}

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

export async function getCurriculumTree(sourceId: string): Promise<CurriculumTree | null> {
  return repo().getTree(sourceId);
}

// ---------------------------------------------------------------------------
// Integration hooks (stubs — wired up in later plans)
// ---------------------------------------------------------------------------

/**
 * Enqueues a document chunking/embedding job for the given source.
 *
 * Integration point: replace stub with `inngest.send("curriculum/source.index", {...})`
 * once the Inngest event catalog is defined.
 */
async function triggerIndexing(sourceId: string): Promise<void> {
  // TODO: inngest.send("curriculum/source.index", { sourceId })
  console.info(`[curriculum] indexing triggered for source ${sourceId} (stub)`);
}

/**
 * Schedules an AI-draft generation job for a source.
 *
 * Integration point: dispatch to plan 08's task registry.
 */
export async function scheduleAiDraft(
  sourceId: string,
  _params: { prompt?: string }
): Promise<void> {
  // TODO: dispatch to AI task registry (plan 08)
  console.info(`[curriculum] AI draft requested for source ${sourceId} (stub)`);
}
