import "@/lib/server-only";

import { getAdapterForTask } from "@/lib/ai/registry";
import { getModelForTask } from "@/lib/ai/provider-adapter";
import { getAiRoutingConfig } from "@/lib/ai/routing";
import type { ChatMessage } from "@/lib/ai/types";
import { resolvePrompt } from "@/lib/prompts/store";
import {
  buildCurriculumCorePrompt,
  buildCurriculumIntakePrompt,
  buildCurriculumProgressionPrompt,
  buildCurriculumRevisionPrompt,
  CURRICULUM_CORE_PROMPT_VERSION,
  CURRICULUM_INTAKE_PROMPT_VERSION,
  CURRICULUM_PROGRESSION_PROMPT_VERSION,
  CURRICULUM_REVISION_PROMPT_VERSION,
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
import {
  buildGranularityGuidance,
  inferCurriculumGranularityProfile,
  type RequestedPacing,
} from "./granularity";
import {
  extractRequestedSubjectLabel,
  countWords,
  hasWrapperLabelSignals,
  isLikelySentenceLabel,
  labelTokenOverlapScore,
  normalizeCurriculumLabel,
  normalizeForComparison,
} from "./labels";
import type { CurriculumTreeNode } from "./types";
import {
  CurriculumAiCapturedRequirementsSchema,
  CurriculumAiChatTurnSchema,
  CurriculumAiGeneratedArtifactSchema,
  CurriculumAiFailureResultSchema,
  CurriculumAiProgressionSchema,
  type CurriculumAiRevisionPlan,
  CurriculumAiRevisionTurnSchema,
  type CurriculumAiPacing,
  type CurriculumAiCapturedRequirements,
  type CurriculumAiChatMessage,
  type CurriculumAiChatTurn,
  type CurriculumAiDocumentNode,
  type CurriculumAiGeneratedArtifact,
  type CurriculumAiCreateResult,
  type CurriculumAiGenerateResult,
  type CurriculumAiFailureResult,
  type CurriculumAiFailureIssue,
  type CurriculumAiRevisionResult,
  type CurriculumAiRevisionTurn,
  type CurriculumAiProgression,
} from "./ai-draft";
import {
  buildRevisionPromptSummary,
  runCurriculumRevisionDecision,
} from "./revision-model";
import {
  validateProgressionSemantics,
  extractLeafSkillTitles,
} from "./progression-validation";
import { assessCurriculumArtifactQuality } from "./quality";

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
    progressionAttemptCount: (generation as any).progressionAttemptCount,
    progressionFailureReason: (generation as any).progressionFailureReason,
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
    loadSnapshot?: typeof buildCurriculumRevisionSnapshot;
    decide?: typeof generateCurriculumRevisionDecision;
    persist?: typeof applyAiDraftArtifactToCurriculumSource;
  },
): Promise<CurriculumAiRevisionResult> {
  const loadSnapshot = deps?.loadSnapshot ?? buildCurriculumRevisionSnapshot;
  const snapshot = await loadSnapshot(params.sourceId, params.householdId);
  const decide = deps?.decide ?? generateCurriculumRevisionDecision;
  const persist = deps?.persist ?? applyAiDraftArtifactToCurriculumSource;
  const decision = await decide({
    learner: params.learner,
    messages: params.messages,
    snapshot,
  });

  if ("kind" in decision) {
    return decision;
  }

  if (decision.action === "clarify") {
    console.info("[curriculum/ai-draft] revision clarified", {
      sourceId: snapshot.source.id,
      changeSummaryCount: decision.changeSummary.length,
    });
    return {
      kind: "clarify",
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

  if (!decision.artifact) {
    return buildCurriculumFailureResult({
      stage: "revision",
      reason: "revision_failed",
      userSafeMessage:
        "I could not apply the revision because the model did not return a usable curriculum artifact.",
      issues: [
        {
          code: "missing_artifact",
          message: "The revision decision did not include an artifact for an apply action.",
          path: [],
        },
      ],
      attemptCount: 1,
      retryable: true,
      debugMetadata: {
        sourceId: snapshot.source.id,
        sourceTitle: snapshot.source.title,
      },
    });
  }

  const progressionResult = await generateCurriculumProgression({
    learner: params.learner,
    artifact: decision.artifact,
  });

  if (progressionResult.progression) {
    decision.artifact.progression = progressionResult.progression;
  }

  console.info("[curriculum/ai-draft] Revision progression pass complete.", {
    sourceId: snapshot.source.id,
    progressionAttempted: progressionResult.attempted,
    progressionAccepted: progressionResult.progression !== null,
    progressionPhaseCount: progressionResult.phaseCount,
    progressionEdgeCount: progressionResult.edgeCount,
    progressionUnresolvedCount: progressionResult.unresolvedCount,
    progressionFailureReason: progressionResult.failureReason ?? "none",
    usingInferredFallback: progressionResult.progression === null,
  });

  const created = await persist({
    householdId: params.householdId,
    sourceId: params.sourceId,
    artifact: decision.artifact,
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
    kind: "applied",
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

export async function generateCurriculumArtifact(
  params: {
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
},
  deps?: {
    resolvePrompt?: typeof resolvePrompt;
    complete?: (options: any) => Promise<{ content: string }>;
  },
): Promise<CurriculumAiGenerateResult> {
  const resolvePromptFn = deps?.resolvePrompt ?? resolvePrompt;
  const prompt = await resolvePromptFn("curriculum.generate.core", CURRICULUM_CORE_PROMPT_VERSION);
  const adapter = getAdapterForTask("curriculum.generate.core");
  const model = getModelForTask("curriculum.generate.core", getAiRoutingConfig());
  const complete = deps?.complete ?? ((options: any) => adapter.complete(options));
  const messages = normalizeMessages(params.messages);
  const capturedRequirements = inferCapturedRequirements(messages);
  const requestedPacing = inferRequestedPacing(messages, capturedRequirements);
  const topic = resolveGenerationTopic(capturedRequirements, messages);
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
  let attempts = 0;
  let stage: CurriculumAiFailureResult["stage"] = "generation";
  let issues: CurriculumAiFailureIssue[] = [];
  let coreArtifact: CurriculumAiGeneratedArtifact | null = null;

  for (const correctionNotes of attemptNotes) {
    attempts += 1;
    try {
      const response = await complete({
        model,
        temperature: 0.4,
        systemPrompt: prompt.systemPrompt,
        messages: [
          {
            role: "user",
            content: buildCurriculumCorePrompt({
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
      if (parsedArtifact.kind !== "success") {
        stage = parsedArtifact.kind === "parse_failure" ? "parse" : "schema";
        issues = parsedArtifact.issues;
        continue;
      }

      const sanitizedArtifact = sanitizeArtifact(parsedArtifact.artifact);
      const titledArtifact = {
        ...sanitizedArtifact,
        source: {
          ...sanitizedArtifact.source,
          title: normalizeCurriculumLabel(sanitizedArtifact.source.title),
        },
      };
      const candidate = normalizeCurriculumArtifactLabels(titledArtifact);
      const qualityIssues = assessCurriculumArtifactQuality(candidate, {
        topicText: topic,
        granularity: granularityProfile,
        requestedPacing,
        revisionMode: "generation",
      });

      if (qualityIssues.length > 0) {
        stage = "quality";
        issues = qualityIssues.map((qi) => ({
          code: qi.code,
          message: qi.message,
          path: qi.path ?? [],
        }));
        console.warn("[curriculum/ai-draft] curriculum artifact failed quality check", {
          attempt: attempts,
          issueCount: qualityIssues.length,
          issues: issues.slice(0, 5),
        });
        continue;
      }

      coreArtifact = candidate;
      break;
    } catch (error) {
      stage = "generation";
      issues = [
        {
          code: "model_error",
          message: error instanceof Error ? error.message : "The model call failed.",
          path: [],
        },
      ];
      console.error("[curriculum/ai-draft] Artifact core generation failed, retrying.", error);
    }
  }

  if (coreArtifact) {
    const progressionResult = await generateCurriculumProgression({
      learner: params.learner,
      artifact: coreArtifact,
    }, deps);

    if (progressionResult.progression) {
      coreArtifact.progression = progressionResult.progression;
    }

    console.info("[curriculum/ai-draft] Core generation complete.", {
      progressionAttempted: progressionResult.attempted,
      progressionAccepted: progressionResult.progression !== null,
      progressionPhaseCount: progressionResult.phaseCount,
      progressionEdgeCount: progressionResult.edgeCount,
      progressionUnresolvedCount: progressionResult.unresolvedCount,
      progressionFailureReason: progressionResult.failureReason ?? "none",
      progressionAttemptCount: progressionResult.attemptCount,
      usingInferredFallback: progressionResult.progression === null,
    });

    const successResult: CurriculumAiGenerateResult & {
      progressionAttemptCount: number;
      progressionFailureReason: string | null;
    } = {
      kind: "success",
      artifact: coreArtifact,
      progressionAttemptCount: progressionResult.attemptCount,
      progressionFailureReason: progressionResult.failureReason,
    };
    return successResult;
  }

  console.error("[curriculum/ai-draft] curriculum artifact failure", {
    stage,
    reason:
      stage === "parse"
        ? "parse_failed"
        : stage === "schema"
          ? "schema_failed"
          : stage === "quality"
            ? "quality_failed"
            : "generation_failed",
    issueCount: issues.length,
  });

  return buildCurriculumFailureResult({
    stage,
    reason:
      stage === "parse"
        ? "parse_failed"
        : stage === "schema"
          ? "schema_failed"
          : stage === "quality"
            ? "quality_failed"
            : "generation_failed",
    userSafeMessage:
      stage === "parse"
        ? "I could not parse a valid curriculum from the model response. Please try again."
        : stage === "schema"
          ? "I could not validate the curriculum structure from the model response. Please try again."
          : stage === "quality"
            ? "The generated curriculum did not meet quality requirements. Please try again or rephrase your request."
            : "I could not produce a valid curriculum from the model response. Please try again.",
    issues,
    attemptCount: attempts,
    retryable: true,
    debugMetadata: {
      promptVersion: CURRICULUM_CORE_PROMPT_VERSION,
      topic,
      capturedRequirements,
      requestedPacing,
      granularityProfile,
    },
  });
}

export interface ProgressionGenerateResult {
  progression: CurriculumAiProgression | null;
  attempted: boolean;
  parsed: boolean;
  semanticValidation: boolean | null;
  phaseCount: number;
  edgeCount: number;
  unresolvedCount: number;
  failureReason: string | null;
  attemptCount: number;
}

export async function generateCurriculumProgression(
  params: {
    learner: { displayName: string };
    artifact: CurriculumAiGeneratedArtifact;
    /** Optional: pre-computed skill refs with stable IDs (for the regeneration path). */
    skillRefs?: Array<{ skillId: string; skillTitle: string }>;
  },
  deps?: {
    resolvePrompt?: typeof resolvePrompt;
    complete?: (options: any) => Promise<{ content: string }>;
  },
): Promise<ProgressionGenerateResult> {
  const resolvePromptFn = deps?.resolvePrompt ?? resolvePrompt;
  const prompt = await resolvePromptFn("curriculum.generate.progression", CURRICULUM_PROGRESSION_PROMPT_VERSION);
  const adapter = getAdapterForTask("curriculum.generate.progression");
  const model = getModelForTask("curriculum.generate.progression", getAiRoutingConfig());
  const complete = deps?.complete ?? ((options: any) => adapter.complete(options));
  const leafSkillTitles = params.skillRefs
    ? params.skillRefs.map((r) => r.skillTitle)
    : extractLeafSkillTitles(params.artifact.document);

  console.info("[curriculum/ai-draft] progression generation started", {
    learner: params.learner.displayName,
    leafSkillCount: leafSkillTitles.length,
    model,
  });

  const attemptNotes: string[][] = [
    // attempt 1: no correction notes
    [],
    // attempt 2: basic title-matching correction
    [
      "Ensure ALL skill titles match EXACTLY the titles in the authoritative leaf skill list.",
      "Copy the exact string from the list — do not paraphrase, abbreviate, or rephrase.",
      "Avoid cycles in hard prerequisites.",
      "Every phase must include at least one skill from the authoritative list.",
    ],
    // attempt 3: stricter coverage and cycle guidance
    [
      "CRITICAL: Every skillTitle, fromSkillTitle, and toSkillTitle must be an exact copy from the numbered list. No paraphrasing.",
      "Check for prerequisite cycles: if A→B and B→C then C→A is a cycle and invalid.",
      "Assign ALL skills from the list to at least one phase — do not leave any skill unphased.",
      "Phases must cover at least 40% of skills from the list.",
    ],
    // attempt 4: minimal safe output instruction
    [
      "Simplify: produce the minimum number of phases needed (2-3 phases), assign every skill to exactly one phase.",
      "Use only 'hardPrerequisite' and 'recommendedBefore' edge kinds.",
      "Do NOT create any edges between skills in the same phase.",
      "Triple-check: every title is a character-for-character copy from the authoritative skill list.",
    ],
    // attempt 5: last resort — minimal valid output
    [
      "FINAL ATTEMPT: Return the simplest valid progression.",
      "Create exactly 2 phases: Phase 1 for foundational skills, Phase 2 for advanced skills.",
      "Add only 1-3 clear hardPrerequisite edges between the most obviously sequential skill pairs.",
      "Every title must match the list exactly — copy-paste each one.",
    ],
  ];
  let attempts = 0;
  let lastFailureReason: string | null = null;

  for (const correctionNotes of attemptNotes) {
    attempts += 1;
    try {
      const correctionBlock =
        correctionNotes.length > 0
          ? `\n\nCorrection notes for this retry:\n${correctionNotes.map((note, i) => `${i + 1}. ${note}`).join("\n")}`
          : "";

      const response = await complete({
        model,
        temperature: 0.2,
        systemPrompt: prompt.systemPrompt,
        messages: [
          {
            role: "user",
            content:
              buildCurriculumProgressionPrompt({
                learnerName: params.learner.displayName,
                coreArtifact: params.artifact,
                leafSkillTitles,
                skillRefs: params.skillRefs,
              }) + correctionBlock,
          },
        ],
      });

      const parsed = parseCurriculumProgression(response.content);
      if (parsed.kind !== "success") {
        lastFailureReason = `${parsed.kind} on attempt ${attempts}`;
        console.warn("[curriculum/ai-draft] Progression parse/schema failed.", {
          attempt: attempts,
          kind: parsed.kind,
          issues: parsed.issues,
        });
        continue;
      }

      // Semantic validation
      const validation = validateProgressionSemantics(parsed.progression, leafSkillTitles);
      const { summary } = validation;

      console.info("[curriculum/ai-draft] progression semantic validation", {
        attempt: attempts,
        valid: validation.valid,
        skillsInCurriculum: summary.skillsInCurriculum,
        skillsAssignedToPhases: summary.skillsAssignedToPhases,
        edgesAccepted: summary.edgesAccepted,
        edgesDropped: summary.edgesDropped,
        unresolvedEdgeEndpoints: summary.unresolvedEdgeEndpoints,
        unresolvedPhaseSkills: summary.unresolvedPhaseSkills,
        hardPrerequisiteEdges: summary.hardPrerequisiteEdges,
        phaseCount: summary.phaseCount,
        issues: validation.issues.map((issue) => ({ code: issue.code, message: issue.message })),
      });

      if (!validation.valid) {
        const blockingIssues = validation.issues.filter(
          (issue) =>
            issue.code === "hard_prerequisite_cycle" ||
            issue.code === "self_loop" ||
            issue.code === "empty_phases",
        );
        lastFailureReason = `semantic validation failed on attempt ${attempts}: ${blockingIssues.map((issue) => issue.code).join(", ")}`;
        console.warn("[curriculum/ai-draft] Progression semantic validation blocked.", {
          attempt: attempts,
          blockingIssues: blockingIssues.map((issue) => ({ code: issue.code, message: issue.message })),
        });
        continue;
      }

      // Quality threshold: non-empty phases and minimal skill coverage for non-trivial curricula
      const totalSkills = leafSkillTitles.length;
      const minPhaseCoverage = totalSkills >= 4 ? Math.ceil(totalSkills * 0.4) : 0;
      if (summary.phaseCount === 0 && totalSkills > 0) {
        lastFailureReason = `no phases generated on attempt ${attempts}`;
        console.warn("[curriculum/ai-draft] Progression has no phases, retrying.", { attempt: attempts, totalSkills });
        continue;
      }
      if (summary.skillsAssignedToPhases < minPhaseCoverage) {
        lastFailureReason = `insufficient phase coverage on attempt ${attempts}: ${summary.skillsAssignedToPhases}/${totalSkills} skills assigned`;
        console.warn("[curriculum/ai-draft] Progression phase coverage below threshold, retrying.", {
          attempt: attempts,
          skillsAssignedToPhases: summary.skillsAssignedToPhases,
          totalSkills,
          minPhaseCoverage,
        });
        continue;
      }

      console.info("[curriculum/ai-draft] Progression accepted.", {
        attempt: attempts,
        summary,
      });

      return {
        progression: parsed.progression,
        attempted: true,
        parsed: true,
        semanticValidation: true,
        phaseCount: summary.phaseCount,
        edgeCount: summary.edgesAccepted,
        unresolvedCount: summary.unresolvedEdgeEndpoints + summary.unresolvedPhaseSkills,
        failureReason: null,
        attemptCount: attempts,
      };
    } catch (error) {
      lastFailureReason = `model call failed on attempt ${attempts}`;
      console.error("[curriculum/ai-draft] Progression generation failed attempt.", {
        attempt: attempts,
        error,
      });
    }
  }

  // All attempts exhausted — log explicitly, do not silently succeed
  console.error("[curriculum/ai-draft] Progression generation failed after all attempts. Planning will fall back to inferred order.", {
    leafSkillCount: leafSkillTitles.length,
    attempts,
    lastFailureReason,
  });

  return {
    progression: null,
    attempted: true,
    parsed: false,
    semanticValidation: null,
    phaseCount: 0,
    edgeCount: 0,
    unresolvedCount: 0,
    failureReason: lastFailureReason,
    attemptCount: attempts,
  };
}

async function generateCurriculumRevisionDecision(params: {
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
  snapshot: CurriculumRevisionSnapshot;
}): Promise<CurriculumAiRevisionTurn | CurriculumAiFailureResult> {
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
  return normalizeCurriculumArtifactLabels({
    source: {
      ...artifact.source,
      title: normalizeCurriculumLabel(artifact.source.title),
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
        title: normalizeCurriculumLabel(lesson.title),
        description: lesson.description.trim(),
        subject: lesson.subject?.trim() || undefined,
        materials: uniqueNonEmpty(lesson.materials),
        objectives: uniqueNonEmpty(lesson.objectives),
        linkedSkillTitles: uniqueNonEmpty(lesson.linkedSkillTitles.map((title) => normalizeCurriculumLabel(title))),
      })),
    })),
  });
}

function normalizeCurriculumArtifactLabels(
  artifact: CurriculumAiGeneratedArtifact,
): CurriculumAiGeneratedArtifact {
  return {
    ...artifact,
    source: {
      ...artifact.source,
      title: normalizeCurriculumLabel(artifact.source.title),
    },
    document: normalizeCurriculumDocumentLabels(artifact.document),
    units: artifact.units.map((unit) => ({
      ...unit,
      title: normalizeCurriculumLabel(unit.title),
      lessons: unit.lessons.map((lesson) => ({
        ...lesson,
        title: normalizeCurriculumLabel(lesson.title),
        subject: lesson.subject?.trim() || undefined,
        linkedSkillTitles: uniqueNonEmpty(
          lesson.linkedSkillTitles.map((title) => normalizeCurriculumLabel(title)),
        ),
      })),
    })),
  };
}

function normalizeCurriculumDocumentLabels(
  node: CurriculumAiGeneratedArtifact["document"],
): CurriculumAiGeneratedArtifact["document"] {
  const next: CurriculumAiGeneratedArtifact["document"] = {};

  for (const [key, value] of Object.entries(node)) {
    const normalizedKey = normalizeCurriculumLabel(key);
    if (!normalizedKey) {
      continue;
    }

    next[normalizedKey] = normalizeCurriculumDocumentValue(value);
  }

  return next;
}

function normalizeCurriculumDocumentValue(
  value: unknown,
): CurriculumAiDocumentNode {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return uniqueNonEmpty(value.map((item) => normalizeCurriculumLabel(String(item ?? ""))));
  }

  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = normalizeCurriculumLabel(key);
      if (!normalizedKey) {
        continue;
      }
      next[normalizedKey] = normalizeCurriculumDocumentValue(child);
    }
    return next as CurriculumAiDocumentNode;
  }

  return typeof value === "string" ? value : "";
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

export function parseCurriculumGeneratedArtifact(content: string):
  | {
      kind: "success";
      artifact: CurriculumAiGeneratedArtifact;
    }
  | {
      kind: "parse_failure";
      issues: CurriculumAiFailureIssue[];
    }
  | {
      kind: "schema_failure";
      issues: CurriculumAiFailureIssue[];
    } {
  const parsed = safeParseJson(content);
  if (!parsed) {
    return {
      kind: "parse_failure",
      issues: [
        {
          code: "parse_failed",
          message: "The model response could not be parsed as JSON.",
          path: [],
        },
      ],
    };
  }

  const validated = CurriculumAiGeneratedArtifactSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      kind: "schema_failure",
      issues: validated.error.issues.map((issue) => ({
        code: "schema_failed",
        message: issue.message,
        path: issue.path.map((segment) => String(segment)),
      })),
    };
  }

  return {
    kind: "success",
    artifact: validated.data,
  };
}

export function parseCurriculumProgression(content: string):
  | {
      kind: "success";
      progression: CurriculumAiProgression;
    }
  | {
      kind: "parse_failure";
      issues: CurriculumAiFailureIssue[];
    }
  | {
      kind: "schema_failure";
      issues: CurriculumAiFailureIssue[];
    } {
  const parsed = safeParseJson(content);
  if (!parsed) {
    return {
      kind: "parse_failure",
      issues: [
        {
          code: "parse_failed",
          message: "The progression response could not be parsed as JSON.",
          path: [],
        },
      ],
    };
  }

  const data = (parsed as any).progression ?? parsed;
  const validated = CurriculumAiProgressionSchema.safeParse(data);
  if (!validated.success) {
    return {
      kind: "schema_failure",
      issues: validated.error.issues.map((issue) => ({
        code: "schema_failed",
        message: issue.message,
        path: issue.path.map((segment) => String(segment)),
      })),
    };
  }

  return {
    kind: "success",
    progression: validated.data,
  };
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

export function buildFallbackChatTurn(params: {
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

function inferCapturedRequirements(messages: ChatMessage[]): CurriculumAiCapturedRequirements {
  const userMessages = collectUserMessages(messages);
  const combined = userMessages.join(" ");
  const openingMessage = userMessages[0] ?? "";
  const openingSentences = splitIntoSentences(openingMessage);
  const openingTopicSentence = openingSentences[0] ?? openingMessage;
  const openingGoalRemainder = openingSentences.slice(1).join(" ").trim();

  const requirements = {
    topic:
      extractRequestedSubjectLabel(openingTopicSentence) ??
      extractRequestedSubjectLabel(combined) ??
      "",
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

function resolveGenerationTopic(
  requirements: CurriculumAiCapturedRequirements,
  messages: ChatMessage[],
) {
  const candidates = [
    requirements.topic,
    extractRequestedSubjectLabel(collectUserMessages(messages).join(" ")),
    extractRequestedSubjectLabel(messages.map((message) => message.content).join(" ")),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return "";
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

function normalizeMessages(messages: CurriculumAiChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));
}

function buildCurriculumFailureResult(params: {
  stage: CurriculumAiFailureResult["stage"];
  reason: string;
  userSafeMessage: string;
  issues: CurriculumAiFailureIssue[];
  attemptCount: number;
  retryable: boolean;
  debugMetadata?: Record<string, unknown>;
}): CurriculumAiFailureResult {
  const result = CurriculumAiFailureResultSchema.parse({
    kind: "failure",
    stage: params.stage,
    reason: params.reason,
    userSafeMessage: params.userSafeMessage,
    issues: uniqueFailures(params.issues),
    attemptCount: params.attemptCount,
    retryable: params.retryable,
    debugMetadata: params.debugMetadata,
  });

  console.warn("[curriculum/ai-draft] curriculum artifact failure", {
    stage: result.stage,
    reason: result.reason,
    attemptCount: result.attemptCount,
    retryable: result.retryable,
    promptVersion: result.debugMetadata?.promptVersion,
    issueSummary: result.issues.map((issue) => issue.message),
  });

  return result;
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

function firstNumberMatch(value: string, pattern: RegExp) {
  const match = value.match(pattern)?.[1];
  return match ? Number(match) : undefined;
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[0]?.trim() ?? "";
}

function extractTopicLabel(value: string) {
  return extractRequestedSubjectLabel(value) ?? "";
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
function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueFailures(values: CurriculumAiFailureIssue[]) {
  const seen = new Set<string>();
  const unique: CurriculumAiFailureIssue[] = [];

  for (const value of values) {
    const key = `${value.code}:${value.path.join(" > ")}:${value.message}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(value);
  }

  return unique;
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
