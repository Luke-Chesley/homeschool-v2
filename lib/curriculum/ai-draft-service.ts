import "server-only";

import { getAdapterForTask } from "@/lib/ai/registry";
import { getModelForTask } from "@/lib/ai/provider-adapter";
import { getAiRoutingConfig } from "@/lib/ai/routing";
import type { ChatMessage } from "@/lib/ai/types";
import { resolvePrompt } from "@/lib/prompts/store";
import {
  buildCurriculumGenerationPrompt,
  buildCurriculumIntakePrompt,
  buildCurriculumRevisionPrompt,
  buildCurriculumTitlePrompt,
  CURRICULUM_GENERATION_PROMPT_VERSION,
  CURRICULUM_INTAKE_PROMPT_VERSION,
  CURRICULUM_REVISION_PROMPT_VERSION,
  CURRICULUM_TITLE_PROMPT_VERSION,
  type CurriculumRevisionPromptSnapshot,
} from "@/lib/prompts/curriculum-draft";
import type { AppLearner } from "@/lib/users/service";

import {
  applyAiDraftArtifactToCurriculumSource,
  createCurriculumSourceFromAiDraftArtifact,
  getCurriculumSource,
  getCurriculumTree,
  listCurriculumOutline,
  type CreatedAiDraftCurriculumResult,
} from "./service";
import { buildFallbackCurriculumArtifact } from "./fallback";
import {
  buildGranularityGuidance,
  inferCurriculumGranularityProfile,
  type RequestedPacing,
} from "./granularity";
import { assessCurriculumArtifactQuality } from "./quality";
import type { CurriculumTreeNode } from "./types";
import {
  CurriculumAiCapturedRequirementsSchema,
  CurriculumAiChatTurnSchema,
  CurriculumAiGeneratedArtifactSchema,
  type CurriculumAiRevisionPlan,
  CurriculumAiRevisionTurnSchema,
  type CurriculumAiPacing,
  type CurriculumAiCapturedRequirements,
  type CurriculumAiChatMessage,
  type CurriculumAiChatTurn,
  type CurriculumAiGeneratedArtifact,
  type CurriculumAiRevisionTurn,
} from "./ai-draft";
import {
  buildRevisionPromptSummary,
  runCurriculumRevisionDecision,
} from "./revision-model";

type RevisionPreference = "targeted" | "broader";

interface CurriculumRevisionSnapshot {
  source: {
    id: string;
    title: string;
    description?: string;
    kind: string;
    status: string;
    importVersion: number;
    subjects: string[];
    gradeLevels: string[];
    academicYear?: string;
  };
  counts: {
    nodeCount: number;
    skillCount: number;
    unitCount: number;
    lessonCount: number;
    estimatedSessionCount: number;
  };
  pacing: {
    totalEstimatedSessions: number;
    unitSessionBudgets: Array<{
      unitTitle: string;
      estimatedSessions: number;
    }>;
  };
  structureSummary: string[];
  structure: CurriculumRevisionSnapshotNode[];
  outline: Array<{
    title?: unknown;
    description?: unknown;
    subject?: unknown;
    estimatedWeeks?: unknown;
    estimatedSessions?: unknown;
    lessons: Array<{
      title?: unknown;
      description?: unknown;
      subject?: unknown;
      estimatedMinutes?: unknown;
      materials?: unknown;
      objectives?: unknown;
      linkedSkillTitles?: unknown;
    }>;
  }>;
}

interface CurriculumRevisionSnapshotNode {
  title: string;
  normalizedType: "domain" | "strand" | "goal_group" | "skill";
  path: string[];
  normalizedPath: string;
  description?: string;
  code?: string;
  depth: number;
  sequenceIndex: number;
  children: CurriculumRevisionSnapshotNode[];
}

interface PromptCurriculumNode {
  title: string;
  type: string;
  description?: string;
  children: PromptCurriculumNode[];
}

interface SerializedCurriculumNodeForPrompt {
  title: string;
  normalizedType: string;
  description?: string;
  children: SerializedCurriculumNodeForPrompt[];
}

interface RevisionSnapshotNode {
  type?: string;
  title?: string;
  description?: string;
  children?: RevisionSnapshotNode[];
}

interface RevisionTargetCandidate {
  path: string[];
  title: string;
  type: string;
  score: number;
}

interface RevisionSnapshotOutlineLesson {
  title?: unknown;
  description?: unknown;
  subject?: unknown;
  estimatedMinutes?: unknown;
  materials?: unknown;
  objectives?: unknown;
  linkedSkillTitles?: unknown;
}

interface RevisionSnapshotOutlineUnit {
  title?: unknown;
  description?: unknown;
  estimatedWeeks?: unknown;
  estimatedSessions?: unknown;
  lessons: RevisionSnapshotOutlineLesson[];
}

type RevisionDocumentNode = string | string[] | { [key: string]: RevisionDocumentNode };

interface RevisionSkillLeafLocation {
  kind: "array" | "object";
  container: string[] | Record<string, RevisionDocumentNode>;
  index?: number;
  key?: string;
  title: string;
  description?: string;
}

export async function continueCurriculumAiDraftConversation(params: {
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
}): Promise<CurriculumAiChatTurn> {
  const prompt = await resolvePrompt("curriculum.intake", CURRICULUM_INTAKE_PROMPT_VERSION);
  const adapter = getAdapterForTask("curriculum.intake");
  const model = getModelForTask("curriculum.intake", getAiRoutingConfig());
  const messages = normalizeMessages(params.messages);

  try {
    const response = await adapter.complete({
      model,
      temperature: 0.35,
      systemPrompt: prompt.systemPrompt,
      messages: [
        {
          role: "user",
          content: buildCurriculumIntakePrompt({
            learnerName: params.learner.displayName,
            messages,
            requirementHints: inferCapturedRequirements(messages),
          }),
        },
      ],
    });

    const parsedTurn = parseCurriculumChatTurn(response.content);
    if (parsedTurn) {
      return parsedTurn;
    }
  } catch (error) {
    console.error("[curriculum/ai-draft] Intake turn failed, using fallback.", error);
  }

  return buildFallbackChatTurn({
    learner: params.learner,
    messages,
  });
}

export async function createCurriculumFromConversation(params: {
  householdId: string;
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
}): Promise<CreatedAiDraftCurriculumResult> {
  const artifact = await generateCurriculumArtifact({
    learner: params.learner,
    messages: params.messages,
  });

  return createCurriculumSourceFromAiDraftArtifact({
    householdId: params.householdId,
    artifact,
  });
}

export async function reviseCurriculumFromConversation(params: {
  householdId: string;
  sourceId: string;
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
}): Promise<
  | ({
      assistantMessage: string;
      action: "clarify";
      changeSummary: string[];
    } & Pick<CreatedAiDraftCurriculumResult, "sourceId" | "sourceTitle">)
  | ({
      assistantMessage: string;
      action: "applied";
      changeSummary: string[];
    } & CreatedAiDraftCurriculumResult)
> {
  const snapshot = await buildCurriculumRevisionSnapshot(params.sourceId, params.householdId);
  const decision = await generateCurriculumRevisionDecision({
    learner: params.learner,
    messages: params.messages,
    snapshot,
  });

  if (decision.action === "clarify") {
    console.info("[curriculum/ai-draft] revision clarified", {
      sourceId: snapshot.source.id,
      changeSummaryCount: decision.changeSummary.length,
    });
    return {
      assistantMessage: decision.assistantMessage,
      action: "clarify",
      changeSummary: decision.changeSummary,
      sourceId: snapshot.source.id,
      sourceTitle: snapshot.source.title,
    };
  }

  console.info("[curriculum/ai-draft] revision decision", {
    sourceId: snapshot.source.id,
    action: decision.action,
    changeSummaryCount: decision.changeSummary.length,
  });

  const created = await applyAiDraftArtifactToCurriculumSource({
    householdId: params.householdId,
    sourceId: params.sourceId,
    artifact: decision.artifact!,
  });

  console.info("[curriculum/ai-draft] revision apply succeeded", {
    sourceId: snapshot.source.id,
    beforeCounts: snapshot.counts,
    afterCounts: {
      nodeCount: created.nodeCount,
      skillCount: created.skillCount,
      unitCount: created.unitCount,
      lessonCount: created.lessonCount,
      estimatedSessionCount: created.estimatedSessionCount,
    },
  });

  return {
    assistantMessage: decision.assistantMessage,
    action: "applied",
    changeSummary: decision.changeSummary,
    ...created,
  };
}

export async function buildCurriculumRevisionPromptPreview(params: {
  householdId: string;
  sourceId: string;
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
}): Promise<{
  systemPrompt: string;
  userPrompt: string;
}> {
  const snapshot = await buildCurriculumRevisionSnapshot(params.sourceId, params.householdId);
  const prompt = await resolvePrompt("curriculum.revise", CURRICULUM_REVISION_PROMPT_VERSION);
  const messages = normalizeMessages(params.messages);

  return {
    systemPrompt: prompt.systemPrompt,
    userPrompt: buildCurriculumRevisionPrompt({
      learnerName: params.learner.displayName,
      currentCurriculum: snapshot as CurriculumRevisionPromptSnapshot,
      currentRequest: getLatestParentRequest(messages),
      messages,
    }),
  };
}

async function generateCurriculumArtifact(params: {
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
}): Promise<CurriculumAiGeneratedArtifact> {
  const prompt = await resolvePrompt("curriculum.generate", CURRICULUM_GENERATION_PROMPT_VERSION);
  const adapter = getAdapterForTask("curriculum.generate");
  const model = getModelForTask("curriculum.generate", getAiRoutingConfig());
  const messages = normalizeMessages(params.messages);
  const capturedRequirements = inferCapturedRequirements(messages);
  const requestedPacing = inferRequestedPacing(messages, capturedRequirements);
  const topic = extractTopicLabel(capturedRequirements.topic || collectUserMessages(messages)[0] || "Custom Study");
  const granularityProfile = inferCurriculumGranularityProfile({
    topic,
    requirements: capturedRequirements,
    pacing: requestedPacing,
  });

  const attemptNotes: string[][] = [
    [],
    [
      "The previous draft was too shallow or too compressed for the requested pacing.",
      "Preserve coherence and avoid taxonomy noise, but add as many goal groups and skills as needed for teachability and pacing realism.",
      "Do not optimize for minimal node count.",
      "If multiple procedures, rules, or misconception targets would be taught separately, split them into separate skills.",
      "Generate a distinct curriculum title instead of copying the parent's opening message.",
    ],
  ];

  for (const correctionNotes of attemptNotes) {
    try {
      const response = await adapter.complete({
        model,
        temperature: 0.4,
        systemPrompt: prompt.systemPrompt,
        messages: [
          {
            role: "user",
            content: buildCurriculumGenerationPrompt({
              learnerName: params.learner.displayName,
              messages,
              requirementHints: capturedRequirements,
              pacingExpectations: requestedPacing,
              granularityGuidance: buildGranularityGuidance(granularityProfile),
              correctionNotes,
            }),
          },
        ],
      });

      const parsedArtifact = parseCurriculumGeneratedArtifact(response.content);
      if (!parsedArtifact) {
        continue;
      }

      const artifact = await finalizeCurriculumTitle({
        artifact: sanitizeArtifact(parsedArtifact),
        learner: params.learner,
        messages,
      });
      const qualityIssues = assessCurriculumArtifactQuality(artifact, {
        topicText: [
          topic,
          capturedRequirements.topic,
          capturedRequirements.goals,
          capturedRequirements.learnerProfile,
          capturedRequirements.structurePreferences,
        ]
          .join(" ")
          .trim(),
        granularity: granularityProfile,
        requestedPacing,
        learnerText: params.learner.displayName,
      });
      if (qualityIssues.length === 0) {
        return artifact;
      }

      console.warn("[curriculum/ai-draft] Artifact quality check failed, retrying.", {
        issues: qualityIssues.map((issue) => issue.message),
      });
    } catch (error) {
      console.error("[curriculum/ai-draft] Artifact generation failed, retrying or using fallback.", error);
    }
  }

  return finalizeCurriculumTitle({
    artifact: buildFallbackCurriculumArtifact({
      learner: params.learner,
      topic,
      capturedRequirements,
      requestedPacing,
    }),
    learner: params.learner,
    messages,
  });
}

async function generateCurriculumRevisionDecision(params: {
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
  snapshot: CurriculumRevisionSnapshot;
}): Promise<CurriculumAiRevisionTurn> {
  const prompt = await resolvePrompt("curriculum.revise", CURRICULUM_REVISION_PROMPT_VERSION);
  const adapter = getAdapterForTask("curriculum.revise");
  const model = getModelForTask("curriculum.revise", getAiRoutingConfig());
  const normalizedMessages = normalizeMessages(params.messages);
  const snapshotSummary = buildRevisionPromptSummary(
    params.snapshot as CurriculumRevisionPromptSnapshot,
  );
  const revisionTopic = extractTopicLabel(
    [
      params.snapshot.source.title,
      params.snapshot.source.description ?? "",
      normalizedMessages.map((message) => message.content).join(" "),
    ].join(" "),
  );
  const revisionGranularityProfile = inferCurriculumGranularityProfile({
    topic: revisionTopic,
    requirements: {
      topic: revisionTopic,
      goals: getLatestParentRequest(normalizedMessages),
      timeframe: "",
      learnerProfile: "",
      constraints: "",
      teachingStyle: "",
      assessment: "",
      structurePreferences: "",
    },
    pacing: {
      totalWeeks: params.snapshot.counts.estimatedSessionCount > 0
        ? Math.max(1, Math.ceil(params.snapshot.counts.estimatedSessionCount / 4))
        : undefined,
      totalSessionsLowerBound:
        params.snapshot.counts.estimatedSessionCount > 0
          ? Math.max(1, Math.floor(params.snapshot.counts.estimatedSessionCount * 0.9))
          : undefined,
      totalSessionsUpperBound:
        params.snapshot.counts.estimatedSessionCount > 0
          ? Math.max(1, Math.ceil(params.snapshot.counts.estimatedSessionCount * 1.1))
          : undefined,
      explicitlyRequestedTotalSessions:
        params.snapshot.counts.estimatedSessionCount > 0
          ? params.snapshot.counts.estimatedSessionCount
          : undefined,
    },
  });

  console.info("[curriculum/ai-draft] revision model orchestration", {
    learner: params.learner.displayName,
    sourceTitle: params.snapshot.source.title,
    counts: params.snapshot.counts,
    topLevelDomains: snapshotSummary.topLevelDomains,
    unitTitles: snapshotSummary.unitTitles,
  });

  return runCurriculumRevisionDecision({
    learnerName: params.learner.displayName,
    messages: normalizedMessages,
    snapshot: params.snapshot as CurriculumRevisionPromptSnapshot,
    model,
    systemPrompt: prompt.systemPrompt,
    completeJson: (options) => adapter.completeJson(options),
    logger: console,
    artifactQualityCheck: (artifact) =>
      assessCurriculumArtifactQuality(artifact, {
        topicText: [
          revisionTopic,
          params.snapshot.source.title,
          params.snapshot.source.description ?? "",
          normalizedMessages.map((message) => message.content).join(" "),
        ]
          .join(" ")
          .trim(),
        granularity: revisionGranularityProfile,
        requestedPacing: {
          totalWeeks: params.snapshot.counts.estimatedSessionCount > 0
            ? Math.max(1, Math.ceil(params.snapshot.counts.estimatedSessionCount / 4))
            : undefined,
          totalSessionsLowerBound:
            params.snapshot.counts.estimatedSessionCount > 0
              ? Math.max(1, Math.floor(params.snapshot.counts.estimatedSessionCount * 0.9))
              : undefined,
          totalSessionsUpperBound:
            params.snapshot.counts.estimatedSessionCount > 0
              ? Math.max(1, Math.ceil(params.snapshot.counts.estimatedSessionCount * 1.1))
              : undefined,
          explicitlyRequestedTotalSessions:
            params.snapshot.counts.estimatedSessionCount > 0
              ? params.snapshot.counts.estimatedSessionCount
              : undefined,
        },
        learnerText: params.learner.displayName,
        revisionMode: "revision",
      }).map((issue) => issue.message),
  });
}

function inferRevisionPlanFromConversation(params: {
  messages: ChatMessage[];
  snapshot: CurriculumRevisionSnapshot;
}): CurriculumAiRevisionPlan | null {
  const latestRequest = getLatestParentRequest(params.messages);
  if (!latestRequest) {
    return null;
  }

  if (isPreferenceOnlyRevisionMessage(latestRequest)) {
    return {
      assistantMessage: buildTargetedRevisionClarificationMessage(params.messages),
      action: "clarify",
      scope: "targeted",
      operation: "adjust",
      changeSummary: [],
      targetPath: [],
      replacementTitles: [],
      missingDetail: "The request only chose a revision mode, not a concrete edit.",
    };
  }

  const revisionOperation = inferLocalRevisionOperation(latestRequest);
  const targetCandidates = collectRevisionTargetCandidates(
    params.snapshot.structure as unknown as RevisionSnapshotNode[],
    latestRequest,
  ).sort((left, right) => right.score - left.score || left.path.length - right.path.length);
  const wantsSkillLevelTarget = /\b(skill|skills|subskill|subskills|smaller skills?)\b/i.test(
    latestRequest,
  );
  const candidatePool = wantsSkillLevelTarget
    ? targetCandidates.filter((candidate) => candidate.type === "skill")
    : targetCandidates;
  const bestTarget = candidatePool[0] ?? targetCandidates[0] ?? null;
  const hasConcreteTarget = Boolean(bestTarget && bestTarget.score >= 12);

  if (revisionOperation === "broader") {
    return {
      assistantMessage: `I will make a broader rewrite of ${params.snapshot.source.title}.`,
      action: "apply",
      scope: "broader",
      operation: "broader",
      changeSummary: ["Broader rewrite requested."],
      revisionBrief: `Rewrite ${params.snapshot.source.title} more broadly while preserving coherence.`,
      targetPath: bestTarget ? bestTarget.path : [],
      replacementTitles: [],
    };
  }

  if (!hasConcreteTarget) {
    return null;
  }

  if (revisionOperation === "rename") {
    const replacementTitle = extractRequestedRenameTitle(latestRequest);
    if (!replacementTitle) {
      return null;
    }

    return {
      assistantMessage: `I will rename ${bestTarget!.path.join(" > ")} as requested.`,
      action: "apply",
      scope: "targeted",
      operation: "rename",
      changeSummary: [`Rename ${bestTarget!.path.join(" > ")}.`],
      revisionBrief: latestRequest,
      targetPath: bestTarget!.path,
      replacementTitles: [replacementTitle],
    };
  }

  if (revisionOperation === "split" || revisionOperation === "adjust") {
    return {
      assistantMessage: `I will revise ${bestTarget.path.join(" > ")} as requested.`,
      action: "apply",
      scope: "targeted",
      operation: revisionOperation,
      changeSummary: [latestRequest],
      revisionBrief: latestRequest,
      targetPath: bestTarget.path,
      replacementTitles: [],
    };
  }

  return null;
}

function inferLocalRevisionOperation(requestText: string) {
  if (/\b(split(?: up)?|break down|separate|divide)\b/i.test(requestText)) {
    return "split" as const;
  }

  if (/\b(rename|retitle|new title|title update|title)\b/i.test(requestText)) {
    return "rename" as const;
  }

  if (/\b(broader rewrite|rewrite it|rewrite the structure|rebuild it|start over|replace the structure)\b/i.test(requestText)) {
    return "broader" as const;
  }

  if (/\b(shorten|shorter|lengthen|longer|simplify|simpler|condense|trim|reduce|increase|tighten|streamline|refine|adjust)\b/i.test(requestText)) {
    return "adjust" as const;
  }

  return "unknown" as const;
}

function extractRequestedRenameTitle(requestText: string) {
  const quoted = requestText.match(/["“](.+?)["”]/)?.[1]?.trim();
  if (quoted) {
    return quoted;
  }

  const explicit = requestText.match(/\brename(?: it| this)? to\s+(.+?)(?:[.!?]|$)/i)?.[1]?.trim();
  if (explicit) {
    return explicit;
  }

  return null;
}

function inferRevisionOperation(requestText: string) {
  if (/\b(split(?: up)?|break down|separate|divide)\b/i.test(requestText)) {
    return { kind: "split" as const };
  }

  if (/\b(rename|retitle|new title|title update|title)\b/i.test(requestText)) {
    return { kind: "rename" as const };
  }

  if (/\b(shorten|shorter|lengthen|longer|simplify|simpler|condense|trim|reduce|increase|tighten|streamline|refine|adjust)\b/i.test(requestText)) {
    return { kind: "adjust" as const };
  }

  if (/\b(broader rewrite|broader rewrite please|rewrite it|rewrite the structure|rebuild it|start over|replace the structure)\b/i.test(requestText)) {
    return { kind: "broader" as const };
  }

  return { kind: "unknown" as const };
}

function inferRevisionScope(requestText: string): "targeted" | "broader" {
  if (/\b(broader rewrite|broader rewrite please|rewrite it|rewrite the structure|rebuild it|start over|replace the structure)\b/i.test(requestText)) {
    return "broader";
  }

  return "targeted";
}

function buildRevisionBriefForOperation(operation: "split" | "rename" | "adjust", targetLabel: string, requestText: string) {
  if (operation === "split") {
    return `Split ${targetLabel} into smaller skills based on the requested change.`;
  }

  if (operation === "rename") {
    return `Rename ${targetLabel} to better match the parent's request.`;
  }

  if (/\b(shorten|shorter|condense|trim|reduce|tighten|simplify|simpler)\b/i.test(requestText)) {
    return `Shorten and simplify ${targetLabel}.`;
  }

  if (/\b(lengthen|longer|expand|deepen|increase)\b/i.test(requestText)) {
    return `Expand ${targetLabel} with more room for practice and pacing.`;
  }

  return `Refine ${targetLabel} to match the parent's requested adjustment.`;
}

async function applyCurriculumRevisionPlan(params: {
  learner: AppLearner;
  messages: ChatMessage[];
  snapshot: CurriculumRevisionSnapshot;
  revisionPlan: CurriculumAiRevisionPlan;
  revisionPreference: RevisionPreference | null;
}): Promise<CurriculumAiRevisionTurn> {
  void params;
  return {
    assistantMessage: "Revision planning is disabled in favor of the model-first revision path.",
    action: "clarify",
    changeSummary: [],
  };
}

interface RevisionConversationPlan {
  mode: "apply" | "clarify";
  preference: RevisionPreference | null;
  clarificationMessage: string;
  splitSkillTarget: string | null;
}

function classifyRevisionConversation(messages: ChatMessage[]): RevisionConversationPlan {
  const userMessages = collectUserMessages(messages);
  const splitSkillTarget = extractSplitSkillTarget(userMessages);
  const hasExplicitBroaderPreference = userMessages.some(isExplicitBroaderRevisionMessage);
  const hasConcreteTargetedRequest = userMessages.some(isConcreteTargetedRevisionMessage);
  const hasExplicitTargetedPreference = userMessages.some(isExplicitTargetedRevisionMessage);

  if (hasExplicitBroaderPreference) {
    return {
      mode: "apply" as const,
      preference: "broader" as const,
      clarificationMessage: "",
      splitSkillTarget,
    };
  }

  if (hasConcreteTargetedRequest) {
    return {
      mode: "apply" as const,
      preference: "targeted" as const,
      clarificationMessage: "",
      splitSkillTarget,
    };
  }

  if (hasExplicitTargetedPreference) {
    return {
      mode: "clarify" as const,
      preference: "targeted" as const,
      clarificationMessage: buildTargetedRevisionClarificationMessage(messages),
      splitSkillTarget,
    };
  }

  return {
    mode: "clarify" as const,
    preference: null,
    clarificationMessage: buildGenericRevisionClarificationMessage(messages),
    splitSkillTarget,
  };
}

function isExplicitTargetedRevisionMessage(message: string) {
  const value = message.trim().toLowerCase();
  return (
    /^1[.!?]*$/.test(value) ||
    /\b(targeted adjustment|targeted change|preserve the current structure|keep the current structure)\b/i.test(
      value,
    )
  );
}

function isExplicitBroaderRevisionMessage(message: string) {
  const value = message.trim().toLowerCase();
  return (
    /^2[.!?]*$/.test(value) ||
    /\b(broader rewrite|broader rewrite please|rewrite it|rewrite the structure|rebuild it|start over|replace the structure)\b/i.test(
      value,
    )
  );
}

function buildTargetedRevisionClarificationMessage(messages: ChatMessage[]) {
  const title = inferRevisionTopicTitle(messages);
  return `What part of ${title} should I adjust? For example, pacing, lesson structure, specific skills, materials, or the title.`;
}

function buildConcreteRevisionClarificationMessage(messages: ChatMessage[]) {
  const splitTarget = extractSplitSkillTarget(collectUserMessages(messages));
  if (splitTarget) {
    return `I can split ${toSentenceFragment(splitTarget)} into smaller skills, but I need to match it to the current curriculum first. Which exact skill should I break down?`;
  }

  return buildGenericRevisionClarificationMessage(messages);
}

function buildGenericRevisionClarificationMessage(messages: ChatMessage[]) {
  const title = inferRevisionTopicTitle(messages);
  return `What would you like me to change about ${title}?`;
}

function inferRevisionTopicTitle(messages: ChatMessage[]) {
  const opening = collectUserMessages(messages)[0] ?? "";
  const topic = extractTopicLabel(opening);
  return topic ? toSentenceFragment(topic) : "this curriculum";
}

function applyRevisionFixups(params: {
  artifact: CurriculumAiGeneratedArtifact;
  messages: ChatMessage[];
  snapshot: CurriculumRevisionSnapshot;
}): CurriculumAiGeneratedArtifact | null {
  const splitTarget = extractSplitSkillTarget(params.messages);
  const shouldPreserveTitle = Boolean(splitTarget);
  const next = cloneArtifact(params.artifact);

  if (shouldPreserveTitle && next.source.title !== params.snapshot.source.title) {
    next.source.title = params.snapshot.source.title;
  }

  if (!splitTarget) {
    return next;
  }

  const target = findBestSkillLeaf(next.document, splitTarget);
  if (!target) {
    return null;
  }

  const splitTitles = buildSplitSkillTitles(target.title, splitTarget);
  if (splitTitles.length < 2) {
    return null;
  }

  replaceSkillLeafInDocument(next.document, target, splitTitles);
  replaceLinkedSkillTitles(next.units, target.title, splitTitles);

  if (shouldPreserveTitle && next.source.title !== params.snapshot.source.title) {
    next.source.title = params.snapshot.source.title;
  }

  return next;
}

function buildDeterministicSplitRevisionTurn(params: {
  learner: AppLearner;
  messages: ChatMessage[];
  snapshot: CurriculumRevisionSnapshot;
  revisionPreference: RevisionPreference | null;
  splitSkillTarget: string | null;
}): CurriculumAiRevisionTurn | null {
  if (!params.splitSkillTarget) {
    return null;
  }

  const splitNode = findBestRevisionStructureNode(
    params.snapshot.structure as unknown as PromptCurriculumNode[],
    params.splitSkillTarget,
  );
  if (!splitNode) {
    return null;
  }

  const splitTitles = buildSplitSkillTitles(splitNode.title, params.splitSkillTarget);
  if (splitTitles.length < 2) {
    return null;
  }

  const artifact = sanitizeArtifact(
    buildRevisionArtifactFromSnapshot({
      snapshot: params.snapshot,
      splitNodeTitle: splitNode.title,
      splitTitles,
      revisionPreference: params.revisionPreference,
      messages: params.messages,
    }),
  );

  return {
    assistantMessage: buildDeterministicSplitRevisionAssistantMessage(splitNode.title, splitTitles),
    action: "apply",
    changeSummary: buildDeterministicSplitRevisionChangeSummary(splitNode.title, splitTitles),
    artifact,
  };
}

function buildRevisionArtifactFromSnapshot(params: {
  snapshot: CurriculumRevisionSnapshot;
  splitNodeTitle: string;
  splitTitles: string[];
  revisionPreference: RevisionPreference | null;
  messages: ChatMessage[];
}): CurriculumAiGeneratedArtifact {
  const document = buildRevisionDocumentFromStructure(
    params.snapshot.structure as unknown as PromptCurriculumNode[],
    params.splitNodeTitle,
    params.splitTitles,
  );

  const outline = params.snapshot.outline as unknown as RevisionSnapshotOutlineUnit[];
  const units = outline.map((unit, unitIndex) => ({
    title: typeof unit.title === "string" && unit.title.trim() ? unit.title.trim() : `Unit ${unitIndex + 1}`,
    description:
      typeof unit.description === "string" && unit.description.trim()
        ? unit.description.trim()
        : `Updated unit sequence for ${params.snapshot.source.title}.`,
    estimatedWeeks: typeof unit.estimatedWeeks === "number" ? unit.estimatedWeeks : undefined,
    estimatedSessions:
      typeof unit.estimatedSessions === "number" ? unit.estimatedSessions : undefined,
    lessons: unit.lessons.map((lesson, lessonIndex) => {
      const linkedSkillTitles = Array.isArray(lesson.linkedSkillTitles)
        ? uniqueNonEmpty([
            ...(lesson.linkedSkillTitles as string[]).filter(
              (title) => title !== params.splitNodeTitle,
            ),
            ...(lesson.linkedSkillTitles.includes(params.splitNodeTitle) ? params.splitTitles : []),
          ])
        : [];
      const materials = Array.isArray(lesson.materials) ? uniqueNonEmpty(lesson.materials as string[]) : [];
      const objectives = Array.isArray(lesson.objectives) ? uniqueNonEmpty(lesson.objectives as string[]) : [];

      return {
        title:
          typeof lesson.title === "string" && lesson.title.trim()
            ? lesson.title.trim()
            : `Lesson ${lessonIndex + 1}`,
        description:
          typeof lesson.description === "string" && lesson.description.trim()
            ? lesson.description.trim()
            : `Lesson aligned to ${params.snapshot.source.title}.`,
        subject:
          typeof lesson.subject === "string" && lesson.subject.trim()
            ? lesson.subject.trim()
            : undefined,
        estimatedMinutes:
          typeof lesson.estimatedMinutes === "number" ? lesson.estimatedMinutes : undefined,
        materials,
        objectives,
        linkedSkillTitles,
      };
    }),
  }));

  return {
    source: {
      title: params.snapshot.source.title,
      description:
        params.snapshot.source.description ??
        `Targeted revision of ${params.snapshot.source.title}.`,
      subjects: params.snapshot.source.subjects,
      gradeLevels: params.snapshot.source.gradeLevels,
      academicYear: undefined,
      summary:
        params.snapshot.source.description ??
        `Targeted revision of ${params.snapshot.source.title}.`,
      teachingApproach:
        "Keep the existing sequence in place while splitting the requested skill into smaller, easier-to-read steps.",
      successSignals: [
        "The revised branch shows the requested skill broken into smaller visible leaves.",
        "Linked lessons point at the updated skill titles.",
        "The rest of the curriculum structure stays intact.",
      ],
      parentNotes: [
        "Preserve the surrounding curriculum structure unless the request explicitly asks for a broader rewrite.",
      ],
      rationale: [
        "This revision is intentionally narrow so the change is obvious in the curriculum graph.",
        "The current outline and lesson links are carried forward with the requested skill split applied.",
      ],
    },
    intakeSummary: `Targeted revision applied to ${params.snapshot.source.title}.`,
    pacing: {
      totalWeeks:
        typeof params.snapshot.counts.estimatedSessionCount === "number"
          ? Math.max(1, Math.ceil(params.snapshot.counts.estimatedSessionCount / 2))
          : undefined,
      sessionsPerWeek: undefined,
      sessionMinutes: undefined,
      totalSessions:
        typeof params.snapshot.counts.estimatedSessionCount === "number"
          ? params.snapshot.counts.estimatedSessionCount
          : undefined,
      coverageStrategy:
        "Keep the current pacing in place and preserve the existing outline while applying the requested targeted split.",
      coverageNotes: [
        "Only the requested branch is narrowed into smaller skills.",
        "The surrounding units and lessons remain intact.",
      ],
    },
    document,
    units,
  };
}

function buildTargetedRevisionTurnFromPlan(params: {
  learner: AppLearner;
  messages: ChatMessage[];
  snapshot: CurriculumRevisionSnapshot;
  revisionPlan: CurriculumAiRevisionPlan;
}): CurriculumAiRevisionTurn | null {
  if (params.revisionPlan.scope !== "targeted" || params.revisionPlan.operation === "broader") {
    return null;
  }

  const artifact = buildTargetedRevisionArtifactFromSnapshot({
    snapshot: params.snapshot,
    revisionPlan: params.revisionPlan,
  });
  if (!artifact) {
    return null;
  }

  return {
    assistantMessage: buildTargetedRevisionAssistantMessage(params.revisionPlan, artifact),
    action: "apply",
    changeSummary: buildTargetedRevisionChangeSummary(params.revisionPlan),
    artifact,
  };
}

function buildTargetedRevisionArtifactFromSnapshot(params: {
  snapshot: CurriculumRevisionSnapshot;
  revisionPlan: CurriculumAiRevisionPlan;
}): CurriculumAiGeneratedArtifact | null {
  const document = buildRevisionDocumentFromSnapshotStructure(
    params.snapshot.structure as unknown as RevisionSnapshotNode[],
  );
  const targetPath = params.revisionPlan.targetPath;
  const targetNode = targetPath.length
    ? findRevisionStructureNodeByPath(
        params.snapshot.structure as unknown as RevisionSnapshotNode[],
        targetPath,
      )
    : null;

  if (targetPath.length === 0) {
    if (params.revisionPlan.operation === "rename" || params.revisionPlan.operation === "adjust") {
      const source = buildRevisionSourceFieldsFromSnapshot(params.snapshot, params.revisionPlan);
      const units = buildRevisionUnitsFromSnapshot(
        params.snapshot,
        params.snapshot.source.title,
        [],
        params.revisionPlan,
      );

      return {
        source,
        intakeSummary: buildRevisionIntakeSummary(params.snapshot, params.revisionPlan),
        pacing: buildRevisionPacingFromSnapshot(params.snapshot, params.revisionPlan),
        document,
        units,
      };
    }

    return null;
  }

  if (!targetNode) {
    return null;
  }

  const targetTitle =
    typeof targetNode.title === "string" && targetNode.title.trim() ? targetNode.title.trim() : "";
  if (!targetTitle) {
    return null;
  }
  const targetDescription =
    typeof targetNode.description === "string" && targetNode.description.trim()
      ? targetNode.description.trim()
      : undefined;

  if (params.revisionPlan.operation === "split") {
    const replacementTitles = uniqueNonEmpty(
      params.revisionPlan.replacementTitles.length >= 2
        ? params.revisionPlan.replacementTitles
        : buildGenericSplitReplacementTitles(targetTitle),
    );
    if (replacementTitles.length < 2) {
      return null;
    }

    const replacementDescriptions = buildGenericSplitReplacementDescriptions(
      targetTitle,
      targetDescription,
      replacementTitles,
      params.revisionPlan.revisionBrief ?? "",
    );
    if (
      !replaceRevisionDocumentBranch(document, targetPath, buildSplitRevisionBranch(replacementTitles, replacementDescriptions))
    ) {
      return null;
    }

    const source = buildRevisionSourceFieldsFromSnapshot(params.snapshot, params.revisionPlan);
    const units = buildRevisionUnitsFromSnapshot(
      params.snapshot,
      targetTitle,
      replacementTitles,
      params.revisionPlan,
    );
    return {
      source,
      intakeSummary: buildRevisionIntakeSummary(params.snapshot, params.revisionPlan),
      pacing: buildRevisionPacingFromSnapshot(params.snapshot, params.revisionPlan),
      document,
      units,
    };
  }

  if (params.revisionPlan.operation === "rename") {
    const replacementTitle =
      params.revisionPlan.replacementTitles[0]?.trim() ||
      buildGenericRenameTitle(targetTitle, params.revisionPlan.revisionBrief ?? "");
    if (!replacementTitle) {
      return null;
    }

    if (!renameRevisionDocumentBranch(document, targetPath, replacementTitle)) {
      return null;
    }

    const source = buildRevisionSourceFieldsFromSnapshot(params.snapshot, params.revisionPlan);
    const units = buildRevisionUnitsFromSnapshot(
      params.snapshot,
      targetTitle,
      [replacementTitle],
      params.revisionPlan,
    );
    return {
      source,
      intakeSummary: buildRevisionIntakeSummary(params.snapshot, params.revisionPlan),
      pacing: buildRevisionPacingFromSnapshot(params.snapshot, params.revisionPlan),
      document,
      units,
    };
  }

  if (params.revisionPlan.operation === "adjust") {
    const adjustedDescription = buildGenericAdjustedDescription(
      targetTitle,
      targetDescription,
      params.revisionPlan.revisionBrief ?? "",
    );
    if (!replaceRevisionDocumentBranch(document, targetPath, adjustedDescription)) {
      return null;
    }

    const source = buildRevisionSourceFieldsFromSnapshot(params.snapshot, params.revisionPlan);
    const units = buildRevisionUnitsFromSnapshot(
      params.snapshot,
      targetTitle,
      [],
      params.revisionPlan,
    );
    return {
      source,
      intakeSummary: buildRevisionIntakeSummary(params.snapshot, params.revisionPlan),
      pacing: buildRevisionPacingFromSnapshot(params.snapshot, params.revisionPlan),
      document,
      units,
    };
  }

  return null;
}

function buildRevisionDocumentFromSnapshotStructure(
  nodes: RevisionSnapshotNode[],
): Record<string, RevisionDocumentNode> {
  const document: Record<string, RevisionDocumentNode> = {};
  for (const node of nodes) {
    const title = typeof node.title === "string" ? node.title.trim() : "";
    if (!title) {
      continue;
    }

    document[title] = buildRevisionDocumentFromSnapshotNode(node);
  }

  return document;
}

function buildRevisionDocumentFromSnapshotNode(node: RevisionSnapshotNode): RevisionDocumentNode {
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length === 0) {
    return typeof node.description === "string" && node.description.trim()
      ? node.description.trim()
      : typeof node.title === "string"
        ? node.title.trim()
        : "";
  }

  const next: Record<string, RevisionDocumentNode> = {};
  for (const child of children) {
    const title = typeof child.title === "string" ? child.title.trim() : "";
    if (!title) {
      continue;
    }

    next[title] = buildRevisionDocumentFromSnapshotNode(child);
  }

  return next;
}

function findRevisionStructureNodeByPath(
  nodes: RevisionSnapshotNode[],
  targetPath: string[],
): RevisionSnapshotNode | null {
  let currentNodes = nodes;
  let current: RevisionSnapshotNode | null = null;

  for (const segment of targetPath) {
    current = currentNodes.find(
      (node) =>
        typeof node.title === "string" &&
        normalizeForComparison(node.title) === normalizeForComparison(segment),
    ) ?? null;
    if (!current) {
      return null;
    }

    currentNodes = Array.isArray(current.children) ? current.children : [];
  }

  return current;
}

function replaceRevisionDocumentBranch(
  document: Record<string, RevisionDocumentNode>,
  targetPath: string[],
  replacement: RevisionDocumentNode,
) {
  const location = getRevisionDocumentLocation(document, targetPath);
  if (!location) {
    return false;
  }

  location.container[location.key] = replacement;
  return true;
}

function renameRevisionDocumentBranch(
  document: Record<string, RevisionDocumentNode>,
  targetPath: string[],
  replacementTitle: string,
) {
  const location = getRevisionDocumentLocation(document, targetPath);
  if (!location) {
    return false;
  }

  const existing = location.container[location.key];
  delete location.container[location.key];
  location.container[replacementTitle] = existing;
  return true;
}

function getRevisionDocumentLocation(
  document: Record<string, RevisionDocumentNode>,
  targetPath: string[],
) {
  if (targetPath.length === 0) {
    return null;
  }

  let container: Record<string, RevisionDocumentNode> = document;
  for (const segment of targetPath.slice(0, -1)) {
    const next = container[segment];
    if (!next || typeof next === "string" || Array.isArray(next)) {
      return null;
    }
    container = next as Record<string, RevisionDocumentNode>;
  }

  const key = targetPath[targetPath.length - 1];
  if (!(key in container)) {
    const fallbackKey = Object.keys(container).find(
      (candidate) => normalizeForComparison(candidate) === normalizeForComparison(key),
    );
    if (!fallbackKey) {
      return null;
    }

    return {
      container,
      key: fallbackKey,
      value: container[fallbackKey],
    };
  }

  return {
    container,
    key,
    value: container[key],
  };
}

function buildSplitRevisionBranch(
  replacementTitles: string[],
  replacementDescriptions: string[],
): Record<string, RevisionDocumentNode> {
  const branch: Record<string, RevisionDocumentNode> = {};
  for (const [index, title] of replacementTitles.entries()) {
    branch[title] = replacementDescriptions[index] ?? "";
  }

  return branch;
}

function buildRevisionSourceFieldsFromSnapshot(
  snapshot: CurriculumRevisionSnapshot,
  revisionPlan: CurriculumAiRevisionPlan,
): CurriculumAiGeneratedArtifact["source"] {
  const isRename = revisionPlan.operation === "rename" && revisionPlan.targetPath.length === 0;
  const title = isRename && revisionPlan.replacementTitles[0]
    ? revisionPlan.replacementTitles[0]
    : snapshot.source.title;
  const summary = revisionPlan.revisionBrief?.trim() || snapshot.source.description || `Revision of ${snapshot.source.title}.`;
  const targeted = revisionPlan.scope === "targeted";

  return {
    title,
    description: snapshot.source.description || `Targeted revision of ${snapshot.source.title}.`,
    subjects: snapshot.source.subjects,
    gradeLevels: snapshot.source.gradeLevels,
    academicYear: undefined,
    summary,
    teachingApproach: targeted
      ? "Keep the existing sequence in place and apply the requested targeted revision."
      : "Rework the curriculum more broadly while keeping the learning arc coherent.",
    successSignals:
      revisionPlan.operation === "split"
        ? [
            "The selected branch is visibly broken into smaller skills.",
            "Linked lessons point at the updated skill titles.",
            "The rest of the curriculum stays intact.",
          ]
        : revisionPlan.operation === "rename"
          ? [
              "The selected branch uses the new wording consistently.",
              "Linked lessons reflect the renamed branch.",
              "The curriculum structure still reads cleanly.",
            ]
          : [
              "The requested revision is reflected in the curriculum structure.",
              "The outline still reads like a teachable sequence.",
              "The revision preserves coherence across units and lessons.",
            ],
    parentNotes: targeted
      ? ["Preserve surrounding structure unless the request explicitly asks for a broader rewrite."]
      : ["Use a broader revision only when the request clearly asks for it."],
    rationale: targeted
      ? ["This revision is intentionally narrow so the requested change is easy to see."]
      : ["The revision expands beyond one branch because the parent requested a broader rewrite."],
  };
}

function buildRevisionIntakeSummary(
  snapshot: CurriculumRevisionSnapshot,
  revisionPlan: CurriculumAiRevisionPlan,
) {
  if (revisionPlan.revisionBrief?.trim()) {
    return revisionPlan.revisionBrief.trim();
  }

  return `Revision applied to ${snapshot.source.title}.`;
}

function buildRevisionPacingFromSnapshot(
  snapshot: CurriculumRevisionSnapshot,
  revisionPlan: CurriculumAiRevisionPlan,
): CurriculumAiGeneratedArtifact["pacing"] {
  const totalSessions =
    snapshot.counts.estimatedSessionCount > 0 ? snapshot.counts.estimatedSessionCount : undefined;
  return {
    totalWeeks: totalSessions ? Math.max(1, Math.ceil(totalSessions / 5)) : undefined,
    sessionsPerWeek: undefined,
    sessionMinutes: undefined,
    totalSessions,
    coverageStrategy: revisionPlan.scope === "targeted"
      ? "Preserve the existing pacing while applying the requested local revision."
      : "Keep the pacing coherent while rewriting the curriculum more broadly.",
    coverageNotes:
      revisionPlan.operation === "split"
        ? [
            "Only the requested branch is broken into smaller skills.",
            "The surrounding units and lessons remain intact.",
          ]
        : [
            "The revision keeps the sequence teachable and coherent.",
          ],
  };
}

function buildRevisionUnitsFromSnapshot(
  snapshot: CurriculumRevisionSnapshot,
  targetTitle: string,
  replacementTitles: string[],
  revisionPlan: CurriculumAiRevisionPlan,
): CurriculumAiGeneratedArtifact["units"] {
  const outline = snapshot.outline as unknown as RevisionSnapshotOutlineUnit[];

  return outline.map((unit, unitIndex) => ({
    title:
      typeof unit.title === "string" && unit.title.trim()
        ? unit.title.trim()
        : `Unit ${unitIndex + 1}`,
    description:
      typeof unit.description === "string" && unit.description.trim()
        ? unit.description.trim()
        : `Updated unit sequence for ${snapshot.source.title}.`,
    estimatedWeeks: typeof unit.estimatedWeeks === "number" ? unit.estimatedWeeks : undefined,
    estimatedSessions: typeof unit.estimatedSessions === "number" ? unit.estimatedSessions : undefined,
    lessons: unit.lessons.map((lesson: RevisionSnapshotOutlineLesson, lessonIndex: number) => {
      const linkedSkillTitles = Array.isArray(lesson.linkedSkillTitles)
        ? uniqueNonEmpty([
            ...lesson.linkedSkillTitles.filter((title: string) => title !== targetTitle),
            ...(lesson.linkedSkillTitles.includes(targetTitle) ? replacementTitles : []),
          ])
        : [];

      return {
        title:
          typeof lesson.title === "string" && lesson.title.trim()
            ? lesson.title.trim()
            : `Lesson ${lessonIndex + 1}`,
        description:
          typeof lesson.description === "string" && lesson.description.trim()
            ? lesson.description.trim()
            : `Lesson aligned to ${snapshot.source.title}.`,
        subject:
          typeof lesson.subject === "string" && lesson.subject.trim()
            ? lesson.subject.trim()
            : undefined,
        estimatedMinutes:
          typeof lesson.estimatedMinutes === "number" ? lesson.estimatedMinutes : undefined,
        materials: [],
        objectives: [],
        linkedSkillTitles,
      };
    }),
  }));
}

function buildTargetedRevisionAssistantMessage(
  revisionPlan: CurriculumAiRevisionPlan,
  artifact: CurriculumAiGeneratedArtifact,
) {
  const targetLabel = revisionPlan.targetPath.length > 0 ? revisionPlan.targetPath.join(" > ") : artifact.source.title;

  if (revisionPlan.operation === "split") {
    return `I split ${targetLabel} into smaller skills and updated the curriculum map.`;
  }

  if (revisionPlan.operation === "rename") {
    return `I renamed ${targetLabel} and updated the curriculum map.`;
  }

  return `I adjusted ${targetLabel} and updated the curriculum map.`;
}

function buildTargetedRevisionChangeSummary(revisionPlan: CurriculumAiRevisionPlan) {
  const targetLabel =
    revisionPlan.targetPath.length > 0 ? revisionPlan.targetPath.join(" > ") : "the curriculum";

  if (revisionPlan.operation === "split") {
    return uniqueNonEmpty(
      [
        `Split ${targetLabel} into smaller skills.`,
        revisionPlan.replacementTitles.length > 0
          ? `Updated linked lessons to point at ${revisionPlan.replacementTitles.join(", ")}.`
          : "",
      ].filter(Boolean),
    );
  }

  if (revisionPlan.operation === "rename") {
    return uniqueNonEmpty(
      [
        `Renamed ${targetLabel}.`,
        revisionPlan.replacementTitles[0]
          ? `Updated the curriculum map to use ${revisionPlan.replacementTitles[0]}.`
          : "",
      ].filter(Boolean),
    );
  }

  return [`Adjusted ${targetLabel} to match the requested change.`];
}

function buildGenericSplitReplacementTitles(title: string) {
  const compact = title.replace(/\s+/g, " ").trim();
  const parts = compact
    .split(/,\s*|\s+and\s+/i)
    .map((part) => part.trim().replace(/^(?:and|or)\s+/i, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts.slice(0, 5);
  }

  const base = compact.replace(/\b(skill|skills)\b/i, "").replace(/\s+/g, " ").trim();
  if (!base) {
    return [];
  }

  const lowerBase = base.toLowerCase();
  return [
    `Build foundations for ${lowerBase}`,
    `Practice ${lowerBase} in examples`,
    `Apply ${lowerBase} independently`,
  ];
}

function buildGenericSplitReplacementDescriptions(
  originalTitle: string,
  originalDescription: string | undefined,
  replacementTitles: string[],
  revisionBrief: string,
) {
  return replacementTitles.map((title, index) => {
    const hint = revisionBrief.trim() || originalDescription?.trim() || `A smaller step for ${originalTitle.toLowerCase()}.`;
    if (index === 0) {
      return `${hint} Start with ${title.toLowerCase()}.`;
    }
    return `${hint} Continue with ${title.toLowerCase()}.`;
  });
}

function buildGenericRenameTitle(originalTitle: string, revisionBrief: string) {
  const brief = revisionBrief.trim();
  if (brief) {
    const extracted = brief.match(/(?:rename|retitle|rename to)\s+(.*)$/i)?.[1]?.trim();
    if (extracted) {
      return extracted.replace(/[.]+$/, "");
    }
  }

  return originalTitle;
}

function buildGenericAdjustedDescription(
  originalTitle: string,
  originalDescription: string | undefined,
  revisionBrief: string,
) {
  const brief = revisionBrief.trim();
  if (brief) {
    return `${originalDescription?.trim() || originalTitle}. Revised to match: ${brief}`;
  }

  return originalDescription?.trim() || `Revised version of ${originalTitle}.`;
}

function buildRevisionDocumentFromStructure(
  nodes: PromptCurriculumNode[],
  splitNodeTitle: string,
  splitTitles: string[],
): Record<string, RevisionDocumentNode> {
  const document: Record<string, RevisionDocumentNode> = {};

  for (const node of nodes) {
    if (node.type === "skill" && titlesMatch(node.title, splitNodeTitle)) {
      const descriptions = buildSplitSkillDescriptions(node.title, node.description, splitTitles);
      for (const [index, title] of splitTitles.entries()) {
        document[title] = descriptions[index] ?? "";
      }
      continue;
    }

    document[node.title] = buildRevisionDocumentNode(node, splitNodeTitle, splitTitles);
  }

  return document;
}

function buildRevisionDocumentNode(
  node: PromptCurriculumNode,
  splitNodeTitle: string,
  splitTitles: string[],
): RevisionDocumentNode {
  if (node.type === "skill" || node.children.length === 0) {
    return node.description?.trim() || node.title;
  }

  const next: Record<string, RevisionDocumentNode> = {};
  for (const child of node.children) {
    if (child.type === "skill" && titlesMatch(child.title, splitNodeTitle)) {
      const descriptions = buildSplitSkillDescriptions(child.title, child.description, splitTitles);
      for (const [index, title] of splitTitles.entries()) {
        next[title] = descriptions[index] ?? "";
      }
      continue;
    }

    next[child.title] = buildRevisionDocumentNode(child, splitNodeTitle, splitTitles);
  }

  return next;
}

function findBestRevisionStructureNode(
  nodes: PromptCurriculumNode[],
  targetText: string,
): PromptCurriculumNode | null {
  let best: PromptCurriculumNode | null = null;
  let bestScore = 0;

  const visit = (node: PromptCurriculumNode) => {
    if (node.type === "skill") {
      const score = scoreSkillMatch(node.title, targetText) + scoreSkillMatch(node.description ?? "", targetText) / 2;
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return bestScore >= 8 ? best : null;
}

function titlesMatch(left: string, right: string) {
  return normalizeForComparison(left) === normalizeForComparison(right);
}

function buildDeterministicSplitRevisionAssistantMessage(splitNodeTitle: string, splitTitles: string[]) {
  return `I split ${splitNodeTitle} into ${splitTitles.length} smaller skills and updated the curriculum map.`;
}

function buildDeterministicSplitRevisionChangeSummary(splitNodeTitle: string, splitTitles: string[]) {
  return [
    `Split ${splitNodeTitle} into ${splitTitles.length} smaller skills.`,
    `Updated linked lessons to point at ${splitTitles.join(", ")}.`,
  ];
}

function cloneArtifact(artifact: CurriculumAiGeneratedArtifact): CurriculumAiGeneratedArtifact {
  return JSON.parse(JSON.stringify(artifact)) as CurriculumAiGeneratedArtifact;
}

function extractSplitSkillTarget(messages: Array<string | ChatMessage>) {
  const combined = messages
    .map((message) => (typeof message === "string" ? message : message.content))
    .join(" ");
  const splitMatch = combined.match(
    /\b(?:split(?: up)?|break down|separate|divide)\s+(?:the\s+)?(.+?)(?:\s+(?:into|to)\s+(?:smaller\s+)?(?:skills?|parts?|subskills?)|[.!?]|$)/i,
  );

  if (splitMatch?.[1]) {
    return splitMatch[1].replace(/\s+/g, " ").trim();
  }

  return null;
}

function shouldPreserveRevisionTitle(messages: ChatMessage[]) {
  const requestText = collectUserMessages(messages).join(" ").toLowerCase();
  return !/\b(rename|retitle|new title|change the title|title update|title)\b/i.test(requestText);
}

function findBestSkillLeaf(
  document: RevisionDocumentNode,
  targetText: string,
): RevisionSkillLeafLocation | null {
  let best: RevisionSkillLeafLocation | null = null;
  let bestScore = 0;

  const visit = (node: RevisionDocumentNode, container?: RevisionSkillLeafLocation["container"]) => {
    if (typeof node === "string") {
      if (Array.isArray(container)) {
        const score = scoreSkillMatch(node, targetText);
        if (score > bestScore) {
          bestScore = score;
          best = {
            kind: "array",
            container,
            index: container.indexOf(node),
            title: node,
          };
        }
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, node);
      }
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") {
        const score = scoreSkillMatch(key, targetText) + scoreSkillMatch(value, targetText) / 2;
        if (score > bestScore) {
          bestScore = score;
          best = {
            kind: "object",
            container: node,
            key,
            title: key,
            description: value,
          };
        }
        continue;
      }

      visit(value, node);
    }
  };

  visit(document);
  return bestScore >= 8 ? best : null;
}

function scoreSkillMatch(title: string, targetText: string) {
  const normalizedTitle = normalizeForComparison(title);
  const normalizedTarget = normalizeForComparison(targetText);
  if (!normalizedTitle || !normalizedTarget) {
    return 0;
  }

  if (normalizedTitle === normalizedTarget) {
    return 100;
  }

  let score = 0;
  if (normalizedTitle.includes(normalizedTarget) || normalizedTarget.includes(normalizedTitle)) {
    score += 40;
  }

  const titleTokens = normalizedTitle.split(" ");
  const targetTokens = normalizedTarget.split(" ");
  for (const targetToken of targetTokens) {
    if (targetToken.length < 4) continue;
    const targetStem = stemSkillToken(targetToken);
    for (const titleToken of titleTokens) {
      const titleStem = stemSkillToken(titleToken);
      if (titleToken === targetToken) {
        score += 12;
      } else if (
        titleToken.startsWith(targetToken) ||
        targetToken.startsWith(titleToken) ||
        (titleStem && targetStem && titleStem === targetStem)
      ) {
        score += 8;
      }
    }
  }

  return score;
}

function stemSkillToken(token: string) {
  return token
    .replace(/(ing|edly|edly|ed|es|s)$/i, "")
    .replace(/e$/i, "")
    .trim();
}

function buildSplitSkillTitles(title: string, _targetText: string) {
  const compact = title.replace(/\s+/g, " ").trim();
  const parts = compact
    .split(/,\s*|\s+and\s+/i)
    .map((part) => part.trim().replace(/^(?:and|or)\s+/i, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    const lead = getSkillVerbPrefix(parts[0]);

    if (lead) {
      return parts.map((part, index) => {
        const cleanedPart =
          index === 0
            ? part.replace(new RegExp(`^${escapeRegExp(lead)}\\s+`, "i"), "")
            : part.replace(/^(?:and|or)\s+/i, "");
        const leaf = cleanedPart.trim();
        return leaf ? `${lead} ${leaf}`.replace(/\s+/g, " ").trim() : part;
      });
    }
  }

  const base = compact
    .replace(/\b(skill|skills)\b/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (base) {
    return [
      `Build foundations for ${base.toLowerCase()}`,
      `Practice ${base.toLowerCase()} in examples`,
      `Apply ${base.toLowerCase()} independently`,
    ];
  }

  return [];
}

function getSkillVerbPrefix(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "";
  }

  if (
    words.length >= 2 &&
    ["up", "out", "in", "on", "off", "for", "with", "to"].includes(words[1].toLowerCase())
  ) {
    return `${words[0]} ${words[1]}`;
  }

  return words[0];
}

function replaceSkillLeafInDocument(
  document: RevisionDocumentNode,
  target: RevisionSkillLeafLocation,
  replacementTitles: string[],
) {
  if (target.kind === "array") {
    const index = target.index ?? -1;
    if (index < 0) {
      return;
    }

    const replacements = replacementTitles.map((title) => title.trim()).filter(Boolean);
    (target.container as string[]).splice(index, 1, ...replacements);
    return;
  }

  if (target.kind === "object" && target.key) {
    const descriptions = buildSplitSkillDescriptions(target.title, target.description, replacementTitles);
    const container = target.container as Record<string, RevisionDocumentNode>;
    delete container[target.key];
    for (const [index, title] of replacementTitles.entries()) {
      const description = descriptions[index];
      container[title] = description ? description : "";
    }
  }
}

function buildSplitSkillDescriptions(
  originalTitle: string,
  originalDescription: string | undefined,
  replacementTitles: string[],
) {
  return replacementTitles.map((title) => {
    return originalDescription?.trim() || `Practice ${title.toLowerCase()} in a smaller, focused step.`;
  });
}

function replaceLinkedSkillTitles(units: CurriculumAiGeneratedArtifact["units"], targetTitle: string, replacementTitles: string[]) {
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      if (!lesson.linkedSkillTitles.includes(targetTitle)) {
        continue;
      }

      lesson.linkedSkillTitles = uniqueNonEmpty([
        ...lesson.linkedSkillTitles.filter((title) => title !== targetTitle),
        ...replacementTitles,
      ]);
    }
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function finalizeCurriculumTitle(params: {
  artifact: CurriculumAiGeneratedArtifact;
  learner: AppLearner;
  messages: ChatMessage[];
}): Promise<CurriculumAiGeneratedArtifact> {
  const currentIssues = getCurriculumTitleIssues(params.artifact.source.title, params.messages);
  const proposedTitle = await generateCurriculumTitle({
    artifact: params.artifact,
    learner: params.learner,
    messages: params.messages,
  });

  if (proposedTitle && getCurriculumTitleIssues(proposedTitle, params.messages).length === 0) {
    return {
      ...params.artifact,
      source: {
        ...params.artifact.source,
        title: proposedTitle,
      },
    };
  }

  if (currentIssues.length === 0) {
    return params.artifact;
  }

  return {
    ...params.artifact,
    source: {
      ...params.artifact.source,
      title: buildHeuristicCurriculumTitle(params.artifact, params.messages),
    },
  };
}

async function generateCurriculumTitle(params: {
  artifact: CurriculumAiGeneratedArtifact;
  learner: AppLearner;
  messages: ChatMessage[];
}) {
  const prompt = await resolvePrompt("curriculum.title", CURRICULUM_TITLE_PROMPT_VERSION);
  const adapter = getAdapterForTask("curriculum.title");
  const model = getModelForTask("curriculum.title", getAiRoutingConfig());

  try {
    const response = await adapter.complete({
      model,
      temperature: 0.25,
      systemPrompt: prompt.systemPrompt,
      messages: [
        {
          role: "user",
          content: buildCurriculumTitlePrompt({
            learnerName: params.learner.displayName,
            messages: params.messages,
            artifact: {
              source: {
                title: params.artifact.source.title,
                summary: params.artifact.source.summary,
                subjects: params.artifact.source.subjects,
                gradeLevels: params.artifact.source.gradeLevels,
              },
              pacing: {
                totalWeeks: params.artifact.pacing.totalWeeks,
                sessionsPerWeek: params.artifact.pacing.sessionsPerWeek,
                totalSessions: params.artifact.pacing.totalSessions,
              },
              units: params.artifact.units.map((unit) => ({
                title: unit.title,
                description: unit.description,
              })),
            },
          }),
        },
      ],
    });

    const parsed = parseCurriculumTitleCandidate(response.content);
    return parsed?.trim() || null;
  } catch (error) {
    console.error("[curriculum/ai-draft] Title generation failed, using fallback title handling.", error);
    return null;
  }
}

async function buildCurriculumRevisionSnapshot(sourceId: string, householdId: string) {
  const source = await getCurriculumSource(sourceId, householdId);
  const tree = await getCurriculumTree(sourceId, householdId);
  const outline = await listCurriculumOutline(sourceId);

  if (!source || !tree) {
    throw new Error(`CurriculumSource not found: ${sourceId}`);
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
    structureSummary: buildRevisionStructureSummary(tree.rootNodes),
    structure: tree.rootNodes.map((node) => serializeCurriculumRevisionNode(node)),
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
  } satisfies CurriculumRevisionSnapshot;
}

function buildRevisionStructureSummary(nodes: CurriculumTreeNode[], path: string[] = []) {
  const lines: string[] = [];

  for (const node of nodes) {
    const currentPath = [...path, node.title];
    lines.push(`${node.normalizedType}: ${currentPath.join(" > ")}`);
    if (node.children.length > 0) {
      lines.push(...buildRevisionStructureSummary(node.children, currentPath));
    }
  }

  return lines;
}

function serializeCurriculumRevisionNode(
  node: CurriculumTreeNode,
  path: string[] = [],
): CurriculumRevisionSnapshotNode {
  const currentPath = [...path, node.title];
  return {
    title: node.title,
    normalizedType: node.normalizedType,
    path: currentPath,
    normalizedPath: node.normalizedPath,
    description: node.description ?? undefined,
    code: node.code ?? undefined,
    depth: node.depth,
    sequenceIndex: node.sequenceIndex,
    children: node.children.map((child) => serializeCurriculumRevisionNode(child, currentPath)),
  };
}

function buildRevisionSnapshotSummary(snapshot: CurriculumRevisionSnapshot) {
  const unitTitles = snapshot.outline
    .map((unit) => (typeof unit.title === "string" ? unit.title : null))
    .filter((title): title is string => Boolean(title));

  return [
    `Source title: ${snapshot.source.title}`,
    snapshot.source.description ? `Source summary: ${snapshot.source.description}` : null,
    snapshot.counts.unitCount > 0 ? `Units: ${unitTitles.join(" | ")}` : null,
    snapshot.structureSummary.length > 0
      ? `Top-level structure: ${snapshot.structureSummary.slice(0, 6).join(" | ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function getLatestParentRequest(messages: ChatMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role === "user" && message.content.trim()) {
      return message.content.trim();
    }
  }

  return "";
}

function buildRevisionStructureSignatureFromSnapshot(nodes: RevisionSnapshotNode[]) {
  return nodes.map(buildRevisionStructureSignatureFromSnapshotNode).join("|");
}

function buildRevisionStructureSignatureFromSnapshotNode(node: RevisionSnapshotNode): string {
  const title = typeof node.title === "string" ? node.title.trim() : "";
  const children = Array.isArray(node.children) ? node.children : [];
  return `${title}{${children.map(buildRevisionStructureSignatureFromSnapshotNode).join("|")}}`;
}

function buildRevisionStructureSignatureFromDocument(node: RevisionDocumentNode): string {
  if (typeof node === "string") {
    return node.trim();
  }

  if (Array.isArray(node)) {
    return `[${node.map(buildRevisionStructureSignatureFromDocument).join("|")}]`;
  }

  return `{${Object.entries(node)
    .map(([key, value]) => `${key}${buildRevisionStructureSignatureFromDocument(value)}`)
    .join("|")}}`;
}

function buildRevisionTargetCandidatesSummary(
  snapshot: CurriculumRevisionSnapshot,
  requestText: string,
) {
  const candidates = collectRevisionTargetCandidates(
    snapshot.structure as unknown as RevisionSnapshotNode[],
    requestText,
  )
    .sort((left, right) => right.score - left.score || left.path.length - right.path.length)
    .slice(0, 6);

  return candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.path.join(" > ")} [${candidate.type}]`,
    )
    .join("\n");
}

function collectRevisionTargetCandidates(
  nodes: RevisionSnapshotNode[],
  requestText: string,
  path: string[] = [],
) {
  const candidates: RevisionTargetCandidate[] = [];

  for (const node of nodes) {
    const title = typeof node.title === "string" ? node.title.trim() : "";
    if (!title) {
      continue;
    }

    const nextPath = [...path, title];
    const type = typeof node.type === "string" ? node.type : "node";
    let score = scoreSkillMatch(title, requestText);

    if (typeof node.description === "string" && node.description.trim()) {
      score += Math.round(scoreSkillMatch(node.description, requestText) / 2);
    }

    if (type === "skill") {
      score += 20;
    } else if (type === "goal_group") {
      score += 10;
    } else if (type === "strand") {
      score += 4;
    }

    score += Math.min(nextPath.length, 4);

    candidates.push({
      path: nextPath,
      title,
      type,
      score,
    });

    if (Array.isArray(node.children) && node.children.length > 0) {
      candidates.push(...collectRevisionTargetCandidates(node.children, requestText, nextPath));
    }
  }

  return candidates;
}

function serializeCurriculumNodeForPrompt(
  node: SerializedCurriculumNodeForPrompt,
): Record<string, unknown> {
  return {
    type: node.normalizedType,
    title: node.title,
    description: node.description,
    children: node.children.map((child) => serializeCurriculumNodeForPrompt(child)),
  };
}

function sanitizeChatTurn(turn: CurriculumAiChatTurn): CurriculumAiChatTurn {
  return {
    assistantMessage: turn.assistantMessage.trim(),
    state: {
      readiness: turn.state.readiness,
      summary: turn.state.summary.trim(),
      missingInformation: uniqueNonEmpty(turn.state.missingInformation),
      capturedRequirements: sanitizeCapturedRequirements(turn.state.capturedRequirements),
    },
  };
}

function sanitizeArtifact(artifact: CurriculumAiGeneratedArtifact): CurriculumAiGeneratedArtifact {
  return {
    source: {
      ...artifact.source,
      title: artifact.source.title.trim(),
      description: artifact.source.description.trim(),
      summary: artifact.source.summary.trim(),
      teachingApproach: artifact.source.teachingApproach.trim(),
      subjects: uniqueNonEmpty(artifact.source.subjects),
      gradeLevels: uniqueNonEmpty(artifact.source.gradeLevels),
      successSignals: uniqueNonEmpty(artifact.source.successSignals),
      parentNotes: uniqueNonEmpty(artifact.source.parentNotes),
      rationale: uniqueNonEmpty(artifact.source.rationale),
    },
    intakeSummary: artifact.intakeSummary.trim(),
    pacing: sanitizePacing(artifact.pacing),
    document: artifact.document,
    units: artifact.units.map((unit) => ({
      ...unit,
      title: unit.title.trim(),
      description: unit.description.trim(),
      lessons: unit.lessons.map((lesson) => ({
        ...lesson,
        title: lesson.title.trim(),
        description: lesson.description.trim(),
        subject: lesson.subject?.trim() || undefined,
        materials: uniqueNonEmpty(lesson.materials),
        objectives: uniqueNonEmpty(lesson.objectives),
        linkedSkillTitles: uniqueNonEmpty(lesson.linkedSkillTitles),
      })),
    })),
  };
}

function parseCurriculumChatTurn(content: string) {
  const parsed = safeParseJson(content);
  if (!parsed) {
    return null;
  }

  const candidate = normalizeChatTurnCandidate(parsed);
  const validated = CurriculumAiChatTurnSchema.safeParse(candidate);

  return validated.success ? sanitizeChatTurn(validated.data) : null;
}

function parseCurriculumGeneratedArtifact(content: string) {
  const parsed = safeParseJson(content);
  if (!parsed) {
    return null;
  }

  const validated = CurriculumAiGeneratedArtifactSchema.safeParse(parsed);
  return validated.success ? validated.data : null;
}

function parseCurriculumRevisionTurn(content: string) {
  const parsed = safeParseJson(content);
  if (!parsed) {
    return null;
  }

  const validated = CurriculumAiRevisionTurnSchema.safeParse(parsed);
  if (!validated.success) {
    return null;
  }

  return sanitizeRevisionTurn(validated.data);
}

function sanitizeRevisionTurn(turn: CurriculumAiRevisionTurn): CurriculumAiRevisionTurn {
  return {
    ...turn,
    assistantMessage: turn.assistantMessage.trim(),
    changeSummary: uniqueNonEmpty(turn.changeSummary),
    artifact: turn.artifact ? sanitizeArtifact(turn.artifact) : undefined,
  };
}

function sanitizeRevisionPlan(plan: CurriculumAiRevisionPlan): CurriculumAiRevisionPlan {
  return {
    assistantMessage: plan.assistantMessage.trim(),
    action: plan.action,
    scope: plan.scope,
    operation: plan.operation,
    changeSummary: uniqueNonEmpty(plan.changeSummary),
    revisionBrief: plan.revisionBrief?.trim() || undefined,
    targetPath: uniqueNonEmpty(plan.targetPath),
    replacementTitles: uniqueNonEmpty(plan.replacementTitles),
    missingDetail: plan.missingDetail?.trim() || undefined,
  };
}

function parseCurriculumTitleCandidate(content: string) {
  const parsed = safeParseJson(content);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const candidate = (parsed as Record<string, unknown>).title;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const trimmed = content.trim().replace(/^["']|["']$/g, "");
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizePacing(pacing: CurriculumAiPacing): CurriculumAiPacing {
  return {
    totalWeeks: pacing.totalWeeks,
    sessionsPerWeek: pacing.sessionsPerWeek,
    sessionMinutes: pacing.sessionMinutes,
    totalSessions: pacing.totalSessions,
    coverageStrategy: pacing.coverageStrategy.trim(),
    coverageNotes: uniqueNonEmpty(pacing.coverageNotes),
  };
}

function normalizeChatTurnCandidate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const stateRecord =
    "state" in record && record.state && typeof record.state === "object" && !Array.isArray(record.state)
      ? (record.state as Record<string, unknown>)
      : record;

  return {
    assistantMessage:
      typeof record.assistantMessage === "string"
        ? record.assistantMessage
        : typeof stateRecord.assistantMessage === "string"
          ? stateRecord.assistantMessage
          : "",
    state: {
      readiness: stateRecord.readiness,
      summary: typeof stateRecord.summary === "string" ? stateRecord.summary : "",
      missingInformation: Array.isArray(stateRecord.missingInformation)
        ? stateRecord.missingInformation
            .map((item) => (typeof item === "string" ? item : String(item ?? "")))
            .filter(Boolean)
            .slice(0, 6)
        : [],
      capturedRequirements:
        stateRecord.capturedRequirements &&
        typeof stateRecord.capturedRequirements === "object" &&
        !Array.isArray(stateRecord.capturedRequirements)
          ? stateRecord.capturedRequirements
          : {},
    },
  };
}

function buildFallbackChatTurn(params: {
  learner: AppLearner;
  messages: ChatMessage[];
}): CurriculumAiChatTurn {
  const capturedRequirements = inferCapturedRequirements(params.messages);
  const missingInformation = getMissingRequirements(capturedRequirements);
  const readiness = deriveFallbackReadiness(capturedRequirements);

  if (params.messages.length === 0) {
    return {
      assistantMessage: `What are you hoping to build for ${params.learner.firstName} right now? Tell me the topic or area you want to focus on, and what you want this curriculum to help them become able to do.`,
      state: {
        readiness: "gathering",
        summary: `We are starting a new curriculum conversation for ${params.learner.displayName}.`,
        missingInformation,
        capturedRequirements,
      },
    };
  }

  if (readiness === "ready") {
    return {
      assistantMessage: buildFallbackReadyMessage(capturedRequirements),
      state: {
        readiness: "ready",
        summary: buildRequirementSummary(capturedRequirements),
        missingInformation,
        capturedRequirements,
      },
    };
  }

  return {
    assistantMessage: buildFallbackQuestion(
      params.learner.firstName,
      missingInformation[0],
      capturedRequirements,
    ),
    state: {
      readiness: "gathering",
      summary: buildRequirementSummary(capturedRequirements),
      missingInformation,
      capturedRequirements,
    },
  };
}

function buildFallbackArtifact(params: {
  learner: AppLearner;
  messages: ChatMessage[];
}): CurriculumAiGeneratedArtifact {
  const capturedRequirements = inferCapturedRequirements(params.messages);
  const requestedPacing = inferRequestedPacing(params.messages, capturedRequirements);
  const topic = extractTopicLabel(capturedRequirements.topic || collectUserMessages(params.messages)[0] || "Custom Study");

  return buildFallbackCurriculumArtifact({
    learner: params.learner,
    topic,
    capturedRequirements,
    requestedPacing,
  });
}

function inferCapturedRequirements(messages: ChatMessage[]): CurriculumAiCapturedRequirements {
  const userMessages = collectUserMessages(messages);
  const combined = userMessages.join(" ");
  const openingMessage = userMessages[0] ?? "";
  const openingSentences = splitIntoSentences(openingMessage);
  const openingTopicSentence = openingSentences[0] ?? openingMessage;
  const openingGoalRemainder = openingSentences.slice(1).join(" ").trim();

  const requirements = {
    topic: extractTopicLabel(openingTopicSentence),
    goals:
      openingGoalRemainder ||
      findFirstMatchingMessage(userMessages.slice(1), /(goal|by the end|want .* to|hope|outcome|master)/i) ||
      "",
    timeframe: firstMatch(combined, /\b(?:\d+\s+(?:week|weeks|month|months|day|days|session|sessions)|semester|year|daily|weekly|minutes?)\b.*?(?:\.|$)/i),
    learnerProfile:
      findFirstMatchingMessage(
        userMessages,
        /(already know|struggle|support|learn best|confidence|attention|ready|experience)/i,
      ) ?? "",
    constraints:
      findFirstMatchingMessage(
        userMessages,
        /(material|resource|prep|schedule|routine|constraint|avoid|need|have|offline|budget)/i,
      ) ?? "",
    teachingStyle:
      findFirstMatchingMessage(
        userMessages,
        /(hands-on|discussion|project|visual|direct instruction|short lessons|practice)/i,
      ) ?? "",
    assessment:
      findFirstMatchingMessage(
        userMessages,
        /(assess|progress|show|portfolio|project|demonstrate|evidence|mastery)/i,
      ) ?? "",
    structurePreferences:
      findFirstMatchingMessage(
        userMessages,
        /(domain|strand|goal group|theme|project-based|project sequence|skill progression|spiral|mastery)/i,
      ) ?? "",
  };

  return sanitizeCapturedRequirements(requirements);
}

function sanitizeCapturedRequirements(
  requirements: CurriculumAiCapturedRequirements,
): CurriculumAiCapturedRequirements {
  return CurriculumAiCapturedRequirementsSchema.parse({
    topic: requirements.topic.trim(),
    goals: requirements.goals.trim(),
    timeframe: requirements.timeframe.trim(),
    learnerProfile: requirements.learnerProfile.trim(),
    constraints: requirements.constraints.trim(),
    teachingStyle: requirements.teachingStyle.trim(),
    assessment: requirements.assessment.trim(),
    structurePreferences: requirements.structurePreferences.trim(),
  });
}

function getMissingRequirements(requirements: CurriculumAiCapturedRequirements) {
  const missing: string[] = [];

  if (!requirements.topic) missing.push("topic");
  if (!requirements.goals) missing.push("goals");
  if (!requirements.timeframe) missing.push("timeframe");
  if (!requirements.learnerProfile) missing.push("learner profile");
  if (!requirements.constraints) missing.push("constraints");
  if (!requirements.assessment) missing.push("assessment");
  if (!requirements.structurePreferences) missing.push("structure");

  return missing.slice(0, 6);
}

function deriveFallbackReadiness(
  requirements: CurriculumAiCapturedRequirements,
) {
  const hasCoreContext =
    Boolean(requirements.topic) &&
    Boolean(requirements.goals) &&
    Boolean(requirements.learnerProfile);

  return hasCoreContext ? "ready" : "gathering";
}

function buildFallbackQuestion(
  learnerFirstName: string,
  missing: string,
  requirements: CurriculumAiCapturedRequirements,
) {
  const topic = requirements.topic ? toSentenceFragment(requirements.topic) : "";
  const topicLead = topic ? `For ${topic.toLowerCase()}, ` : "";

  switch (missing) {
    case "topic":
      return `What do you want ${learnerFirstName} to study, and what makes that topic worth building a curriculum around right now?`;
    case "goals":
      return `${topicLead}what would success look like by the end of the plan? I’m looking for the kind of understanding, performance, or independence you want to see.`;
    case "timeframe":
      return "What span should this curriculum cover, and what weekly rhythm is actually sustainable for your family?";
    case "learner profile":
      return `What does ${learnerFirstName} already know in this area, and where do they tend to need more support, confidence, or structure?`;
    case "constraints":
      return "What constraints should I design around, such as prep time, available materials, budget, schedule, or the kind of routine that works best at home?";
    case "assessment":
      return "How would you like to notice progress as you go: quick conversations, short performances, projects, written work, or something lighter-touch?";
    case "structure":
      return "Should I organize this more like a steady skill progression, a themed exploration, a project sequence, or another structure you already have in mind?";
    default:
      return "Tell me a bit more about what this curriculum needs to accomplish.";
  }
}

function buildFallbackReadyMessage(requirements: CurriculumAiCapturedRequirements) {
  const fragments = [
    requirements.topic ? `the focus is ${toSentenceFragment(requirements.topic)}` : null,
    requirements.goals ? `the main goal is ${toSentenceFragment(requirements.goals)}` : null,
    requirements.timeframe ? `the pacing is ${toSentenceFragment(requirements.timeframe)}` : null,
  ].filter(Boolean);

  const summary = fragments.length > 0 ? fragments.join(", ") : "I have the key planning context";
  return `I have enough to build this curriculum now. From what you’ve shared, ${summary}. I’ll fill in the pacing, assessment, and structure with reasonable defaults if they were not specified. If that sounds right, I can generate the domain-to-skill structure and the first unit-and-lesson sequence.`;
}

function buildRequirementSummary(requirements: CurriculumAiCapturedRequirements) {
  const parts = [
    requirements.topic ? `Topic: ${requirements.topic}` : null,
    requirements.goals ? `Goals: ${shorten(requirements.goals, 160)}` : null,
    requirements.timeframe ? `Pacing: ${requirements.timeframe}` : null,
    requirements.learnerProfile ? `Learner: ${shorten(requirements.learnerProfile, 160)}` : null,
    requirements.constraints ? `Constraints: ${shorten(requirements.constraints, 160)}` : null,
    requirements.assessment ? `Assessment: ${shorten(requirements.assessment, 120)}` : null,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(" ")
    : "The intake is still gathering the core requirements for this curriculum.";
}

function artifactMatchesConversation(artifact: CurriculumAiGeneratedArtifact, messages: ChatMessage[]) {
  const combinedText = JSON.stringify({
    title: artifact.source.title,
    description: artifact.source.description,
    summary: artifact.source.summary,
    pacing: artifact.pacing,
    document: artifact.document,
    units: artifact.units.map((unit) => ({
      title: unit.title,
      lessons: unit.lessons.map((lesson) => lesson.title),
    })),
  }).toLowerCase();

  const topicKeywords = extractMeaningfulKeywords(collectUserMessages(messages).join(" "));
  if (topicKeywords.length === 0) {
    return true;
  }

  return topicKeywords.some((keyword) => combinedText.includes(keyword));
}

function getArtifactCoverageIssues(
  artifact: CurriculumAiGeneratedArtifact,
  messages: ChatMessage[],
  requestedPacing: RequestedPacing,
) {
  const issues: string[] = [];

  if (!artifactMatchesConversation(artifact, messages)) {
    issues.push("The artifact does not stay aligned to the conversation topic.");
  }

  const estimatedSessions = estimateArtifactSessionCount(artifact);
  if (
    typeof requestedPacing.totalSessionsLowerBound === "number" &&
    estimatedSessions < requestedPacing.totalSessionsLowerBound
  ) {
    issues.push(
      `The curriculum only accounts for about ${estimatedSessions} sessions, which is below the requested scope.`,
    );
  }

  const skillCount = countDocumentSkills(artifact.document);
  if (estimatedSessions >= 24 && skillCount > 0) {
    const sessionsPerSkill = estimatedSessions / skillCount;
    if (sessionsPerSkill > 8) {
      issues.push("The curriculum has too few distinct skills for the requested schedule.");
    }
  }

  if (!titleLooksDistinctFromOpeningMessage(artifact.source.title, messages)) {
    issues.push("The curriculum title is too close to the parent's opening message.");
  }

  return issues;
}

function estimateArtifactSessionCount(artifact: CurriculumAiGeneratedArtifact) {
  const unitSessionTotal = artifact.units.reduce(
    (total, unit) => total + (unit.estimatedSessions ?? unit.lessons.length),
    0,
  );

  if (unitSessionTotal > 0) {
    return unitSessionTotal;
  }

  return artifact.pacing.totalSessions ?? artifact.units.reduce((total, unit) => total + unit.lessons.length, 0);
}

function countDocumentSkills(document: CurriculumAiGeneratedArtifact["document"]) {
  return countDocumentNodeSkills(document);
}

function getCurriculumTitleIssues(title: string, messages: ChatMessage[]) {
  const issues: string[] = [];
  const normalizedTitle = normalizeForComparison(title);
  const opening = collectUserMessages(messages)[0] ?? "";
  const topic = normalizeForComparison(
    extractTopicLabel(inferCapturedRequirements(messages).topic || opening),
  );

  if (!titleLooksDistinctFromOpeningMessage(title, messages)) {
    issues.push("Title echoes the opening request.");
  }

  if (!normalizedTitle || normalizedTitle.split(" ").length < 2) {
    issues.push("Title is too short or generic.");
  }

  if (topic && (normalizedTitle === topic || normalizedTitle.startsWith(topic) || topic.startsWith(normalizedTitle))) {
    issues.push("Title is too close to the raw topic label.");
  }

  if (/\b(curriculum|study|learning plan|skill path|custom study)\b/i.test(title) && normalizedTitle.split(" ").length <= 4) {
    issues.push("Title still sounds like a placeholder.");
  }

  return issues;
}

function buildHeuristicCurriculumTitle(
  artifact: CurriculumAiGeneratedArtifact,
  messages: ChatMessage[],
) {
  const topic = toTitleCase(
    extractTopicLabel(inferCapturedRequirements(messages).topic || artifact.source.title),
  );

  if (artifact.units[0]?.title) {
    const lead = artifact.units[0].title
      .replace(/\b(foundations|guided practice|independent growth)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (lead && getCurriculumTitleIssues(lead, messages).length === 0) {
      return lead;
    }
  }

  return `First Steps in ${topic}`;
}

function countDocumentNodeSkills(node: unknown): number {
  if (typeof node === "string") {
    return 1;
  }

  if (Array.isArray(node)) {
    return node.length;
  }

  if (!node || typeof node !== "object") {
    return 0;
  }

  return Object.values(node).reduce((total, child) => total + countDocumentNodeSkills(child), 0);
}

function inferRequestedPacing(
  messages: ChatMessage[],
  requirements: CurriculumAiCapturedRequirements,
): RequestedPacing {
  const combined = messages.map((message) => message.content).join(" ").toLowerCase();
  const timeframe = `${requirements.timeframe} ${requirements.constraints} ${requirements.goals}`.toLowerCase();
  const explicitTotalSessions = firstNumberMatch(combined, /\b(\d+)\s+(?:total\s+)?sessions?\b/i);
  const sessionsPerWeek =
    firstNumberMatch(combined, /\b(\d+(?:\.\d+)?)\s+(?:sessions?|lessons?)\s+(?:per|a)\s+week\b/i) ??
    (/\bdaily\b/i.test(combined) ? 7 : /\bweekly\b/i.test(combined) ? 1 : undefined);
  const totalWeeks =
    firstNumberMatch(timeframe, /\b(\d+)\s*weeks?\b/i) ??
    (() => {
      const months = firstNumberMatch(timeframe, /\b(\d+)\s*months?\b/i);
      return typeof months === "number" ? months * 4 : undefined;
    })();
  const sessionMinutes =
    firstNumberMatch(combined, /\b(\d+)\s*minutes?\b/i) ??
    firstNumberMatch(timeframe, /\b(\d+)\s*minutes?\b/i);

  const inferredTotalSessions =
    explicitTotalSessions ??
    (typeof totalWeeks === "number" && typeof sessionsPerWeek === "number"
      ? Math.round(totalWeeks * sessionsPerWeek)
      : undefined);

  return {
    totalWeeks,
    sessionsPerWeek,
    sessionMinutes,
    explicitlyRequestedTotalSessions: explicitTotalSessions,
    totalSessionsLowerBound:
      typeof inferredTotalSessions === "number"
        ? Math.max(1, Math.floor(inferredTotalSessions * 0.85))
        : undefined,
    totalSessionsUpperBound:
      typeof inferredTotalSessions === "number"
        ? Math.max(1, Math.ceil(inferredTotalSessions * 1.2))
        : undefined,
  };
}

function titleLooksDistinctFromOpeningMessage(title: string, messages: ChatMessage[]) {
  const opening = collectUserMessages(messages)[0];
  if (!opening) {
    return true;
  }

  const normalizedTitle = normalizeForComparison(title);
  const normalizedOpening = normalizeForComparison(opening);

  if (!normalizedTitle || !normalizedOpening) {
    return true;
  }

  return normalizedTitle !== normalizedOpening && !normalizedOpening.startsWith(normalizedTitle);
}

function normalizeForComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(curriculum|plan|study|learn|build|create|make|for|my|child|please|help|me)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMessages(messages: CurriculumAiChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));
}

async function buildFallbackRevisionTurn(params: {
  learner: AppLearner;
  messages: ChatMessage[];
  snapshot: CurriculumRevisionSnapshot;
  revisionPreference: RevisionPreference | null;
  revisionPlan?: CurriculumAiRevisionPlan | null;
}): Promise<CurriculumAiRevisionTurn | null> {
  const shouldApply = params.revisionPlan?.action === "apply"
    ? true
    : shouldAutoApplyRevision(params.messages, params.revisionPreference);

  if (!shouldApply) {
    return null;
  }

  const capturedRequirements = inferCapturedRequirements(params.messages);
  const requestedPacing = inferRequestedPacing(params.messages, capturedRequirements);
  const topic = extractTopicLabel(
    capturedRequirements.topic || inferRevisionTopic(params.snapshot) || params.snapshot.source.title,
  );
  const artifact = await finalizeCurriculumTitle({
    artifact: buildFallbackCurriculumArtifact({
      learner: params.learner,
      topic,
      capturedRequirements,
      requestedPacing,
    }),
    learner: params.learner,
    messages: params.messages,
  });

  return {
    assistantMessage: buildFallbackRevisionAssistantMessage(
      params.messages,
      artifact,
      params.revisionPreference,
      params.revisionPlan ?? null,
    ),
    action: "apply",
    changeSummary: buildFallbackRevisionChangeSummary(
      params.messages,
      artifact,
      params.revisionPreference,
      params.revisionPlan ?? null,
    ),
    artifact,
  };
}

function collectUserMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);
}

function findFirstMatchingMessage(messages: string[], pattern: RegExp) {
  return messages.find((message) => pattern.test(message)) ?? null;
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[0]?.trim() ?? "";
}

function inferRevisionPreference(messages: ChatMessage[]): RevisionPreference | null {
  const assistantAskedPreference = hasPreferenceClarificationFromAssistant(messages);

  for (const message of [...messages].reverse()) {
    if (message.role !== "user") {
      continue;
    }

    const value = message.content.trim().toLowerCase();
    if (
      /\b(broader rewrite|broader rewrite please|rewrite it|rewrite the structure|rebuild it|start over|replace the structure)\b/i.test(
        value,
      ) ||
      (assistantAskedPreference && /^2(?:\b|$)/.test(value))
    ) {
      return "broader";
    }

    if (
      /\b(targeted adjustment|targeted change|preserve the current structure|keep the current structure)\b/i.test(
        value,
      ) ||
      (assistantAskedPreference && /^1(?:\b|$)/.test(value))
    ) {
      return "targeted";
    }

    if (isConcreteTargetedRevisionMessage(value)) {
      return "targeted";
    }
  }

  return null;
}

function shouldAutoApplyTargetedRevision(
  messages: ChatMessage[],
  revisionPreference: RevisionPreference | null,
) {
  return revisionPreference === "targeted" && hasTargetedRevisionDirection(messages);
}

function shouldAutoApplyBroaderRewrite(
  messages: ChatMessage[],
  revisionPreference: RevisionPreference | null,
) {
  return revisionPreference === "broader" && hasConcreteRevisionDirection(messages);
}

function shouldAutoApplyRevision(
  messages: ChatMessage[],
  revisionPreference: RevisionPreference | null,
) {
  return shouldAutoApplyBroaderRewrite(messages, revisionPreference) ||
    shouldAutoApplyTargetedRevision(messages, revisionPreference);
}

function hasPreferenceClarificationFromAssistant(messages: ChatMessage[]) {
  return messages.some(
    (message) =>
      message.role === "assistant" && isPreferenceClarificationMessage(message.content),
  );
}

function hasConcreteRevisionDirection(messages: ChatMessage[]) {
  return collectUserMessages(messages)
    .filter((message) => !isPreferenceOnlyRevisionMessage(message))
    .some(
      (message) =>
        message.length >= 14 ||
        /\b(add|expand|rename|retitle|title|pacing|pace|week|weeks|session|sessions|goal group|strand|skill|foundation|foundations|core ideas?|rewrite|reorganize|broader)\b/i.test(
          message,
        ),
    );
}

function hasTargetedRevisionDirection(messages: ChatMessage[]) {
  return collectUserMessages(messages)
    .filter((message) => !isPreferenceOnlyRevisionMessage(message))
    .some(isConcreteTargetedRevisionMessage);
}

function isConcreteTargetedRevisionMessage(message: string) {
  return /\b(shorten|shorter|lengthen|longer|simplify|simpler|condense|trim|reduce|increase|tighten|streamline|refine|adjust|rename|retitle|split|split up|smaller skills|subskills|break down|focus(?:ed|es|ing)?|narrow(?:er)?|sharpen(?: up)?|clean up|polish|improve|better|more concise|less repetitive|pacing|timeline|materials?|lesson structure|opening lessons|teaching approach|goal group|strand|skill|title)\b/i.test(
    message,
  );
}

function isPreferenceOnlyRevisionMessage(message: string) {
  const value = message.trim().toLowerCase();
  return (
    /^1[.!?]*$/.test(value) ||
    /^2[.!?]*$/.test(value) ||
    /^(?:just\s+|please\s+|make\s+|do\s+|a\s+|the\s+|one\s+)*targeted adjustment(?: please)?[.!?]*$/.test(value) ||
    /^(?:just\s+|please\s+|make\s+|do\s+|a\s+|the\s+|one\s+)*broader rewrite(?: please)?[.!?]*$/.test(value)
  );
}

function isPreferenceClarificationMessage(message: string) {
  return /targeted adjustment/i.test(message) && /broader rewrite/i.test(message);
}

function buildFallbackRevisionSeedMessages(
  snapshot: CurriculumRevisionSnapshot,
  messages: ChatMessage[],
  revisionPlan: CurriculumAiRevisionPlan | null,
): ChatMessage[] {
  const topic = inferRevisionTopic(snapshot);
  const revisionRequest = collectUserMessages(messages)
    .filter((message) => !isPreferenceOnlyRevisionMessage(message))
    .join(" ");
  const unitTitles = snapshot.outline
    .map((unit) =>
      typeof unit.title === "string" && unit.title.trim() ? unit.title.trim() : null,
    )
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");

  return [
    {
      role: "user",
      content: [
        `We want to teach ${topic}.`,
        revisionRequest ? `Requested revision: ${revisionRequest}.` : null,
        revisionPlan?.revisionBrief ? `Revision brief: ${revisionPlan.revisionBrief}.` : null,
        `Current curriculum title: ${snapshot.source.title}.`,
        snapshot.source.description ? `Current summary: ${snapshot.source.description}.` : null,
        snapshot.counts.estimatedSessionCount > 0
          ? `Current outline covers about ${snapshot.counts.estimatedSessionCount} sessions.`
          : null,
        unitTitles ? `Current units include ${unitTitles}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    },
  ];
}

function inferRevisionTopic(snapshot: CurriculumRevisionSnapshot) {
  const snapshotText = [
    snapshot.source.title,
    snapshot.source.description ?? "",
    snapshot.source.subjects.join(" "),
    JSON.stringify(snapshot.structure).slice(0, 1_200),
    JSON.stringify(snapshot.outline).slice(0, 1_200),
  ].join(" ");

  return extractTopicLabel(snapshotText);
}

function buildFallbackRevisionAssistantMessage(
  messages: ChatMessage[],
  artifact: CurriculumAiGeneratedArtifact,
  revisionPreference: RevisionPreference | null,
  revisionPlan: CurriculumAiRevisionPlan | null,
) {
  const requestText = collectUserMessages(messages).join(" ").toLowerCase();
  const revisionLead =
    revisionPlan?.scope === "targeted" || revisionPreference === "targeted"
      ? "targeted revision"
      : "broader rewrite";
  const details = [
    /\b(shorten|shorter|lengthen|longer|simplify|simpler|condense|trim|reduce|increase|tighten|streamline|refine|adjust|rename|retitle|pacing|timeline|materials?|lesson structure|opening lessons|teaching approach|goal group|strand|skill|title)\b/i.test(
      requestText,
    )
      ? /\b(shorten|shorter|condense|trim|reduce|tighten|simplify|simpler)\b/i.test(requestText)
        ? "refocused the pacing and simplified the opening lessons"
        : /\b(lengthen|longer|expand|deepen|increase)\b/i.test(requestText)
          ? "expanded the pacing and added more room for practice"
          : "refined the early lesson sequence"
      : null,
    /foundation|core ideas?/.test(requestText)
      ? "expanded the foundations and core ideas"
      : null,
    typeof artifact.pacing.totalWeeks === "number" && typeof artifact.pacing.totalSessions === "number"
      ? `rebalanced the pacing for about ${artifact.pacing.totalWeeks} weeks and ${artifact.pacing.totalSessions} sessions`
      : null,
  ].filter(Boolean);

  return details.length > 0
    ? `I applied a ${revisionLead}, ${details.join(", ")}, and refreshed the curriculum structure so it is ready to use.`
    : `I applied a ${revisionLead} and refreshed the curriculum structure so it is ready to use.`;
}

function buildFallbackRevisionChangeSummary(
  messages: ChatMessage[],
  artifact: CurriculumAiGeneratedArtifact,
  revisionPreference: RevisionPreference | null,
  revisionPlan: CurriculumAiRevisionPlan | null,
) {
  const requestText = collectUserMessages(messages).join(" ").toLowerCase();
  const revisionLead =
    revisionPlan?.scope === "targeted" || revisionPreference === "targeted"
      ? "Applied a targeted revision to the curriculum structure."
      : "Applied a broader rewrite to the curriculum structure.";
  const summary = [
    revisionLead,
    revisionPlan?.revisionBrief ? `Planned change: ${revisionPlan.revisionBrief}` : null,
    /\b(shorten|shorter|lengthen|longer|simplify|simpler|condense|trim|reduce|increase|tighten|streamline|refine|adjust|rename|retitle|pacing|timeline|materials?|lesson structure|opening lessons|teaching approach|goal group|strand|skill|title)\b/i.test(
      requestText,
    )
      ? /\b(shorten|shorter|condense|trim|reduce|tighten|simplify|simpler)\b/i.test(requestText)
        ? "Shortened and simplified the opening stretch so the curriculum feels lighter."
        : /\b(lengthen|longer|expand|deepen|increase)\b/i.test(requestText)
          ? "Expanded the pacing so the curriculum has more room to breathe."
          : "Refined the early lesson sequence to better match the requested change."
      : null,
    /foundation|core ideas?/.test(requestText)
      ? "Expanded the foundations so the opening stretch carries more core ideas."
      : null,
    typeof artifact.pacing.totalWeeks === "number" && typeof artifact.pacing.totalSessions === "number"
      ? `Rebalanced the pacing for roughly ${artifact.pacing.totalWeeks} weeks and ${artifact.pacing.totalSessions} sessions.`
      : null,
    artifact.source.title ? `Updated the curriculum framing to ${artifact.source.title}.` : null,
  ].filter((item): item is string => Boolean(item));

  return uniqueNonEmpty(summary).slice(0, 4);
}

function firstNumberMatch(value: string, pattern: RegExp) {
  const match = value.match(pattern)?.[1];
  return match ? Number(match) : undefined;
}

function buildFallbackSkills(
  topic: string,
  requirements: CurriculumAiCapturedRequirements,
  requestedPacing: RequestedPacing,
) {
  const loweredTopic = topic.toLowerCase();
  const targetSkillCount = determineFallbackSkillCount(requestedPacing);

  const baseSkills = [
    {
      title: `Build core vocabulary in ${topic.toLowerCase()}`,
      description: "Introduce the words and ideas the learner needs before deeper work begins.",
    },
    {
      title: `Explain foundational concepts in ${topic.toLowerCase()}`,
      description: "Connect big ideas in simple, memorable language.",
    },
    {
      title: `Practice guided application in ${topic.toLowerCase()}`,
      description: "Move from explanation to supported use through short tasks and examples.",
    },
    {
      title: `Strengthen accuracy and fluency in ${topic.toLowerCase()}`,
      description: "Revisit important skills until the learner can use them more smoothly.",
    },
    {
      title: `Use feedback to improve work in ${topic.toLowerCase()}`,
      description: "Build the habit of revising and trying again with specific guidance.",
    },
    {
      title: `Apply ${topic.toLowerCase()} in new situations`,
      description: "Shift from familiar routines to transfer and flexible use.",
    },
    {
      title: `Show independent understanding of ${topic.toLowerCase()}`,
      description: "Create opportunities for the learner to work with less prompting.",
    },
    {
      title: requirements.goals
        ? `Work toward the priority outcome: ${shorten(toSentenceFragment(requirements.goals), 90)}`
        : `Reflect on progress and next steps in ${topic.toLowerCase()}`,
      description: "Keep the visible end goal connected to the weekly work.",
    },
  ];

  const expansions = [
    {
      title: `Review previous learning in ${topic.toLowerCase()}`,
      description: "Use retrieval, review, and light spiral work so earlier learning sticks.",
    },
    {
      title: `Talk through reasoning in ${topic.toLowerCase()}`,
      description: "Make thinking visible through explanation, narration, or discussion.",
    },
    {
      title: `Complete longer practice in ${topic.toLowerCase()}`,
      description: "Sustain attention across slightly larger tasks or project pieces.",
    },
    {
      title: `Use ${topic.toLowerCase()} more creatively`,
      description: "Apply the same learning through open-ended or choice-based work.",
    },
  ];

  return [...baseSkills, ...expansions].slice(0, Math.max(baseSkills.length, targetSkillCount));
}

function buildFallbackMaterials(topic: string, requirements: CurriculumAiCapturedRequirements) {
  const materials: string[] = [];
  const constraintsLower = requirements.constraints.toLowerCase();
  if (constraintsLower.includes("book")) {
    materials.push("family-selected reference book");
  }
  if (constraintsLower.includes("workbook")) {
    materials.push("workbook or printed practice page");
  }

  return materials.length > 0 ? uniqueNonEmpty(materials) : ["notebook", "simple practice materials"];
}

function buildFallbackTitle(topic: string, requirements: CurriculumAiCapturedRequirements) {
  const cleanTopic = toTitleCase(topic);
  if (requirements.goals) {
    return `${cleanTopic} Skill Path`;
  }

  return `${cleanTopic} Learning Journey`;
}

function determineFallbackSkillCount(requestedPacing: RequestedPacing) {
  const targetSessions =
    requestedPacing.explicitlyRequestedTotalSessions ??
    requestedPacing.totalSessionsLowerBound ??
    24;

  return Math.max(6, Math.min(14, Math.ceil(targetSessions / 7)));
}

function estimateFallbackTotalSessions(requestedPacing: RequestedPacing, skillCount: number) {
  if (typeof requestedPacing.explicitlyRequestedTotalSessions === "number") {
    return requestedPacing.explicitlyRequestedTotalSessions;
  }

  if (typeof requestedPacing.totalSessionsLowerBound === "number") {
    return requestedPacing.totalSessionsLowerBound;
  }

  return Math.max(skillCount * 4, 24);
}

function allocateSessionsAcrossUnits(totalSessions: number, unitCount: number) {
  if (unitCount <= 0) {
    return [];
  }

  const base = Math.max(1, Math.floor(totalSessions / unitCount));
  const remainder = totalSessions % unitCount;
  return Array.from({ length: unitCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function estimateLessonMinutes(timeframe: string) {
  const match = timeframe.match(/(\d+)\s*minute/i);
  return match?.[1] ? Number(match[1]) : 30;
}

function estimateWeeksPerUnit(timeframe: string, unitCount: number, index: number) {
  const match = timeframe.match(/(\d+)\s*week/i);
  if (!match?.[1]) {
    return index === unitCount - 1 ? 1 : undefined;
  }

  const totalWeeks = Number(match[1]);
  return Math.max(1, Math.round(totalWeeks / unitCount));
}

function extractTopicLabel(value: string) {
  if (!value.trim()) {
    return "";
  }

  const firstSentence = splitIntoSentences(value)[0] ?? value;
  const normalized = firstSentence
    .replace(
      /^i\s+(?:want|need)\s+to\s+(?:build|create|design|make|learn|study|explore)\s+/i,
      "",
    )
    .replace(
      /^we\s+(?:want|need)\s+to\s+(?:build|create|design|make|learn|study|explore)\s+/i,
      "",
    )
    .replace(/^i\s+(?:want|need)\s+(?:a|an)?\s+/i, "")
    .replace(/^please\s+(?:help\s+)?(?:me\s+)?(?:build|create|design|make)\s+/i, "")
    .trim();

  const curriculumMatch = normalized.match(/^(?:a|an|the)?\s*(.+?)\s+curriculum\b/i);
  if (curriculumMatch?.[1]) {
    return cleanTopicFragment(curriculumMatch[1]);
  }

  const learnMatch = normalized.match(
    /^(?:to\s+)?(?:learn|study|explore)\s+(?:about\s+)?(.+)/i,
  );
  if (learnMatch?.[1]) {
    return cleanTopicFragment(learnMatch[1]);
  }

  const cleaned = normalized
    .replace(/^about\s+/i, "")
    .replace(/^an?\s+/i, "")
    .trim()
    .replace(/[.?!]+$/, "");

  return cleaned.length > 0 ? cleaned : "Custom Study";
}

function inferSubjects(text: string) {
  const value = text.toLowerCase();
  const subjectMatches = [
    { keywords: ["math", "algebra", "geometry", "fractions"], subject: "math" },
    { keywords: ["science", "biology", "chemistry", "physics"], subject: "science" },
    { keywords: ["history", "civics", "government"], subject: "history" },
    { keywords: ["writing", "reading", "literature", "grammar"], subject: "language arts" },
    { keywords: ["logic", "strategy"], subject: "strategy" },
    { keywords: ["art", "drawing", "painting"], subject: "art" },
    { keywords: ["nature", "outdoor", "habitat"], subject: "nature study" },
    { keywords: ["coding", "programming", "computer"], subject: "technology" },
  ];

  const subjects = subjectMatches
    .filter((entry) => entry.keywords.some((keyword) => value.includes(keyword)))
    .map((entry) => entry.subject);

  return subjects.length > 0 ? uniqueNonEmpty(subjects).slice(0, 4) : ["interdisciplinary"];
}

function inferGradeLevels(text: string) {
  const value = text.toLowerCase();
  const matches = new Set<string>();

  const gradeRegexes = [
    /\bgrade\s+(\d{1,2})\b/g,
    /\b(\d{1,2})(?:st|nd|rd|th)\s+grade\b/g,
  ];

  for (const regex of gradeRegexes) {
    for (const match of value.matchAll(regex)) {
      if (match[1]) {
        matches.add(match[1]);
      }
    }
  }

  if (value.includes("kindergarten")) matches.add("K");
  if (value.includes("middle school")) matches.add("6-8");
  if (value.includes("high school")) matches.add("9-12");

  return [...matches].slice(0, 4);
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function shorten(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toSentenceFragment(value: string) {
  return value
    .trim()
    .replace(/^(?:i['’]?d like it to|i want it to|i want to|we want to|the goal is to)\s+/i, "")
    .replace(/[.?!]+$/, "");
}

function normalizeTimeframePhrase(value: string) {
  return toSentenceFragment(value).replace(/^plan\s+for\s+/i, "");
}

function extractMeaningfulKeywords(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)
    .filter((part) => !["learn", "study", "about", "curriculum", "plan", "want", "need"].includes(part));
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }

  return groups.length > 0 ? groups : [items];
}

function splitIntoSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanTopicFragment(value: string) {
  return value
    .replace(/\bfor\s+my\s+child\b.*$/i, "")
    .replace(/\bfor\s+the\s+learner\b.*$/i, "")
    .replace(/\bfor\s+our\s+family\b.*$/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
}

function safeParseJson(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]) as unknown;
      } catch {
        // Fall through to broad JSON extraction below.
      }
    }

    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      return null;
    }

    try {
      return JSON.parse(objectMatch[0]) as unknown;
    } catch {
      return null;
    }
  }
}
