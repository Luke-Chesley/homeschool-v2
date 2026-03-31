import { eq } from "drizzle-orm";

import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { curriculumItems, curriculumSources } from "@/lib/db/schema";

import type {
  CurriculumSource,
  CurriculumTree,
  CreateCurriculumSourceInput,
  CreateCurriculumUnitInput,
  CreateCurriculumLessonInput,
  CreateCurriculumObjectiveInput,
} from "./types";

function mapKind(kind: string): CurriculumSource["kind"] {
  return kind === "external_link" ? "external" : (kind as CurriculumSource["kind"]);
}

function mapSource(record: {
  id: string;
  organizationId: string;
  title: string;
  kind: string;
  summary: string | null;
  provenance: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}): CurriculumSource {
  return {
    id: record.id,
    householdId: record.organizationId,
    title: record.title,
    description: record.summary ?? undefined,
    kind: mapKind(record.kind),
    academicYear:
      typeof record.metadata.academicYear === "string" ? record.metadata.academicYear : undefined,
    subjects: Array.isArray(record.metadata.subjects) ? (record.metadata.subjects as string[]) : [],
    gradeLevels: Array.isArray(record.metadata.gradeLevels)
      ? (record.metadata.gradeLevels as string[])
      : [],
    storagePath:
      typeof record.metadata.storagePath === "string" ? record.metadata.storagePath : undefined,
    indexingStatus:
      (record.metadata.indexingStatus as CurriculumSource["indexingStatus"] | undefined) ??
      "not_applicable",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function repos() {
  return createRepositories(getDb());
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function listCurriculumSources(householdId: string): Promise<CurriculumSource[]> {
  const sources = await repos().curriculum.listSourcesForOrganization(householdId);
  return sources.map(mapSource);
}

export async function getCurriculumSource(id: string) {
  const source = await getDb().query.curriculumSources.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });

  return source ? mapSource(source) : null;
}

export async function createCurriculumSource(input: CreateCurriculumSourceInput) {
  const source = await repos().curriculum.createSource({
    organizationId: input.householdId,
    learnerId: null,
    title: input.title,
    kind: input.kind === "external" ? "external_link" : input.kind,
    provenance: input.academicYear ?? null,
    summary: input.description || null,
    metadata: {
      academicYear: input.academicYear ?? null,
      subjects: input.subjects,
      gradeLevels: input.gradeLevels,
      storagePath: input.storagePath ?? null,
      indexingStatus: "not_applicable",
    },
  });

  // Integration point: trigger ingestion/indexing job for upload-kind sources
  const mapped = mapSource(source);
  if (mapped.kind === "upload" && mapped.storagePath) {
    await triggerIndexing(source.id);
  }
  return mapped;
}

export async function updateCurriculumSource(
  id: string,
  patch: Partial<CreateCurriculumSourceInput>
) {
  const existing = await getDb().query.curriculumSources.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
  if (!existing) throw new Error(`CurriculumSource not found: ${id}`);

  const [updated] = await getDb()
    .update(curriculumSources)
    .set({
      title: patch.title ?? existing.title,
      summary: patch.description ?? existing.summary,
      provenance: patch.academicYear ?? existing.provenance,
      metadata: {
        ...(existing.metadata ?? {}),
        academicYear: patch.academicYear ?? existing.metadata.academicYear ?? null,
        subjects: patch.subjects ?? (existing.metadata.subjects as string[] | undefined) ?? [],
        gradeLevels:
          patch.gradeLevels ?? (existing.metadata.gradeLevels as string[] | undefined) ?? [],
        storagePath: patch.storagePath ?? existing.metadata.storagePath ?? null,
      },
      updatedAt: new Date(),
    })
    .where(eq(curriculumSources.id, id))
    .returning();

  return mapSource(updated);
}

export async function deleteCurriculumSource(id: string) {
  await getDb().delete(curriculumSources).where(eq(curriculumSources.id, id));
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export async function listCurriculumUnits(sourceId: string) {
  const items = await repos().curriculum.listItemsForSource(sourceId);

  return items
    .filter((item) => item.itemType === "unit")
    .map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      title: item.title,
      description: item.description ?? undefined,
      sequence: item.position,
      estimatedWeeks:
        typeof item.metadata.estimatedWeeks === "number" ? item.metadata.estimatedWeeks : undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
}

export async function createCurriculumUnit(input: CreateCurriculumUnitInput) {
  const [unit] = await getDb()
    .insert(curriculumItems)
    .values({
      sourceId: input.sourceId,
      learnerId: null,
      parentItemId: null,
      itemType: "unit",
      title: input.title,
      description: input.description ?? null,
      subject: null,
      estimatedMinutes: null,
      position: input.sequence,
      metadata: {
        estimatedWeeks: input.estimatedWeeks ?? null,
      },
    })
    .returning();

  return {
    id: unit.id,
    sourceId: unit.sourceId,
    title: unit.title,
    description: unit.description ?? undefined,
    sequence: unit.position,
    estimatedWeeks:
      typeof unit.metadata.estimatedWeeks === "number" ? unit.metadata.estimatedWeeks : undefined,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}

export async function updateCurriculumUnit(
  id: string,
  patch: Partial<CreateCurriculumUnitInput>
) {
  const existing = await getDb().query.curriculumItems.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
  if (!existing) throw new Error(`CurriculumUnit not found: ${id}`);

  const [unit] = await getDb()
    .update(curriculumItems)
    .set({
      title: patch.title ?? existing.title,
      description: patch.description ?? existing.description,
      position: patch.sequence ?? existing.position,
      metadata: {
        ...(existing.metadata ?? {}),
        estimatedWeeks: patch.estimatedWeeks ?? existing.metadata.estimatedWeeks ?? null,
      },
      updatedAt: new Date(),
    })
    .where(eq(curriculumItems.id, id))
    .returning();

  return {
    id: unit.id,
    sourceId: unit.sourceId,
    title: unit.title,
    description: unit.description ?? undefined,
    sequence: unit.position,
    estimatedWeeks:
      typeof unit.metadata.estimatedWeeks === "number" ? unit.metadata.estimatedWeeks : undefined,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  };
}

export async function deleteCurriculumUnit(id: string) {
  await getDb().delete(curriculumItems).where(eq(curriculumItems.id, id));
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function listCurriculumLessons(unitId: string) {
  const unit = await getDb().query.curriculumItems.findFirst({
    where: (table, { eq }) => eq(table.id, unitId),
  });
  if (!unit) return [];

  const items = await repos().curriculum.listItemsForSource(unit.sourceId);

  return items
    .filter((item) => item.itemType === "lesson" && item.parentItemId === unitId)
    .map((item) => ({
      id: item.id,
      unitId,
      title: item.title,
      description: item.description ?? undefined,
      sequence: item.position,
      estimatedMinutes: item.estimatedMinutes ?? undefined,
      materials: Array.isArray(item.metadata.materials) ? (item.metadata.materials as string[]) : [],
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
}

export async function createCurriculumLesson(input: CreateCurriculumLessonInput) {
  const unit = await getDb().query.curriculumItems.findFirst({
    where: (table, { eq }) => eq(table.id, input.unitId),
  });
  if (!unit) throw new Error(`CurriculumUnit not found: ${input.unitId}`);

  const [lesson] = await getDb()
    .insert(curriculumItems)
    .values({
      sourceId: unit.sourceId,
      learnerId: null,
      parentItemId: input.unitId,
      itemType: "lesson",
      title: input.title,
      description: input.description ?? null,
      subject: null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      position: input.sequence,
      metadata: {
        materials: input.materials,
      },
    })
    .returning();

  return {
    id: lesson.id,
    unitId: input.unitId,
    title: lesson.title,
    description: lesson.description ?? undefined,
    sequence: lesson.position,
    estimatedMinutes: lesson.estimatedMinutes ?? undefined,
    materials: Array.isArray(lesson.metadata.materials)
      ? (lesson.metadata.materials as string[])
      : [],
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

export async function updateCurriculumLesson(
  id: string,
  patch: Partial<CreateCurriculumLessonInput>
) {
  const existing = await getDb().query.curriculumItems.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
  if (!existing) throw new Error(`CurriculumLesson not found: ${id}`);

  const [lesson] = await getDb()
    .update(curriculumItems)
    .set({
      title: patch.title ?? existing.title,
      description: patch.description ?? existing.description,
      estimatedMinutes: patch.estimatedMinutes ?? existing.estimatedMinutes,
      position: patch.sequence ?? existing.position,
      metadata: {
        ...(existing.metadata ?? {}),
        materials: patch.materials ?? (existing.metadata.materials as string[] | undefined) ?? [],
      },
      updatedAt: new Date(),
    })
    .where(eq(curriculumItems.id, id))
    .returning();

  return {
    id: lesson.id,
    unitId: lesson.parentItemId!,
    title: lesson.title,
    description: lesson.description ?? undefined,
    sequence: lesson.position,
    estimatedMinutes: lesson.estimatedMinutes ?? undefined,
    materials: Array.isArray(lesson.metadata.materials)
      ? (lesson.metadata.materials as string[])
      : [],
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

export async function deleteCurriculumLesson(id: string) {
  await getDb().delete(curriculumItems).where(eq(curriculumItems.id, id));
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

export async function listObjectivesForLesson(_lessonId: string) {
  return [];
}

export async function listObjectivesForUnit(_unitId: string) {
  return [];
}

export async function createCurriculumObjective(_input: CreateCurriculumObjectiveInput) {
  throw new Error("Curriculum objectives are not wired to persistence yet.");
}

export async function updateCurriculumObjective(
  id: string,
  patch: Partial<CreateCurriculumObjectiveInput>
) {
  throw new Error("Curriculum objectives are not wired to persistence yet.");
}

export async function deleteCurriculumObjective(_id: string) {
  throw new Error("Curriculum objectives are not wired to persistence yet.");
}

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

export async function getCurriculumTree(sourceId: string): Promise<CurriculumTree | null> {
  const source = await getCurriculumSource(sourceId);
  if (!source) return null;

  const [units, lessons] = await Promise.all([
    listCurriculumUnits(sourceId),
    repos().curriculum.listItemsForSource(sourceId),
  ]);

  return {
    source,
    units: units.map((unit) => ({
      unit,
      lessons: lessons
        .filter((item) => item.itemType === "lesson" && item.parentItemId === unit.id)
        .map((lesson) => ({
          lesson: {
            id: lesson.id,
            unitId: unit.id,
            title: lesson.title,
            description: lesson.description ?? undefined,
            sequence: lesson.position,
            estimatedMinutes: lesson.estimatedMinutes ?? undefined,
            materials: Array.isArray(lesson.metadata.materials)
              ? (lesson.metadata.materials as string[])
              : [],
            createdAt: lesson.createdAt.toISOString(),
            updatedAt: lesson.updatedAt.toISOString(),
          },
          objectives: [],
        })),
      objectives: [],
    })),
  };
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
