import "@/lib/server-only";

import {
  getCurriculumSource,
  getCurriculumTree,
  listCurriculumUnits,
} from "./service";
import type { CurriculumSource, CurriculumTree, CurriculumTreeNode, CurriculumUnit } from "./types";

export type ProgressionInstructionalRole =
  | "orientation"
  | "setup"
  | "safety"
  | "concept"
  | "procedure"
  | "integration"
  | "application"
  | "review";

export type LearnerPriorKnowledge = "unknown" | "novice" | "intermediate" | "advanced";

export interface ProgressionBasisSkillCatalogItem {
  skillRef: string;
  title: string;
  domainTitle?: string;
  strandTitle?: string;
  goalGroupTitle?: string;
  ordinal?: number;
  unitRef?: string;
  unitTitle?: string;
  unitOrderIndex?: number;
  instructionalRole?: ProgressionInstructionalRole;
  requiresAdultSupport?: boolean;
  safetyCritical?: boolean;
  isAuthenticApplication?: boolean;
}

export interface ProgressionBasisUnitAnchor {
  unitRef: string;
  title: string;
  description: string;
  orderIndex: number;
  estimatedWeeks?: number;
  estimatedSessions?: number;
  skillRefs: string[];
}

export interface ProgressionGenerationBasis {
  source: CurriculumSource;
  tree: CurriculumTree;
  units: CurriculumUnit[];
  skillCatalog: ProgressionBasisSkillCatalogItem[];
  unitAnchors: ProgressionBasisUnitAnchor[];
  skillNodeIdByRef: Map<string, string>;
  gradeLevels: string[];
  learnerPriorKnowledge: LearnerPriorKnowledge;
  totalWeeks?: number;
  sessionsPerWeek?: number;
  sessionMinutes?: number;
  totalSessions?: number;
  suggestedPhaseCountMin?: number;
  suggestedPhaseCountMax?: number;
}

export interface SuggestedPhaseCountRange {
  min: number;
  max: number;
}

const PRIOR_KNOWLEDGE_VALUES = new Set<LearnerPriorKnowledge>([
  "unknown",
  "novice",
  "intermediate",
  "advanced",
]);

const SAFETY_KEYWORDS = [
  "safe",
  "safety",
  "supervision",
  "supervise",
  "caution",
  "hazard",
  "dangerous",
  "danger",
  "hot",
  "heat",
  "sharp",
  "knife",
  "stove",
  "oven",
  "lab",
  "chemical",
  "protect",
];

const SETUP_KEYWORDS = [
  "setup",
  "set up",
  "prepare environment",
  "organize",
  "materials",
  "workspace",
  "choose tools",
  "supplies",
];

const REVIEW_KEYWORDS = ["review", "revisit", "reflect", "assess", "check", "quiz"];

const ORIENTATION_KEYWORDS = [
  "introduction",
  "overview",
  "why",
  "purpose",
  "how to use",
  "readiness",
  "norms",
];

const APPLICATION_KEYWORDS = [
  "project",
  "recipe",
  "experiment",
  "performance",
  "build",
  "presentation",
  "create",
  "compose",
  "solve real-world",
  "real-world",
];

const INTEGRATION_KEYWORDS = ["combine", "integrate", "plan and execute", "multi-step", "end-to-end"];

const CONCEPT_KEYWORDS = ["explain", "describe", "compare", "connect", "identify", "classify", "understand"];

const ADULT_SUPPORT_KEYWORDS = [
  "adult",
  "support",
  "guided",
  "guidance",
  "with help",
  "with guidance",
  "partner",
];

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function slugify(value: string) {
  return normalizeLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function canonicalSkillRefFromPath(path: string[]) {
  return `skill:${path.map(slugify).join("/")}`;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function buildHeuristicText(params: {
  title: string;
  domainTitle?: string;
  strandTitle?: string;
  goalGroupTitle?: string;
  unitTitle?: string;
  ancestorLabels?: string[];
}) {
  return [
    params.title,
    params.domainTitle,
    params.strandTitle,
    params.goalGroupTitle,
    params.unitTitle,
    ...(params.ancestorLabels ?? []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" | ")
    .toLowerCase();
}

function includesAny(text: string, candidates: string[]) {
  return candidates.some((candidate) => text.includes(candidate));
}

export function inferSafetyCritical(params: {
  title: string;
  domainTitle?: string;
  strandTitle?: string;
  goalGroupTitle?: string;
  unitTitle?: string;
  ancestorLabels?: string[];
}) {
  return includesAny(buildHeuristicText(params), SAFETY_KEYWORDS);
}

export function inferAdultSupport(params: {
  title: string;
  domainTitle?: string;
  strandTitle?: string;
  goalGroupTitle?: string;
  unitTitle?: string;
  ancestorLabels?: string[];
}) {
  const text = buildHeuristicText(params);
  return includesAny(text, ADULT_SUPPORT_KEYWORDS) || includesAny(text, SAFETY_KEYWORDS);
}

export function inferAuthenticApplication(params: {
  title: string;
  domainTitle?: string;
  strandTitle?: string;
  goalGroupTitle?: string;
  unitTitle?: string;
  ancestorLabels?: string[];
}) {
  return includesAny(buildHeuristicText(params), APPLICATION_KEYWORDS);
}

export function inferInstructionalRole(params: {
  title: string;
  domainTitle?: string;
  strandTitle?: string;
  goalGroupTitle?: string;
  unitTitle?: string;
  ancestorLabels?: string[];
}): ProgressionInstructionalRole {
  const text = buildHeuristicText(params);

  if (includesAny(text, SAFETY_KEYWORDS)) {
    return "safety";
  }
  if (includesAny(text, SETUP_KEYWORDS)) {
    return "setup";
  }
  if (includesAny(text, REVIEW_KEYWORDS)) {
    return "review";
  }
  if (includesAny(text, ORIENTATION_KEYWORDS)) {
    return "orientation";
  }
  if (includesAny(text, APPLICATION_KEYWORDS)) {
    return "application";
  }
  if (includesAny(text, INTEGRATION_KEYWORDS)) {
    return "integration";
  }
  if (includesAny(text, CONCEPT_KEYWORDS)) {
    return "concept";
  }
  return "procedure";
}

export function deriveSuggestedPhaseCountRange(params: {
  totalSessions?: number;
  skillCount: number;
}): SuggestedPhaseCountRange {
  const { totalSessions, skillCount } = params;

  if (typeof totalSessions === "number") {
    if (totalSessions <= 8) return { min: 2, max: 4 };
    if (totalSessions <= 16) return { min: 3, max: 5 };
    if (totalSessions <= 30) return { min: 4, max: 6 };
    if (totalSessions <= 60) return { min: 5, max: 8 };
    return { min: 6, max: 10 };
  }

  if (skillCount <= 8) return { min: 2, max: 4 };
  if (skillCount <= 20) return { min: 3, max: 5 };
  if (skillCount <= 40) return { min: 4, max: 7 };
  return { min: 5, max: 9 };
}

function inferLearnerPriorKnowledge(source: CurriculumSource): LearnerPriorKnowledge {
  const candidate =
    readString(source.curriculumLineage?.learnerPriorKnowledge)
    ?? readString(source.curriculumLineage?.priorKnowledge);
  if (candidate && PRIOR_KNOWLEDGE_VALUES.has(candidate as LearnerPriorKnowledge)) {
    return candidate as LearnerPriorKnowledge;
  }
  return "unknown";
}

function resolveCanonicalSkillRef(node: CurriculumTreeNode, ancestors: CurriculumTreeNode[]) {
  const explicit =
    readString(node.metadata?.canonicalSkillRef)
    ?? readString(node.metadata?.skillRef)
    ?? readString(node.sourcePayload?.skillRef);
  if (explicit) {
    return explicit;
  }

  const metadataRawPath = readStringArray(node.metadata?.rawPath);
  const sourcePayloadRawPath = readStringArray(node.sourcePayload?.rawPath);
  const rawPath = metadataRawPath.length > 0 ? metadataRawPath : sourcePayloadRawPath;
  if (rawPath.length > 0) {
    return canonicalSkillRefFromPath(rawPath);
  }

  return canonicalSkillRefFromPath([...ancestors.map((ancestor) => ancestor.title), node.title]);
}

function calculateTotalSessions(source: CurriculumSource, units: CurriculumUnit[]) {
  if (typeof source.pacing?.totalSessions === "number") {
    return source.pacing.totalSessions;
  }

  if (
    typeof source.pacing?.totalWeeks === "number"
    && typeof source.pacing?.sessionsPerWeek === "number"
  ) {
    return Math.round(source.pacing.totalWeeks * source.pacing.sessionsPerWeek);
  }

  const unitTotal = units.reduce((total, unit) => total + (unit.estimatedSessions ?? 0), 0);
  return unitTotal > 0 ? unitTotal : undefined;
}

export function createProgressionGenerationBasis(params: {
  source: CurriculumSource;
  tree: CurriculumTree;
  units: CurriculumUnit[];
}, options?: {
  allowUnitless?: boolean;
}): ProgressionGenerationBasis {
  const units = [...params.units].sort((left, right) => left.sequence - right.sequence);
  if (!options?.allowUnitless && units.length === 0) {
    throw new Error(`Curriculum source ${params.source.id} has no persisted units.`);
  }

  const earliestUnitBySkillRef = new Map<string, ProgressionBasisUnitAnchor>();
  const unitAnchors = units.map((unit, index) => {
    const anchor: ProgressionBasisUnitAnchor = {
      unitRef: unit.unitRef,
      title: unit.title,
      description: unit.description ?? "",
      orderIndex: index + 1,
      estimatedWeeks: unit.estimatedWeeks,
      estimatedSessions: unit.estimatedSessions,
      skillRefs: [...unit.skillRefs],
    };
    for (const skillRef of anchor.skillRefs) {
      if (!earliestUnitBySkillRef.has(skillRef)) {
        earliestUnitBySkillRef.set(skillRef, anchor);
      }
    }
    return anchor;
  });

  const skillCatalog: ProgressionBasisSkillCatalogItem[] = [];
  const skillNodeIdByRef = new Map<string, string>();
  const seenSkillRefs = new Set<string>();

  const walk = (node: CurriculumTreeNode, ancestors: CurriculumTreeNode[]) => {
    if (node.normalizedType === "skill") {
      const skillRef = resolveCanonicalSkillRef(node, ancestors);
      if (seenSkillRefs.has(skillRef)) {
        throw new Error(`Duplicate canonical skillRef in progression basis: ${skillRef}`);
      }
      seenSkillRefs.add(skillRef);
      skillNodeIdByRef.set(skillRef, node.id);

      const domainTitle = ancestors.find((ancestor) => ancestor.normalizedType === "domain")?.title;
      const strandTitle = ancestors.find((ancestor) => ancestor.normalizedType === "strand")?.title;
      const goalGroupTitle = ancestors.find((ancestor) => ancestor.normalizedType === "goal_group")?.title;
      const unitOwner = earliestUnitBySkillRef.get(skillRef);
      const heuristicInput = {
        title: node.title,
        domainTitle,
        strandTitle,
        goalGroupTitle,
        unitTitle: unitOwner?.title,
        ancestorLabels: ancestors.map((ancestor) => ancestor.title),
      };

      skillCatalog.push({
        skillRef,
        title: node.title,
        domainTitle,
        strandTitle,
        goalGroupTitle,
        ordinal:
          typeof node.metadata.canonicalSequenceIndex === "number"
            ? node.metadata.canonicalSequenceIndex + 1
            : skillCatalog.length + 1,
        unitRef: unitOwner?.unitRef,
        unitTitle: unitOwner?.title,
        unitOrderIndex: unitOwner?.orderIndex,
        instructionalRole: inferInstructionalRole(heuristicInput),
        requiresAdultSupport: inferAdultSupport(heuristicInput),
        safetyCritical: inferSafetyCritical(heuristicInput),
        isAuthenticApplication: inferAuthenticApplication(heuristicInput),
      });
    }

    for (const child of node.children) {
      walk(child, [...ancestors, node]);
    }
  };

  for (const rootNode of params.tree.rootNodes) {
    walk(rootNode, []);
  }

  if (skillCatalog.length === 0) {
    throw new Error(`Curriculum source ${params.source.id} has no resolved skills for progression generation.`);
  }

  for (const unitAnchor of unitAnchors) {
    for (const skillRef of unitAnchor.skillRefs) {
      if (!skillNodeIdByRef.has(skillRef)) {
        throw new Error(
          `Unit "${unitAnchor.title}" references unknown canonical skillRef "${skillRef}" in progression basis.`,
        );
      }
    }
  }

  const totalSessions = calculateTotalSessions(params.source, units);
  const phaseBudget = deriveSuggestedPhaseCountRange({
    totalSessions,
    skillCount: skillCatalog.length,
  });

  return {
    source: params.source,
    tree: params.tree,
    units,
    skillCatalog,
    unitAnchors,
    skillNodeIdByRef,
    gradeLevels: [...params.source.gradeLevels],
    learnerPriorKnowledge: inferLearnerPriorKnowledge(params.source),
    totalWeeks: params.source.pacing?.totalWeeks,
    sessionsPerWeek: params.source.pacing?.sessionsPerWeek,
    sessionMinutes: params.source.pacing?.sessionMinutes,
    totalSessions,
    suggestedPhaseCountMin: phaseBudget.min,
    suggestedPhaseCountMax: phaseBudget.max,
  };
}

export async function buildProgressionGenerationBasis(params: {
  sourceId: string;
  householdId: string;
}): Promise<ProgressionGenerationBasis> {
  const [source, tree, units] = await Promise.all([
    getCurriculumSource(params.sourceId, params.householdId),
    getCurriculumTree(params.sourceId, params.householdId),
    listCurriculumUnits(params.sourceId),
  ]);

  if (!source) {
    throw new Error(`Curriculum source not found: ${params.sourceId}`);
  }
  if (!tree) {
    throw new Error(`Curriculum tree not found: ${params.sourceId}`);
  }

  return createProgressionGenerationBasis({ source, tree, units });
}

export function buildProgressionGenerationInput(params: {
  learnerName: string;
  basis: ProgressionGenerationBasis;
}) {
  return {
    learnerName: params.learnerName,
    sourceTitle: params.basis.source.title,
    sourceSummary: params.basis.source.description,
    requestMode: readString(params.basis.source.curriculumLineage?.requestMode) ?? undefined,
    sourceKind: params.basis.source.sourceModel?.sourceKind,
    deliveryPattern: params.basis.source.sourceModel?.deliveryPattern,
    entryStrategy: params.basis.source.sourceModel?.entryStrategy,
    continuationMode: params.basis.source.sourceModel?.continuationMode,
    gradeLevels: params.basis.gradeLevels,
    learnerPriorKnowledge: params.basis.learnerPriorKnowledge,
    totalWeeks: params.basis.totalWeeks,
    sessionsPerWeek: params.basis.sessionsPerWeek,
    sessionMinutes: params.basis.sessionMinutes,
    totalSessions: params.basis.totalSessions,
    suggestedPhaseCountMin: params.basis.suggestedPhaseCountMin,
    suggestedPhaseCountMax: params.basis.suggestedPhaseCountMax,
    skillCatalog: params.basis.skillCatalog,
    unitAnchors: params.basis.unitAnchors,
  };
}
