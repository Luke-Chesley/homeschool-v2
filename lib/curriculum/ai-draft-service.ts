import "@/lib/server-only";

import type { AppLearner } from "@/lib/users/service";
import {
  CurriculumAiChatTurnSchema,
  CurriculumAiGeneratedArtifactSchema,
  CurriculumAiFailureResultSchema,
  CurriculumAiRevisionResultSchema,
  type CurriculumAiChatMessage,
  type CurriculumAiChatTurn,
  type CurriculumAiFailureResult,
  type CurriculumAiGeneratedArtifact,
  type CurriculumAiLaunchPlan,
  type CurriculumAiProgression,
  type CurriculumAiRevisionResult,
} from "@/lib/curriculum/ai-draft";
import {
  executeCurriculumIntake,
  executeCurriculumRevision,
  executeLaunchPlanGenerate,
  executeProgressionGenerate,
  previewCurriculumRevision,
} from "@/lib/learning-core/curriculum";

import {
  applyCurriculumArtifactToCurriculumSource,
  getCurriculumSource,
  setCurriculumLaunchPlan,
} from "./service";
import {
  buildProgressionGenerationBasis,
  buildProgressionGenerationInput,
  type ProgressionGenerationBasis,
} from "./progression-basis";

const MAX_FAILURE_REASON_LENGTH = 120;

export function truncateCurriculumFailureReason(reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length <= MAX_FAILURE_REASON_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_FAILURE_REASON_LENGTH - 3)}...`;
}

function buildFailureResult(params: {
  stage: "generation" | "parse" | "schema" | "persistence" | "revision" | "quality";
  reason: string;
  userSafeMessage: string;
  attemptCount?: number;
  debugMetadata?: Record<string, unknown>;
}): CurriculumAiFailureResult {
  const reason = truncateCurriculumFailureReason(params.reason);
  const debugMetadata =
    reason === params.reason
      ? params.debugMetadata
      : {
          ...(params.debugMetadata ?? {}),
          originalReason: params.reason,
        };

  return CurriculumAiFailureResultSchema.parse({
    kind: "failure",
    stage: params.stage,
    reason,
    userSafeMessage: params.userSafeMessage,
    issues: [],
    attemptCount: params.attemptCount ?? 1,
    retryable: false,
    debugMetadata,
  });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function buildRevisionCoverageStrategy(sourceTitle: string, unitCount: number) {
  const unitLabel = unitCount === 1 ? "unit" : "units";
  return `Continue the existing ${sourceTitle} sequence across ${unitCount} ${unitLabel}, adjusting only where the revision request changes scope or emphasis.`;
}

function buildRevisionCurriculumSkills(
  basis: ProgressionGenerationBasis,
): CurriculumAiGeneratedArtifact["skills"] {
  return basis.skillCatalog.map((skill, index) => ({
    skillId: skill.skillRef || `skill-${index + 1}`,
    domainTitle: readString(skill.domainTitle) ?? "General",
    strandTitle: readString(skill.strandTitle) ?? "General",
    goalGroupTitle: readString(skill.goalGroupTitle) ?? "Skills",
    title: skill.title,
  }));
}

export async function continueCurriculumAiDraftConversation(params: {
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
}): Promise<CurriculumAiChatTurn> {
  const response = await executeCurriculumIntake({
    input: {
      learnerName: params.learner.displayName,
      messages: params.messages,
    },
    surface: "curriculum",
  });

  return CurriculumAiChatTurnSchema.parse(response.artifact);
}

export async function reviseCurriculumFromConversation(params: {
  householdId: string;
  sourceId: string;
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
},
deps?: {
  persist?: typeof applyCurriculumArtifactToCurriculumSource;
}): Promise<CurriculumAiRevisionResult> {
  const persist = deps?.persist ?? applyCurriculumArtifactToCurriculumSource;
  const source = await getCurriculumSource(params.sourceId, params.householdId);
  if (!source) {
    return buildFailureResult({
      stage: "revision",
      reason: "Source not found",
      userSafeMessage: "Curriculum source not found.",
    });
  }

  const snapshot = await buildCurriculumRevisionSnapshot(params.sourceId, params.householdId);
  const latestUserMessage = [...params.messages].reverse().find((message) => message.role === "user");

  try {
    const response = await executeCurriculumRevision({
      input: {
        learnerName: params.learner.displayName,
        currentCurriculum: snapshot,
        currentRequest: latestUserMessage?.content ?? null,
        messages: params.messages,
        correctionNotes: [],
      },
      organizationId: params.householdId,
      learnerId: params.learner.id,
    });

    const turn = response.artifact;
    if (turn.action === "clarify" || !turn.artifact) {
      return CurriculumAiRevisionResultSchema.parse({
        kind: "clarify",
        action: "clarify",
        assistantMessage: turn.assistantMessage,
        changeSummary: turn.changeSummary,
        sourceId: params.sourceId,
        sourceTitle: source.title,
      });
    }

    const applied = await persist({
      sourceId: params.sourceId,
      householdId: params.householdId,
      artifact: turn.artifact,
    });

    return CurriculumAiRevisionResultSchema.parse({
      kind: "applied",
      action: "applied",
      assistantMessage: turn.assistantMessage,
      changeSummary: turn.changeSummary,
      ...applied,
    });
  } catch (error) {
    return buildFailureResult({
      stage: "revision",
      reason: error instanceof Error ? error.message : "Revision failed",
      userSafeMessage: "Could not revise this curriculum.",
    });
  }
}

export async function buildCurriculumRevisionPromptPreview(params: {
  householdId: string;
  sourceId: string;
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
}) {
  const snapshot = await buildCurriculumRevisionSnapshot(params.sourceId, params.householdId);
  const latestUserMessage = [...params.messages].reverse().find((message) => message.role === "user");

  return previewCurriculumRevision({
    input: {
      learnerName: params.learner.displayName,
      currentCurriculum: snapshot,
      currentRequest: latestUserMessage?.content ?? null,
      messages: params.messages,
      correctionNotes: [],
    },
    organizationId: params.householdId,
    learnerId: params.learner.id,
  });
}

export async function generateCurriculumProgression(params: {
  householdId: string;
  sourceId: string;
  learner: { displayName: string };
  basis?: ProgressionGenerationBasis;
}): Promise<{
  progression?: CurriculumAiProgression;
  attemptCount: number;
  attempts: Array<Record<string, unknown>>;
  failureReason?: string;
}> {
  try {
    const basis = params.basis ?? await buildProgressionGenerationBasis({
      sourceId: params.sourceId,
      householdId: params.householdId,
    });
    const response = await executeProgressionGenerate({
      input: buildProgressionGenerationInput({
        learnerName: params.learner.displayName,
        basis,
      }),
      organizationId: params.householdId,
    });

    return {
      progression: response.artifact,
      attemptCount: 1,
      attempts: [],
    };
  } catch (error) {
    return {
      attemptCount: 1,
      attempts: [],
      failureReason: error instanceof Error ? error.message : "Progression generation failed.",
    };
  }
}

export async function generateCurriculumLaunchPlan(params: {
  householdId: string;
  sourceId: string;
  learner: { displayName: string };
  chosenHorizon: string;
  progression?: CurriculumAiProgression | null;
  basis?: ProgressionGenerationBasis;
}): Promise<{
  launchPlan?: CurriculumAiLaunchPlan;
  attemptCount: number;
  attempts: Array<Record<string, unknown>>;
  failureReason?: string;
}> {
  try {
    const basis = params.basis ?? await buildProgressionGenerationBasis({
      sourceId: params.sourceId,
      householdId: params.householdId,
    });
    const response = await executeLaunchPlanGenerate({
      input: {
        learnerName: params.learner.displayName,
        sourceTitle: basis.source.title,
        sourceSummary: basis.source.description,
        requestMode: readString(basis.source.curriculumLineage?.requestMode) ?? undefined,
        sourceKind: basis.source.sourceModel?.sourceKind,
        deliveryPattern: basis.source.sourceModel?.deliveryPattern,
        entryStrategy: basis.source.sourceModel?.entryStrategy,
        entryLabel: basis.source.sourceModel?.entryLabel,
        continuationMode: basis.source.sourceModel?.continuationMode,
        chosenHorizon: params.chosenHorizon,
        skillCatalog: basis.skillCatalog,
        unitAnchors: basis.unitAnchors,
        progression: params.progression ?? undefined,
      },
      organizationId: params.householdId,
    });
    const launchPlan = response.artifact;

    return {
      launchPlan,
      attemptCount: 1,
      attempts: [],
    };
  } catch (error) {
    return {
      attemptCount: 1,
      attempts: [],
      failureReason: error instanceof Error ? error.message : "Launch plan generation failed.",
    };
  }
}

export function resolveLaunchPlanOpeningSkillNodeIds(params: {
  basis: ProgressionGenerationBasis;
  openingSkillRefs: string[];
}) {
  const unresolvedSkillRefs = params.openingSkillRefs.filter(
    (skillRef) => !params.basis.skillNodeIdByRef.has(skillRef),
  );
  if (unresolvedSkillRefs.length > 0) {
    throw new Error(
      `Launch plan references unresolved openingSkillRefs: ${unresolvedSkillRefs.join(", ")}`,
    );
  }

  return [...new Set(params.openingSkillRefs.map((skillRef) => params.basis.skillNodeIdByRef.get(skillRef)!))];
}

export function resolveLaunchPlanOpeningUnitRefs(params: {
  basis: ProgressionGenerationBasis;
  openingSkillRefs: string[];
}) {
  const selectedSkillRefs = new Set(params.openingSkillRefs);
  const derivedUnitRefs = params.basis.unitAnchors
    .filter((unitAnchor) => unitAnchor.skillRefs.some((skillRef) => selectedSkillRefs.has(skillRef)))
    .map((unitAnchor) => unitAnchor.unitRef);

  if (derivedUnitRefs.length > 0) {
    return [...new Set(derivedUnitRefs)];
  }

  if (params.basis.unitAnchors.length === 1) {
    return [params.basis.unitAnchors[0]!.unitRef];
  }

  return [];
}

export async function persistCurriculumLaunchPlan(params: {
  householdId: string;
  sourceId: string;
  launchPlan: CurriculumAiLaunchPlan;
}) {
  const basis = await buildProgressionGenerationBasis({
    sourceId: params.sourceId,
    householdId: params.householdId,
  });

  const openingSkillNodeIds = resolveLaunchPlanOpeningSkillNodeIds({
    basis,
    openingSkillRefs: params.launchPlan.openingSkillRefs,
  });
  const openingUnitRefs = resolveLaunchPlanOpeningUnitRefs({
    basis,
    openingSkillRefs: params.launchPlan.openingSkillRefs,
  });

  if (openingSkillNodeIds.length === 0) {
    throw new Error("Launch plan did not resolve to any persisted skill nodes.");
  }

  return setCurriculumLaunchPlan({
    sourceId: params.sourceId,
    householdId: params.householdId,
    launchPlan: {
      chosenHorizon: params.launchPlan.chosenHorizon,
      scopeSummary: params.launchPlan.scopeSummary,
      initialSliceUsed: params.launchPlan.initialSliceUsed,
      initialSliceLabel: params.launchPlan.initialSliceLabel ?? null,
      openingUnitRefs,
      openingSkillNodeIds: [...new Set(openingSkillNodeIds)],
    },
  });
}

async function buildCurriculumRevisionSnapshot(
  sourceId: string,
  householdId: string,
): Promise<CurriculumAiGeneratedArtifact> {
  const basis = await buildProgressionGenerationBasis({ sourceId, householdId });
  const description =
    readString(basis.source.description) ?? `Current curriculum for ${basis.source.title}.`;
  const teachingApproach =
    readString(basis.source.teachingApproach)
    ?? `Keep the ${basis.source.title} work practical, teachable, and aligned to the existing curriculum structure.`;
  const successSignals =
    readStringArray(basis.source.successSignals).length > 0
      ? readStringArray(basis.source.successSignals)
      : [`Learner makes visible progress through ${basis.source.title} with clear mastery checks.`];
  const rationale =
    readStringArray(basis.source.rationale).length > 0
      ? readStringArray(basis.source.rationale)
      : ["Preserve the durable curriculum structure while applying the requested revision."];
  return CurriculumAiGeneratedArtifactSchema.parse({
    source: {
      title: basis.source.title,
      description,
      subjects: basis.source.subjects,
      gradeLevels: basis.source.gradeLevels,
      academicYear: basis.source.academicYear ?? undefined,
      summary: description,
      teachingApproach,
      successSignals,
      parentNotes: readStringArray(basis.source.parentNotes),
      rationale,
    },
    intakeSummary:
      readString(basis.source.intakeSummary)
      ?? `Continue revising the existing ${basis.source.title} curriculum without rebuilding it from scratch.`,
    pacing: {
      totalWeeks: basis.source.pacing?.totalWeeks,
      sessionsPerWeek: basis.source.pacing?.sessionsPerWeek,
      sessionMinutes: basis.source.pacing?.sessionMinutes,
      totalSessions: basis.source.pacing?.totalSessions,
      coverageStrategy: buildRevisionCoverageStrategy(basis.source.title, basis.units.length),
      coverageNotes: [],
    },
    skills: buildRevisionCurriculumSkills(basis),
    units: basis.units.map((unit) => ({
      unitRef: unit.unitRef,
      title: unit.title,
      description: readString(unit.description) ?? `Work through ${unit.title}.`,
      estimatedWeeks: unit.estimatedWeeks,
      estimatedSessions: unit.estimatedSessions,
      skillIds: unit.skillRefs,
    })),
  });
}
