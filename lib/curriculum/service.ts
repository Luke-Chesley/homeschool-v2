import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import {
  curriculumItems,
  curriculumNodes,
  curriculumSkillPrerequisites,
  curriculumSources,
} from "@/lib/db/schema";

import { loadLocalCurriculumJson, type ImportedCurriculumDocument } from "./local-json-import";
import { normalizeCurriculumDocument } from "./normalization";
import type {
  CurriculumNode,
  CurriculumSource,
  CurriculumTree,
  CurriculumTreeNode,
  CreateCurriculumLessonInput,
  CreateCurriculumObjectiveInput,
  CreateCurriculumSourceInput,
  CreateCurriculumUnitInput,
} from "./types";

function mapKind(kind: string): CurriculumSource["kind"] {
  return kind === "external_link" ? "external" : (kind as CurriculumSource["kind"]);
}

function mapSource(record: {
  id: string;
  organizationId: string;
  title: string;
  kind: string;
  status: string;
  importVersion: number;
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
    status: record.status as CurriculumSource["status"],
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
    importVersion: record.importVersion,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapNode(record: typeof curriculumNodes.$inferSelect): CurriculumNode {
  return {
    id: record.id,
    sourceId: record.sourceId,
    parentNodeId: record.parentNodeId,
    normalizedType: record.normalizedType,
    title: record.title,
    code: record.code ?? undefined,
    description: record.description ?? undefined,
    sequenceIndex: record.sequenceIndex,
    depth: record.depth,
    normalizedPath: record.normalizedPath,
    originalLabel: record.originalLabel ?? undefined,
    originalType: record.originalType ?? undefined,
    estimatedMinutes: record.estimatedMinutes ?? undefined,
    isActive: record.isActive,
    sourcePayload: record.sourcePayload,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildCurriculumTree(source: CurriculumSource, nodes: CurriculumNode[]): CurriculumTree {
  const byId = new Map<string, CurriculumTreeNode>();
  const roots: CurriculumTreeNode[] = [];

  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }

  for (const node of nodes) {
    const treeNode = byId.get(node.id)!;
    if (node.parentNodeId) {
      const parent = byId.get(node.parentNodeId);
      if (parent) {
        parent.children.push(treeNode);
        continue;
      }
    }
    roots.push(treeNode);
  }

  const sortTree = (treeNode: CurriculumTreeNode) => {
    treeNode.children.sort((left, right) => left.sequenceIndex - right.sequenceIndex);
    treeNode.children.forEach(sortTree);
  };

  roots.sort((left, right) => left.sequenceIndex - right.sequenceIndex);
  roots.forEach(sortTree);

  const canonicalSkillNodeIds = nodes
    .filter((node) => node.normalizedType === "skill")
    .sort((left, right) => {
      const leftOrder = Number(left.metadata.canonicalSequenceIndex ?? 0);
      const rightOrder = Number(right.metadata.canonicalSequenceIndex ?? 0);
      return leftOrder - rightOrder;
    })
    .map((node) => node.id);

  return {
    source,
    rootNodes: roots,
    nodeCount: nodes.length,
    skillCount: canonicalSkillNodeIds.length,
    canonicalSkillNodeIds,
  };
}

async function createSourceRecord(
  input: CreateCurriculumSourceInput,
  options?: { status?: CurriculumSource["status"] },
) {
  const [source] = await getDb()
    .insert(curriculumSources)
    .values({
      organizationId: input.householdId,
      learnerId: null,
      title: input.title,
      kind: input.kind === "external" ? "external_link" : input.kind,
      status: options?.status ?? "draft",
      importVersion: 1,
      provenance: input.academicYear ?? null,
      summary: input.description || null,
      metadata: {
        academicYear: input.academicYear ?? null,
        subjects: input.subjects,
        gradeLevels: input.gradeLevels,
        storagePath: input.storagePath ?? null,
        indexingStatus: "not_applicable",
        importFingerprint: null,
        normalizedNodeCount: 0,
        normalizedSkillCount: 0,
      },
    })
    .returning();

  return source;
}

async function importNormalizedTree(sourceId: string, imported: ImportedCurriculumDocument) {
  const source = await getDb().query.curriculumSources.findFirst({
    where: (table, { eq }) => eq(table.id, sourceId),
  });
  if (!source) {
    throw new Error(`CurriculumSource not found: ${sourceId}`);
  }

  const nextImportVersion = source.importVersion + (source.metadata.importFingerprint ? 1 : 0);
  const normalized = normalizeCurriculumDocument({
    sourceId,
    sourceLineageId: source.id,
    document: imported.document,
  });

  await getDb().transaction(async (tx) => {
    const existingNodes = await tx
      .select({ id: curriculumNodes.id })
      .from(curriculumNodes)
      .where(eq(curriculumNodes.sourceId, sourceId));

    const activeNodeIds = normalized.nodes.map((node) => node.id);
    const retiredNodeIds = existingNodes
      .map((node) => node.id)
      .filter((id) => !activeNodeIds.includes(id));

    for (const node of normalized.nodes) {
      await tx
        .insert(curriculumNodes)
        .values(node)
        .onConflictDoUpdate({
          target: curriculumNodes.id,
          set: {
            sourceId: node.sourceId,
            parentNodeId: node.parentNodeId,
            normalizedType: node.normalizedType,
            title: node.title,
            code: node.code,
            description: node.description,
            sequenceIndex: node.sequenceIndex,
            depth: node.depth,
            normalizedPath: node.normalizedPath,
            originalLabel: node.originalLabel,
            originalType: node.originalType,
            estimatedMinutes: node.estimatedMinutes,
            isActive: true,
            sourcePayload: node.sourcePayload,
            metadata: node.metadata,
            updatedAt: new Date(),
          },
        });
    }

    if (retiredNodeIds.length > 0) {
      await tx
        .update(curriculumNodes)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(inArray(curriculumNodes.id, retiredNodeIds));
    }

    await tx
      .delete(curriculumSkillPrerequisites)
      .where(eq(curriculumSkillPrerequisites.sourceId, sourceId));

    if (normalized.prerequisites.length > 0) {
      await tx.insert(curriculumSkillPrerequisites).values(normalized.prerequisites);
    }

    await tx
      .update(curriculumSources)
      .set({
        title: imported.title,
        kind: imported.kind === "external" ? "external_link" : imported.kind,
        status: "active",
        importVersion: nextImportVersion,
        provenance: imported.academicYear ?? source.provenance,
        summary: imported.description || source.summary,
        metadata: {
          ...(source.metadata ?? {}),
          academicYear: imported.academicYear ?? source.metadata.academicYear ?? null,
          subjects: imported.subjects,
          gradeLevels: imported.gradeLevels,
          importFingerprint: normalized.summary.sourceFingerprint,
          normalizedNodeCount: normalized.summary.nodeCount,
          normalizedSkillCount: normalized.summary.skillCount,
          normalizationVersion: 1,
          lastImportedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(curriculumSources.id, sourceId));
  });

  const updated = await getCurriculumSource(sourceId);
  if (!updated) {
    throw new Error(`CurriculumSource not found after import: ${sourceId}`);
  }

  return updated;
}

export async function listCurriculumSources(householdId: string): Promise<CurriculumSource[]> {
  const sources = await getDb().query.curriculumSources.findMany({
    where: (table, { eq }) => eq(table.organizationId, householdId),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  return sources.map(mapSource);
}

export async function getCurriculumSource(id: string, householdId?: string) {
  const source = await getDb().query.curriculumSources.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, id), householdId ? eq(table.organizationId, householdId) : undefined),
  });

  return source ? mapSource(source) : null;
}

export async function createCurriculumSource(input: CreateCurriculumSourceInput) {
  const source = await createSourceRecord(input);
  const mapped = mapSource(source);
  if (mapped.kind === "upload" && mapped.storagePath) {
    await triggerIndexing(source.id);
  }
  return mapped;
}

export async function importCurriculumSourceFromLocalJson(
  householdId: string,
  sourceId?: string,
) {
  const imported = await loadLocalCurriculumJson();

  if (sourceId) {
    return importNormalizedTree(sourceId, imported);
  }

  const source = await createSourceRecord(
    {
      householdId,
      title: imported.title,
      description: imported.description,
      kind: imported.kind,
      academicYear: imported.academicYear,
      subjects: imported.subjects,
      gradeLevels: imported.gradeLevels,
    },
    { status: "active" },
  );

  try {
    return await importNormalizedTree(source.id, imported);
  } catch (error) {
    await getDb()
      .update(curriculumSources)
      .set({
        status: "failed_import",
        updatedAt: new Date(),
      })
      .where(eq(curriculumSources.id, source.id));
    throw error;
  }
}

export async function updateCurriculumSource(
  id: string,
  patch: Partial<CreateCurriculumSourceInput>,
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

export async function listCurriculumNodes(sourceId: string, options?: { includeInactive?: boolean }) {
  const records = await getDb().query.curriculumNodes.findMany({
    where: (table, { and, eq }) =>
      and(
        eq(table.sourceId, sourceId),
        options?.includeInactive ? undefined : eq(table.isActive, true),
      ),
    orderBy: (table, { asc }) => [asc(table.depth), asc(table.sequenceIndex), asc(table.createdAt)],
  });

  return records.map(mapNode);
}

export async function getCurriculumTree(
  sourceId: string,
  householdId?: string,
): Promise<CurriculumTree | null> {
  const source = await getCurriculumSource(sourceId, householdId);
  if (!source) return null;

  const nodes = await listCurriculumNodes(sourceId);
  return buildCurriculumTree(source, nodes);
}

export async function listCurriculumUnits(sourceId: string) {
  const items = await getDb().query.curriculumItems.findMany({
    where: (table, { eq }) => eq(table.sourceId, sourceId),
    orderBy: (table, { asc }) => [asc(table.position), asc(table.createdAt)],
  });

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
  patch: Partial<CreateCurriculumUnitInput>,
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

export async function listCurriculumLessons(unitId: string) {
  const unit = await getDb().query.curriculumItems.findFirst({
    where: (table, { eq }) => eq(table.id, unitId),
  });
  if (!unit) return [];

  const items = await getDb().query.curriculumItems.findMany({
    where: (table, { eq }) => eq(table.sourceId, unit.sourceId),
    orderBy: (table, { asc }) => [asc(table.position), asc(table.createdAt)],
  });

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
  patch: Partial<CreateCurriculumLessonInput>,
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
  _id: string,
  _patch: Partial<CreateCurriculumObjectiveInput>,
) {
  throw new Error("Curriculum objectives are not wired to persistence yet.");
}

export async function deleteCurriculumObjective(_id: string) {
  throw new Error("Curriculum objectives are not wired to persistence yet.");
}

async function triggerIndexing(sourceId: string): Promise<void> {
  console.info(`[curriculum] indexing triggered for source ${sourceId} (stub)`);
}

export async function scheduleAiDraft(
  sourceId: string,
  _params: { prompt?: string },
): Promise<void> {
  console.info(`[curriculum] AI draft requested for source ${sourceId} (stub)`);
}
