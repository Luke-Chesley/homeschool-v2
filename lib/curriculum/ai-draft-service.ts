import "server-only";

import { getAdapterForTask } from "@/lib/ai/registry";
import { getAiRoutingConfig } from "@/lib/ai/routing";
import { getModelForTask } from "@/lib/ai/provider-adapter";
import type { AppLearner } from "@/lib/users/service";

import {
  CurriculumAiDraftSchema,
  type CurriculumAiDraft,
  type CurriculumAiDraftAnswer,
} from "./ai-draft";

const CURRICULUM_AI_DRAFT_SYSTEM_PROMPT = `You are helping a homeschool parent shape a first-pass curriculum brief from an intake conversation.

Use sound pedagogy:
- begin with the learner's goals and prior knowledge
- keep pacing realistic for the stated schedule
- prefer coherent progression over broad coverage
- include motivation, practice, and a visible way to tell whether the plan is working
- keep the tone calm, practical, and parent-facing

Return JSON only with these keys:
- title: short curriculum title
- description: one concise summary sentence for the curriculum source card
- subjects: 1 to 4 plain-language subject labels
- gradeLevels: inferred grade labels only if the parent implied them
- academicYear: optional, only if the parent clearly named one
- summary: a short paragraph describing the shape of the curriculum
- teachingApproach: one sentence describing the instructional approach
- successSignals: 2 to 4 short bullets describing what success will look like
- parentNotes: 2 to 4 short practical notes for the parent
- rationale: 2 to 4 short bullets explaining why this draft is structured this way

Do not mention JSON. Do not include markdown fences.`;

export async function buildCurriculumAiDraft(params: {
  learner: AppLearner;
  answers: CurriculumAiDraftAnswer[];
}): Promise<CurriculumAiDraft> {
  const { learner, answers } = params;
  const answerMap = new Map(answers.map((entry) => [entry.questionId, entry.answer.trim()]));
  const adapter = getAdapterForTask("chat.answer");
  const model = getModelForTask("chat.answer", getAiRoutingConfig());
  const userPrompt = buildUserPrompt({ learner, answers });

  try {
    const response = await adapter.complete({
      model,
      systemPrompt: CURRICULUM_AI_DRAFT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const parsed = safeParseJson(response.content);
    const validated = CurriculumAiDraftSchema.safeParse(parsed);

    if (validated.success) {
      const parsedDraft = sanitizeDraft(validated.data);
      if (isDraftGroundedInTopic(parsedDraft, answerMap)) {
        return parsedDraft;
      }
    }
  } catch (error) {
    console.error("[curriculum/ai-draft] Structured generation failed, using fallback.", error);
  }

  return buildFallbackDraft({ learner, answers });
}

function buildUserPrompt(params: {
  learner: AppLearner;
  answers: CurriculumAiDraftAnswer[];
}) {
  const answerLines = params.answers.map(
    (entry, index) => `${index + 1}. ${humanizeQuestion(entry.questionId)}\nAnswer: ${entry.answer}`,
  );

  return [
    `Active learner: ${params.learner.displayName}`,
    `Learner first name: ${params.learner.firstName}`,
    "",
    "Parent intake conversation:",
    answerLines.join("\n\n"),
  ].join("\n");
}

function humanizeQuestion(questionId: CurriculumAiDraftAnswer["questionId"]) {
  switch (questionId) {
    case "topic":
      return "What should this curriculum focus on?";
    case "goals":
      return "What outcomes matter most?";
    case "timeframe":
      return "What pace and time horizon are realistic?";
    case "learnerProfile":
      return "What prior knowledge and supports should shape the plan?";
    case "constraints":
      return "What materials, routines, or constraints should the plan honor?";
  }
}

function sanitizeDraft(draft: CurriculumAiDraft): CurriculumAiDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    summary: draft.summary.trim(),
    teachingApproach: draft.teachingApproach.trim(),
    subjects: uniqueNonEmpty(draft.subjects),
    gradeLevels: uniqueNonEmpty(draft.gradeLevels),
    successSignals: uniqueNonEmpty(draft.successSignals),
    parentNotes: uniqueNonEmpty(draft.parentNotes),
    rationale: uniqueNonEmpty(draft.rationale),
  };
}

function buildFallbackDraft(params: {
  learner: AppLearner;
  answers: CurriculumAiDraftAnswer[];
}): CurriculumAiDraft {
  const answerMap = new Map(params.answers.map((entry) => [entry.questionId, entry.answer.trim()]));
  const topic = extractTopicLabel(answerMap.get("topic") ?? "Custom Study");
  const goals = answerMap.get("goals") ?? "";
  const timeframe = answerMap.get("timeframe") ?? "";
  const learnerProfile = answerMap.get("learnerProfile") ?? "";
  const constraints = answerMap.get("constraints") ?? "";
  const normalizedGoals = toSentenceFragment(shorten(goals, 140));
  const normalizedTimeframe = normalizeTimeframePhrase(timeframe);
  const combinedText = [topic, goals, timeframe, learnerProfile, constraints].join(" ");
  const subjects = inferSubjects(combinedText);
  const gradeLevels = inferGradeLevels(combinedText);

  const summaryParts = [
    `${params.learner.displayName} will work through a ${topic.toLowerCase()} plan`,
    normalizedTimeframe ? `paced around ${normalizedTimeframe}` : null,
    normalizedGoals ? `with emphasis on ${normalizedGoals}` : null,
  ].filter(Boolean);

  const parentNotes = [
    timeframe ? `Keep the cadence aligned with ${shorten(timeframe, 90)}.` : null,
    learnerProfile ? `Build from current readiness: ${shorten(learnerProfile, 90)}.` : null,
    constraints ? `Plan around these constraints: ${shorten(constraints, 90)}.` : null,
  ].filter((value): value is string => Boolean(value));

  const rationale = [
    goals
      ? `The sequence is anchored to the parent's stated goals instead of broad topic coverage.`
      : "The sequence starts with core understanding before layering on more independent work.",
    timeframe
      ? `The pacing stays realistic for the stated schedule so the plan is teachable week to week.`
      : "The pacing is intentionally restrained so the learner can revisit important ideas.",
    learnerProfile
      ? `The plan accounts for current readiness and support needs rather than assuming a blank slate.`
      : "The plan includes explicit practice and reflection so progress is visible to the parent.",
  ];

  const successSignals = [
    goals
      ? `The learner can demonstrate progress toward ${shorten(goals, 80).replace(/\.$/, "")}.`
      : `The learner can explain and apply the core ideas in ${topic.toLowerCase()}.`,
    "The parent can point to concrete work, discussion, or performance evidence each week.",
    constraints
      ? `The routine remains workable within the family's actual resources and energy.`
      : `The routine remains sustainable without heavy prep every session.`,
  ];

  return sanitizeDraft({
    title: toTitleCase(topic),
    description: summaryParts.join(", ") + ".",
    subjects,
    gradeLevels,
    summary:
      `${summaryParts.join(", ")}. The draft balances clear instruction, guided practice, and a visible way to tell whether the plan is working.`,
    teachingApproach:
      "Use short, coherent lessons that connect new ideas to prior knowledge and end with visible practice or reflection.",
    successSignals,
    parentNotes,
    rationale,
  });
}

function extractTopicLabel(value: string) {
  const cleaned = value
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

function isDraftGroundedInTopic(
  draft: CurriculumAiDraft,
  answerMap: Map<CurriculumAiDraftAnswer["questionId"], string>,
) {
  const topicAnswer = answerMap.get("topic") ?? "";
  const topicKeywords = extractMeaningfulKeywords(extractTopicLabel(topicAnswer));

  if (topicKeywords.length === 0) {
    return true;
  }

  const combinedDraftText = [
    draft.title,
    draft.description,
    draft.summary,
    draft.subjects.join(" "),
    draft.rationale.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return topicKeywords.some((keyword) => combinedDraftText.includes(keyword));
}

function extractMeaningfulKeywords(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)
    .filter((part) => !["learn", "study", "about", "curriculum", "plan"].includes(part));
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

  if (value.includes("kindergarten")) {
    matches.add("K");
  }
  if (value.includes("middle school")) {
    matches.add("6-8");
  }
  if (value.includes("high school")) {
    matches.add("9-12");
  }

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

function safeParseJson(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (!fenceMatch) {
      return null;
    }

    try {
      return JSON.parse(fenceMatch[1]) as unknown;
    } catch {
      return null;
    }
  }
}
