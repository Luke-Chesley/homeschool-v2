import type { CurriculumAiGeneratedArtifact } from "./ai-draft.ts";
import type { CurriculumGranularityProfile, RequestedPacing } from "./granularity.ts";
import {
  hasWrapperLabelSignals,
  isLikelySentenceLabel,
  labelTokenOverlapScore,
  normalizeCurriculumLabel,
} from "./labels.ts";

export type CurriculumQualityIssueCode =
  | "topic_alignment"
  | "skill_atomicity"
  | "learner_fit_granularity"
  | "taxonomic_bloat"
  | "teachability"
  | "assessment_visibility"
  | "practice_balance"
  | "lesson_skill_alignment"
  | "title_length"
  | "title_shape"
  | "title_topic_alignment"
  | "title_overlap"
  | "title_wrapper";

export interface CurriculumQualityIssue {
  code: CurriculumQualityIssueCode;
  message: string;
  path?: string[];
}

export interface CurriculumArtifactQualityContext {
  topicText: string;
  requestText?: string;
  granularity: CurriculumGranularityProfile;
  requestedPacing?: RequestedPacing;
  learnerText?: string;
  revisionMode?: "generation" | "revision";
}

interface DocumentSkillLeaf {
  title: string;
  description?: string;
  path: string[];
}

interface LessonEnvelope {
  title: string;
  description: string;
  objectives: string[];
  linkedSkillTitles: string[];
}

export function assessCurriculumArtifactQuality(
  artifact: CurriculumAiGeneratedArtifact,
  context: CurriculumArtifactQualityContext,
): CurriculumQualityIssue[] {
  const issues: CurriculumQualityIssue[] = [];
  const skillLeaves = collectDocumentSkillLeaves(artifact.document);
  const lessons = collectLessons(artifact);
  const topicKeywords = extractMeaningfulKeywords(context.topicText);
  const artifactText = buildArtifactText(artifact);
  const totalSessions = estimateTotalSessions(artifact);
  const sessionsPerSkill = skillLeaves.length > 0 ? totalSessions / skillLeaves.length : Number.POSITIVE_INFINITY;

  if (skillLeaves.length === 0) {
    issues.push({
      code: "teachability",
      message: "The curriculum tree does not contain any skill leaves.",
    });
    return issues;
  }

  if (!hasTopicOverlap(artifactText, topicKeywords)) {
    issues.push({
      code: "topic_alignment",
      message: "The curriculum does not stay clearly aligned to the requested topic.",
    });
  }

  if (sessionsPerSkill > context.granularity.maxSessionsPerSkill) {
    issues.push({
      code: "learner_fit_granularity",
      message: `The curriculum is too broad for the learner context: about ${sessionsPerSkill.toFixed(1)} sessions per skill.`,
    });
  }

  if (skillLeaves.length > context.granularity.preferredSkillCount + 5) {
    issues.push({
      code: "taxonomic_bloat",
      message: "The curriculum creates more skill leaves than the learner context appears to need.",
    });
  }

  const broadSkillIssues = skillLeaves
    .map((skill) => describeSkillBroadness(skill, context.granularity))
    .filter((issue): issue is CurriculumQualityIssue => Boolean(issue));
  issues.push(...broadSkillIssues);

  const teachabilityIssues = lessons.flatMap((lesson) =>
    describeLessonTeachability(lesson, skillLeaves, context.granularity),
  );
  issues.push(...teachabilityIssues);

  const visibleAssessmentIssue = describeAssessmentVisibility(artifact, lessons);
  if (visibleAssessmentIssue) {
    issues.push(visibleAssessmentIssue);
  }

  issues.push(
    ...describeNamingIssues({
      artifact,
      context,
    }),
  );

  const practiceBalanceIssue = describePracticeBalance(artifact, lessons, totalSessions);
  if (practiceBalanceIssue) {
    issues.push(practiceBalanceIssue);
  }

  const alignmentIssues = describeLessonSkillAlignment(lessons, skillLeaves);
  issues.push(...alignmentIssues);

  return uniqueIssues(issues);
}

function describeNamingIssues(params: {
  artifact: CurriculumAiGeneratedArtifact;
  context: CurriculumArtifactQualityContext;
}) {
  const issues: CurriculumQualityIssue[] = [];
  const topicText = params.context.topicText;
  const requestText = params.context.requestText ?? "";

  const sourceTitleIssue = assessLabelQuality({
    label: params.artifact.source.title,
    path: ["source", "title"],
    role: "source title",
    maxWords: 8,
    maxChars: 60,
    topicText,
    requestText,
  });
  if (sourceTitleIssue) {
    issues.push(sourceTitleIssue);
  }

  issues.push(
    ...collectDocumentNamingIssues(params.artifact.document, {
      topicText,
      requestText,
      skillMaxWords: params.context.granularity.maxSkillTitleWords,
    }),
  );

  for (const [unitIndex, unit] of params.artifact.units.entries()) {
    const unitIssue = assessLabelQuality({
      label: unit.title,
      path: ["units", String(unitIndex), "title"],
      role: "unit",
      maxWords: 7,
      maxChars: 52,
      topicText,
      requestText,
    });
    if (unitIssue) {
      issues.push(unitIssue);
    }

    for (const [lessonIndex, lesson] of unit.lessons.entries()) {
      const lessonIssue = assessLabelQuality({
        label: lesson.title,
        path: ["units", String(unitIndex), "lessons", String(lessonIndex), "title"],
        role: "lesson",
        maxWords: 8,
        maxChars: 60,
        topicText,
        requestText,
      });
      if (lessonIssue) {
        issues.push(lessonIssue);
      }
    }
  }

  return uniqueIssues(issues);
}

function collectDocumentNamingIssues(
  node: CurriculumAiGeneratedArtifact["document"],
  context: {
    topicText: string;
    requestText: string;
    skillMaxWords: number;
  },
  path: string[] = [],
  depth = 0,
): CurriculumQualityIssue[] {
  const issues: CurriculumQualityIssue[] = [];
  const role =
    depth === 0 ? "domain" : depth === 1 ? "strand" : depth === 2 ? "goal group" : "skill";

  for (const [title, value] of Object.entries(node)) {
    const maxWords = depth === 0 ? 6 : depth === 1 ? 7 : depth === 2 ? 8 : context.skillMaxWords;
    const maxChars = depth === 0 ? 36 : depth === 1 ? 48 : depth === 2 ? 56 : 72;
    const issue = assessLabelQuality({
      label: title,
      path: [...path, title],
      role,
      maxWords,
      maxChars,
      topicText: context.topicText,
      requestText: context.requestText,
    });
    if (issue) {
      issues.push(issue);
    }

    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        const skillIssue = assessLabelQuality({
          label: item,
          path: [...path, title, String(index)],
          role: "skill",
          maxWords: context.skillMaxWords,
          maxChars: 72,
          topicText: context.topicText,
          requestText: context.requestText,
        });
        if (skillIssue) {
          issues.push(skillIssue);
        }
      }
      continue;
    }

    if (value && typeof value === "object") {
      issues.push(
        ...collectDocumentNamingIssues(
          value as CurriculumAiGeneratedArtifact["document"],
          context,
          [...path, title],
          depth + 1,
        ),
      );
    }
  }

  return issues;
}

function assessLabelQuality(params: {
  label: string;
  path: string[];
  role: string;
  maxWords: number;
  maxChars: number;
  topicText: string;
  requestText: string;
}): CurriculumQualityIssue | null {
  const normalized = normalizeCurriculumLabel(params.label);
  if (!normalized) {
    return {
      code: "title_shape",
      path: params.path,
      message: `${params.role} title is empty after normalization.`,
    };
  }

  if (normalized.length > params.maxChars || countWords(normalized) > params.maxWords) {
    return {
      code: "title_length",
      path: params.path,
      message: `${params.role} title "${normalized}" is too long to be a usable label.`,
    };
  }

  if (isLikelySentenceLabel(normalized)) {
    return {
      code: "title_shape",
      path: params.path,
      message: `${params.role} title "${normalized}" reads like a sentence instead of a label.`,
    };
  }

  if (hasWrapperLabelSignals(normalized) && countWords(normalized) <= 4) {
    return {
      code: "title_wrapper",
      path: params.path,
      message: `${params.role} title "${normalized}" looks like wrapper language instead of a usable label.`,
    };
  }

  if (
    params.topicText &&
    (params.role === "source title" || params.role === "domain") &&
    labelTokenOverlapScore(normalized, params.topicText) === 0
  ) {
    return {
      code: "title_topic_alignment",
      path: params.path,
      message: `${params.role} title "${normalized}" is not clearly aligned to the requested topic.`,
    };
  }

  if (params.requestText) {
    const overlap = labelTokenOverlapScore(normalized, params.requestText);
    if (overlap >= 0.8 && countWords(params.requestText) > 8) {
      return {
        code: "title_overlap",
        path: params.path,
        message: `${params.role} title "${normalized}" overlaps too heavily with the raw request.`,
      };
    }
  }

  return null;
}

function describeSkillBroadness(
  skill: DocumentSkillLeaf,
  granularity: CurriculumGranularityProfile,
): CurriculumQualityIssue | null {
  const text = `${skill.title} ${skill.description ?? ""}`.trim();
  const clauseSignals = countSignals(text, [
    /\band\b/gi,
    /\bor\b/gi,
    /,/g,
    /;/g,
    /\bthen\b/gi,
    /\bfollowed by\b/gi,
    /\bas well as\b/gi,
    /\bplus\b/gi,
  ]);
  const wordCount = countWords(skill.title);
  const titleLooksBundled =
    clauseSignals > granularity.maxSkillClauses ||
    wordCount > granularity.maxSkillTitleWords ||
    hasMultiProcedureSignals(skill.title);

  if (!titleLooksBundled) {
    return null;
  }

  return {
    code: "skill_atomicity",
    path: skill.path,
    message: `Skill "${skill.title}" looks too broad or bundled for the requested granularity.`,
  };
}

function describeLessonTeachability(
  lesson: LessonEnvelope,
  skillLeaves: DocumentSkillLeaf[],
  granularity: CurriculumGranularityProfile,
) {
  const issues: CurriculumQualityIssue[] = [];

  if (lesson.objectives.length === 0) {
    issues.push({
      code: "teachability",
      message: `Lesson "${lesson.title}" has no stated objectives.`,
    });
  }

  if (lesson.linkedSkillTitles.length === 0) {
    issues.push({
      code: "lesson_skill_alignment",
      message: `Lesson "${lesson.title}" is not linked to any skill.`,
    });
  }

  if (lesson.linkedSkillTitles.length > 3) {
    issues.push({
      code: "lesson_skill_alignment",
      message: `Lesson "${lesson.title}" links to too many skills to stay instructionally clear.`,
    });
  }

  const lessonText = `${lesson.title} ${lesson.description} ${lesson.objectives.join(" ")}`;
  const visibleWords = /(\bshow\b|\bdemonstrate\b|\bcheck\b|\bexplain\b|\bapply\b|\bsolve\b|\bproduce\b|\bperform\b)/i;
  if (!visibleWords.test(lessonText) && !lesson.objectives.some((objective) => visibleWords.test(objective))) {
    issues.push({
      code: "assessment_visibility",
      message: `Lesson "${lesson.title}" does not make progress or checking visible enough.`,
    });
  }

  const linkedSkillTitles = new Set(lesson.linkedSkillTitles.map((value) => normalizeKey(value)));
  for (const title of linkedSkillTitles) {
    const match = skillLeaves.find((skill) => normalizeKey(skill.title) === title);
    if (!match) {
      issues.push({
        code: "lesson_skill_alignment",
        message: `Lesson "${lesson.title}" links to a skill title that does not appear in the curriculum tree.`,
      });
      break;
    }

    const skillIssue = describeSkillBroadness(match, granularity);
    if (skillIssue) {
      issues.push({
        code: "lesson_skill_alignment",
        path: match.path,
        message: `Lesson "${lesson.title}" is linked to a skill that is still too broad to be instructionally clear.`,
      });
      break;
    }
  }

  return issues;
}

function describeAssessmentVisibility(
  artifact: CurriculumAiGeneratedArtifact,
  lessons: LessonEnvelope[],
): CurriculumQualityIssue | null {
  const assessmentText = [
    artifact.source.successSignals.join(" "),
    artifact.pacing.coverageStrategy,
    artifact.pacing.coverageNotes.join(" "),
    lessons.map((lesson) => `${lesson.title} ${lesson.description} ${lesson.objectives.join(" ")}`).join(" "),
  ].join(" ");

  if (/\b(show|demonstrate|check|observe|evidence|progress|performance|proof|apply|explain)\b/i.test(assessmentText)) {
    return null;
  }

  return {
    code: "assessment_visibility",
    message: "The curriculum does not surface a visible way to check progress.",
  };
}

function describePracticeBalance(
  artifact: CurriculumAiGeneratedArtifact,
  lessons: LessonEnvelope[],
  totalSessions: number,
): CurriculumQualityIssue | null {
  const text = [
    artifact.pacing.coverageStrategy,
    artifact.pacing.coverageNotes.join(" "),
    artifact.source.summary,
    lessons.map((lesson) => `${lesson.title} ${lesson.description} ${lesson.objectives.join(" ")}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  const practiceCount = countSignals(text, [/\bpractice\b/g, /\brehearse\b/g, /\bguided\b/g, /\btry\b/g, /\brepeat\b/g, /\bdrill\b/g]);
  const reviewCount = countSignals(text, [/\breview\b/g, /\brevisit\b/g, /\bretrieval\b/g, /\breflect\b/g, /\bcheck\b/g, /\brecheck\b/g]);
  const applicationCount = countSignals(text, [/\bapply\b/g, /\btransfer\b/g, /\buse\b/g, /\bsolve\b/g, /\bdemonstrate\b/g, /\bshow\b/g, /\bperform\b/g]);

  if (totalSessions >= 8 && practiceCount === 0) {
    return {
      code: "practice_balance",
      message: "The curriculum does not show enough guided practice.",
    };
  }

  if (totalSessions >= 8 && reviewCount === 0) {
    return {
      code: "practice_balance",
      message: "The curriculum does not show enough review or retrieval.",
    };
  }

  if (totalSessions >= 12 && applicationCount === 0) {
    return {
      code: "practice_balance",
      message: "The curriculum does not show enough application or transfer work.",
    };
  }

  return null;
}

function describeLessonSkillAlignment(
  lessons: LessonEnvelope[],
  skillLeaves: DocumentSkillLeaf[],
) {
  const issues: CurriculumQualityIssue[] = [];
  const skillTitles = new Set(skillLeaves.map((skill) => normalizeKey(skill.title)));

  for (const lesson of lessons) {
    for (const linkedSkill of lesson.linkedSkillTitles) {
      if (!skillTitles.has(normalizeKey(linkedSkill))) {
        issues.push({
          code: "lesson_skill_alignment",
          message: `Lesson "${lesson.title}" references "${linkedSkill}" but that skill is not present in the curriculum tree.`,
        });
      }
    }
  }

  return uniqueIssues(issues);
}

function collectDocumentSkillLeaves(
  node: CurriculumAiGeneratedArtifact["document"],
  path: string[] = [],
): DocumentSkillLeaf[] {
  const leaves: DocumentSkillLeaf[] = [];

  for (const [title, value] of Object.entries(node)) {
    const nextPath = [...path, title];
    if (typeof value === "string") {
      leaves.push({
        title,
        description: value,
        path: nextPath,
      });
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        leaves.push({
          title: item,
          description: undefined,
          path: [...nextPath, item],
        });
      }
      continue;
    }

    if (value && typeof value === "object") {
      leaves.push(...collectNestedDocumentSkills(value as Record<string, unknown>, nextPath));
    }
  }

  return leaves;
}

function collectNestedDocumentSkills(
  node: Record<string, unknown>,
  path: string[],
): DocumentSkillLeaf[] {
  const leaves: DocumentSkillLeaf[] = [];

  for (const [title, value] of Object.entries(node)) {
    const nextPath = [...path, title];
    if (typeof value === "string") {
      leaves.push({
        title,
        description: value,
        path: nextPath,
      });
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          leaves.push({
            title: item,
            description: undefined,
            path: [...nextPath, item],
          });
        }
      }
      continue;
    }

    if (value && typeof value === "object") {
      leaves.push(...collectNestedDocumentSkills(value as Record<string, unknown>, nextPath));
    }
  }

  return leaves;
}

function collectLessons(artifact: CurriculumAiGeneratedArtifact): LessonEnvelope[] {
  return artifact.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({
      title: lesson.title,
      description: lesson.description,
      objectives: lesson.objectives,
      linkedSkillTitles: lesson.linkedSkillTitles,
    })),
  );
}

function estimateTotalSessions(artifact: CurriculumAiGeneratedArtifact) {
  const unitSessionTotal = artifact.units.reduce(
    (total, unit) => total + (unit.estimatedSessions ?? unit.lessons.length),
    0,
  );

  if (unitSessionTotal > 0) {
    return unitSessionTotal;
  }

  return artifact.pacing.totalSessions ?? artifact.units.reduce((total, unit) => total + unit.lessons.length, 0);
}

function buildArtifactText(artifact: CurriculumAiGeneratedArtifact) {
  return JSON.stringify(
    {
      source: artifact.source,
      pacing: artifact.pacing,
      document: artifact.document,
      units: artifact.units,
    },
  ).toLowerCase();
}

function hasTopicOverlap(artifactText: string, topicKeywords: string[]) {
  if (topicKeywords.length === 0) {
    return true;
  }

  return topicKeywords.some((keyword) => artifactText.includes(keyword));
}

function hasMultiProcedureSignals(title: string) {
  return /\b(and|or|then|followed by|plus|while also|as well as)\b/i.test(title);
}

function extractMeaningfulKeywords(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)
    .filter((part) => !["learn", "study", "about", "curriculum", "plan", "want", "need"].includes(part));
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function countSignals(value: string, patterns: RegExp[]) {
  return patterns.reduce((total, pattern) => total + (value.match(pattern)?.length ?? 0), 0);
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueIssues(issues: CurriculumQualityIssue[]) {
  const seen = new Set<string>();
  const unique: CurriculumQualityIssue[] = [];

  for (const issue of issues) {
    const key = `${issue.code}:${issue.path?.join(" > ") ?? ""}:${issue.message}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(issue);
  }

  return unique;
}
