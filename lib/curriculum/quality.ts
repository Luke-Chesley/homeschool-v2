import type { CurriculumAiDocumentNode, CurriculumAiGeneratedArtifact } from "./ai-draft.ts";
import { canonicalizeCurriculumArtifact } from "./canonical-artifact.ts";
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
  linkedSkillRefs: string[];
}

export function assessCurriculumArtifactQuality(
  artifact: CurriculumAiGeneratedArtifact,
  context: CurriculumArtifactQualityContext,
): CurriculumQualityIssue[] {
  const issues: CurriculumQualityIssue[] = [];
  const canonicalArtifact = canonicalizeCurriculumArtifact(artifact);
  const skillLeaves = canonicalArtifact.skillCatalog.map((skill) => ({
    title: skill.title,
    path: skill.path,
    skillRef: skill.skillRef,
  }));
  const topicKeywords = extractMeaningfulKeywords(context.topicText);
  const artifactText = buildArtifactText(artifact);

  // Only block on truly egregious structural failures.

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

  return uniqueIssues(issues);
}

function describeNamingIssues(params: {
  artifact: CurriculumAiGeneratedArtifact;
  context: CurriculumArtifactQualityContext;
}) {
  const issues: CurriculumQualityIssue[] = [];
  const canonicalArtifact = canonicalizeCurriculumArtifact(params.artifact);
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
    ...collectDocumentNamingIssues(canonicalArtifact.document, {
      topicText,
      requestText,
      skillMaxWords: params.context.granularity.maxSkillTitleWords,
    }),
  );

  for (const [unitIndex, unit] of canonicalArtifact.units.entries()) {
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

  }

  return uniqueIssues(issues);
}

function collectDocumentNamingIssues(
  node: Record<string, CurriculumAiDocumentNode>,
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
          value as Record<string, CurriculumAiDocumentNode>,
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
  skillLeaves: Array<DocumentSkillLeaf & { skillRef: string }>,
  granularity: CurriculumGranularityProfile,
) {
  const issues: CurriculumQualityIssue[] = [];

  if (lesson.objectives.length === 0) {
    issues.push({
      code: "teachability",
      message: `Lesson "${lesson.title}" has no stated objectives.`,
    });
  }

  if (lesson.linkedSkillRefs.length === 0) {
    issues.push({
      code: "lesson_skill_alignment",
      message: `Lesson "${lesson.title}" is not linked to any skill.`,
    });
  }

  if (lesson.linkedSkillRefs.length > 3) {
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

  const linkedSkillRefs = new Set(lesson.linkedSkillRefs);
  for (const skillRef of linkedSkillRefs) {
    const match = skillLeaves.find((skill) => skill.skillRef === skillRef);
    if (!match) {
      issues.push({
        code: "lesson_skill_alignment",
        message: `Lesson "${lesson.title}" links to a skill ref that does not appear in the curriculum tree.`,
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
  skillLeaves: Array<DocumentSkillLeaf & { skillRef: string }>,
) {
  const issues: CurriculumQualityIssue[] = [];
  const skillRefs = new Set(skillLeaves.map((skill) => skill.skillRef));

  for (const lesson of lessons) {
    for (const linkedSkillRef of lesson.linkedSkillRefs) {
      if (!skillRefs.has(linkedSkillRef)) {
        issues.push({
          code: "lesson_skill_alignment",
          message: `Lesson "${lesson.title}" references "${linkedSkillRef}" but that skill is not present in the curriculum tree.`,
        });
      }
    }
  }

  return uniqueIssues(issues);
}

function collectDocumentSkillLeaves(
  node: Record<string, CurriculumAiDocumentNode>,
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
  const canonicalArtifact = canonicalizeCurriculumArtifact(artifact);
  return canonicalArtifact.units.map((unit) => ({
    title: unit.title,
    description: unit.description,
    objectives: [],
    linkedSkillRefs: unit.skillRefs,
  }));
}

function estimateTotalSessions(artifact: CurriculumAiGeneratedArtifact) {
  const canonicalArtifact = canonicalizeCurriculumArtifact(artifact);
  const unitSessionTotal = canonicalArtifact.units.reduce(
    (total, unit) => total + (unit.estimatedSessions ?? 0),
    0,
  );

  if (unitSessionTotal > 0) {
    return unitSessionTotal;
  }

  return artifact.pacing.totalSessions ?? 0;
}

function buildArtifactText(artifact: CurriculumAiGeneratedArtifact) {
  const canonicalArtifact = canonicalizeCurriculumArtifact(artifact);
  return JSON.stringify(
    {
      source: artifact.source,
      pacing: artifact.pacing,
      skills: artifact.skills,
      document: canonicalArtifact.document,
      units: canonicalArtifact.units,
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
