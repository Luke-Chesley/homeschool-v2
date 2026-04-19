import "@/lib/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import { curriculumNodes, curriculumPhases, curriculumPhaseNodes, curriculumSkillPrerequisites } from "@/lib/db/schema";
import { previewProgressionGenerate } from "@/lib/learning-core/curriculum";

import {
  getCurriculumSource,
  upsertProgressionState,
  type ProgressionProvenance,
} from "./service";
import { generateCurriculumProgression } from "./ai-draft-service";
import type { CurriculumAiProgression } from "./ai-draft";

export interface RegenerateProgressionParams {
  sourceId: string;
  householdId: string;
  learnerDisplayName: string;
}

export type RegenerateProgressionResult =
  | {
      kind: "success";
      progression: CurriculumAiProgression;
      phaseCount: number;
      edgeCount: number;
      attemptCount: number;
      phaseMembershipCount: number;
    }
  | {
      kind: "failure";
      reason: string;
      attemptCount: number;
    };

// ── Resolution types ─────────────────────────────────────────────────────────

type PrerequisiteKind =
  | "explicit"
  | "inferred"
  | "hardPrerequisite"
  | "recommendedBefore"
  | "revisitAfter"
  | "coPractice";

export interface ResolvedPhase {
  title: string;
  description?: string;
  position: number;
  nodeIds: string[];
}

export interface ResolvedPrerequisite {
  sourceId: string;
  skillNodeId: string;
  prerequisiteSkillNodeId: string;
  kind: PrerequisiteKind;
}

export interface ResolutionDiagnostics {
  totalAssignedSkillRefs: number;
  totalAcceptedEdges: number;
  unresolvedSkillRefCount: number;
  emptyPhaseCount: number;
  droppedEdgeCount: number;
}

export interface ProgressionResolutionResult {
  resolvedPhases: ResolvedPhase[];
  resolvedPrerequisites: ResolvedPrerequisite[];
  diagnostics: ResolutionDiagnostics;
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugify(value: string) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function buildResolutionAliases(dbSkillNodes: Array<{ id: string; title: string }>) {
  const byTitle = new Map<string, string>();
  const bySlugTitle = new Map<string, string>();
  const ambiguousSlugTitles = new Set<string>();
  for (const node of dbSkillNodes) {
    byTitle.set(normalizeLabel(node.title), node.id);
    const slugTitle = slugify(node.title);
    const existing = bySlugTitle.get(slugTitle);
    if (existing && existing !== node.id) {
      ambiguousSlugTitles.add(slugTitle);
      bySlugTitle.delete(slugTitle);
    } else if (!ambiguousSlugTitles.has(slugTitle)) {
      bySlugTitle.set(slugTitle, node.id);
    }
  }

  const canonicalAliasToId = new Map<string, string>();
  const labelAliasToId = new Map<string, string>();

  for (const [labelPath, nodeId] of byTitle.entries()) {
    const segments = labelPath.split(" / ").map((segment) => normalizeLabel(segment)).filter(Boolean);
    if (segments.length === 0) continue;
    canonicalAliasToId.set(`skill:${segments.map(slugify).join("/")}`, nodeId);
    labelAliasToId.set(segments.join(" / "), nodeId);
  }

  return { canonicalAliasToId, labelAliasToId, bySlugTitle };
}

/**
 * Resolve a generated progression draft strictly against existing authoritative
 * DB skill node IDs for a curriculum source.
 *
 * No synthetic IDs. No title lookup fallback. skillRef IS the DB node ID.
 * The same validNodeIdSet used here must be the same used for semantic
 * validation — no second resolution universe.
 */
export function resolveProgressionAgainstExistingNodes(
  sourceId: string,
  dbSkillNodes: Array<{ id: string; title: string }>,
  progression: CurriculumAiProgression,
): ProgressionResolutionResult {
  const validNodeIdSet = new Set(dbSkillNodes.map((n) => n.id));
  const { canonicalAliasToId, labelAliasToId, bySlugTitle } = buildResolutionAliases(dbSkillNodes);
  const resolveSkillRef = (skillRef: string) => {
    if (validNodeIdSet.has(skillRef)) {
      return skillRef;
    }

    const explicit =
      canonicalAliasToId.get(skillRef)
      ?? labelAliasToId.get(skillRef);
    if (explicit) {
      return explicit;
    }

    if (skillRef.startsWith("skill:")) {
      const leaf = skillRef.split("/").at(-1);
      return leaf ? bySlugTitle.get(leaf) : undefined;
    }

    const leaf = skillRef.split(" / ").at(-1);
    return leaf ? bySlugTitle.get(slugify(leaf)) : undefined;
  };

  // ── Phase resolution ─────────────────────────────────────────────────────
  const resolvedPhases: ResolvedPhase[] = [];
  let unresolvedSkillRefCount = 0;
  let totalAssignedSkillRefs = 0;

  for (const [index, phase] of progression.phases.entries()) {
    const nodeIds: string[] = [];
    for (const skillRef of phase.skillRefs) {
      const resolved = resolveSkillRef(skillRef);
      if (resolved) {
        nodeIds.push(resolved);
        totalAssignedSkillRefs++;
      } else {
        unresolvedSkillRefCount++;
        console.warn(
          "[curriculum/progression-regeneration] Phase skillRef failed resolution against existing nodes.",
          { sourceId, phaseTitle: phase.title, skillRef },
        );
      }
    }
    resolvedPhases.push({
      title: phase.title,
      description: phase.description,
      position: index,
      nodeIds,
    });
  }

  const emptyPhaseCount = resolvedPhases.filter((p) => p.nodeIds.length === 0).length;

  // ── Edge resolution ───────────────────────────────────────────────────────
  const resolvedPrerequisites: ResolvedPrerequisite[] = [];
  let droppedEdgeCount = 0;
  const edgeSet = new Set<string>();

  for (const edge of progression.edges) {
    const fromResolvedRef = resolveSkillRef(edge.fromSkillRef);
    const toResolvedRef = resolveSkillRef(edge.toSkillRef);
    const fromResolved = Boolean(fromResolvedRef);
    const toResolved = Boolean(toResolvedRef);

    if (!fromResolved || !toResolved) {
      droppedEdgeCount++;
      console.warn(
        "[curriculum/progression-regeneration] Prerequisite edge dropped — skillRef(s) not in existing nodes.",
        {
          sourceId,
          fromSkillRef: edge.fromSkillRef,
          toSkillRef: edge.toSkillRef,
          fromResolved,
          toResolved,
        },
      );
      continue;
    }

    if (fromResolvedRef === toResolvedRef) {
      droppedEdgeCount++;
      continue;
    }

    const edgeKey = `${fromResolvedRef}→${toResolvedRef}`;
    if (edgeSet.has(edgeKey)) {
      droppedEdgeCount++;
      continue;
    }

    edgeSet.add(edgeKey);
    resolvedPrerequisites.push({
      sourceId,
      skillNodeId: toResolvedRef!,
      prerequisiteSkillNodeId: fromResolvedRef!,
      kind: edge.kind as PrerequisiteKind,
    });
  }

  const totalAcceptedEdges = resolvedPrerequisites.length;

  return {
    resolvedPhases,
    resolvedPrerequisites,
    diagnostics: {
      totalAssignedSkillRefs,
      totalAcceptedEdges,
      unresolvedSkillRefCount,
      emptyPhaseCount,
      droppedEdgeCount,
    },
  };
}

/**
 * Regenerate only the progression pass for an existing curriculum source.
 *
 * Loads the persisted skill nodes, reruns pass 2 (progression generation only),
 * validates the result, and if valid, resolves the generated progression directly
 * against authoritative DB node IDs — no synthetic document normalization.
 *
 * Clears and rewrites curriculum_phases, curriculum_phase_nodes, and the explicit
 * rows in curriculum_skill_prerequisites.
 *
 * Updates the curriculum_progression_state table with the outcome.
 * Does NOT touch the curriculum core (nodes, outline, source metadata).
 */
export async function regenerateCurriculumProgression(
  params: RegenerateProgressionParams,
): Promise<RegenerateProgressionResult> {
  const source = await getCurriculumSource(params.sourceId, params.householdId);
  if (!source) {
    return { kind: "failure", reason: `Curriculum source not found: ${params.sourceId}`, attemptCount: 0 };
  }

  // Load active skill nodes from DB — these are the authoritative leaf skill list.
  const skillNodes = await getDb()
    .select({
      id: curriculumNodes.id,
      title: curriculumNodes.title,
      normalizedType: curriculumNodes.normalizedType,
    })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.sourceId, params.sourceId))
    .then((rows) => rows.filter((r) => r.normalizedType === "skill" && r.title));

  if (skillNodes.length === 0) {
    return { kind: "failure", reason: "No skill nodes found for this curriculum source.", attemptCount: 0 };
  }

  const result = await generateCurriculumProgression(
    {
      householdId: params.householdId,
      sourceId: params.sourceId,
      learner: { displayName: params.learnerDisplayName },
    },
  );

  const provenance: ProgressionProvenance = "manual_regeneration";

  if (!result.progression) {
    await upsertProgressionState({
      sourceId: params.sourceId,
      status: "explicit_failed",
      lastFailureReason: result.failureReason ?? "All progression generation attempts failed.",
      lastFailureCategory: "unknown",
      attemptCount: result.attemptCount,
      attempts: result.attempts,
      usingInferredFallback: true,
      provenance,
      debugMetadata: {
        rawGeneratedProgression: null,
        resolutionDiagnostics: null,
      },
    });

    return {
      kind: "failure",
      reason: result.failureReason ?? "All progression generation attempts failed.",
      attemptCount: result.attemptCount,
    };
  }

  // Resolve the generated progression strictly against existing DB node IDs.
  // The same authoritative ref universe used for semantic validation in
  // generateCurriculumProgression is also used here for persistence resolution.
  const resolution = resolveProgressionAgainstExistingNodes(
    params.sourceId,
    skillNodes,
    result.progression,
  );

  const { resolvedPhases, resolvedPrerequisites, diagnostics } = resolution;

  console.info("[curriculum/progression-regeneration] Resolution complete.", {
    sourceId: params.sourceId,
    phaseCount: resolvedPhases.length,
    phaseMembershipCount: diagnostics.totalAssignedSkillRefs,
    emptyPhaseCount: diagnostics.emptyPhaseCount,
    acceptedEdgeCount: diagnostics.totalAcceptedEdges,
    droppedEdgeCount: diagnostics.droppedEdgeCount,
    unresolvedSkillRefCount: diagnostics.unresolvedSkillRefCount,
  });

  // ── Hard post-resolution integrity checks ─────────────────────────────────
  // Never mark explicit_ready when all phase memberships resolve to empty.
  if (resolvedPhases.length === 0) {
    const reason = "Resolved phases contained zero phases — regeneration produced no phase structure.";
    await upsertProgressionState({
      sourceId: params.sourceId,
      status: "explicit_failed",
      lastFailureReason: reason,
      lastFailureCategory: "semantic",
      attemptCount: result.attemptCount,
      attempts: result.attempts,
      usingInferredFallback: true,
      provenance,
      debugMetadata: {
        rawGeneratedProgression: result.progression,
        resolutionDiagnostics: diagnostics,
      },
    });
    return { kind: "failure", reason, attemptCount: result.attemptCount };
  }

  if (diagnostics.totalAssignedSkillRefs === 0) {
    const reason =
      "Resolved phases contained zero valid node assignments — all generated skillRefs failed resolution against existing nodes.";
    await upsertProgressionState({
      sourceId: params.sourceId,
      status: "explicit_failed",
      lastFailureReason: reason,
      lastFailureCategory: "semantic",
      attemptCount: result.attemptCount,
      attempts: result.attempts,
      usingInferredFallback: true,
      provenance,
      debugMetadata: {
        rawGeneratedProgression: result.progression,
        resolutionDiagnostics: diagnostics,
      },
    });
    return { kind: "failure", reason, attemptCount: result.attemptCount };
  }

  // ── Persist resolved progression ──────────────────────────────────────────
  const db = getDb();
  await db.transaction(async (tx) => {
    // Clear existing phases (cascades to phase_nodes via FK).
    await tx.delete(curriculumPhases).where(eq(curriculumPhases.sourceId, params.sourceId));

    // Clear all prerequisites for this source (explicit and inferred).
    await tx
      .delete(curriculumSkillPrerequisites)
      .where(eq(curriculumSkillPrerequisites.sourceId, params.sourceId));

    // Insert resolved prerequisites.
    if (resolvedPrerequisites.length > 0) {
      await tx.insert(curriculumSkillPrerequisites).values(
        resolvedPrerequisites.map((p) => ({
          sourceId: p.sourceId,
          skillNodeId: p.skillNodeId,
          prerequisiteSkillNodeId: p.prerequisiteSkillNodeId,
          kind: p.kind,
          metadata: { derivedFrom: "explicit_progression_graph", resolvedById: true },
        })),
      );
    }

    // Insert phase rows and phase-node assignments.
    for (const phase of resolvedPhases) {
      const [createdPhase] = await tx
        .insert(curriculumPhases)
        .values({
          sourceId: params.sourceId,
          title: phase.title,
          description: phase.description ?? null,
          position: phase.position,
          metadata: {
            provenance: "manual_regeneration",
            resolvedMembershipCount: phase.nodeIds.length,
          },
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
  });

  await upsertProgressionState({
    sourceId: params.sourceId,
    status: "explicit_ready",
    lastFailureReason: null,
    lastFailureCategory: null,
    lastAcceptedPhaseCount: resolvedPhases.length,
    lastAcceptedEdgeCount: diagnostics.totalAcceptedEdges,
    attemptCount: result.attemptCount,
    attempts: result.attempts,
    usingInferredFallback: false,
    provenance,
    debugMetadata: {
      rawGeneratedProgression: result.progression,
      resolutionDiagnostics: diagnostics,
      resolvedPhaseMembershipCount: diagnostics.totalAssignedSkillRefs,
      emptyPhaseCount: diagnostics.emptyPhaseCount,
      resolvedExplicitEdgeCount: diagnostics.totalAcceptedEdges,
      droppedExplicitEdgeCount: diagnostics.droppedEdgeCount,
      unresolvedSkillRefCount: diagnostics.unresolvedSkillRefCount,
      persistenceSummary: {
        accepted: true,
        persisted: true,
        acceptedPhaseCount: resolvedPhases.length,
        acceptedPhaseMembershipCount: diagnostics.totalAssignedSkillRefs,
        acceptedExplicitEdgeCount: diagnostics.totalAcceptedEdges,
        droppedEdgeCount: diagnostics.droppedEdgeCount,
        finalStatus: "explicit_ready",
      },
    },
  });

  console.info("[curriculum/progression-regeneration] Progression regenerated successfully.", {
    sourceId: params.sourceId,
    phaseCount: resolvedPhases.length,
    phaseMembershipCount: diagnostics.totalAssignedSkillRefs,
    edgeCount: diagnostics.totalAcceptedEdges,
    attemptCount: result.attemptCount,
  });

  return {
    kind: "success",
    progression: result.progression,
    phaseCount: resolvedPhases.length,
    edgeCount: diagnostics.totalAcceptedEdges,
    attemptCount: result.attemptCount,
    phaseMembershipCount: diagnostics.totalAssignedSkillRefs,
  };
}

// ── Prompt preview ───────────────────────────────────────────────────────────

/**
 * Build the exact system + user prompts that would be sent for a progression
 * generation run on this source. Does NOT call the AI model.
 */
export async function buildProgressionPromptPreview(params: {
  sourceId: string;
  householdId: string;
  learnerDisplayName: string;
}) {
  const source = await getCurriculumSource(params.sourceId, params.householdId);
  if (!source) {
    throw new Error(`Curriculum source not found: ${params.sourceId}`);
  }

  const skillNodes = await getDb()
    .select({
      id: curriculumNodes.id,
      title: curriculumNodes.title,
      normalizedType: curriculumNodes.normalizedType,
    })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.sourceId, params.sourceId))
    .then((rows) => rows.filter((r) => r.normalizedType === "skill" && r.title));

  const skillRefs = skillNodes.map((n) => ({ skillId: n.id, skillTitle: n.title }));

  return previewProgressionGenerate({
    input: {
      learnerName: params.learnerDisplayName,
      sourceTitle: source.title,
      sourceSummary: source.description || undefined,
      skillCatalog: skillRefs.map((r) => ({ skillRef: r.skillId, title: r.skillTitle })),
    },
    organizationId: params.householdId,
  });
}
