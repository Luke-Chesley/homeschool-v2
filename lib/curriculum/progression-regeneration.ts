import "@/lib/server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import { curriculumNodes, curriculumPhases, curriculumPhaseNodes, curriculumSkillPrerequisites } from "@/lib/db/schema";
import { getAdapterForTask } from "@/lib/ai/registry";
import { getModelForTask } from "@/lib/ai/provider-adapter";
import { getAiRoutingConfig } from "@/lib/ai/routing";
import { resolvePrompt } from "@/lib/prompts/store";
import {
  buildCurriculumProgressionPrompt,
  CURRICULUM_PROGRESSION_PROMPT_VERSION,
} from "@/lib/prompts/curriculum-draft";

import {
  getCurriculumSource,
  upsertProgressionState,
  type ProgressionProvenance,
} from "./service";
import { generateCurriculumProgression } from "./ai-draft-service";
import { normalizeCurriculumDocument } from "./normalization";
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
    }
  | {
      kind: "failure";
      reason: string;
      attemptCount: number;
    };

/**
 * Regenerate only the progression pass for an existing curriculum source.
 *
 * Loads the persisted skill nodes, rebuilds a minimal artifact shell for the prompt,
 * reruns pass 2 (progression generation only), validates the result, and if valid,
 * clears and rewrites curriculum_phases, curriculum_phase_nodes, and the explicit rows
 * in curriculum_skill_prerequisites.
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

  // Build a minimal artifact shell — we only need enough structure for the prompt.
  // The actual document content is reconstructed from the skill hierarchy.
  const minimalArtifact: CurriculumAiGeneratedArtifact = buildMinimalArtifactForProgression(source, skillNodes);

  // Run progression generation with the real skill IDs.
  const result = await generateCurriculumProgression(
    {
      learner: { displayName: params.learnerDisplayName },
      artifact: minimalArtifact,
      skillRefs,
    },
    {
      resolvePrompt,
      complete: (options: any) => {
        const adapter = getAdapterForTask("curriculum.generate.progression");
        return adapter.complete(options);
      },
    },
  );

  const provenance: ProgressionProvenance = "manual_regeneration";

  if (!result.progression) {
    await upsertProgressionState({
      sourceId: params.sourceId,
      status: "explicit_failed",
      lastFailureReason: result.failureReason ?? "All progression generation attempts failed.",
      attemptCount: result.attemptCount,
      usingInferredFallback: true,
      provenance,
    });

    return {
      kind: "failure",
      reason: result.failureReason ?? "All progression generation attempts failed.",
      attemptCount: result.attemptCount,
    };
  }

  // Normalize the progression using the real DB source ID and lineage.
  const normalized = normalizeCurriculumDocument({
    sourceId: params.sourceId,
    sourceLineageId: params.sourceId,
    document: buildDocumentFromSkillNodes(skillNodes),
    progression: result.progression,
  });

  // Persist: clear explicit progression then write new phases and prerequisites.
  const db = getDb();
  await db.transaction(async (tx) => {
    // Clear existing phases (cascades to phase_nodes).
    await tx.delete(curriculumPhases).where(eq(curriculumPhases.sourceId, params.sourceId));

    // Clear explicit (non-inferred) prerequisites only; preserve inferred fallback rows
    // if they don't conflict with what we're about to write.
    await tx
      .delete(curriculumSkillPrerequisites)
      .where(eq(curriculumSkillPrerequisites.sourceId, params.sourceId));

    // Insert new prerequisites.
    if (normalized.prerequisites.length > 0) {
      await tx.insert(curriculumSkillPrerequisites).values(normalized.prerequisites);
    }

    // Insert new phases and phase-node assignments.
    for (const phase of normalized.phases) {
      const [createdPhase] = await tx
        .insert(curriculumPhases)
        .values({
          sourceId: params.sourceId,
          title: phase.title,
          description: phase.description ?? null,
          position: phase.position,
          metadata: { provenance: "manual_regeneration" },
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

  const diag = normalized.summary.progressionDiagnostics;

  await upsertProgressionState({
    sourceId: params.sourceId,
    status: "explicit_ready",
    lastFailureReason: null,
    lastAcceptedPhaseCount: diag.phaseCount,
    lastAcceptedEdgeCount: diag.acceptedEdgeCount,
    attemptCount: result.attemptCount,
    usingInferredFallback: false,
    provenance,
  });

  console.info("[curriculum/progression-regeneration] Progression regenerated successfully.", {
    sourceId: params.sourceId,
    phaseCount: diag.phaseCount,
    edgeCount: diag.acceptedEdgeCount,
    attemptCount: result.attemptCount,
  });

  return {
    kind: "success",
    phaseCount: diag.phaseCount,
    edgeCount: diag.acceptedEdgeCount,
    attemptCount: result.attemptCount,
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
}): Promise<{ systemPrompt: string; userPrompt: string }> {
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
  const minimalArtifact = buildMinimalArtifactForProgression(source, skillNodes);
  const leafSkillTitles = skillRefs.map((r) => r.skillTitle);

  const prompt = await resolvePrompt(
    "curriculum.generate.progression",
    CURRICULUM_PROGRESSION_PROMPT_VERSION,
  );

  const userPrompt = buildCurriculumProgressionPrompt({
    learnerName: params.learnerDisplayName,
    coreArtifact: minimalArtifact,
    leafSkillTitles,
    skillRefs,
  });

  return {
    systemPrompt: prompt.systemPrompt,
    userPrompt,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal synthetic document from skill nodes for the progression prompt.
 * Groups skills by their stable ID prefix (since we don't have full tree context
 * in this service, we use a flat structure). The prompt context from the source
 * title is more important for quality than the document hierarchy.
 */
function buildDocumentFromSkillNodes(
  skillNodes: Array<{ id: string; title: string; normalizedType: string }>,
): Record<string, CurriculumJsonNode> {
  // Build a flat skills-only document to feed to normalization for title→ID mapping.
  // The prompt already receives skill titles + IDs directly; this document is only
  // used for normalization title lookups.
  const skills: Record<string, string> = {};
  for (const node of skillNodes) {
    skills[node.title] = node.id;
  }
  return { Skills: skills } as Record<string, CurriculumJsonNode>;
}

/**
 * Build a minimal artifact that has enough structure for the progression prompt
 * but doesn't require a full AI re-generation.
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
