import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import {
  curriculumItems,
  curriculumNodes,
  curriculumPhases,
  curriculumPhaseNodes,
  curriculumProgressionState,
  curriculumSkillPrerequisites,
  curriculumSources,
  organizationPlatformSettings,
  organizations,
} from "@/lib/db/schema";
import type { CurriculumGenerateRequestMode } from "@/lib/learning-core/curriculum";
import { ensureOrganizationPlatformSettings } from "@/lib/platform/settings";

import type { CurriculumAiGeneratedArtifact } from "./ai-draft";
import { loadLocalCurriculumJson, type ImportedCurriculumDocument } from "./local-json-import";
import { normalizeCurriculumDocument } from "./normalization";
import {
  CurriculumLaunchPlanSchema,
  CurriculumSourceIntakeSchema,
  CurriculumSourceModelSchema,
  JsonRecordSchema,
} from "./types";
import type {
  CurriculumNode,
  CurriculumSource,
  CurriculumSourceIntake,
  CurriculumTree,
  CurriculumTreeNode,
  CreateCurriculumLessonInput,
  CreateCurriculumObjectiveInput,
  CreateCurriculumSourceInput,
  CreateCurriculumUnitInput,
  CurriculumUnitOutline,
} from "./types";

function mapKind(kind: string): CurriculumSource["kind"] {
  return kind === "external_link" ? "external" : (kind as CurriculumSource["kind"]);
}

function extractSourcePacing(
  metadata: Record<string, unknown>,
): import("./types").CurriculumSourcePacing | undefined {
  const raw = metadata.pacing;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return undefined;
  }

  const pacingRecord = raw as Record<string, unknown>;
  const sessionMinutes =
    typeof pacingRecord.sessionMinutes === "number" ? pacingRecord.sessionMinutes : undefined;
  const sessionsPerWeek =
    typeof pacingRecord.sessionsPerWeek === "number" ? pacingRecord.sessionsPerWeek : undefined;
  const totalWeeks =
    typeof pacingRecord.totalWeeks === "number" ? pacingRecord.totalWeeks : undefined;
  const totalSessions =
    typeof pacingRecord.totalSessions === "number" ? pacingRecord.totalSessions : undefined;

  if (
    sessionMinutes === undefined &&
    sessionsPerWeek === undefined &&
    totalWeeks === undefined &&
    totalSessions === undefined
  ) {
    return undefined;
  }

  return { sessionMinutes, sessionsPerWeek, totalWeeks, totalSessions };
}

function extractSourceIntake(metadata: Record<string, unknown>): CurriculumSourceIntake | undefined {
  const parsed = CurriculumSourceIntakeSchema.safeParse(metadata.intake);
  return parsed.success ? parsed.data : undefined;
}

function extractSourceModel(metadata: Record<string, unknown>) {
  const parsed = CurriculumSourceModelSchema.safeParse(metadata.sourceModel);
  return parsed.success ? parsed.data : undefined;
}

function extractLaunchPlan(metadata: Record<string, unknown>) {
  const parsed = CurriculumLaunchPlanSchema.safeParse(metadata.launchPlan);
  return parsed.success ? parsed.data : undefined;
}

function extractCurriculumLineage(metadata: Record<string, unknown>) {
  const parsed = JsonRecordSchema.safeParse(metadata.curriculumLineage);
  return parsed.success ? parsed.data : undefined;
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
    pacing: extractSourcePacing(record.metadata),
    intake: extractSourceIntake(record.metadata),
    sourceModel: extractSourceModel(record.metadata),
    launchPlan: extractLaunchPlan(record.metadata),
    curriculumLineage: extractCurriculumLineage(record.metadata),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function getActiveCurriculumSourceId(metadata: Record<string, unknown> | null | undefined) {
  return typeof metadata?.activeCurriculumSourceId === "string"
    ? metadata.activeCurriculumSourceId
    : undefined;
}

async function ensureOrganizationSettingsRow(organizationId: string) {
  const organization = await getDb().query.organizations.findFirst({
    where: (table, { eq }) => eq(table.id, organizationId),
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  await ensureOrganizationPlatformSettings({
    id: organization.id,
    type: organization.type,
  });
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

export interface CreatedCurriculumArtifactImportResult {
  sourceId: string;
  sourceTitle: string;
  nodeCount: number;
  skillCount: number;
  unitCount: number;
  lessonCount: number;
  estimatedSessionCount: number;
}

async function createSourceRecord(
  input: CreateCurriculumSourceInput,
  options?: { status?: CurriculumSource["status"]; metadata?: Record<string, unknown> },
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
        ...(options?.metadata ?? {}),
      },
    })
    .returning();

  return source;
}

function countEstimatedSessions(units: ImportedCurriculumDocument["units"] = []) {
  return units.reduce((total, unit) => total + (unit.estimatedSessions ?? unit.lessons.length), 0);
}

function resolveCurriculumArtifactLaunchPlan(artifact: CurriculumAiGeneratedArtifact) {
  return artifact.launchPlan;
}

function buildCurriculumArtifactMetadata(artifact: CurriculumAiGeneratedArtifact) {
  return {
    intakeSummary: artifact.intakeSummary,
    teachingApproach: artifact.source.teachingApproach,
    successSignals: artifact.source.successSignals,
    parentNotes: artifact.source.parentNotes,
    rationale: artifact.source.rationale,
    pacing: artifact.pacing,
    curriculumArtifactLaunchPlan: resolveCurriculumArtifactLaunchPlan(artifact),
    generatedUnitCount: artifact.units.length,
    generatedLessonCount: artifact.units.reduce((total, unit) => total + unit.lessons.length, 0),
    generatedEstimatedSessionCount: countEstimatedSessions(artifact.units),
  };
}

function toImportedCurriculumDocumentFromCurriculumArtifact(
  artifact: CurriculumAiGeneratedArtifact,
  kind: CreateCurriculumSourceInput["kind"] = "ai_draft",
): ImportedCurriculumDocument {
  return {
    title: artifact.source.title,
    description: artifact.source.description,
    kind,
    academicYear: artifact.source.academicYear,
    subjects: artifact.source.subjects,
    gradeLevels: artifact.source.gradeLevels,
    document: artifact.document,
    progression: artifact.progression,
    units: artifact.units,
    metadata: buildCurriculumArtifactMetadata(artifact),
  };
}

async function buildCreatedCurriculumArtifactImportResult(params: {
  sourceId: string;
  householdId: string;
  fallbackTitle: string;
  imported: ImportedCurriculumDocument;
}): Promise<CreatedCurriculumArtifactImportResult> {
  const [updated, tree, outline] = await Promise.all([
    getCurriculumSource(params.sourceId, params.householdId),
    getCurriculumTree(params.sourceId, params.householdId),
    listCurriculumOutline(params.sourceId),
  ]);
  const lessonCount = outline.reduce((total, unit) => total + unit.lessons.length, 0);

  return {
    sourceId: params.sourceId,
    sourceTitle: updated?.title ?? params.fallbackTitle,
    nodeCount: tree?.nodeCount ?? 0,
    skillCount: tree?.skillCount ?? 0,
    unitCount: outline.length,
    lessonCount,
    estimatedSessionCount: countEstimatedSessions(params.imported.units),
  };
}

async function replaceCurriculumOutline(
  tx: Pick<ReturnType<typeof getDb>, "delete" | "insert">,
  sourceId: string,
  units: ImportedCurriculumDocument["units"] = [],
) {
  await tx.delete(curriculumItems).where(eq(curriculumItems.sourceId, sourceId));

  for (const [unitIndex, unit] of units.entries()) {
    const [createdUnit] = await tx
      .insert(curriculumItems)
      .values({
        sourceId,
        learnerId: null,
        parentItemId: null,
        itemType: "unit",
        title: unit.title,
        description: unit.description ?? null,
        subject: null,
        estimatedMinutes: null,
        position: unitIndex,
        metadata: {
          estimatedWeeks: unit.estimatedWeeks ?? null,
          estimatedSessions: unit.estimatedSessions ?? null,
        },
      })
      .returning();

    for (const [lessonIndex, lesson] of unit.lessons.entries()) {
      await tx.insert(curriculumItems).values({
        sourceId,
        learnerId: null,
        parentItemId: createdUnit.id,
        itemType: "lesson",
        title: lesson.title,
        description: lesson.description ?? null,
        subject: lesson.subject ?? null,
        estimatedMinutes: lesson.estimatedMinutes ?? null,
        position: lessonIndex,
        metadata: {
          materials: lesson.materials ?? [],
          objectives: lesson.objectives ?? [],
          linkedSkillTitles: lesson.linkedSkillTitles ?? [],
        },
      });
    }
  }
}

async function importNormalizedTree(
  sourceId: string,
  imported: ImportedCurriculumDocument,
  options?: {
    metadata?: Record<string, unknown>;
    progressionProvenance?: ProgressionProvenance;
    progressionAttemptCount?: number;
    progressionFailureReason?: string | null;
  },
) {
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
    progression: imported.progression,
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

    // Persist Phases
    await tx.delete(curriculumPhases).where(eq(curriculumPhases.sourceId, sourceId));
    for (const phase of normalized.phases) {
      const [createdPhase] = await tx
        .insert(curriculumPhases)
        .values({
          sourceId,
          title: phase.title,
          description: phase.description ?? null,
          position: phase.position,
        })
        .returning();

      if (phase.nodeIds.length > 0) {
        await tx.insert(curriculumPhaseNodes).values(
          phase.nodeIds.map((nodeId) => ({
            phaseId: createdPhase.id,
            curriculumNodeId: nodeId,
          })),
        );
      }
    }

    await replaceCurriculumOutline(tx, sourceId, imported.units);

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
          ...(imported.metadata ?? {}),
          ...(options?.metadata ?? {}),
        },
        updatedAt: new Date(),
      })
      .where(eq(curriculumSources.id, sourceId));
  });

  // Persist progression state after the transaction.
  const diag = normalized.summary.progressionDiagnostics;
  let progressionStatus: ProgressionStatus;
  if (diag.hasExplicitProgression) {
    progressionStatus = "explicit_ready";
  } else if (options?.progressionFailureReason) {
    progressionStatus = "explicit_failed";
  } else if (diag.usingInferredFallback) {
    progressionStatus = "fallback_only";
  } else {
    progressionStatus = "not_attempted";
  }

  await upsertProgressionState({
    sourceId,
    status: progressionStatus,
    lastFailureReason: options?.progressionFailureReason ?? null,
    lastAcceptedPhaseCount: diag.phaseCount,
    lastAcceptedEdgeCount: diag.acceptedEdgeCount,
    attemptCount: options?.progressionAttemptCount ?? 0,
    usingInferredFallback: diag.usingInferredFallback,
    provenance: options?.progressionProvenance ?? (diag.hasExplicitProgression ? "initial_generation" : "fallback_inference"),
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

export async function getLiveCurriculumSource(householdId: string): Promise<CurriculumSource | null> {
  const [settings, sources] = await Promise.all([
    getDb().query.organizationPlatformSettings.findFirst({
      where: (table, { eq }) => eq(table.organizationId, householdId),
    }),
    getDb().query.curriculumSources.findMany({
      where: (table, { eq }) => eq(table.organizationId, householdId),
      orderBy: (table, { desc }) => [desc(table.updatedAt), desc(table.createdAt)],
    }),
  ]);

  if (sources.length === 0) {
    return null;
  }

  const activeSourceId = getActiveCurriculumSourceId(settings?.metadata);
  if (activeSourceId) {
    const activeSource = sources.find((source) => source.id === activeSourceId);
    if (activeSource) {
      return mapSource(activeSource);
    }
  }

  return mapSource(sources[0]);
}

export async function setLiveCurriculumSource(householdId: string, sourceId: string | null) {
  await ensureOrganizationSettingsRow(householdId);

  if (sourceId != null && sourceId.length === 0) {
    throw new Error("CurriculumSource id is required.");
  }

  const source =
    sourceId != null
      ? await getDb().query.curriculumSources.findFirst({
          where: (table, { and, eq }) =>
            and(eq(table.id, sourceId), eq(table.organizationId, householdId)),
        })
      : null;

  if (sourceId != null && sourceId.length > 0 && !source) {
    throw new Error(`CurriculumSource not found: ${sourceId}`);
  }

  const settings = await getDb().query.organizationPlatformSettings.findFirst({
    where: (table, { eq }) => eq(table.organizationId, householdId),
  });

  if (!settings) {
    throw new Error(`Organization platform settings not found for: ${householdId}`);
  }

  await getDb()
    .update(organizationPlatformSettings)
    .set({
      metadata: {
        ...(settings.metadata ?? {}),
        activeCurriculumSourceId: sourceId,
        activeCurriculumUpdatedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(organizationPlatformSettings.organizationId, householdId));

  return source ? mapSource(source) : null;
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

export async function importStructuredCurriculumDocument(params: {
  householdId: string;
  imported: ImportedCurriculumDocument;
  sourceId?: string;
}) {
  if (params.sourceId) {
    return importNormalizedTree(params.sourceId, params.imported);
  }

  const source = await createSourceRecord(
    {
      householdId: params.householdId,
      title: params.imported.title,
      description: params.imported.description,
      kind: params.imported.kind,
      academicYear: params.imported.academicYear,
      subjects: params.imported.subjects,
      gradeLevels: params.imported.gradeLevels,
    },
    { status: "active", metadata: params.imported.metadata },
  );

  return importNormalizedTree(source.id, params.imported);
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

export async function createCurriculumSourceFromCurriculumArtifact(params: {
  householdId: string;
  artifact: CurriculumAiGeneratedArtifact;
  requestMode?: CurriculumGenerateRequestMode;
  sourceKind?: CreateCurriculumSourceInput["kind"];
  progressionAttemptCount?: number;
  progressionFailureReason?: string | null;
  sourceMetadata?: Record<string, unknown>;
}): Promise<CreatedCurriculumArtifactImportResult> {
  const imported = toImportedCurriculumDocumentFromCurriculumArtifact(
    params.artifact,
    params.sourceKind ?? "ai_draft",
  );
  const metadata = {
    ...(imported.metadata ?? {}),
    ...(params.requestMode ? { requestMode: params.requestMode } : {}),
    ...(params.sourceMetadata ?? {}),
  };

  const source = await createSourceRecord(
    {
      householdId: params.householdId,
      title: imported.title,
      description: imported.description,
      kind: imported.kind,
      academicYear: imported.academicYear,
      subjects: imported.subjects,
      gradeLevels: imported.gradeLevels,
    },
    {
      status: "active",
      metadata,
    },
  );

  try {
    await importNormalizedTree(source.id, imported, {
      metadata,
      progressionProvenance: "initial_generation",
      progressionAttemptCount: params.progressionAttemptCount,
      progressionFailureReason: params.progressionFailureReason,
    });
    return buildCreatedCurriculumArtifactImportResult({
      sourceId: source.id,
      householdId: params.householdId,
      fallbackTitle: source.title,
      imported,
    });
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

export async function applyCurriculumArtifactToCurriculumSource(params: {
  sourceId: string;
  householdId: string;
  artifact: CurriculumAiGeneratedArtifact;
}): Promise<CreatedCurriculumArtifactImportResult> {
  const existing = await getCurriculumSource(params.sourceId, params.householdId);
  if (!existing) {
    throw new Error(`CurriculumSource not found: ${params.sourceId}`);
  }

  const imported = toImportedCurriculumDocumentFromCurriculumArtifact(
    params.artifact,
    existing.kind,
  );
  await importNormalizedTree(params.sourceId, imported, {
    metadata: {
      ...(imported.metadata ?? {}),
      lastArtifactRevisionAt: new Date().toISOString(),
    },
  });

  return buildCreatedCurriculumArtifactImportResult({
    sourceId: params.sourceId,
    householdId: params.householdId,
    fallbackTitle: params.artifact.source.title,
    imported,
  });
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

export async function deleteCurriculumSource(id: string, organizationId: string) {
  const [deleted] = await getDb()
    .delete(curriculumSources)
    .where(and(eq(curriculumSources.id, id), eq(curriculumSources.organizationId, organizationId)))
    .returning();

  const settings = await getDb().query.organizationPlatformSettings.findFirst({
    where: (table, { eq }) => eq(table.organizationId, organizationId),
  });

  const activeSourceId = getActiveCurriculumSourceId(settings?.metadata);
  if (deleted && activeSourceId === id && settings) {
    await getDb()
      .update(organizationPlatformSettings)
      .set({
        metadata: {
          ...(settings.metadata ?? {}),
          activeCurriculumSourceId: null,
          activeCurriculumUpdatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(organizationPlatformSettings.organizationId, organizationId));
  }

  return deleted ? mapSource(deleted) : null;
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
      estimatedSessions:
        typeof item.metadata.estimatedSessions === "number"
          ? item.metadata.estimatedSessions
          : undefined,
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
        estimatedSessions: input.estimatedSessions ?? null,
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
    estimatedSessions:
      typeof unit.metadata.estimatedSessions === "number"
        ? unit.metadata.estimatedSessions
        : undefined,
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
        estimatedSessions: patch.estimatedSessions ?? existing.metadata.estimatedSessions ?? null,
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
    estimatedSessions:
      typeof unit.metadata.estimatedSessions === "number"
        ? unit.metadata.estimatedSessions
        : undefined,
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
      subject: item.subject ?? undefined,
      sequence: item.position,
      estimatedMinutes: item.estimatedMinutes ?? undefined,
      materials: Array.isArray(item.metadata.materials) ? (item.metadata.materials as string[]) : [],
      objectives: Array.isArray(item.metadata.objectives) ? (item.metadata.objectives as string[]) : [],
      linkedSkillTitles: Array.isArray(item.metadata.linkedSkillTitles)
        ? (item.metadata.linkedSkillTitles as string[])
        : [],
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
      subject: input.subject ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      position: input.sequence,
      metadata: {
        materials: input.materials,
        objectives: input.objectives ?? [],
        linkedSkillTitles: input.linkedSkillTitles ?? [],
      },
    })
    .returning();

  return {
    id: lesson.id,
    unitId: input.unitId,
    title: lesson.title,
    description: lesson.description ?? undefined,
    subject: lesson.subject ?? undefined,
    sequence: lesson.position,
    estimatedMinutes: lesson.estimatedMinutes ?? undefined,
    materials: Array.isArray(lesson.metadata.materials)
      ? (lesson.metadata.materials as string[])
      : [],
    objectives: Array.isArray(lesson.metadata.objectives)
      ? (lesson.metadata.objectives as string[])
      : [],
    linkedSkillTitles: Array.isArray(lesson.metadata.linkedSkillTitles)
      ? (lesson.metadata.linkedSkillTitles as string[])
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
      subject: patch.subject ?? existing.subject,
      estimatedMinutes: patch.estimatedMinutes ?? existing.estimatedMinutes,
      position: patch.sequence ?? existing.position,
      metadata: {
        ...(existing.metadata ?? {}),
        materials: patch.materials ?? (existing.metadata.materials as string[] | undefined) ?? [],
        objectives: patch.objectives ?? (existing.metadata.objectives as string[] | undefined) ?? [],
        linkedSkillTitles:
          patch.linkedSkillTitles ??
          (existing.metadata.linkedSkillTitles as string[] | undefined) ??
          [],
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
    subject: lesson.subject ?? undefined,
    sequence: lesson.position,
    estimatedMinutes: lesson.estimatedMinutes ?? undefined,
    materials: Array.isArray(lesson.metadata.materials)
      ? (lesson.metadata.materials as string[])
      : [],
    objectives: Array.isArray(lesson.metadata.objectives)
      ? (lesson.metadata.objectives as string[])
      : [],
    linkedSkillTitles: Array.isArray(lesson.metadata.linkedSkillTitles)
      ? (lesson.metadata.linkedSkillTitles as string[])
      : [],
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

export async function listCurriculumOutline(sourceId: string): Promise<CurriculumUnitOutline[]> {
  const units = await listCurriculumUnits(sourceId);
  const lessonsByUnit = await Promise.all(
    units.map(async (unit) => ({
      unitId: unit.id,
      lessons: await listCurriculumLessons(unit.id),
    })),
  );

  const lessonMap = new Map(lessonsByUnit.map((entry) => [entry.unitId, entry.lessons]));

  return units.map((unit) => ({
    ...unit,
    lessons: lessonMap.get(unit.id) ?? [],
  }));
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

export interface CurriculumPhaseRecord {
  id: string;
  title: string;
  description?: string;
  position: number;
  skillNodeIds: string[];
}

export interface CurriculumPrerequisiteRecord {
  id: string;
  skillNodeId: string;
  prerequisiteSkillNodeId: string;
  kind: string;
}

export type ProgressionStatus =
  | "not_attempted"
  | "explicit_ready"
  | "explicit_failed"
  | "fallback_only"
  | "stale";

export type ProgressionProvenance =
  | "initial_generation"
  | "manual_regeneration"
  | "fallback_inference";

export interface CurriculumProgressionDiagnostics {
  /** True only when there is at least one phase membership or explicit prerequisite. */
  hasExplicitProgression: boolean;
  usingInferredFallback: boolean;
  phaseCount: number;
  /** Total phase-node memberships across all phases. */
  phaseMembershipCount: number;
  /** Number of phases that have zero node assignments. */
  emptyPhaseCount: number;
  /** Non-inferred prerequisite count. */
  explicitPrereqCount: number;
  acceptedEdgeCount: number;
  /** Persisted from write-time diagnostics; 0 if not yet available. */
  droppedEdgeCount: number;
  /** Explicit state from the progression_state table, or inferred from DB if not yet tracked. */
  progressionStatus: ProgressionStatus;
  lastAttemptAt: string | null;
  lastFailureCategory: "transport" | "parse" | "schema" | "semantic" | "unknown" | null;
  lastFailureReason: string | null;
  attemptCount: number;
  provenance: ProgressionProvenance | null;
  rawAttemptSummaries?: any[];
}

export interface CurriculumProgressionData {
  phases: CurriculumPhaseRecord[];
  prerequisites: CurriculumPrerequisiteRecord[];
  diagnostics: CurriculumProgressionDiagnostics;
}

export async function getCurriculumProgression(sourceId: string): Promise<CurriculumProgressionData> {
  const db = getDb();

  const [phaseRows, prereqRows, stateRow] = await Promise.all([
    db
      .select()
      .from(curriculumPhases)
      .where(eq(curriculumPhases.sourceId, sourceId))
      .orderBy(curriculumPhases.position),
    db
      .select()
      .from(curriculumSkillPrerequisites)
      .where(eq(curriculumSkillPrerequisites.sourceId, sourceId)),
    db
      .select()
      .from(curriculumProgressionState)
      .where(eq(curriculumProgressionState.sourceId, sourceId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const phaseNodeRows =
    phaseRows.length > 0
      ? await db
          .select()
          .from(curriculumPhaseNodes)
          .where(
            inArray(
              curriculumPhaseNodes.phaseId,
              phaseRows.map((p) => p.id),
            ),
          )
      : [];

  const phaseNodesByPhaseId = new Map<string, string[]>();
  for (const row of phaseNodeRows) {
    const list = phaseNodesByPhaseId.get(row.phaseId) ?? [];
    list.push(row.curriculumNodeId);
    phaseNodesByPhaseId.set(row.phaseId, list);
  }

  const phases: CurriculumPhaseRecord[] = phaseRows.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description ?? undefined,
    position: p.position,
    skillNodeIds: phaseNodesByPhaseId.get(p.id) ?? [],
  }));

  const prerequisites: CurriculumPrerequisiteRecord[] = prereqRows.map((r) => ({
    id: r.id,
    skillNodeId: r.skillNodeId,
    prerequisiteSkillNodeId: r.prerequisiteSkillNodeId,
    kind: r.kind,
  }));

  const phaseMembershipCount = phaseNodeRows.length;
  const emptyPhaseCount = phases.filter((p) => p.skillNodeIds.length === 0).length;
  const explicitPrereqCount = prerequisites.filter((p) => p.kind !== "inferred").length;
  const inferredEdgeCount = prerequisites.filter((p) => p.kind === "inferred").length;

  // hasExplicitProgression is true only when there is usable explicit content —
  // phases with actual memberships or explicit prerequisites. An empty phase row
  // without any memberships does not constitute usable explicit progression.
  const hasExplicitProgression = phaseMembershipCount > 0 || explicitPrereqCount > 0;

  // Read write-time diagnostics from state metadata when available.
  const stateMetadata = stateRow?.metadata as Record<string, unknown> | null ?? {};
  const droppedEdgeCount = typeof stateMetadata.droppedExplicitEdgeCount === "number"
    ? stateMetadata.droppedExplicitEdgeCount
    : 0;
  const acceptedEdgeCount = explicitPrereqCount;

  // Derive progression status: prefer the explicit state row; infer from DB if missing.
  let progressionStatus: ProgressionStatus;
  if (stateRow) {
    progressionStatus = stateRow.status as ProgressionStatus;
  } else if (hasExplicitProgression) {
    progressionStatus = "explicit_ready";
  } else if (inferredEdgeCount > 0) {
    progressionStatus = "fallback_only";
  } else {
    progressionStatus = "not_attempted";
  }

  const diagnostics: CurriculumProgressionDiagnostics = {
    hasExplicitProgression,
    usingInferredFallback: !hasExplicitProgression && inferredEdgeCount > 0,
    phaseCount: phases.length,
    phaseMembershipCount,
    emptyPhaseCount,
    explicitPrereqCount,
    acceptedEdgeCount,
    droppedEdgeCount,
    progressionStatus,
    lastAttemptAt: stateRow?.lastAttemptAt?.toISOString() ?? null,
    lastFailureCategory: (stateMetadata.lastFailureCategory as any) ?? null,
    lastFailureReason: stateRow?.lastFailureReason ?? null,
    attemptCount: stateRow?.attemptCount ?? 0,
    provenance: (stateRow?.provenance as ProgressionProvenance | null) ?? null,
    rawAttemptSummaries: (stateMetadata.attempts as any[]) ?? [],
  };

  return { phases, prerequisites, diagnostics };
}

export interface UpsertProgressionStateParams {
  sourceId: string;
  status: ProgressionStatus;
  lastFailureCategory?: "transport" | "parse" | "schema" | "semantic" | "unknown" | null;
  lastFailureReason?: string | null;
  lastAcceptedPhaseCount?: number;
  lastAcceptedEdgeCount?: number;
  attemptCount?: number;
  usingInferredFallback?: boolean;
  provenance?: ProgressionProvenance;
  attempts?: any[];
  /** Write-time resolution diagnostics and raw draft for debugging. */
  debugMetadata?: Record<string, unknown> | null;
}

export async function upsertProgressionState(params: UpsertProgressionStateParams): Promise<void> {
  const now = new Date();
  const existing = await getDb()
    .select()
    .from(curriculumProgressionState)
    .where(eq(curriculumProgressionState.sourceId, params.sourceId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    await getDb()
      .update(curriculumProgressionState)
      .set({
        status: params.status,
        lastAttemptAt: now,
        lastFailureReason: params.lastFailureReason ?? null,
        lastAcceptedPhaseCount: params.lastAcceptedPhaseCount ?? existing.lastAcceptedPhaseCount,
        lastAcceptedEdgeCount: params.lastAcceptedEdgeCount ?? existing.lastAcceptedEdgeCount,
        attemptCount: params.attemptCount ?? existing.attemptCount,
        usingInferredFallback: params.usingInferredFallback ?? existing.usingInferredFallback,
        provenance: params.provenance ?? existing.provenance,
        updatedAt: now,
        metadata: {
          ...(existing.metadata ?? {}),
          lastFailureCategory: params.lastFailureCategory ?? (existing.metadata as any)?.lastFailureCategory,
          attempts: params.attempts ?? (existing.metadata as any)?.attempts,
          ...(params.debugMetadata ?? {}),
        },
      })
      .where(eq(curriculumProgressionState.sourceId, params.sourceId));
  } else {
    await getDb()
      .insert(curriculumProgressionState)
      .values({
        sourceId: params.sourceId,
        status: params.status,
        lastAttemptAt: now,
        lastFailureReason: params.lastFailureReason ?? null,
        lastAcceptedPhaseCount: params.lastAcceptedPhaseCount ?? 0,
        lastAcceptedEdgeCount: params.lastAcceptedEdgeCount ?? 0,
        attemptCount: params.attemptCount ?? 0,
        usingInferredFallback: params.usingInferredFallback ?? false,
        provenance: params.provenance,
        metadata: {
          lastFailureCategory: params.lastFailureCategory ?? null,
          attempts: params.attempts ?? [],
          ...(params.debugMetadata ?? {}),
        },
      });
  }
}
