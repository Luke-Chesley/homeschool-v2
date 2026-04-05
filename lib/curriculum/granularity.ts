import type { CurriculumAiCapturedRequirements } from "./ai-draft.ts";

export interface RequestedPacing {
  totalWeeks?: number;
  sessionsPerWeek?: number;
  sessionMinutes?: number;
  totalSessionsLowerBound?: number;
  totalSessionsUpperBound?: number;
  explicitlyRequestedTotalSessions?: number;
}

export type CurriculumDomainMode = "procedural" | "conceptual" | "creative" | "mixed";
export type CurriculumGranularityMode = "narrow" | "balanced" | "broad";
export type CurriculumLearnerMode = "novice" | "developing" | "experienced";
export type CurriculumConfidenceMode = "fragile" | "steady" | "independent";
export type CurriculumSessionMode = "short" | "moderate" | "long";

export interface CurriculumGranularityProfile {
  mode: CurriculumGranularityMode;
  domainMode: CurriculumDomainMode;
  learnerMode: CurriculumLearnerMode;
  confidenceMode: CurriculumConfidenceMode;
  sessionMode: CurriculumSessionMode;
  preferredSkillCount: number;
  preferredStrandCount: number;
  preferredGoalGroupsPerStrand: number;
  targetSessionsPerSkill: number;
  maxSessionsPerSkill: number;
  maxSkillTitleWords: number;
  maxSkillClauses: number;
  rationale: string[];
}

export function inferCurriculumGranularityProfile(params: {
  topic: string;
  requirements: CurriculumAiCapturedRequirements;
  pacing: RequestedPacing;
}): CurriculumGranularityProfile {
  const topic = normalizeText(params.topic);
  const requirements = normalizeText([
    params.requirements.goals,
    params.requirements.learnerProfile,
    params.requirements.teachingStyle,
    params.requirements.constraints,
    params.requirements.structurePreferences,
  ].join(" "));
  const pacingText = normalizeText([
    params.requirements.timeframe,
    String(params.pacing.sessionMinutes ?? ""),
    String(params.pacing.sessionsPerWeek ?? ""),
    String(params.pacing.totalWeeks ?? ""),
    String(params.pacing.explicitlyRequestedTotalSessions ?? ""),
    String(params.pacing.totalSessionsLowerBound ?? ""),
    String(params.pacing.totalSessionsUpperBound ?? ""),
  ].join(" "));

  const domainMode = inferDomainMode(topic, requirements);
  const learnerMode = inferLearnerMode(requirements);
  const confidenceMode = inferConfidenceMode(requirements);
  const sessionMode = inferSessionMode(params.pacing, pacingText);

  let narrowScore = 0;
  let broadScore = 0;

  if (learnerMode === "novice") narrowScore += 3;
  if (learnerMode === "experienced") broadScore += 3;
  if (confidenceMode === "fragile") narrowScore += 2;
  if (confidenceMode === "independent") broadScore += 2;
  if (sessionMode === "short") narrowScore += 3;
  if (sessionMode === "long") broadScore += 2;
  if (domainMode === "procedural") narrowScore += 2;
  if (domainMode === "conceptual" || domainMode === "creative") broadScore += 1;

  const containsNarrowingSignals = /\b(beginner|new to|new learner|fragile|needs support|struggle|struggling|step by step|guided|short sessions?|short attention|one step at a time|hands on|concrete|careful)\b/i.test(
    requirements,
  );
  const containsBroadeningSignals = /\b(advanced|experienced|fluent|independent|confident|comfortable|abstract|integrated|deeper|longer|synthesis|transfer|open-ended)\b/i.test(
    requirements,
  );

  if (containsNarrowingSignals) narrowScore += 3;
  if (containsBroadeningSignals) broadScore += 3;

  const mode: CurriculumGranularityMode =
    narrowScore >= broadScore + 2 ? "narrow" : broadScore >= narrowScore + 2 ? "broad" : "balanced";

  const pacingSessions =
    params.pacing.explicitlyRequestedTotalSessions ??
    params.pacing.totalSessionsLowerBound ??
    params.pacing.totalSessionsUpperBound ??
    estimateSessionsFromPacing(params.pacing);

  const preferredSkillCount =
    mode === "narrow"
      ? clamp(Math.round((pacingSessions ?? 12) / 2.5), 8, 14)
      : mode === "broad"
        ? clamp(Math.round((pacingSessions ?? 12) / 6), 5, 7)
        : clamp(Math.round((pacingSessions ?? 12) / 3.5), 6, 10);

  const preferredStrandCount =
    mode === "narrow"
      ? domainMode === "procedural"
        ? 4
        : 3
      : mode === "broad"
        ? domainMode === "conceptual" || domainMode === "creative"
          ? 3
          : 2
        : 3;

  const preferredGoalGroupsPerStrand =
    mode === "narrow" ? 2 : mode === "broad" ? 1 : domainMode === "procedural" ? 2 : 1;

  const targetSessionsPerSkill =
    preferredSkillCount > 0 ? roundOneDecimal((pacingSessions ?? preferredSkillCount * 3) / preferredSkillCount) : 3;

  const maxSessionsPerSkill =
    mode === "narrow"
      ? sessionMode === "short"
        ? 3
        : 3.5
      : mode === "broad"
        ? sessionMode === "long"
          ? 7
          : 6
        : sessionMode === "long"
          ? 4.8
          : 4.2;

  const maxSkillTitleWords =
    mode === "narrow" ? 11 : mode === "broad" ? 15 : 13;

  const maxSkillClauses =
    mode === "narrow" ? 1 : 2;

  const rationale = uniqueNonEmpty([
    mode === "narrow"
      ? "The learner context suggests smaller, more observable skills."
      : mode === "broad"
        ? "The learner context can support broader integrated skills."
        : "The learner context sits in the middle and needs teachable but not over-fragmented skills.",
    domainMode === "procedural"
      ? "The topic looks procedural, so the draft should favor explicit steps, checks, and correction points."
      : domainMode === "conceptual"
        ? "The topic looks conceptual, so integrated explanation and transfer are acceptable when they stay teachable."
        : domainMode === "creative"
          ? "The topic looks creative, so planning, drafting, revising, and presentation can stay grouped when the rhythm allows it."
          : "The topic is mixed, so the draft should balance clarity, practice, and transfer.",
    sessionMode === "short"
      ? "Short sessions call for smaller skills and more visible checks."
      : sessionMode === "long"
        ? "Longer sessions can carry broader skill chunks if the learner can still model, practice, and check them."
        : "Medium-length sessions can support a moderate granularity level.",
  ]);

  return {
    mode,
    domainMode,
    learnerMode,
    confidenceMode,
    sessionMode,
    preferredSkillCount,
    preferredStrandCount,
    preferredGoalGroupsPerStrand,
    targetSessionsPerSkill,
    maxSessionsPerSkill,
    maxSkillTitleWords,
    maxSkillClauses,
    rationale,
  };
}

export function buildGranularityGuidance(profile: CurriculumGranularityProfile) {
  const lines = [
    "Do not optimize for minimal node count.",
    "Optimize for the smallest teachable unit that still feels meaningful in the available lesson rhythm.",
    `This context points toward ${profile.mode} granularity in a ${profile.domainMode} topic.`,
    profile.mode === "narrow"
      ? "Use smaller, more observable skills that can be modeled, practiced, and checked quickly."
      : profile.mode === "broad"
        ? "Broader integrated skills are acceptable when the learner is ready and the topic supports it."
        : "Use a moderate grain size and split only when a branch would otherwise become vague or overloaded.",
    "Multiple goal groups per strand are fine when they reflect real sub-progressions.",
    "A skill should usually be narrow enough to teach, model, practice, and check within roughly 1-3 short sessions unless the learner is more advanced and the topic supports broader integration.",
    "If multiple distinct procedures, rules, or misconception targets would be taught separately, they should usually be separate skills.",
    "Keep taxonomy noise and gratuitous bloat out of the tree.",
  ];

  return uniqueNonEmpty(lines);
}

function inferDomainMode(topic: string, requirements: string): CurriculumDomainMode {
  const proceduralScore = scoreSignals(
    `${topic} ${requirements}`,
    [
      "step",
      "steps",
      "routine",
      "setup",
      "practice",
      "drill",
      "move",
      "moves",
      "calculate",
      "solve",
      "build",
      "write",
      "code",
      "play",
      "measure",
      "arrange",
      "tool",
      "tools",
      "hands on",
      "hands-on",
      "lab",
      "stitch",
      "stitches",
      "grammar",
      "phonics",
      "decode",
    ],
  );
  const conceptualScore = scoreSignals(
    `${topic} ${requirements}`,
    [
      "concept",
      "concepts",
      "idea",
      "ideas",
      "theory",
      "explain",
      "compare",
      "analyze",
      "reason",
      "evidence",
      "interpret",
      "history",
      "science",
      "algebra",
      "literature",
      "discussion",
      "proof",
      "model",
    ],
  );
  const creativeScore = scoreSignals(
    `${topic} ${requirements}`,
    [
      "draft",
      "drafting",
      "revise",
      "revision",
      "design",
      "compose",
      "project",
      "portfolio",
      "art",
      "music",
      "story",
      "present",
      "presentation",
      "make",
      "create",
      "produce",
    ],
  );

  const scores = [
    { mode: "procedural" as const, score: proceduralScore },
    { mode: "conceptual" as const, score: conceptualScore },
    { mode: "creative" as const, score: creativeScore },
  ].sort((left, right) => right.score - left.score);

  if (scores[0].score === 0 || scores[0].score === scores[1].score) {
    return "mixed";
  }

  return scores[0].mode;
}

function inferLearnerMode(requirements: string): CurriculumLearnerMode {
  if (
    /\b(beginner|novice|new to|just starting|still learning|struggle|struggling|needs support|younger|young|early learner|early reader|careful support|step by step|guided)\b/i.test(
      requirements,
    )
  ) {
    return "novice";
  }

  if (
    /\b(advanced|experienced|fluent|comfortable|independent|mature|older|ready for depth|already knows|already know|confident)\b/i.test(
      requirements,
    )
  ) {
    return "experienced";
  }

  return "developing";
}

function inferConfidenceMode(requirements: string): CurriculumConfidenceMode {
  if (/\b(fragile|hesitant|uncertain|needs reassurance|needs support|low confidence|anxious|careful)\b/i.test(requirements)) {
    return "fragile";
  }

  if (/\b(confident|steady|comfortable|supported|secure|ready)\b/i.test(requirements)) {
    return "steady";
  }

  return "independent";
}

function inferSessionMode(pacing: RequestedPacing, pacingText: string): CurriculumSessionMode {
  const minutes = pacing.sessionMinutes;
  const weekly = pacing.sessionsPerWeek;

  if ((typeof minutes === "number" && minutes <= 25) || (typeof weekly === "number" && weekly >= 4)) {
    return "short";
  }

  if ((typeof minutes === "number" && minutes >= 45) || /\b(long|extended|deep dive|immersive)\b/i.test(pacingText)) {
    return "long";
  }

  return "moderate";
}

function estimateSessionsFromPacing(pacing: RequestedPacing) {
  if (
    typeof pacing.totalWeeks === "number" &&
    typeof pacing.sessionsPerWeek === "number"
  ) {
    return Math.max(1, Math.round(pacing.totalWeeks * pacing.sessionsPerWeek));
  }

  if (typeof pacing.totalSessionsUpperBound === "number") {
    return pacing.totalSessionsUpperBound;
  }

  if (typeof pacing.totalSessionsLowerBound === "number") {
    return pacing.totalSessionsLowerBound;
  }

  return 12;
}

function scoreSignals(text: string, keywords: string[]) {
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 1;
    }
  }
  return score;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
