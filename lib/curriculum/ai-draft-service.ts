import "@/lib/server-only";

import type { AppLearner } from "@/lib/users/service";
import {
  CurriculumAiChatTurnSchema,
  CurriculumAiFailureResultSchema,
  CurriculumAiRevisionResultSchema,
  type CurriculumAiChatMessage,
  type CurriculumAiChatTurn,
  type CurriculumAiCreateResult,
  type CurriculumAiFailureResult,
  type CurriculumAiGenerateResult,
  type CurriculumAiGeneratedArtifact,
  type CurriculumAiProgression,
  type CurriculumAiRevisionResult,
} from "@/lib/curriculum/ai-draft";
import type {
  IntakeSourcePackageContext,
  LearningCoreInputFile,
} from "@/lib/homeschool/intake/types";
import {
  executeCurriculumGenerate,
  executeCurriculumIntake,
  executeCurriculumRevision,
  executeProgressionGenerate,
  previewCurriculumRevision,
} from "@/lib/learning-core/curriculum";

import {
  applyAiDraftArtifactToCurriculumSource,
  createCurriculumSourceFromAiDraftArtifact,
  getCurriculumSource,
  getCurriculumTree,
  listCurriculumOutline,
  type CreatedAiDraftCurriculumResult,
} from "./service";
import type { CurriculumTreeNode } from "./types";

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

export async function createCurriculumFromConversation(
  params: {
    householdId: string;
    learner: AppLearner;
    messages: CurriculumAiChatMessage[];
  },
  deps?: {
    generate?: typeof generateCurriculumArtifact;
    persist?: typeof createCurriculumSourceFromAiDraftArtifact;
  },
): Promise<CurriculumAiCreateResult> {
  const generate = deps?.generate ?? generateCurriculumArtifact;
  const persist = deps?.persist ?? createCurriculumSourceFromAiDraftArtifact;
  const generation = await generate({
    learner: params.learner,
    messages: params.messages,
  });

  if (generation.kind === "failure") {
    return generation;
  }

  const created = await persist({
    householdId: params.householdId,
    artifact: generation.artifact,
  });

  return {
    kind: "success",
    ...created,
  };
}

export async function reviseCurriculumFromConversation(params: {
  householdId: string;
  sourceId: string;
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
},
deps?: {
  persist?: typeof applyAiDraftArtifactToCurriculumSource;
}): Promise<CurriculumAiRevisionResult> {
  const persist = deps?.persist ?? applyAiDraftArtifactToCurriculumSource;
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

export async function generateCurriculumArtifact(params: {
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
  sourcePackages?: IntakeSourcePackageContext[];
  sourceFiles?: LearningCoreInputFile[];
},
deps?: {
  execute?: typeof executeCurriculumGenerate;
}): Promise<CurriculumAiGenerateResult> {
  const execute = deps?.execute ?? executeCurriculumGenerate;

  try {
    const response = await execute({
      input: {
        learnerName: params.learner.displayName,
        messages: params.messages,
        granularityGuidance: [],
        correctionNotes: [],
        sourcePackages: params.sourcePackages ?? [],
        sourceFiles: params.sourceFiles ?? [],
      },
      organizationId: params.learner.organizationId,
      learnerId: params.learner.id,
    });

    return {
      kind: "success",
      artifact: response.artifact,
    };
  } catch (error) {
    return buildFailureResult({
      stage: "generation",
      reason: error instanceof Error ? error.message : "Generation failed",
      userSafeMessage: "Could not generate this curriculum yet.",
    });
  }
}

export async function generateCurriculumProgression(params: {
  learner: { displayName: string };
  artifact: CurriculumAiGeneratedArtifact;
  skillRefs?: Array<{ skillId: string; skillTitle: string }>;
}): Promise<{
  progression?: CurriculumAiProgression;
  attemptCount: number;
  attempts: Array<Record<string, unknown>>;
  failureReason?: string;
}> {
  const skillCatalog =
    params.skillRefs?.map((skill, index) => ({
      skillRef: skill.skillId,
      title: skill.skillTitle,
      ordinal: index + 1,
    })) ??
    extractSkillCatalogFromArtifact(params.artifact);

  try {
    const response = await executeProgressionGenerate({
      input: {
        learnerName: params.learner.displayName,
        sourceTitle: params.artifact.source.title,
        sourceSummary: params.artifact.source.summary,
        skillCatalog,
      },
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

function extractSkillCatalogFromArtifact(artifact: CurriculumAiGeneratedArtifact) {
  const rows: Array<{ skillRef: string; title: string; ordinal: number }> = [];
  const walk = (node: unknown, path: string[]) => {
    if (typeof node === "string") {
      rows.push({
        skillRef: [...path, node].join(" / "),
        title: node,
        ordinal: rows.length + 1,
      });
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === "string") {
          walk(item, path);
        }
      }
      return;
    }

    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === "string") {
          rows.push({
            skillRef: [...path, key].join(" / "),
            title: key,
            ordinal: rows.length + 1,
          });
        } else {
          walk(value, [...path, key]);
        }
      }
    }
  };

  walk(artifact.document, []);
  return rows;
}

async function buildCurriculumRevisionSnapshot(sourceId: string, householdId: string) {
  const [source, tree, outline] = await Promise.all([
    getCurriculumSource(sourceId, householdId),
    getCurriculumTree(sourceId, householdId),
    listCurriculumOutline(sourceId),
  ]);

  if (!source || !tree) {
    throw new Error("Curriculum snapshot could not be loaded.");
  }

  const lessonCount = outline.reduce((total, unit) => total + unit.lessons.length, 0);
  const estimatedSessionCount = outline.reduce(
    (total, unit) => total + (unit.estimatedSessions ?? unit.lessons.length),
    0,
  );

  return {
    source: {
      id: source.id,
      title: source.title,
      description: source.description,
      kind: source.kind,
      status: source.status,
      importVersion: source.importVersion,
      subjects: source.subjects,
      gradeLevels: source.gradeLevels,
      academicYear: source.academicYear,
    },
    counts: {
      nodeCount: tree.nodeCount,
      skillCount: tree.skillCount,
      unitCount: outline.length,
      lessonCount,
      estimatedSessionCount,
    },
    pacing: {
      totalEstimatedSessions: estimatedSessionCount,
      unitSessionBudgets: outline.map((unit) => ({
        unitTitle: unit.title,
        estimatedSessions: unit.estimatedSessions ?? unit.lessons.length,
      })),
    },
    structureSummary: tree.rootNodes.map((node) => summarizeTreeNode(node)),
    structure: tree.rootNodes.map((node) => serializeTreeNode(node, [])),
    outline: outline.map((unit) => ({
      title: unit.title,
      description: unit.description,
      subject: undefined,
      estimatedWeeks: unit.estimatedWeeks,
      estimatedSessions: unit.estimatedSessions,
      lessons: unit.lessons.map((lesson) => ({
        title: lesson.title,
        description: lesson.description,
        subject: lesson.subject,
        estimatedMinutes: lesson.estimatedMinutes,
        materials: lesson.materials,
        objectives: lesson.objectives,
        linkedSkillTitles: lesson.linkedSkillTitles,
      })),
    })),
  };
}

function summarizeTreeNode(node: CurriculumTreeNode) {
  return `${node.normalizedType}: ${node.title}`;
}

function serializeTreeNode(
  node: CurriculumTreeNode,
  parentPath: string[],
): {
  title: string;
  normalizedType: string;
  path: string[];
  normalizedPath: string;
  description?: string;
  code?: string;
  depth: number;
  sequenceIndex: number;
  children: Array<ReturnType<typeof serializeTreeNode>>;
} {
  const path = [...parentPath, node.title];
  return {
    title: node.title,
    normalizedType: node.normalizedType,
    path,
    normalizedPath: node.normalizedPath,
    description: node.description,
    code: node.code,
    depth: node.depth,
    sequenceIndex: node.sequenceIndex,
    children: node.children.map((child) => serializeTreeNode(child, path)),
  };
}
