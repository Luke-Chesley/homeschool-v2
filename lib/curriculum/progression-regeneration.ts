import "@/lib/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import { curriculumPhases, curriculumPhaseNodes, curriculumSkillPrerequisites } from "@/lib/db/schema";
import { previewProgressionGenerate } from "@/lib/learning-core/curriculum";

import {
  buildProgressionGenerationBasis,
  buildProgressionGenerationInput,
  type ProgressionGenerationBasis,
} from "./progression-basis";
import {
  getCurriculumSource,
  upsertProgressionState,
  type ProgressionProvenance,
} from "./service";
import { generateCurriculumProgression } from "./ai-draft-service";
import type { CurriculumAiProgression } from "./ai-draft";
import { validateGeneratedProgression } from "./progression-validation";

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

export interface ProgressionResolutionResult {
  resolvedPhases: ResolvedPhase[];
  resolvedPrerequisites: ResolvedPrerequisite[];
}

function buildProgressionDebugMetadata(params: {
  progression: CurriculumAiProgression | null;
  validation?: ReturnType<typeof validateGeneratedProgression>;
}) {
  const stats = params.validation?.stats;
  return {
    rawGeneratedProgression: params.progression,
    progressionValidation: params.validation
      ? {
          fatalIssues: params.validation.fatalIssues,
          warnings: params.validation.warnings,
          stats: params.validation.stats,
        }
      : null,
    expectedSkillCount: stats?.expectedSkillCount ?? 0,
    assignedSkillCount: stats?.assignedSkillCount ?? 0,
    missingSkillRefs: stats?.missingSkillRefs ?? [],
    duplicateSkillRefs: stats?.duplicateSkillRefs ?? [],
    inventedSkillRefs: stats?.inventedSkillRefs ?? [],
    acceptedEdgeCount: stats?.acceptedEdgeCount ?? 0,
    droppedEdgeCount: stats?.droppedEdgeCount ?? 0,
    phaseCount: stats?.phaseCount ?? 0,
    emptyPhaseCount: stats?.emptyPhaseCount ?? 0,
    phaseBudgetRange: stats?.phaseBudgetRange ?? {},
    unitFragmentation: stats?.unitFragmentation ?? null,
    exactCanonicalResolution: stats?.exactCanonicalResolution ?? false,
  };
}

export function resolveProgressionAgainstBasis(params: {
  sourceId: string;
  basis: ProgressionGenerationBasis;
  progression: CurriculumAiProgression;
}): ProgressionResolutionResult {
  const resolveSkillRef = (skillRef: string) => {
    const nodeId = params.basis.skillNodeIdByRef.get(skillRef);
    if (!nodeId) {
      throw new Error(`Unresolved canonical skillRef during exact progression resolution: ${skillRef}`);
    }
    return nodeId;
  };

  const resolvedPhases = params.progression.phases.map((phase, index) => ({
    title: phase.title,
    description: phase.description,
    position: index,
    nodeIds: phase.skillRefs.map(resolveSkillRef),
  }));

  const seenPrerequisitePairs = new Set<string>();
  const resolvedPrerequisites = [];
  for (const edge of params.progression.edges) {
    const skillNodeId = resolveSkillRef(edge.toSkillRef);
    const prerequisiteSkillNodeId = resolveSkillRef(edge.fromSkillRef);
    const pairKey = `${skillNodeId}→${prerequisiteSkillNodeId}`;
    if (seenPrerequisitePairs.has(pairKey)) {
      continue;
    }
    seenPrerequisitePairs.add(pairKey);
    resolvedPrerequisites.push({
      sourceId: params.sourceId,
      skillNodeId,
      prerequisiteSkillNodeId,
      kind: edge.kind as PrerequisiteKind,
    });
  }

  return {
    resolvedPhases,
    resolvedPrerequisites,
  };
}

export async function regenerateCurriculumProgression(
  params: RegenerateProgressionParams,
): Promise<RegenerateProgressionResult> {
  const source = await getCurriculumSource(params.sourceId, params.householdId);
  if (!source) {
    return { kind: "failure", reason: `Curriculum source not found: ${params.sourceId}`, attemptCount: 0 };
  }

  const basis = await buildProgressionGenerationBasis({
    sourceId: params.sourceId,
    householdId: params.householdId,
  });

  const result = await generateCurriculumProgression({
    householdId: params.householdId,
    sourceId: params.sourceId,
    learner: { displayName: params.learnerDisplayName },
    basis,
  });

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
      debugMetadata: buildProgressionDebugMetadata({
        progression: null,
      }),
    });

    return {
      kind: "failure",
      reason: result.failureReason ?? "All progression generation attempts failed.",
      attemptCount: result.attemptCount,
    };
  }

  const validation = validateGeneratedProgression({
    progression: result.progression,
    basis,
  });

  console.info("[curriculum/progression-regeneration] Semantic validation complete.", {
    sourceId: params.sourceId,
    expectedSkillCount: validation.stats.expectedSkillCount,
    assignedSkillCount: validation.stats.assignedSkillCount,
    missingSkillRefs: validation.stats.missingSkillRefs,
    duplicateSkillRefs: validation.stats.duplicateSkillRefs,
    inventedSkillRefs: validation.stats.inventedSkillRefs,
    acceptedEdgeCount: validation.stats.acceptedEdgeCount,
    droppedEdgeCount: validation.stats.droppedEdgeCount,
    phaseCount: validation.stats.phaseCount,
    emptyPhaseCount: validation.stats.emptyPhaseCount,
    phaseBudgetRange: validation.stats.phaseBudgetRange,
    unitFragmentation: validation.stats.unitFragmentation,
    exactCanonicalResolution: validation.stats.exactCanonicalResolution,
  });

  if (validation.fatalIssues.length > 0) {
    const reason =
      validation.fatalIssues[0]?.message ?? "Generated progression failed semantic validation.";

    await upsertProgressionState({
      sourceId: params.sourceId,
      status: "explicit_failed",
      lastFailureReason: reason,
      lastFailureCategory: "semantic",
      attemptCount: result.attemptCount,
      attempts: result.attempts,
      usingInferredFallback: true,
      provenance,
      debugMetadata: buildProgressionDebugMetadata({
        progression: result.progression,
        validation,
      }),
    });

    return {
      kind: "failure",
      reason,
      attemptCount: result.attemptCount,
    };
  }

  const resolution = resolveProgressionAgainstBasis({
    sourceId: params.sourceId,
    basis,
    progression: result.progression,
  });

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(curriculumPhases).where(eq(curriculumPhases.sourceId, params.sourceId));
    await tx
      .delete(curriculumSkillPrerequisites)
      .where(eq(curriculumSkillPrerequisites.sourceId, params.sourceId));

    if (resolution.resolvedPrerequisites.length > 0) {
      await tx.insert(curriculumSkillPrerequisites).values(
        resolution.resolvedPrerequisites.map((prerequisite) => ({
          sourceId: prerequisite.sourceId,
          skillNodeId: prerequisite.skillNodeId,
          prerequisiteSkillNodeId: prerequisite.prerequisiteSkillNodeId,
          kind: prerequisite.kind,
          metadata: { derivedFrom: "explicit_progression_graph", resolvedByCanonicalRef: true },
        })),
      );
    }

    for (const phase of resolution.resolvedPhases) {
      const [createdPhase] = await tx
        .insert(curriculumPhases)
        .values({
          sourceId: params.sourceId,
          title: phase.title,
          description: phase.description ?? null,
          position: phase.position,
          metadata: {
            provenance,
            resolvedMembershipCount: phase.nodeIds.length,
            exactCanonicalResolution: true,
          },
        })
        .returning();

      await tx.insert(curriculumPhaseNodes).values(
        phase.nodeIds.map((nodeId) => ({
          phaseId: createdPhase.id,
          curriculumNodeId: nodeId,
        })),
      );
    }
  });

  await upsertProgressionState({
    sourceId: params.sourceId,
    status: "explicit_ready",
    lastFailureReason: null,
    lastFailureCategory: null,
    lastAcceptedPhaseCount: validation.stats.phaseCount,
    lastAcceptedEdgeCount: validation.stats.acceptedEdgeCount,
    attemptCount: result.attemptCount,
    attempts: result.attempts,
    usingInferredFallback: false,
    provenance,
    debugMetadata: {
      ...buildProgressionDebugMetadata({
        progression: result.progression,
        validation,
      }),
      persistenceSummary: {
        accepted: true,
        persisted: true,
        acceptedPhaseCount: validation.stats.phaseCount,
        acceptedPhaseMembershipCount: validation.stats.assignedSkillCount,
        acceptedExplicitEdgeCount: validation.stats.acceptedEdgeCount,
        droppedEdgeCount: validation.stats.droppedEdgeCount,
        finalStatus: "explicit_ready",
      },
    },
  });

  console.info("[curriculum/progression-regeneration] Progression regenerated successfully.", {
    sourceId: params.sourceId,
    expectedSkillCount: validation.stats.expectedSkillCount,
    assignedSkillCount: validation.stats.assignedSkillCount,
    acceptedEdgeCount: validation.stats.acceptedEdgeCount,
    phaseCount: validation.stats.phaseCount,
    exactCanonicalResolution: validation.stats.exactCanonicalResolution,
  });

  return {
    kind: "success",
    progression: result.progression,
    phaseCount: validation.stats.phaseCount,
    edgeCount: validation.stats.acceptedEdgeCount,
    attemptCount: result.attemptCount,
    phaseMembershipCount: validation.stats.assignedSkillCount,
  };
}

export async function buildProgressionPromptPreview(params: {
  sourceId: string;
  householdId: string;
  learnerDisplayName: string;
}) {
  const basis = await buildProgressionGenerationBasis({
    sourceId: params.sourceId,
    householdId: params.householdId,
  });

  return previewProgressionGenerate({
    input: buildProgressionGenerationInput({
      learnerName: params.learnerDisplayName,
      basis,
    }),
    organizationId: params.householdId,
  });
}
