import "server-only";

import { getAdapterForTask } from "@/lib/ai/registry";
import { getModelForTask } from "@/lib/ai/provider-adapter";
import { getAiRoutingConfig } from "@/lib/ai/routing";
import type { ChatMessage } from "@/lib/ai/types";
import { resolvePrompt } from "@/lib/prompts/store";
import {
  buildCurriculumGenerationPrompt,
  buildCurriculumIntakePrompt,
  CURRICULUM_GENERATION_PROMPT_VERSION,
  CURRICULUM_INTAKE_PROMPT_VERSION,
} from "@/lib/prompts/curriculum-draft";
import type { AppLearner } from "@/lib/users/service";

import {
  createCurriculumSourceFromAiDraftArtifact,
  type CreatedAiDraftCurriculumResult,
} from "./service";
import {
  CurriculumAiCapturedRequirementsSchema,
  CurriculumAiChatTurnSchema,
  CurriculumAiGeneratedArtifactSchema,
  type CurriculumAiCapturedRequirements,
  type CurriculumAiChatMessage,
  type CurriculumAiChatTurn,
  type CurriculumAiGeneratedArtifact,
} from "./ai-draft";

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

async function generateCurriculumArtifact(params: {
  learner: AppLearner;
  messages: CurriculumAiChatMessage[];
}): Promise<CurriculumAiGeneratedArtifact> {
  const prompt = await resolvePrompt("curriculum.generate", CURRICULUM_GENERATION_PROMPT_VERSION);
  const adapter = getAdapterForTask("curriculum.generate");
  const model = getModelForTask("curriculum.generate", getAiRoutingConfig());
  const messages = normalizeMessages(params.messages);

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
          }),
        },
      ],
    });

    const parsedArtifact = parseCurriculumGeneratedArtifact(response.content);
    if (parsedArtifact) {
      const artifact = sanitizeArtifact(parsedArtifact);
      if (artifactMatchesConversation(artifact, messages)) {
        return artifact;
      }
    }
  } catch (error) {
    console.error("[curriculum/ai-draft] Artifact generation failed, using fallback.", error);
  }

  return buildFallbackArtifact({
    learner: params.learner,
    messages,
  });
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
  const readiness = deriveFallbackReadiness(capturedRequirements, missingInformation);

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
  const topic = extractTopicLabel(capturedRequirements.topic || collectUserMessages(params.messages)[0] || "Custom Study");
  const title = toTitleCase(topic);
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
  const skills = buildFallbackSkills(title, capturedRequirements);
  const skillGroups = chunk(skills, Math.max(2, Math.ceil(skills.length / 3)));
  const document = {
    [title]: {
      Foundations: {
        "Core Ideas": skillGroups[0] ?? skills,
      },
      Practice: {
        "Applied Work": skillGroups[1] ?? skills.slice(0, 3),
        "Independent Growth": skillGroups[2] ?? skills.slice(Math.max(0, skills.length - 3)),
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
          ? `Practice the main skills in teachable, low-prep sessions.`
          : `Apply the learning with more independence and visible progress checks.`,
    estimatedWeeks: estimateWeeksPerUnit(capturedRequirements.timeframe, skillGroups.length, index),
    lessons: group.map((skillTitle, lessonIndex) => ({
      title:
        lessonIndex === 0
          ? `Introduction to ${skillTitle}`
          : `${skillTitle} in practice`,
      description: `Teach and rehearse ${skillTitle.toLowerCase()} in a way that fits ${params.learner.firstName}'s pace and current readiness.`,
      subject: subjects[0],
      estimatedMinutes: estimateLessonMinutes(capturedRequirements.timeframe),
      materials: buildFallbackMaterials(title, capturedRequirements),
      objectives: [
        `Explain or demonstrate ${skillTitle.toLowerCase()}.`,
        "Show visible progress through guided practice, discussion, or a short performance task.",
      ],
      linkedSkillTitles: [skillTitle],
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
  missingInformation: string[],
) {
  const hasCoreContext =
    Boolean(requirements.topic) &&
    Boolean(requirements.goals) &&
    Boolean(requirements.learnerProfile);
  const hasPlanningContext = Boolean(requirements.timeframe) || Boolean(requirements.constraints);
  const onlyOptionalGaps = missingInformation.every(
    (item) => item === "assessment" || item === "structure",
  );

  return hasCoreContext && (hasPlanningContext || onlyOptionalGaps) ? "ready" : "gathering";
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
  return `I have enough to build this curriculum now. From what you’ve shared, ${summary}. If that sounds right, I can generate the domain-to-skill structure and the first unit-and-lesson sequence.`;
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

function normalizeMessages(messages: CurriculumAiChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));
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

function buildFallbackSkills(
  topic: string,
  requirements: CurriculumAiCapturedRequirements,
) {
  const loweredTopic = topic.toLowerCase();

  if (loweredTopic.includes("chess")) {
    return [
      "Set up the board and explain the role of each piece",
      "Apply legal moves, captures, and special rules",
      "Read and write simple algebraic notation",
      "Recognize check, checkmate, and stalemate",
      "Use basic opening principles",
      "Plan one move ahead and notice simple tactics",
    ];
  }

  return [
    `Build core vocabulary in ${topic.toLowerCase()}`,
    `Explain foundational concepts in ${topic.toLowerCase()}`,
    `Practice guided application in ${topic.toLowerCase()}`,
    `Use feedback to improve work in ${topic.toLowerCase()}`,
    `Show independent understanding of ${topic.toLowerCase()}`,
    requirements.goals
      ? `Work toward the parent's priority outcome: ${shorten(toSentenceFragment(requirements.goals), 90)}`
      : `Reflect on progress and next steps in ${topic.toLowerCase()}`,
  ];
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
  const curriculumMatch = firstSentence.match(
    /(?:want|need|build|create|design|make)\s+(?:a|an)?\s*(.+?)\s+curriculum\b/i,
  );
  if (curriculumMatch?.[1]) {
    return cleanTopicFragment(curriculumMatch[1]);
  }

  const learnMatch = firstSentence.match(
    /(?:want|need)\s+to\s+(?:learn|study|explore)\s+(?:about\s+)?(.+)/i,
  );
  if (learnMatch?.[1]) {
    return cleanTopicFragment(learnMatch[1]);
  }

  const cleaned = firstSentence
    .replace(/^we\s+(want|need)\s+to\s+(learn|study|explore)\s+/i, "")
    .replace(/^i\s+(want|need)\s+to\s+(learn|study|explore|build)\s+(about\s+)?/i, "")
    .replace(/^please\s+(help|make|create)\s+(me\s+)?(a\s+)?/i, "")
    .replace(/^curriculum\s+(for|about)\s+/i, "")
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
  return value.trim().replace(/[.?!]+$/, "");
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
