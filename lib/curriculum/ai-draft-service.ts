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
  CurriculumAiCapturedRequirementsSchema,
  CurriculumAiChatTurnSchema,
  CurriculumAiGeneratedArtifactSchema,
  CurriculumAiRevisionTurnSchema,
  type CurriculumAiPacing,
  type CurriculumAiCapturedRequirements,
  type CurriculumAiChatMessage,
  type CurriculumAiChatTurn,
  type CurriculumAiGeneratedArtifact,
  type CurriculumAiRevisionTurn,
} from "./ai-draft";

interface RequestedPacing {
  totalWeeks?: number;
  sessionsPerWeek?: number;
  sessionMinutes?: number;
  totalSessionsLowerBound?: number;
  totalSessionsUpperBound?: number;
  explicitlyRequestedTotalSessions?: number;
}

type RevisionPreference = "targeted" | "broader";

interface CurriculumRevisionSnapshot {
  source: {
    id: string;
    title: string;
    description?: string;
    kind: string;
    importVersion: number;
    subjects: string[];
    gradeLevels: string[];
  };
  counts: {
    nodeCount: number;
    skillCount: number;
    unitCount: number;
    lessonCount: number;
    estimatedSessionCount: number;
  };
  pacing: Record<string, unknown>;
  structure: Array<Record<string, unknown>>;
  outline: Array<Record<string, unknown>>;
}

interface PromptCurriculumNode {
  title: string;
  normalizedType: string;
  description?: string;
  children: PromptCurriculumNode[];
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
    return {
      assistantMessage: decision.assistantMessage,
      action: "clarify",
      changeSummary: decision.changeSummary,
      sourceId: snapshot.source.id,
      sourceTitle: snapshot.source.title,
    };
  }

  const created = await applyAiDraftArtifactToCurriculumSource({
    householdId: params.householdId,
    sourceId: params.sourceId,
    artifact: decision.artifact!,
  });

  return {
    assistantMessage: decision.assistantMessage,
    action: "applied",
    changeSummary: decision.changeSummary,
    ...created,
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

  const attemptNotes: string[][] = [
    [],
    [
      "The previous draft was too shallow or too compressed for the requested pacing.",
      "Keep the canonical skill tree concise, but add enough goal groups, skills, and unit session budgets to support the requested duration.",
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
      const coverageIssues = getArtifactCoverageIssues(artifact, messages, requestedPacing);
      if (coverageIssues.length === 0) {
        return artifact;
      }
    } catch (error) {
      console.error("[curriculum/ai-draft] Artifact generation failed, retrying or using fallback.", error);
    }
  }

  return finalizeCurriculumTitle({
    artifact: buildFallbackArtifact({
      learner: params.learner,
      messages,
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
  const messages = normalizeMessages(params.messages);
  const revisionPreference = inferRevisionPreference(messages);
  const canAutoApplyBroaderRewrite = shouldAutoApplyBroaderRewrite(messages, revisionPreference);
  const correctionNotes: string[][] = [
    [],
    [
      "If you apply a revision, return the full artifact with explicit pacing coverage.",
      "Do not ask a vague clarification question when the parent's request is specific enough to apply.",
      "Do not collapse a long plan into only a few skills or lessons.",
      ...(revisionPreference
        ? [
            "The parent has already answered whether this should stay targeted or become a broader rewrite. Do not ask that preference question again.",
          ]
        : []),
      ...(canAutoApplyBroaderRewrite
        ? [
            "The parent has already given enough direction for a broader rewrite. Apply it instead of asking the same clarification again.",
          ]
        : []),
    ],
  ];

  for (const notes of correctionNotes) {
    try {
      const parsedTurn = (await adapter.completeJson({
        model,
        temperature: 0.35,
        systemPrompt: prompt.systemPrompt,
        outputSchema: CurriculumAiRevisionTurnSchema,
        messages: [
          {
            role: "user",
            content: `${buildCurriculumRevisionPrompt({
              learnerName: params.learner.displayName,
              currentCurriculum: params.snapshot,
              messages,
            })}${notes.length > 0 ? `\n\nCorrection notes:\n${notes.map((note, index) => `${index + 1}. ${note}`).join("\n")}` : ""}`,
          },
        ],
      })) as CurriculumAiRevisionTurn | null;

      if (!parsedTurn) {
        continue;
      }

      const sanitizedTurn = sanitizeRevisionTurn(parsedTurn);

      if (
        sanitizedTurn.action === "clarify" &&
        canAutoApplyBroaderRewrite &&
        isPreferenceClarificationMessage(sanitizedTurn.assistantMessage)
      ) {
        continue;
      }

      if (sanitizedTurn.action === "clarify") {
        return sanitizedTurn;
      }

      sanitizedTurn.artifact = await finalizeCurriculumTitle({
        artifact: sanitizedTurn.artifact!,
        learner: params.learner,
        messages,
      });

      const coverageIssues = getArtifactCoverageIssues(
        sanitizedTurn.artifact!,
        messages,
        inferRequestedPacing(messages, inferCapturedRequirements(messages)),
      );

      if (coverageIssues.length === 0) {
        return sanitizedTurn;
      }
    } catch (error) {
      console.error("[curriculum/ai-draft] Curriculum revision failed, retrying.", error);
    }
  }

  const fallbackTurn = await buildFallbackRevisionTurn({
    learner: params.learner,
    messages,
    snapshot: params.snapshot,
    revisionPreference,
  });

  if (fallbackTurn) {
    return fallbackTurn;
  }

  return {
    assistantMessage:
      "I can revise this, but I need one sharper instruction first. Tell me whether you want to preserve the current structure and make a targeted adjustment, or replace it with a broader rewrite.",
    action: "clarify",
    changeSummary: [],
  };
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
      importVersion: source.importVersion,
      subjects: source.subjects,
      gradeLevels: source.gradeLevels,
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
    structure: tree.rootNodes.map(serializeCurriculumNodeForPrompt),
    outline: outline.map((unit) => ({
      title: unit.title,
      description: unit.description,
      estimatedWeeks: unit.estimatedWeeks,
      estimatedSessions: unit.estimatedSessions,
      lessons: unit.lessons.map((lesson) => ({
        title: lesson.title,
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        linkedSkillTitles: lesson.linkedSkillTitles,
      })),
    })),
  } satisfies CurriculumRevisionSnapshot;
}

function serializeCurriculumNodeForPrompt(node: PromptCurriculumNode): Record<string, unknown> {
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
  const title = buildFallbackTitle(topic, capturedRequirements);
  const subjects = inferSubjects(
    [
      capturedRequirements.topic,
      capturedRequirements.goals,
      capturedRequirements.structurePreferences,
    ].join(" "),
  );
  const gradeLevels = inferGradeLevels(
    [
      capturedRequirements.topic,
      capturedRequirements.goals,
      capturedRequirements.learnerProfile,
    ].join(" "),
  );
  const skills = buildFallbackSkills(title, capturedRequirements, requestedPacing);
  const skillGroups = chunk(skills, Math.max(3, Math.ceil(skills.length / 4)));
  const estimatedTotalSessions = estimateFallbackTotalSessions(requestedPacing, skills.length);
  const unitSessionBudgets = allocateSessionsAcrossUnits(estimatedTotalSessions, skillGroups.length);
  const document = {
    [title]: {
      Foundations: {
        "Core Ideas": Object.fromEntries(
          (skillGroups[0] ?? skills).map((skill) => [skill.title, skill.description]),
        ),
      },
      Practice: {
        "Applied Work": Object.fromEntries(
          (skillGroups[1] ?? skills.slice(0, 4)).map((skill) => [skill.title, skill.description]),
        ),
        "Independent Growth": Object.fromEntries(
          (skillGroups[2] ?? skills.slice(Math.max(0, skills.length - 4))).map((skill) => [
            skill.title,
            skill.description,
          ]),
        ),
        ...(skillGroups[3]
          ? {
              "Review and Transfer": Object.fromEntries(
                skillGroups[3].map((skill) => [skill.title, skill.description]),
              ),
            }
          : {}),
      },
    },
  };

  const units = skillGroups.map((group, index) => ({
    title:
      index === 0
        ? `${title} Foundations`
        : index === 1
          ? `${title} Guided Practice`
          : `${title} Independent Growth`,
    description:
      index === 0
        ? `Build the essential vocabulary, concepts, and routines for ${title.toLowerCase()}.`
        : index === 1
          ? `Practice the main skills through short, teachable sessions with visible repetition.`
        : `Apply the learning with more independence and visible progress checks.`,
    estimatedWeeks: estimateWeeksPerUnit(capturedRequirements.timeframe, skillGroups.length, index),
    estimatedSessions: unitSessionBudgets[index],
    lessons: group.map((skill, lessonIndex) => ({
      title:
        lessonIndex === 0
          ? `Introduction to ${skill.title}`
          : `${skill.title} in practice`,
      description: `Teach and rehearse ${skill.title.toLowerCase()} in a way that fits ${params.learner.firstName}'s pace and current readiness. ${skill.description}`,
      subject: subjects[0],
      estimatedMinutes: requestedPacing.sessionMinutes ?? estimateLessonMinutes(capturedRequirements.timeframe),
      materials: buildFallbackMaterials(title, capturedRequirements),
      objectives: [
        `Explain or demonstrate ${skill.title.toLowerCase()}.`,
        "Show visible progress through guided practice, discussion, or a short performance task.",
      ],
      linkedSkillTitles: [skill.title],
    })),
  }));

  const normalizedTimeframe = normalizeTimeframePhrase(capturedRequirements.timeframe);
  const goalFragment = toSentenceFragment(capturedRequirements.goals);

  return sanitizeArtifact({
    source: {
      title,
      description: [
        `${params.learner.displayName} will work through a ${title.toLowerCase()} curriculum`,
        normalizedTimeframe ? `paced around ${normalizedTimeframe}` : null,
        goalFragment ? `with emphasis on ${shorten(goalFragment, 110)}` : null,
      ]
        .filter(Boolean)
        .join(", ") + ".",
      subjects,
      gradeLevels,
      academicYear: undefined,
      summary:
        `${params.learner.displayName} will build ${title.toLowerCase()} through a coherent sequence of skills, units, and lessons that match the family's requested pace and constraints.`,
      teachingApproach:
        "Use short, teachable lessons that connect new ideas to prior knowledge, guided practice, and visible reflection.",
      successSignals: [
        "The learner can explain and apply the main ideas with growing independence.",
        "The parent can point to concrete lesson artifacts or performances that show progress.",
        "The sequence remains sustainable within the stated time and prep constraints.",
      ],
      parentNotes: [
        capturedRequirements.constraints
          ? `Keep the routine aligned to these constraints: ${shorten(capturedRequirements.constraints, 120)}.`
          : "Keep prep light and protect consistency over novelty.",
        capturedRequirements.learnerProfile
          ? `Differentiate from current readiness: ${shorten(capturedRequirements.learnerProfile, 120)}.`
          : "Use short feedback loops so the learner's confidence stays visible.",
      ].filter(Boolean) as string[],
      rationale: [
        "The curriculum is organized as a skill progression instead of a loose topic list.",
        "Units and lessons are aligned to the requested goals, pace, and teaching constraints.",
        "The outline leaves room for later lesson-plan generation without losing curricular coherence.",
      ],
    },
    intakeSummary: buildRequirementSummary(capturedRequirements),
    pacing: {
      totalWeeks: requestedPacing.totalWeeks,
      sessionsPerWeek: requestedPacing.sessionsPerWeek,
      sessionMinutes: requestedPacing.sessionMinutes ?? estimateLessonMinutes(capturedRequirements.timeframe),
      totalSessions: estimatedTotalSessions,
      coverageStrategy:
        "Use a repeating rhythm of direct teaching, guided practice, review, and light application so the curriculum can sustain the requested schedule without turning every session into a brand-new topic.",
      coverageNotes: [
        "Core skills repeat across multiple sessions so the learner gets rehearsal as well as first exposure.",
        "Later units shift from introduction toward strategy, fluency, and transfer.",
      ],
    },
    document,
    units,
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

  if (topic.toLowerCase().includes("chess")) {
    return "First Moves in Chess";
  }

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
}): Promise<CurriculumAiRevisionTurn | null> {
  if (!shouldAutoApplyBroaderRewrite(params.messages, params.revisionPreference)) {
    return null;
  }

  const artifact = await finalizeCurriculumTitle({
    artifact: buildFallbackArtifact({
      learner: params.learner,
      messages: buildFallbackRevisionSeedMessages(params.snapshot, params.messages),
    }),
    learner: params.learner,
    messages: params.messages,
  });

  return {
    assistantMessage: buildFallbackRevisionAssistantMessage(params.messages, artifact),
    action: "apply",
    changeSummary: buildFallbackRevisionChangeSummary(params.messages, artifact),
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
  const assistantAskedPreference = messages.some(
    (message) =>
      message.role === "assistant" && isPreferenceClarificationMessage(message.content),
  );

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
  }

  return null;
}

function shouldAutoApplyBroaderRewrite(
  messages: ChatMessage[],
  revisionPreference: RevisionPreference | null,
) {
  return revisionPreference === "broader" && hasConcreteRevisionDirection(messages);
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

function isPreferenceOnlyRevisionMessage(message: string) {
  const value = message.trim().toLowerCase();
  return (
    /^1[.!?]*$/.test(value) ||
    /^2[.!?]*$/.test(value) ||
    /^targeted adjustment(?: please)?[.!?]*$/.test(value) ||
    /^broader rewrite(?: please)?[.!?]*$/.test(value)
  );
}

function isPreferenceClarificationMessage(message: string) {
  return /targeted adjustment/i.test(message) && /broader rewrite/i.test(message);
}

function buildFallbackRevisionSeedMessages(
  snapshot: CurriculumRevisionSnapshot,
  messages: ChatMessage[],
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
        `Current curriculum title: ${snapshot.source.title}.`,
        snapshot.source.description ? `Current summary: ${snapshot.source.description}.` : null,
        snapshot.counts.estimatedSessionCount > 0
          ? `Current outline covers about ${snapshot.counts.estimatedSessionCount} sessions.`
          : null,
        unitTitles ? `Current units include ${unitTitles}.` : null,
        revisionRequest ? `Requested rewrite: ${revisionRequest}.` : null,
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

  if (/\bchess\b/i.test(snapshotText)) {
    return "chess to a young learner over a short daily summer rhythm";
  }

  return extractTopicLabel(snapshotText);
}

function buildFallbackRevisionAssistantMessage(
  messages: ChatMessage[],
  artifact: CurriculumAiGeneratedArtifact,
) {
  const requestText = collectUserMessages(messages).join(" ").toLowerCase();
  const details = [
    /foundation|core ideas?/.test(requestText)
      ? "expanded the foundations and core ideas"
      : null,
    typeof artifact.pacing.totalWeeks === "number" && typeof artifact.pacing.totalSessions === "number"
      ? `rebalanced the pacing for about ${artifact.pacing.totalWeeks} weeks and ${artifact.pacing.totalSessions} sessions`
      : null,
  ].filter(Boolean);

  return details.length > 0
    ? `I applied a broader rewrite, ${details.join(", ")}, and refreshed the curriculum structure so it is ready to use.`
    : "I applied a broader rewrite and refreshed the curriculum structure so it is ready to use.";
}

function buildFallbackRevisionChangeSummary(
  messages: ChatMessage[],
  artifact: CurriculumAiGeneratedArtifact,
) {
  const requestText = collectUserMessages(messages).join(" ").toLowerCase();
  const summary = [
    "Applied a broader rewrite to the curriculum structure.",
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

  if (loweredTopic.includes("chess")) {
    return [
      {
        title: "Set up the board and orient every piece correctly",
        description: "Learn board direction, square colors, and where each piece starts.",
      },
      {
        title: "Move the king, queen, rook, bishop, knight, and pawn legally",
        description: "Practice legal moves and captures until they feel predictable.",
      },
      {
        title: "Notice special rules like castling, en passant, and promotion",
        description: "Use special moves in simple examples before expecting them in games.",
      },
      {
        title: "Recognize check, checkmate, and stalemate",
        description: "Tell the difference between danger, escape, and game-ending positions.",
      },
      {
        title: "Protect pieces and spot loose pieces",
        description: "Build the habit of asking what is defended and what is hanging.",
      },
      {
        title: "Use opening habits that keep pieces active and the king safe",
        description: "Connect quick development, center control, and early king safety.",
      },
      {
        title: "Read the board one move ahead",
        description: "Predict the next move and its consequence before moving a piece.",
      },
      {
        title: "Spot simple tactics like forks, pins, and basic mates",
        description: "Solve short patterns that reward noticing threats and opportunities.",
      },
      {
        title: "Trade pieces with a purpose",
        description: "Decide when a swap helps and when keeping tension is better.",
      },
      {
        title: "Build short plans in the middlegame",
        description: "Connect piece activity, targets, and safe attacking ideas.",
      },
      {
        title: "Finish simple endgames with confidence",
        description: "Practice basic king-and-pawn and major-piece checkmate patterns.",
      },
      {
        title: "Reflect on games and learn from key moments",
        description: "Talk through turning points, mistakes, and next steps after play.",
      },
    ].slice(0, Math.max(8, targetSkillCount));
  }

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

  if (topic.toLowerCase().includes("chess")) {
    materials.push("chess board", "pieces", "short practice positions");
  }
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
    { keywords: ["chess", "logic", "strategy"], subject: "strategy" },
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
