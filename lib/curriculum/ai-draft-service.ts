import "@/lib/server-only";

import type { AppLearner } from "@/lib/users/service";
import {
  CurriculumAiChatTurnSchema,
  CurriculumAiFailureResultSchema,
  CurriculumAiRevisionResultSchema,
  type CurriculumAiChatMessage,
  type CurriculumAiChatTurn,
  type CurriculumAiFailureResult,
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

    return {
      launchPlan: response.artifact,
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
      openingUnitRefs: params.launchPlan.openingUnitRefs,
      openingSkillNodeIds: [...new Set(openingSkillNodeIds)],
    },
  });
}

async function buildCurriculumRevisionSnapshot(sourceId: string, householdId: string) {
  const basis = await buildProgressionGenerationBasis({ sourceId, householdId });

  return {
    source: {
      title: basis.source.title,
      description: basis.source.description ?? "",
      subjects: basis.source.subjects,
      gradeLevels: basis.source.gradeLevels,
      teachingApproach: "",
      successSignals: [],
      parentNotes: [],
      rationale: [],
    },
    intakeSummary: "",
    pacing: basis.source.pacing ?? {},
    document: {},
    units: basis.units.map((unit) => ({
      unitRef: unit.unitRef,
      title: unit.title,
      description: unit.description ?? "",
      estimatedWeeks: unit.estimatedWeeks,
      estimatedSessions: unit.estimatedSessions,
      skillRefs: unit.skillRefs,
    })),
  };
}
