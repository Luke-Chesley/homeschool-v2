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
import type { CurriculumAiGeneratedArtifact } from "./ai-draft";
import type { CurriculumJsonNode } from "./local-json-import";

export interface RegenerateProgressionParams {
  sourceId: string;
  householdId: string;
  learnerDisplayName: string;
}

export type RegenerateProgressionResult =
  | {
      kind: "success";
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

  // ── Phase resolution ─────────────────────────────────────────────────────
  const resolvedPhases: ResolvedPhase[] = [];
  let unresolvedSkillRefCount = 0;
  let totalAssignedSkillRefs = 0;

  for (const [index, phase] of progression.phases.entries()) {
    const nodeIds: string[] = [];
    for (const skillRef of phase.skillRefs) {
      if (validNodeIdSet.has(skillRef)) {
        nodeIds.push(skillRef);
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
    const fromResolved = validNodeIdSet.has(edge.fromSkillRef);
    const toResolved = validNodeIdSet.has(edge.toSkillRef);

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

    if (edge.fromSkillRef === edge.toSkillRef) {
      droppedEdgeCount++;
      continue;
    }

    const edgeKey = `${edge.fromSkillRef}→${edge.toSkillRef}`;
    if (edgeSet.has(edgeKey)) {
      droppedEdgeCount++;
      continue;
    }

    edgeSet.add(edgeKey);
    resolvedPrerequisites.push({
      sourceId,
      skillNodeId: edge.toSkillRef,
      prerequisiteSkillNodeId: edge.fromSkillRef,
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

  // Build skill refs with stable IDs + titles for the ID-aware prompt path.
  const skillRefs = skillNodes.map((n) => ({ skillId: n.id, skillTitle: n.title }));

  // Build a minimal artifact shell — prompt/preview purposes only.
  const minimalArtifact = buildMinimalArtifactForProgression(source, skillNodes);

  // Run progression generation with the real skill IDs.
  const result = await generateCurriculumProgression(
    {
      learner: { displayName: params.learnerDisplayName },
      artifact: minimalArtifact as any,
      skillRefs,
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

// ── Prompt-only helpers (not used for persistence) ───────────────────────────

/**
 * Build a minimal artifact that has enough structure for the progression prompt
 * but doesn't require a full AI re-generation.
 *
 * NOTE: This is prompt/debug-only. It must NOT participate in persistence-critical
 * resolution. Resolution happens via resolveProgressionAgainstExistingNodes().
 */
function buildMinimalArtifactForProgression(
  source: { title: string; summary?: string | null },
  skillNodes: Array<{ id: string; title: string }>,
): CurriculumAiGeneratedArtifact {
  const document: Record<string, string> = {};
  for (const node of skillNodes) {
    document[node.title] = node.id;
  }

  return {
    source: {
      title: source.title,
      description: source.summary ?? source.title,
      subjects: [],
      gradeLevels: [],
      summary: source.summary ?? source.title,
      teachingApproach: "",
      successSignals: [],
      parentNotes: [],
      rationale: [],
    },
    intakeSummary: source.summary ?? source.title,
    pacing: {
      coverageStrategy: "Standard progression",
      coverageNotes: [],
    },
    document: { Skills: document } as Record<string, CurriculumJsonNode>,
    units: [],
  };
}
