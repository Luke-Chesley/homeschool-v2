import type {
  ProgressionGenerationBasis,
  ProgressionInstructionalRole,
} from "./progression-basis";
import type {
  CurriculumProgressionData,
  CurriculumPrerequisiteRecord,
  ProgressionStatus,
} from "./service";
import type {
  CurriculumLesson,
  CurriculumSource,
  CurriculumTree,
  CurriculumTreeNode,
  CurriculumUnitOutline,
} from "./types";

export interface RoadmapFilterOption {
  id: string;
  title: string;
  count: number;
}

export interface RoadmapPacingSummary {
  totalWeeks?: number;
  sessionsPerWeek?: number;
  sessionMinutes?: number;
  totalSessions?: number;
  label: string | null;
}

export interface RoadmapProgressionSummary {
  status: ProgressionStatus;
  label: string;
  detail: string;
  isExplicit: boolean;
  usingFallback: boolean;
}

export interface RoadmapLaunchSliceSummary {
  label: string;
  scopeSummary: string;
  skillCount: number;
  unitCount: number;
  initialSliceUsed: boolean;
}

export interface RoadmapSummary {
  totalSkills: number;
  totalPhases: number;
  totalUnits: number;
  totalLessons: number;
  pacing: RoadmapPacingSummary;
  progression: RoadmapProgressionSummary;
  launchSlice: RoadmapLaunchSliceSummary | null;
}

export interface RoadmapDependencyTitles {
  count: number;
  titles: string[];
}

export interface RoadmapSkill {
  id: string;
  title: string;
  description?: string;
  breadcrumb: string;
  domainId: string;
  domainTitle: string;
  strandId: string | null;
  strandTitle: string | null;
  goalGroupId: string | null;
  goalGroupTitle: string | null;
  phaseId: string | null;
  phaseTitle: string | null;
  unitRef: string | null;
  unitTitle: string | null;
  unitOrderIndex: number | null;
  instructionalRole: ProgressionInstructionalRole | null;
  requiresAdultSupport: boolean;
  safetyCritical: boolean;
  isAuthenticApplication: boolean;
  canonicalOrder: number;
  dependencySummary: {
    hardPrerequisite: RoadmapDependencyTitles;
    recommendedBefore: RoadmapDependencyTitles;
    revisitAfter: RoadmapDependencyTitles;
    coPractice: RoadmapDependencyTitles;
    unlocks: RoadmapDependencyTitles;
  };
  lessonCount: number;
  linkedLessonTitles: string[];
  linkedLessons: Array<{
    id: string;
    title: string;
    unitRef: string;
    unitTitle: string;
  }>;
  launchSlice: {
    included: boolean;
    viaSkill: boolean;
    viaUnit: boolean;
  };
}

export interface RoadmapPhaseGroup {
  id: string;
  type: "unit" | "domain";
  title: string;
  subtitle: string;
  orderIndex: number;
  skillIds: string[];
  lessonCount: number;
  tags: string[];
}

export interface RoadmapPhase {
  id: string;
  title: string;
  description: string | null;
  position: number;
  skillCount: number;
  domainCount: number;
  unitCount: number;
  lessonCount: number;
  isFallback: boolean;
  groupingStrategy: "unit" | "domain";
  natureLabel: string;
  pacingHint: string | null;
  groups: RoadmapPhaseGroup[];
}

export interface RoadmapStructureIndex {
  canonicalSkillIds: string[];
  phaseIdBySkillId: Record<string, string | null>;
  groupIdBySkillId: Record<string, string | null>;
  domainIdBySkillId: Record<string, string>;
  unitRefBySkillId: Record<string, string | null>;
}

export interface CurriculumRoadmapModel {
  sourceId: string;
  sourceTitle: string;
  sourceVersion: number;
  summary: RoadmapSummary;
  phases: RoadmapPhase[];
  skills: RoadmapSkill[];
  skillById: Record<string, RoadmapSkill>;
  filters: {
    domains: RoadmapFilterOption[];
    units: RoadmapFilterOption[];
    roles: RoadmapFilterOption[];
    phases: RoadmapFilterOption[];
  };
  structureIndex: RoadmapStructureIndex;
  diagnostics: CurriculumProgressionData["diagnostics"];
}

interface TreeSkillInfo {
  nodeId: string;
  title: string;
  description?: string;
  canonicalOrder: number;
  domainId: string;
  domainTitle: string;
  strandId: string | null;
  strandTitle: string | null;
  goalGroupId: string | null;
  goalGroupTitle: string | null;
}

interface PhaseSeed {
  id: string;
  title: string;
  description: string | null;
  position: number;
  isFallback: boolean;
  natureLabel: string;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function collectTreeSkills(
  node: CurriculumTreeNode,
  ancestry: {
    domainId: string | null;
    domainTitle: string | null;
    strandId: string | null;
    strandTitle: string | null;
    goalGroupId: string | null;
    goalGroupTitle: string | null;
  },
  canonicalOrderMap: Map<string, number>,
  result: Map<string, TreeSkillInfo>,
) {
  const next = { ...ancestry };

  if (node.normalizedType === "domain") {
    next.domainId = node.id;
    next.domainTitle = node.title;
  } else if (node.normalizedType === "strand") {
    next.strandId = node.id;
    next.strandTitle = node.title;
  } else if (node.normalizedType === "goal_group") {
    next.goalGroupId = node.id;
    next.goalGroupTitle = node.title;
  }

  if (node.normalizedType === "skill") {
    result.set(node.id, {
      nodeId: node.id,
      title: node.title,
      description: node.description,
      canonicalOrder: canonicalOrderMap.get(node.id) ?? node.sequenceIndex,
      domainId: next.domainId ?? "domain:unknown",
      domainTitle: next.domainTitle ?? "Uncategorized",
      strandId: next.strandId,
      strandTitle: next.strandTitle,
      goalGroupId: next.goalGroupId,
      goalGroupTitle: next.goalGroupTitle,
    });
  }

  for (const child of node.children) {
    collectTreeSkills(child, next, canonicalOrderMap, result);
  }
}

function sortSkillIds(ids: string[], skillInfoById: Map<string, TreeSkillInfo>) {
  return [...ids].sort((left, right) => {
    const leftOrder = skillInfoById.get(left)?.canonicalOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = skillInfoById.get(right)?.canonicalOrder ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  return unique;
}

function countUniqueLinkedLessons(skills: RoadmapSkill[]) {
  return new Set(skills.flatMap((skill) => skill.linkedLessons.map((lesson) => lesson.id))).size;
}

function formatPacingLabel(source: CurriculumSource, outline: CurriculumUnitOutline[]) {
  const derivedSessions = outline.reduce((total, unit) => total + (unit.estimatedSessions ?? 0), 0);
  const totalSessions =
    source.pacing?.totalSessions
    ?? (derivedSessions > 0 ? derivedSessions : undefined);

  const summary: RoadmapPacingSummary = {
    totalWeeks: source.pacing?.totalWeeks,
    sessionsPerWeek: source.pacing?.sessionsPerWeek,
    sessionMinutes: source.pacing?.sessionMinutes,
    totalSessions,
    label: null,
  };

  const parts: string[] = [];
  if (summary.totalWeeks) parts.push(`${summary.totalWeeks} weeks`);
  if (summary.totalSessions) parts.push(`${summary.totalSessions} sessions`);
  if (summary.sessionsPerWeek) parts.push(`${summary.sessionsPerWeek}/week`);
  if (summary.sessionMinutes) parts.push(`${summary.sessionMinutes} min`);
  summary.label = parts.length > 0 ? parts.join(" · ") : null;

  return summary;
}

function progressionStatusSummary(
  status: ProgressionStatus,
  diagnostics: CurriculumProgressionData["diagnostics"],
): RoadmapProgressionSummary {
  switch (status) {
    case "explicit_ready":
      return {
        status,
        label: "Explicit progression ready",
        detail: "Using the stored phase plan and dependency semantics.",
        isExplicit: true,
        usingFallback: false,
      };
    case "explicit_failed":
      return {
        status,
        label: "Fallback sequence after failed generation",
        detail: diagnostics.lastFailureReason
          ? `Showing a fallback sequence while generation is fixed. Last failure: ${diagnostics.lastFailureReason}`
          : "Showing a fallback sequence while generation is fixed.",
        isExplicit: false,
        usingFallback: true,
      };
    case "fallback_only":
      return {
        status,
        label: "Fallback sequence",
        detail: "No accepted explicit phase plan is stored yet, so the roadmap follows a calmer inferred order.",
        isExplicit: false,
        usingFallback: true,
      };
    case "stale":
      return {
        status,
        label: "Progression needs refresh",
        detail: "The stored progression is older than the current curriculum source.",
        isExplicit: true,
        usingFallback: false,
      };
    case "not_attempted":
    default:
      return {
        status,
        label: diagnostics.hasExplicitProgression ? "Explicit progression ready" : "Canonical sequence",
        detail: diagnostics.hasExplicitProgression
          ? "Using the stored phase plan and dependency semantics."
          : "This source has not been given an explicit phase plan yet, so the roadmap follows canonical order.",
        isExplicit: diagnostics.hasExplicitProgression,
        usingFallback: !diagnostics.hasExplicitProgression,
      };
  }
}

function buildLaunchSliceSummary(source: CurriculumSource) {
  if (!source.launchPlan) return null;

  const skillCount = source.launchPlan.openingSkillNodeIds.length;
  const unitCount = source.launchPlan.openingUnitRefs.length;
  const labelParts = [];
  if (skillCount > 0) labelParts.push(`${skillCount} skill${skillCount === 1 ? "" : "s"}`);
  if (unitCount > 0) labelParts.push(`${unitCount} unit${unitCount === 1 ? "" : "s"}`);

  return {
    label:
      source.launchPlan.initialSliceLabel
      ?? (labelParts.length > 0 ? `Opening slice · ${labelParts.join(" · ")}` : "Opening slice ready"),
    scopeSummary: source.launchPlan.scopeSummary,
    skillCount,
    unitCount,
    initialSliceUsed: source.launchPlan.initialSliceUsed,
  } satisfies RoadmapLaunchSliceSummary;
}

function buildPhaseSeeds(
  tree: CurriculumTree,
  progression: CurriculumProgressionData,
  skillInfoById: Map<string, TreeSkillInfo>,
) {
  const sortedPhaseRecords = [...progression.phases].sort((left, right) => left.position - right.position);
  const phaseIdBySkillId = new Map<string, string | null>();
  const orderedSkillIds = tree.canonicalSkillNodeIds.filter((skillId) => skillInfoById.has(skillId));

  const phaseSeeds: PhaseSeed[] = sortedPhaseRecords.map((phase) => {
    return {
      id: phase.id,
      title: phase.title,
      description: phase.description ?? null,
      position: phase.position,
      isFallback: false,
      natureLabel: "This phase is part of the explicit teaching sequence.",
    };
  });

  for (const phase of sortedPhaseRecords) {
    for (const skillId of sortSkillIds(phase.skillNodeIds, skillInfoById)) {
      if (!skillInfoById.has(skillId) || phaseIdBySkillId.has(skillId)) continue;
      phaseIdBySkillId.set(skillId, phase.id);
    }
  }

  if (phaseSeeds.length === 0) {
    const fallbackId = "phase:fallback";
    const fallbackTitle = progression.diagnostics.usingInferredFallback ? "Recommended sequence" : "Canonical sequence";
    phaseSeeds.push({
      id: fallbackId,
      title: fallbackTitle,
      description: progression.diagnostics.usingInferredFallback
        ? "This roadmap shows a stable fallback sequence because an explicit progression has not been accepted yet."
        : "This source is shown in canonical order because it does not have an explicit phase model yet.",
      position: 0,
      isFallback: true,
      natureLabel: "This source is currently communicated as a single ordered sequence.",
    });

    for (const skillId of orderedSkillIds) {
      phaseIdBySkillId.set(skillId, fallbackId);
    }
  } else {
    const unphasedSkillIds = orderedSkillIds.filter((skillId) => !phaseIdBySkillId.has(skillId));
    if (unphasedSkillIds.length > 0) {
      const unplacedId = "phase:unplaced";
      phaseSeeds.push({
        id: unplacedId,
        title: "Needs placement",
        description: "These skills exist in the curriculum but are not assigned to any explicit phase yet.",
        position: phaseSeeds.length,
        isFallback: true,
        natureLabel: "These skills need explicit placement in the progression.",
      });

      for (const skillId of unphasedSkillIds) {
        phaseIdBySkillId.set(skillId, unplacedId);
      }
    }
  }

  const skillIdsByPhaseId = new Map<string, string[]>();
  for (const phase of phaseSeeds) {
    skillIdsByPhaseId.set(phase.id, []);
  }

  for (const skillId of orderedSkillIds) {
    const phaseId = phaseIdBySkillId.get(skillId);
    if (!phaseId) continue;
    const list = skillIdsByPhaseId.get(phaseId) ?? [];
    list.push(skillId);
    skillIdsByPhaseId.set(phaseId, list);
  }

  return {
    phaseSeeds,
    phaseIdBySkillId,
    skillIdsByPhaseId,
    orderedSkillIds,
  };
}

function titlesFromSkillIds(skillIds: string[], skillInfoById: Map<string, TreeSkillInfo>) {
  return sortSkillIds([...new Set(skillIds)], skillInfoById)
    .map((skillId) => skillInfoById.get(skillId)?.title)
    .filter((value): value is string => Boolean(value));
}

function buildDependencyMaps(prerequisites: CurriculumPrerequisiteRecord[]) {
  const incoming = new Map<string, CurriculumPrerequisiteRecord[]>();
  const outgoing = new Map<string, CurriculumPrerequisiteRecord[]>();

  for (const edge of prerequisites) {
    const inList = incoming.get(edge.skillNodeId) ?? [];
    inList.push(edge);
    incoming.set(edge.skillNodeId, inList);

    const outList = outgoing.get(edge.prerequisiteSkillNodeId) ?? [];
    outList.push(edge);
    outgoing.set(edge.prerequisiteSkillNodeId, outList);
  }

  return { incoming, outgoing };
}

function buildDependencySummary(
  skillId: string,
  dependencyMaps: ReturnType<typeof buildDependencyMaps>,
  skillInfoById: Map<string, TreeSkillInfo>,
) {
  const incoming = dependencyMaps.incoming.get(skillId) ?? [];
  const outgoing = dependencyMaps.outgoing.get(skillId) ?? [];

  const kindTitles = (kind: CurriculumPrerequisiteRecord["kind"]) =>
    titlesFromSkillIds(
      incoming
        .filter((edge) => edge.kind === kind)
        .map((edge) => edge.prerequisiteSkillNodeId),
      skillInfoById,
    );

  const unlockTitles = titlesFromSkillIds(
    [...new Set(outgoing.map((edge) => edge.skillNodeId))],
    skillInfoById,
  );

  return {
    hardPrerequisite: { count: kindTitles("hardPrerequisite").length, titles: kindTitles("hardPrerequisite") },
    recommendedBefore: { count: kindTitles("recommendedBefore").length, titles: kindTitles("recommendedBefore") },
    revisitAfter: { count: kindTitles("revisitAfter").length, titles: kindTitles("revisitAfter") },
    coPractice: { count: kindTitles("coPractice").length, titles: kindTitles("coPractice") },
    unlocks: { count: unlockTitles.length, titles: unlockTitles },
  };
}

function buildDomainSubtitle(skills: RoadmapSkill[]) {
  const strandTitles = uniqueStrings(skills.map((skill) => skill.strandTitle));
  const goalGroupTitles = uniqueStrings(skills.map((skill) => skill.goalGroupTitle));

  if (strandTitles.length === 1 && goalGroupTitles.length === 1) {
    return `${strandTitles[0]} · ${goalGroupTitles[0]}`;
  }
  if (strandTitles.length === 1) {
    return goalGroupTitles.length > 0
      ? `${strandTitles[0]} · ${goalGroupTitles.length} goal groups`
      : strandTitles[0];
  }
  if (strandTitles.length > 1) {
    return goalGroupTitles.length > 0
      ? `${strandTitles.length} strands · ${goalGroupTitles.length} goal groups`
      : `${strandTitles.length} strands`;
  }
  if (goalGroupTitles.length === 1) {
    return goalGroupTitles[0];
  }
  if (goalGroupTitles.length > 1) {
    return `${goalGroupTitles.length} goal groups`;
  }
  return "Grouped by domain";
}

function buildPhasePacingHint(phaseSkills: RoadmapSkill[], unitByRef: Map<string, CurriculumUnitOutline>) {
  const uniqueUnits = uniqueStrings(phaseSkills.map((skill) => skill.unitRef));
  if (uniqueUnits.length === 0) return null;

  const weeks = uniqueUnits.reduce((total, unitRef) => total + (unitByRef.get(unitRef)?.estimatedWeeks ?? 0), 0);
  const sessions = uniqueUnits.reduce((total, unitRef) => total + (unitByRef.get(unitRef)?.estimatedSessions ?? 0), 0);
  const parts: string[] = [];
  if (weeks > 0) parts.push(`~${weeks} week${weeks === 1 ? "" : "s"}`);
  if (sessions > 0) parts.push(`${sessions} sessions`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function shouldGroupByUnit(phaseSkills: RoadmapSkill[], unitByRef: Map<string, CurriculumUnitOutline>) {
  if (phaseSkills.length === 0) return false;
  const mapped = phaseSkills.filter((skill) => skill.unitRef && unitByRef.has(skill.unitRef));
  if (mapped.length === 0) return false;

  const coverage = mapped.length / phaseSkills.length;
  const uniqueUnitCount = new Set(mapped.map((skill) => skill.unitRef)).size;
  const averageSkillsPerUnit = uniqueUnitCount > 0 ? mapped.length / uniqueUnitCount : 0;
  const notWildlyFragmented =
    averageSkillsPerUnit >= 1.35
    || uniqueUnitCount <= 2;

  return coverage > 0.6 && notWildlyFragmented;
}

function buildPhaseGroups(params: {
  phase: PhaseSeed;
  skillIds: string[];
  skillById: Record<string, RoadmapSkill>;
  unitByRef: Map<string, CurriculumUnitOutline>;
  skillInfoById: Map<string, TreeSkillInfo>;
}) {
  const phaseSkills = params.skillIds.map((skillId) => params.skillById[skillId]).filter(Boolean);
  const useUnitGroups = shouldGroupByUnit(phaseSkills, params.unitByRef);

  if (phaseSkills.length === 0) {
    return {
      groupingStrategy: "domain" as const,
      groups: [] as RoadmapPhaseGroup[],
      pacingHint: null,
      natureLabel: params.phase.isFallback
        ? params.phase.natureLabel
        : "This phase is ready for skill placement, but no skills are assigned yet.",
    };
  }

  const groups: RoadmapPhaseGroup[] = [];

  if (useUnitGroups) {
    const byUnit = new Map<string, string[]>();
    const unanchored: string[] = [];

    for (const skillId of params.skillIds) {
      const skill = params.skillById[skillId];
      if (!skill) continue;
      if (skill.unitRef && params.unitByRef.has(skill.unitRef)) {
        const list = byUnit.get(skill.unitRef) ?? [];
        list.push(skillId);
        byUnit.set(skill.unitRef, list);
      } else {
        unanchored.push(skillId);
      }
    }

    const orderedUnitRefs = [...byUnit.keys()].sort((left, right) => {
      const leftUnit = params.unitByRef.get(left);
      const rightUnit = params.unitByRef.get(right);
      const leftOrder = leftUnit?.sequence ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = rightUnit?.sequence ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return (leftUnit?.title ?? left).localeCompare(rightUnit?.title ?? right);
    });

    orderedUnitRefs.forEach((unitRef, index) => {
      const unit = params.unitByRef.get(unitRef)!;
      const skillIds = sortSkillIds(byUnit.get(unitRef) ?? [], params.skillInfoById);
      const lessonCount = dedupeById(
        skillIds.flatMap((skillId) => params.skillById[skillId]?.linkedLessons ?? []),
      ).length;
      const tags: string[] = [];
      if (typeof unit.estimatedWeeks === "number") tags.push(`${unit.estimatedWeeks} wk`);
      if (typeof unit.estimatedSessions === "number") tags.push(`${unit.estimatedSessions} sessions`);
      if (skillIds.some((skillId) => params.skillById[skillId]?.launchSlice.included)) tags.push("Opening slice");

      groups.push({
        id: `${params.phase.id}:unit:${unitRef}`,
        type: "unit",
        title: unit.title,
        subtitle: unit.description ?? (lessonCount > 0 ? `${lessonCount} linked lesson${lessonCount === 1 ? "" : "s"}` : "Unit-linked work"),
        orderIndex: index,
        skillIds,
        lessonCount,
        tags,
      });
    });

    if (unanchored.length > 0) {
      const lessonCount = dedupeById(
        unanchored.flatMap((skillId) => params.skillById[skillId]?.linkedLessons ?? []),
      ).length;
      groups.push({
        id: `${params.phase.id}:unitless`,
        type: "domain",
        title: "Without unit anchors",
        subtitle: "These skills do not map cleanly to a stored unit yet.",
        orderIndex: groups.length,
        skillIds: sortSkillIds(unanchored, params.skillInfoById),
        lessonCount,
        tags: [],
      });
    }

    return {
      groupingStrategy: "unit" as const,
      groups,
      pacingHint: buildPhasePacingHint(phaseSkills, params.unitByRef),
      natureLabel: params.phase.isFallback
        ? params.phase.natureLabel
        : "This phase is organized around the strongest unit anchors in the curriculum.",
    };
  }

  const byDomain = new Map<string, string[]>();
  for (const skillId of params.skillIds) {
    const skill = params.skillById[skillId];
    if (!skill) continue;
    const list = byDomain.get(skill.domainId) ?? [];
    list.push(skillId);
    byDomain.set(skill.domainId, list);
  }

  const orderedDomainIds = [...byDomain.keys()].sort((left, right) => {
    const leftSkill = params.skillById[byDomain.get(left)?.[0] ?? ""];
    const rightSkill = params.skillById[byDomain.get(right)?.[0] ?? ""];
    const leftOrder = leftSkill?.canonicalOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = rightSkill?.canonicalOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return (leftSkill?.domainTitle ?? left).localeCompare(rightSkill?.domainTitle ?? right);
  });

  orderedDomainIds.forEach((domainId, index) => {
    const skillIds = sortSkillIds(byDomain.get(domainId) ?? [], params.skillInfoById);
    const skills = skillIds.map((skillId) => params.skillById[skillId]).filter(Boolean);
    const lessonCount = dedupeById(
      skillIds.flatMap((skillId) => params.skillById[skillId]?.linkedLessons ?? []),
    ).length;
    const unitCount = uniqueStrings(skills.map((skill) => skill.unitRef)).length;
    const tags: string[] = [];
    if (unitCount > 0) tags.push(`${unitCount} unit anchor${unitCount === 1 ? "" : "s"}`);
    if (skills.some((skill) => skill.launchSlice.included)) tags.push("Opening slice");

    groups.push({
      id: `${params.phase.id}:domain:${domainId}`,
      type: "domain",
      title: skills[0]?.domainTitle ?? "Domain",
      subtitle: buildDomainSubtitle(skills),
      orderIndex: index,
      skillIds,
      lessonCount,
      tags,
    });
  });

  return {
    groupingStrategy: "domain" as const,
    groups,
    pacingHint: buildPhasePacingHint(phaseSkills, params.unitByRef),
    natureLabel: params.phase.isFallback
      ? params.phase.natureLabel
      : "This phase is organized by domain because unit anchors are weak or too fragmented here.",
  };
}

export function buildCurriculumRoadmapModel(params: {
  tree: CurriculumTree;
  progression: CurriculumProgressionData;
  outline: CurriculumUnitOutline[];
  basis: ProgressionGenerationBasis;
}): CurriculumRoadmapModel {
  const canonicalOrderMap = new Map(params.tree.canonicalSkillNodeIds.map((skillId, index) => [skillId, index]));
  const skillInfoById = new Map<string, TreeSkillInfo>();
  for (const rootNode of params.tree.rootNodes) {
    collectTreeSkills(
      rootNode,
      {
        domainId: null,
        domainTitle: null,
        strandId: null,
        strandTitle: null,
        goalGroupId: null,
        goalGroupTitle: null,
      },
      canonicalOrderMap,
      skillInfoById,
    );
  }

  const skillRefByNodeId = new Map<string, string>();
  for (const [skillRef, skillNodeId] of params.basis.skillNodeIdByRef.entries()) {
    skillRefByNodeId.set(skillNodeId, skillRef);
  }

  const skillCatalogByRef = new Map(params.basis.skillCatalog.map((skill) => [skill.skillRef, skill]));
  const unitByRef = new Map(params.outline.map((unit) => [unit.unitRef, unit]));
  const lessonsBySkillRef = new Map<string, CurriculumLesson[]>();

  for (const unit of params.outline) {
    for (const lesson of unit.lessons) {
      for (const skillRef of lesson.linkedSkillRefs) {
        const list = lessonsBySkillRef.get(skillRef) ?? [];
        list.push(lesson);
        lessonsBySkillRef.set(skillRef, list);
      }
    }
  }

  const dependencyMaps = buildDependencyMaps(params.progression.prerequisites);
  const { phaseSeeds, phaseIdBySkillId, skillIdsByPhaseId, orderedSkillIds } = buildPhaseSeeds(
    params.tree,
    params.progression,
    skillInfoById,
  );
  const phaseById = new Map(phaseSeeds.map((phase) => [phase.id, phase]));

  const launchSkillIds = new Set(params.tree.source.launchPlan?.openingSkillNodeIds ?? []);
  const launchUnitRefs = new Set(params.tree.source.launchPlan?.openingUnitRefs ?? []);
  const skills: RoadmapSkill[] = [];
  const skillById: Record<string, RoadmapSkill> = {};

  for (const skillId of orderedSkillIds) {
    const skillInfo = skillInfoById.get(skillId);
    if (!skillInfo) continue;

    const skillRef = skillRefByNodeId.get(skillId);
    const catalog = skillRef ? skillCatalogByRef.get(skillRef) : undefined;
    const phaseId = phaseIdBySkillId.get(skillId) ?? null;
    const phase = phaseId ? phaseById.get(phaseId) ?? null : null;
    const linkedLessons = skillRef ? dedupeById(lessonsBySkillRef.get(skillRef) ?? []) : [];

    const skill: RoadmapSkill = {
      id: skillId,
      title: skillInfo.title,
      description: skillInfo.description,
      breadcrumb: uniqueStrings([skillInfo.domainTitle, skillInfo.strandTitle, skillInfo.goalGroupTitle]).join(" / "),
      domainId: skillInfo.domainId,
      domainTitle: skillInfo.domainTitle,
      strandId: skillInfo.strandId,
      strandTitle: skillInfo.strandTitle,
      goalGroupId: skillInfo.goalGroupId,
      goalGroupTitle: skillInfo.goalGroupTitle,
      phaseId,
      phaseTitle: phase?.title ?? null,
      unitRef: catalog?.unitRef ?? null,
      unitTitle: catalog?.unitTitle ?? null,
      unitOrderIndex: catalog?.unitOrderIndex ?? null,
      instructionalRole: catalog?.instructionalRole ?? null,
      requiresAdultSupport: catalog?.requiresAdultSupport === true,
      safetyCritical: catalog?.safetyCritical === true,
      isAuthenticApplication: catalog?.isAuthenticApplication === true,
      canonicalOrder: skillInfo.canonicalOrder,
      dependencySummary: buildDependencySummary(skillId, dependencyMaps, skillInfoById),
      lessonCount: linkedLessons.length,
      linkedLessonTitles: linkedLessons.map((lesson) => lesson.title),
      linkedLessons: linkedLessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        unitRef: lesson.unitRef,
        unitTitle: unitByRef.get(lesson.unitRef)?.title ?? lesson.unitRef,
      })),
      launchSlice: {
        included: launchSkillIds.has(skillId) || (catalog?.unitRef ? launchUnitRefs.has(catalog.unitRef) : false),
        viaSkill: launchSkillIds.has(skillId),
        viaUnit: catalog?.unitRef ? launchUnitRefs.has(catalog.unitRef) : false,
      },
    };

    skills.push(skill);
    skillById[skill.id] = skill;
  }

  const phases: RoadmapPhase[] = phaseSeeds.map((phase) => {
    const skillIds = skillIdsByPhaseId.get(phase.id) ?? [];
    const phaseSkills = skillIds.map((skillId) => skillById[skillId]).filter(Boolean);
    const { groups, groupingStrategy, natureLabel, pacingHint } = buildPhaseGroups({
      phase,
      skillIds,
      skillById,
      unitByRef,
      skillInfoById,
    });

    return {
      id: phase.id,
      title: phase.title,
      description: phase.description,
      position: phase.position,
      skillCount: phaseSkills.length,
      domainCount: uniqueStrings(phaseSkills.map((skill) => skill.domainId)).length,
      unitCount: uniqueStrings(phaseSkills.map((skill) => skill.unitRef)).length,
      lessonCount: countUniqueLinkedLessons(phaseSkills),
      isFallback: phase.isFallback,
      groupingStrategy,
      natureLabel,
      pacingHint,
      groups,
    };
  });

  const groupIdBySkillId: Record<string, string | null> = {};
  for (const phase of phases) {
    for (const group of phase.groups) {
      for (const skillId of group.skillIds) {
        groupIdBySkillId[skillId] = group.id;
      }
    }
  }

  const domains = new Map<string, RoadmapFilterOption>();
  const units = new Map<string, RoadmapFilterOption>();
  const roles = new Map<string, RoadmapFilterOption>();
  const phaseOptions = new Map<string, RoadmapFilterOption>();

  for (const skill of skills) {
    domains.set(skill.domainId, {
      id: skill.domainId,
      title: skill.domainTitle,
      count: (domains.get(skill.domainId)?.count ?? 0) + 1,
    });

    if (skill.unitRef && skill.unitTitle) {
      units.set(skill.unitRef, {
        id: skill.unitRef,
        title: skill.unitTitle,
        count: (units.get(skill.unitRef)?.count ?? 0) + 1,
      });
    }

    if (skill.instructionalRole) {
      roles.set(skill.instructionalRole, {
        id: skill.instructionalRole,
        title: skill.instructionalRole.replace(/_/g, " "),
        count: (roles.get(skill.instructionalRole)?.count ?? 0) + 1,
      });
    }

    if (skill.phaseId && skill.phaseTitle) {
      phaseOptions.set(skill.phaseId, {
        id: skill.phaseId,
        title: skill.phaseTitle,
        count: (phaseOptions.get(skill.phaseId)?.count ?? 0) + 1,
      });
    }
  }

  const pacing = formatPacingLabel(params.tree.source, params.outline);
  const progressionStatus =
    params.progression.diagnostics.progressionStatus
    ?? (params.progression.diagnostics.hasExplicitProgression ? "explicit_ready" : "fallback_only");

  return {
    sourceId: params.tree.source.id,
    sourceTitle: params.tree.source.title,
    sourceVersion: params.tree.source.importVersion,
    summary: {
      totalSkills: skills.length,
      totalPhases: phases.length,
      totalUnits: params.outline.length,
      totalLessons: params.outline.reduce((total, unit) => total + unit.lessons.length, 0),
      pacing,
      progression: progressionStatusSummary(progressionStatus, params.progression.diagnostics),
      launchSlice: buildLaunchSliceSummary(params.tree.source),
    },
    phases,
    skills,
    skillById,
    filters: {
      domains: [...domains.values()].sort((left, right) => left.title.localeCompare(right.title)),
      units: [...units.values()].sort((left, right) => left.title.localeCompare(right.title)),
      roles: [...roles.values()].sort((left, right) => left.title.localeCompare(right.title)),
      phases: [...phaseOptions.values()].sort((left, right) => left.title.localeCompare(right.title)),
    },
    structureIndex: {
      canonicalSkillIds: orderedSkillIds,
      phaseIdBySkillId: Object.fromEntries(orderedSkillIds.map((skillId) => [skillId, phaseIdBySkillId.get(skillId) ?? null])),
      groupIdBySkillId: Object.fromEntries(orderedSkillIds.map((skillId) => [skillId, groupIdBySkillId[skillId] ?? null])),
      domainIdBySkillId: Object.fromEntries(orderedSkillIds.map((skillId) => [skillId, skillById[skillId]?.domainId ?? "domain:unknown"])),
      unitRefBySkillId: Object.fromEntries(orderedSkillIds.map((skillId) => [skillId, skillById[skillId]?.unitRef ?? null])),
    },
    diagnostics: params.progression.diagnostics,
  };
}
