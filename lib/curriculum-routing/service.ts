import { and, asc, eq, inArray, lt, ne } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import { getEnabledPlanningDayOffsets } from "./planning-days";
import { normalizeTargetItemsPerDay } from "./defaults";
import {
  curriculumNodes,
  curriculumSources,
  curriculumPhases,
  curriculumPhaseNodes,
  curriculumSkillPrerequisites,
  learnerBranchActivations,
  learnerRouteProfiles,
  learnerSkillStates,
  routeOverrideEvents,
  weeklyRouteItems,
  weeklyRoutes,
} from "@/lib/db/schema";

import type {
  WeeklyRouteBoard,
  WeeklyRouteBoardItem,
  WeeklyRouteConflict,
  WeeklyRouteDailySelectionHandoff,
  WeeklyRouteManualOverrideKind,
  WeeklyRouteRepairOperation,
  WeeklyRouteRepairPreview,
  WeeklyRouteRepairAction,
  WeeklyRouteItemState,
} from "./types";

type WeeklyRouteRecord = typeof weeklyRoutes.$inferSelect;
type WeeklyRouteItemRecord = typeof weeklyRouteItems.$inferSelect;
type LearnerRouteProfileRecord = typeof learnerRouteProfiles.$inferSelect;
type LearnerSkillStateRecord = typeof learnerSkillStates.$inferSelect;
type CurriculumPrerequisiteRecord = typeof curriculumSkillPrerequisites.$inferSelect;

type SkillStatus = LearnerSkillStateRecord["status"];

const COMPLETE_SKILL_STATUSES = new Set<SkillStatus>(["completed", "mastered"]);
const UNSCHEDULED_BLOCKING_SKILL_STATUSES = new Set<SkillStatus>([
  "completed",
  "mastered",
  "blocked",
  "paused",
  "skipped",
]);
const UNFINISHED_SCHEDULED_STATUSES = new Set<SkillStatus>(["scheduled", "in_progress"]);

const CAPACITY_STATES = new Set<WeeklyRouteItemState>(["queued", "scheduled", "in_progress"]);
const WEEKDAY_COUNT = 7;

type RouteBoardContext = {
  sourceId: string;
  targetItemsPerWeek: number;
  skillStatusBySkillNodeId: Map<string, SkillStatus>;
  hardPrerequisitesBySkillNodeId: Map<string, string[]>;
  recommendedBeforeBySkillNodeId: Map<string, string[]>;
  revisitAfterBySkillNodeId: Map<string, string[]>;
  coPracticeBySkillNodeId: Map<string, string[]>;
  phaseIdBySkillNodeId: Map<string, string>;
  orderedPhaseIds: string[];
};

type CurriculumSourceMetadata = Record<string, unknown>;

type RouteItemProjection = {
  id: string;
  skillNodeId: string;
  currentPosition: number;
  scheduledDate: string | null;
  scheduledSlotIndex: number | null;
  state: WeeklyRouteItemState;
  manualOverrideKind: WeeklyRouteManualOverrideKind;
};

function parseDateOrThrow(value: string): Date {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
}

export function toWeekStartDate(inputDate?: string): string {
  const base = inputDate ? parseDateOrThrow(inputDate) : new Date();
  const normalized = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const weekday = normalized.getUTCDay();
  const offset = (weekday + 6) % 7;
  normalized.setUTCDate(normalized.getUTCDate() - offset);
  return normalized.toISOString().slice(0, 10);
}

function addDays(baseDate: string, days: number) {
  const date = parseDateOrThrow(baseDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildWeekDates(weekStartDate: string) {
  return Array.from({ length: WEEKDAY_COUNT }, (_, index) => addDays(weekStartDate, index));
}

function buildSuggestedScheduledDates(params: {
  weekStartDate: string;
  itemCount: number;
  targetItemsPerDay: number;
  enabledDayOffsets: number[];
}) {
  const allDays = buildWeekDates(params.weekStartDate);
  const enabledDays = params.enabledDayOffsets
    .map((offset) => allDays[offset])
    .filter((d): d is string => d != null);
  const targetItemsPerDay = Math.max(1, params.targetItemsPerDay);

  return Array.from({ length: params.itemCount }, (_, index) => {
    const dayIndex = Math.floor(index / targetItemsPerDay);
    return enabledDays[dayIndex] ?? null;
  });
}

export interface SuggestedSchedulePlacement {
  scheduledDate: string | null;
  scheduledSlotIndex: number | null;
}

export function buildSuggestedSchedulePlacements(params: {
  weekStartDate: string;
  itemCount: number;
  targetItemsPerDay: number;
  enabledDayOffsets: number[];
}): SuggestedSchedulePlacement[] {
  const scheduledDates = buildSuggestedScheduledDates(params);
  const nextSlotIndexByDate = new Map<string, number>();

  return scheduledDates.map((scheduledDate) => {
    if (!scheduledDate) {
      return {
        scheduledDate: null,
        scheduledSlotIndex: null,
      };
    }

    const scheduledSlotIndex = nextSlotIndexByDate.get(scheduledDate) ?? 1;
    nextSlotIndexByDate.set(scheduledDate, scheduledSlotIndex + 1);

    return {
      scheduledDate,
      scheduledSlotIndex,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => entry != null);
}

function getPlanningDayCount(profile: LearnerRouteProfileRecord | null): number {
  const planningDays = profile?.planningDays;
  if (!planningDays) {
    return 5;
  }

  if (Array.isArray(planningDays)) {
    const values = planningDays.filter((value) => Boolean(value));
    return values.length > 0 ? values.length : 5;
  }

  const values = Object.values(planningDays);
  if (values.length === 0) {
    return 5;
  }

  const enabledCount = values.filter((value) => Boolean(value)).length;
  return enabledCount > 0 ? enabledCount : 5;
}

function getTargetItemsPerWeek(profile: LearnerRouteProfileRecord | null): number {
  const targetItemsPerDay = normalizeTargetItemsPerDay(profile?.targetItemsPerDay ?? null);
  const planningDayCount = getPlanningDayCount(profile);
  return Math.max(1, targetItemsPerDay * planningDayCount);
}

function getBranchWeight(profile: LearnerRouteProfileRecord | null, branchNodeId: string): number {
  if (!profile?.branchWeighting) {
    return 1;
  }

  const rawValue = profile.branchWeighting[branchNodeId];
  const parsed = readNumber(rawValue);
  if (parsed == null) {
    return 1;
  }

  return Math.min(10, Math.max(1, Math.floor(parsed)));
}

function getCanonicalPosition(node: typeof curriculumNodes.$inferSelect, fallback: number): number {
  const fromMetadata = readNumber(node.metadata.canonicalSequenceIndex);
  if (fromMetadata != null) {
    return Math.max(0, Math.floor(fromMetadata));
  }
  return fallback;
}

function isSkillComplete(status: SkillStatus): boolean {
  return COMPLETE_SKILL_STATUSES.has(status);
}

function isSchedulableStatus(status: SkillStatus): boolean {
  return !UNSCHEDULED_BLOCKING_SKILL_STATUSES.has(status);
}

function sortNodes(left: typeof curriculumNodes.$inferSelect, right: typeof curriculumNodes.$inferSelect) {
  if (left.sequenceIndex !== right.sequenceIndex) {
    return left.sequenceIndex - right.sequenceIndex;
  }
  if (left.depth !== right.depth) {
    return left.depth - right.depth;
  }
  return left.id.localeCompare(right.id);
}

function moveArrayItem<T>(array: T[], fromIndex: number, toIndex: number) {
  const copy = [...array];
  const [entry] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, entry);
  return copy;
}

function normalizeProjectedPositions(items: RouteItemProjection[]): RouteItemProjection[] {
  const ordered = [...items].sort((left, right) => {
    if (left.currentPosition !== right.currentPosition) {
      return left.currentPosition - right.currentPosition;
    }
    return left.id.localeCompare(right.id);
  });

  return ordered.map((item, index) => ({
    ...item,
    currentPosition: index,
  }));
}

function mapDailySelection(item: WeeklyRouteBoardItem): WeeklyRouteDailySelectionHandoff {
  return {
    weeklyRouteItemId: item.id,
    curriculumSourceId: item.sourceId,
    curriculumSkillNodeId: item.skillNodeId,
    currentPosition: item.currentPosition,
    scheduledDate: item.scheduledDate,
    scheduledSlotIndex: item.scheduledSlotIndex ?? null,
    state: item.state,
  };
}

function getScheduledConflictKey(item: WeeklyRouteBoardItem) {
  if (!item.scheduledDate) {
    return null;
  }

  return `${item.skillNodeId}::${item.scheduledDate}`;
}

function computeConflicts(
  items: WeeklyRouteBoardItem[],
  context: RouteBoardContext,
): WeeklyRouteConflict[] {
  const conflicts: WeeklyRouteConflict[] = [];
  const byScheduledSkillKey = new Map<string, WeeklyRouteBoardItem[]>();
  const itemsBySkillNodeId = new Map<string, WeeklyRouteBoardItem[]>();
  const firstActivePositionBySkillNodeId = new Map<string, number>();

  for (const item of items) {
    const skillEntries = itemsBySkillNodeId.get(item.skillNodeId) ?? [];
    skillEntries.push(item);
    itemsBySkillNodeId.set(item.skillNodeId, skillEntries);

    if (item.state !== "removed") {
      const existingFirst = firstActivePositionBySkillNodeId.get(item.skillNodeId);
      if (existingFirst == null || item.currentPosition < existingFirst) {
        firstActivePositionBySkillNodeId.set(item.skillNodeId, item.currentPosition);
      }
    }

    const conflictKey = getScheduledConflictKey(item);
    if (!conflictKey) {
      continue;
    }

    const existing = byScheduledSkillKey.get(conflictKey) ?? [];
    existing.push(item);
    byScheduledSkillKey.set(conflictKey, existing);
  }

  for (const [skillKey, itemGroup] of byScheduledSkillKey) {
    const ordered = [...itemGroup].sort((left, right) => left.currentPosition - right.currentPosition);
    const separatorIndex = skillKey.indexOf("::");
    const skillNodeId = separatorIndex >= 0 ? skillKey.slice(0, separatorIndex) : skillKey;
    if (ordered.length > 1) {
      conflicts.push({
        type: "item_scheduled_twice",
        affectedItemIds: ordered.map((entry) => entry.id),
        blockingSkillNodeIds: [skillNodeId],
        explanation: "This skill is scheduled multiple times on the same day.",
        suggestedRepairActions: ["drop_duplicate"],
        keepOverrideAllowed: false,
      });
    }
  }

  const activeItems = items.filter((item) => CAPACITY_STATES.has(item.state));
  if (activeItems.length > context.targetItemsPerWeek) {
    const overflow = activeItems
      .sort((left, right) => left.currentPosition - right.currentPosition)
      .slice(context.targetItemsPerWeek);

    conflicts.push({
      type: "weekly_capacity_exceeded",
      affectedItemIds: overflow.map((item) => item.id),
      blockingSkillNodeIds: [],
      explanation: `Weekly capacity is ${context.targetItemsPerWeek}, but ${activeItems.length} active items are queued.`,
      suggestedRepairActions: ["rebalance_over_capacity"],
      keepOverrideAllowed: false,
    });
  }

  const isResolved = (skillNodeId: string) => {
    const status = context.skillStatusBySkillNodeId.get(skillNodeId) ?? "not_started";
    if (isSkillComplete(status)) {
      return true;
    }
    const routeItems = itemsBySkillNodeId.get(skillNodeId) ?? [];
    return routeItems.some((routeItem) => routeItem.state === "done");
  };

  for (const item of items) {
    if (item.state === "removed") {
      continue;
    }

    const firstActivePosition = firstActivePositionBySkillNodeId.get(item.skillNodeId);
    if (firstActivePosition != null && item.currentPosition > firstActivePosition) {
      continue;
    }

    // Hard Blockers
    const hardBlocked = (context.hardPrerequisitesBySkillNodeId.get(item.skillNodeId) ?? [])
      .filter((skillNodeId) => !isResolved(skillNodeId));
    if (hardBlocked.length > 0) {
      conflicts.push({
        type: "explicit_prerequisite_blocked",
        affectedItemIds: [item.id],
        blockingSkillNodeIds: hardBlocked,
        explanation: "This skill has unresolved hard prerequisites in the progression graph.",
        suggestedRepairActions: ["move_item_later"],
        keepOverrideAllowed: false,
      });
    }

    // Soft Blockers (Recommended)
    const recommendedBlocked = (context.recommendedBeforeBySkillNodeId.get(item.skillNodeId) ?? [])
      .filter((skillNodeId) => !isResolved(skillNodeId));
    if (recommendedBlocked.length > 0) {
      conflicts.push({
        type: "predecessor_not_completed",
        affectedItemIds: [item.id],
        blockingSkillNodeIds: recommendedBlocked,
        explanation: "This skill is recommended to follow other skills that are not yet complete.",
        suggestedRepairActions: ["move_predecessor_earlier", "move_item_later", "acknowledge_skip"],
        keepOverrideAllowed: true,
      });

      const movedAhead = recommendedBlocked.some((skillNodeId) => {
        const predecessorItems = itemsBySkillNodeId.get(skillNodeId) ?? [];
        const predecessorItem = predecessorItems
          .filter((entry) => entry.state !== "done" && entry.state !== "removed")
          .sort((left, right) => right.currentPosition - left.currentPosition)[0];
        if (!predecessorItem) {
          return true;
        }
        return predecessorItem.currentPosition >= item.currentPosition;
      });

      if (item.manualOverrideKind === "reordered" && movedAhead) {
        conflicts.push({
          type: "reordered_ahead_of_predecessor",
          affectedItemIds: [item.id],
          blockingSkillNodeIds: recommendedBlocked,
          explanation: "Manual reorder moved this skill ahead of a recommended predecessor.",
          suggestedRepairActions: ["move_item_later", "acknowledge_skip"],
          keepOverrideAllowed: true,
        });
      }
    }
  }

  return conflicts;
}

async function loadRouteByWeek(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate: string;
}) {
  return getDb().query.weeklyRoutes.findFirst({
    where: (table, { and: andWhere, eq: eqWhere }) =>
      andWhere(
        eqWhere(table.learnerId, params.learnerId),
        eqWhere(table.sourceId, params.sourceId),
        eqWhere(table.weekStartDate, params.weekStartDate),
      ),
  });
}

async function loadRouteById(params: { weeklyRouteId: string; learnerId: string }) {
  return getDb().query.weeklyRoutes.findFirst({
    where: (table, { and: andWhere, eq: eqWhere }) =>
      andWhere(eqWhere(table.id, params.weeklyRouteId), eqWhere(table.learnerId, params.learnerId)),
  });
}

async function buildRouteBoard(route: WeeklyRouteRecord): Promise<WeeklyRouteBoard> {
  const db = getDb();
  const profile = await db.query.learnerRouteProfiles.findFirst({
    where: and(eq(learnerRouteProfiles.learnerId, route.learnerId), eq(learnerRouteProfiles.sourceId, route.sourceId)),
  });

  const targetItemsPerWeek = getTargetItemsPerWeek(profile ?? null);

  const rows = await db
    .select({
      item: weeklyRouteItems,
      node: curriculumNodes,
    })
    .from(weeklyRouteItems)
    .innerJoin(curriculumNodes, eq(weeklyRouteItems.skillNodeId, curriculumNodes.id))
    .where(eq(weeklyRouteItems.weeklyRouteId, route.id))
    .orderBy(asc(weeklyRouteItems.currentPosition), asc(weeklyRouteItems.createdAt));

  const skillNodeIds = rows.map((row) => row.item.skillNodeId);

  const skillStates = skillNodeIds.length
    ? await db.query.learnerSkillStates.findMany({
        where: and(
          eq(learnerSkillStates.learnerId, route.learnerId),
          inArray(learnerSkillStates.skillNodeId, skillNodeIds),
        ),
      })
    : [];

  const prerequisites = await db.query.curriculumSkillPrerequisites.findMany({
    where: eq(curriculumSkillPrerequisites.sourceId, route.sourceId),
  });

  const phases = await db.query.curriculumPhases.findMany({
    where: eq(curriculumPhases.sourceId, route.sourceId),
    orderBy: [asc(curriculumPhases.position), asc(curriculumPhases.createdAt)],
  });

  const phaseNodes = phases.length > 0
    ? await db.query.curriculumPhaseNodes.findMany({
        where: inArray(
          curriculumPhaseNodes.phaseId,
          phases.map((p) => p.id),
        ),
      })
    : [];

  const statusBySkillNodeId = new Map<string, SkillStatus>(
    skillStates.map((state) => [state.skillNodeId, state.status]),
  );

  const canonicalOrder = [...rows]
    .sort((left, right) => sortNodes(left.node, right.node))
    .map((row) => row.node.id);
  const canonicalFallbackBySkillNodeId = new Map<string, number>(
    canonicalOrder.map((skillNodeId, index) => [skillNodeId, index]),
  );

  const hardPrerequisitesBySkillNodeId = new Map<string, string[]>();
  const recommendedBeforeBySkillNodeId = new Map<string, string[]>();
  const revisitAfterBySkillNodeId = new Map<string, string[]>();
  const coPracticeBySkillNodeId = new Map<string, string[]>();

  for (const prerequisite of prerequisites) {
    let map: Map<string, string[]>;
    switch (prerequisite.kind) {
      case "hardPrerequisite":
      case "explicit": // Treat existing explicit as hard for backward compatibility or as requested
        map = hardPrerequisitesBySkillNodeId;
        break;
      case "recommendedBefore":
      case "inferred": // Treat existing inferred as recommended
        map = recommendedBeforeBySkillNodeId;
        break;
      case "revisitAfter":
        map = revisitAfterBySkillNodeId;
        break;
      case "coPractice":
        map = coPracticeBySkillNodeId;
        break;
      default:
        continue;
    }
    const values = map.get(prerequisite.skillNodeId) ?? [];
    values.push(prerequisite.prerequisiteSkillNodeId);
    map.set(prerequisite.skillNodeId, values);
  }

  const phaseIdBySkillNodeId = new Map<string, string>();
  for (const pn of phaseNodes) {
    phaseIdBySkillNodeId.set(pn.curriculumNodeId, pn.phaseId);
  }
  const orderedPhaseIds = phases.map((p) => p.id);

  const items: WeeklyRouteBoardItem[] = rows.map(({ item, node }) => {
    const canonicalPosition = getCanonicalPosition(node, canonicalFallbackBySkillNodeId.get(node.id) ?? 0);
    const status = statusBySkillNodeId.get(item.skillNodeId) ?? "not_started";

    const boardItem: WeeklyRouteBoardItem = {
      id: item.id,
      weeklyRouteId: item.weeklyRouteId,
      learnerId: item.learnerId,
      sourceId: route.sourceId,
      skillNodeId: item.skillNodeId,
      skillTitle: node.title,
      skillPath: node.normalizedPath,
      estimatedMinutes: node.estimatedMinutes ?? null,
      canonicalPosition,
      recommendedPosition: item.recommendedPosition,
      currentPosition: item.currentPosition,
      scheduledDate: item.scheduledDate,
      scheduledSlotIndex: item.scheduledSlotIndex,
      manualOverrideKind: item.manualOverrideKind,
      manualOverrideNote: item.manualOverrideNote,
      state: item.state,
      learnerSkillStatus: status,
      explicitPrerequisiteSkillNodeIds: hardPrerequisitesBySkillNodeId.get(item.skillNodeId) ?? [],
      predecessorSkillNodeIds: recommendedBeforeBySkillNodeId.get(item.skillNodeId) ?? [],
      dailySelection: {
        weeklyRouteItemId: item.id,
        curriculumSourceId: route.sourceId,
        curriculumSkillNodeId: item.skillNodeId,
        currentPosition: item.currentPosition,
        scheduledDate: item.scheduledDate,
        scheduledSlotIndex: item.scheduledSlotIndex,
        state: item.state,
      },
    };

    return boardItem;
  });

  const context: RouteBoardContext = {
    sourceId: route.sourceId,
    targetItemsPerWeek,
    skillStatusBySkillNodeId: statusBySkillNodeId,
    hardPrerequisitesBySkillNodeId,
    recommendedBeforeBySkillNodeId,
    revisitAfterBySkillNodeId,
    coPracticeBySkillNodeId,
    phaseIdBySkillNodeId,
    orderedPhaseIds,
  };

  const conflicts = computeConflicts(items, context);

  // Debug output: progression consumption basis
  const hasExplicitProgression = orderedPhaseIds.length > 0 || phaseIdBySkillNodeId.size > 0;
  const skillsWithHardPrereqs = items.filter((item) => (hardPrerequisitesBySkillNodeId.get(item.skillNodeId) ?? []).length > 0).length;
  const skillsWithRecommendedBefore = items.filter((item) => (recommendedBeforeBySkillNodeId.get(item.skillNodeId) ?? []).length > 0).length;
  const skillsAssignedToPhases = items.filter((item) => phaseIdBySkillNodeId.has(item.skillNodeId)).length;
  const inferredOrderPrereqs = prerequisites.filter((p) => p.kind === "inferred").length;
  const explicitPrereqs = prerequisites.filter((p) => p.kind !== "inferred").length;

  console.info("[curriculum-routing] Route board built.", {
    sourceId: route.sourceId,
    learnerId: route.learnerId,
    weekStartDate: route.weekStartDate,
    itemCount: items.length,
    phaseCount: orderedPhaseIds.length,
    skillsAssignedToPhases,
    skillsWithHardPrereqs,
    skillsWithRecommendedBefore,
    explicitPrereqs,
    inferredOrderPrereqs,
    hasExplicitProgression,
    usingInferredFallback: !hasExplicitProgression,
    conflictCount: conflicts.length,
  });

  return {
    summary: {
      weeklyRouteId: route.id,
      learnerId: route.learnerId,
      sourceId: route.sourceId,
      weekStartDate: route.weekStartDate,
      generationVersion: route.generationVersion,
      status: route.status,
      targetItemsPerWeek,
      queuedItems: items.filter((item) => item.state === "queued").length,
      removedItems: items.filter((item) => item.state === "removed").length,
      doneItems: items.filter((item) => item.state === "done").length,
    },
    items,
    conflicts,
  };
}

function buildSkillMaps(nodes: typeof curriculumNodes.$inferSelect[]) {
  const nodeById = new Map<string, typeof curriculumNodes.$inferSelect>(nodes.map((node) => [node.id, node]));
  const childrenByNodeId = new Map<string, typeof curriculumNodes.$inferSelect[]>();

  for (const node of nodes) {
    if (!node.parentNodeId) {
      continue;
    }
    const siblings = childrenByNodeId.get(node.parentNodeId) ?? [];
    siblings.push(node);
    childrenByNodeId.set(node.parentNodeId, siblings);
  }

  for (const [nodeId, children] of childrenByNodeId) {
    childrenByNodeId.set(nodeId, children.sort(sortNodes));
  }

  const allSkills = nodes.filter((node) => node.normalizedType === "skill");
  const canonicalOrderedSkills = [...allSkills].sort((left, right) => {
    const leftPosition = getCanonicalPosition(left, Number.MAX_SAFE_INTEGER);
    const rightPosition = getCanonicalPosition(right, Number.MAX_SAFE_INTEGER);
    if (leftPosition !== rightPosition) {
      return leftPosition - rightPosition;
    }
    return left.id.localeCompare(right.id);
  });

  const canonicalPositionBySkillNodeId = new Map<string, number>(
    canonicalOrderedSkills.map((node, index) => [node.id, index]),
  );

  const collectSkillDescendants = (nodeId: string): string[] => {
    const branchRoot = nodeById.get(nodeId);
    if (!branchRoot) {
      return [];
    }

    if (branchRoot.normalizedType === "skill") {
      return [branchRoot.id];
    }

    const results: string[] = [];
    const walk = (currentNodeId: string) => {
      const children = childrenByNodeId.get(currentNodeId) ?? [];
      for (const child of children) {
        if (child.normalizedType === "skill") {
          results.push(child.id);
        } else {
          walk(child.id);
        }
      }
    };

    walk(nodeId);
    return results.sort((left, right) => {
      const leftPosition = canonicalPositionBySkillNodeId.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = canonicalPositionBySkillNodeId.get(right) ?? Number.MAX_SAFE_INTEGER;
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }
      return left.localeCompare(right);
    });
  };

  return {
    nodeById,
    canonicalPositionBySkillNodeId,
    collectSkillDescendants,
  };
}

interface GenerationContext {
  profile: LearnerRouteProfileRecord | null;
  sourceMetadata: CurriculumSourceMetadata;
  activeBranchActivations: Array<typeof learnerBranchActivations.$inferSelect>;
  nodes: typeof curriculumNodes.$inferSelect[];
  prerequisites: CurriculumPrerequisiteRecord[];
  phases: Array<typeof curriculumPhases.$inferSelect>;
  phaseNodes: Array<typeof curriculumPhaseNodes.$inferSelect>;
  skillStateBySkillNodeId: Map<string, SkillStatus>;
  plannedSkillNodeIdsBeforeWeek: Set<string>;
}

async function loadGenerationContext(params: { learnerId: string; sourceId: string }): Promise<GenerationContext> {
  const db = getDb();
  const [profile, source, activeBranchActivations, nodes, prerequisites, phases, phaseNodes, skillStates] = await Promise.all([
    db.query.learnerRouteProfiles.findFirst({
      where: and(eq(learnerRouteProfiles.learnerId, params.learnerId), eq(learnerRouteProfiles.sourceId, params.sourceId)),
    }),
    db.query.curriculumSources.findFirst({
      where: eq(curriculumSources.id, params.sourceId),
    }),
    db.query.learnerBranchActivations.findMany({
      where: and(
        eq(learnerBranchActivations.learnerId, params.learnerId),
        eq(learnerBranchActivations.sourceId, params.sourceId),
        eq(learnerBranchActivations.status, "active"),
      ),
      orderBy: [asc(learnerBranchActivations.createdAt)],
    }),
    db.query.curriculumNodes.findMany({
      where: and(eq(curriculumNodes.sourceId, params.sourceId), eq(curriculumNodes.isActive, true)),
      orderBy: [asc(curriculumNodes.depth), asc(curriculumNodes.sequenceIndex), asc(curriculumNodes.createdAt)],
    }),
    db.query.curriculumSkillPrerequisites.findMany({
      where: eq(curriculumSkillPrerequisites.sourceId, params.sourceId),
    }),
    db.query.curriculumPhases.findMany({
      where: eq(curriculumPhases.sourceId, params.sourceId),
      orderBy: [asc(curriculumPhases.position), asc(curriculumPhases.createdAt)],
    }),
    db.query.curriculumPhaseNodes.findMany({
      where: inArray(
        curriculumPhaseNodes.phaseId,
        db
          .select({ id: curriculumPhases.id })
          .from(curriculumPhases)
          .where(eq(curriculumPhases.sourceId, params.sourceId)),
      ),
    }),
    db.query.learnerSkillStates.findMany({
      where: and(eq(learnerSkillStates.learnerId, params.learnerId), eq(learnerSkillStates.sourceId, params.sourceId)),
    }),
  ]);

  return {
    profile: profile ?? null,
    sourceMetadata: isRecord(source?.metadata) ? source.metadata : {},
    activeBranchActivations,
    nodes,
    prerequisites,
    phases,
    phaseNodes,
    skillStateBySkillNodeId: new Map<string, SkillStatus>(
      skillStates.map((state) => [state.skillNodeId, state.status]),
    ),
    plannedSkillNodeIdsBeforeWeek: new Set<string>(),
  };
}

async function loadPlannedSkillNodeIdsBeforeWeek(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate: string;
}) {
  const rows = await getDb()
    .select({
      skillNodeId: weeklyRouteItems.skillNodeId,
    })
    .from(weeklyRouteItems)
    .innerJoin(weeklyRoutes, eq(weeklyRouteItems.weeklyRouteId, weeklyRoutes.id))
    .where(
      and(
        eq(weeklyRoutes.learnerId, params.learnerId),
        eq(weeklyRoutes.sourceId, params.sourceId),
        inArray(weeklyRoutes.status, ["draft", "active"]),
        lt(weeklyRoutes.weekStartDate, params.weekStartDate),
        ne(weeklyRouteItems.state, "removed"),
      ),
    );

  return new Set(rows.map((row) => row.skillNodeId));
}

function buildRecommendations(params: {
  profile: LearnerRouteProfileRecord | null;
  sourceMetadata: CurriculumSourceMetadata;
  activeBranchActivations: Array<typeof learnerBranchActivations.$inferSelect>;
  nodes: typeof curriculumNodes.$inferSelect[];
  prerequisites: CurriculumPrerequisiteRecord[];
  phases: Array<typeof curriculumPhases.$inferSelect>;
  phaseNodes: Array<typeof curriculumPhaseNodes.$inferSelect>;
  skillStateBySkillNodeId: Map<string, SkillStatus>;
  plannedSkillNodeIdsBeforeWeek: Set<string>;
}): {
  orderedSkillNodeIds: string[];
  targetItemsPerWeek: number;
  targetItemsPerDay: number;
  planningDayCount: number;
  enabledDayOffsets: number[];
  generationBasis: Record<string, unknown>;
} {
  const {
    profile,
    sourceMetadata,
    activeBranchActivations,
    nodes,
    prerequisites,
    phases,
    phaseNodes,
    skillStateBySkillNodeId,
    plannedSkillNodeIdsBeforeWeek,
  } = params;
  const targetItemsPerWeek = getTargetItemsPerWeek(profile);
  const targetItemsPerDay = normalizeTargetItemsPerDay(profile?.targetItemsPerDay ?? null);
  const planningDayCount = getPlanningDayCount(profile);
  const enabledDayOffsets = getEnabledPlanningDayOffsets(profile?.planningDays ?? null);

  const { nodeById, canonicalPositionBySkillNodeId, collectSkillDescendants } = buildSkillMaps(nodes);
  const rawLaunchPlan = isRecord(sourceMetadata.launchPlan) ? sourceMetadata.launchPlan : {};
  const openingSkillNodeIds = readStringArray(rawLaunchPlan.openingSkillNodeIds);

  // Map prerequisites by kind
  const hardPrerequisitesBySkillNodeId = new Map<string, string[]>();
  const recommendedBeforeBySkillNodeId = new Map<string, string[]>();
  const revisitAfterBySkillNodeId = new Map<string, string[]>();
  const coPracticeBySkillNodeId = new Map<string, string[]>();

  for (const prerequisite of prerequisites) {
    let map: Map<string, string[]>;
    switch (prerequisite.kind) {
      case "hardPrerequisite":
      case "explicit":
        map = hardPrerequisitesBySkillNodeId;
        break;
      case "recommendedBefore":
      case "inferred":
        map = recommendedBeforeBySkillNodeId;
        break;
      case "revisitAfter":
        map = revisitAfterBySkillNodeId;
        break;
      case "coPractice":
        map = coPracticeBySkillNodeId;
        break;
      default:
        continue;
    }
    const values = map.get(prerequisite.skillNodeId) ?? [];
    values.push(prerequisite.prerequisiteSkillNodeId);
    map.set(prerequisite.skillNodeId, values);
  }

  // Phase mapping
  const phaseIdBySkillNodeId = new Map<string, string>();
  for (const pn of phaseNodes) {
    phaseIdBySkillNodeId.set(pn.curriculumNodeId, pn.phaseId);
  }
  const phaseIndexById = new Map<string, number>(phases.map((p, i) => [p.id, i]));

  const branchInputs = activeBranchActivations
    .map((activation) => {
      const branchNode = nodeById.get(activation.nodeId);
      if (!branchNode) {
        return null;
      }

      const skillNodeIds = collectSkillDescendants(activation.nodeId);
      const eligibleUnfinishedScheduled: string[] = [];
      const eligibleNew: string[] = [];

      for (const skillNodeId of skillNodeIds) {
        const status = skillStateBySkillNodeId.get(skillNodeId) ?? "not_started";
        if (!isSchedulableStatus(status)) {
          continue;
        }

        // Hard gate check
        const hardPrereqs = hardPrerequisitesBySkillNodeId.get(skillNodeId) ?? [];
        const hardSatisfied = hardPrereqs.every((pid) =>
          isSkillComplete(skillStateBySkillNodeId.get(pid) ?? "not_started"),
        );

        if (!hardSatisfied) {
          continue;
        }

        if (UNFINISHED_SCHEDULED_STATUSES.has(status)) {
          eligibleUnfinishedScheduled.push(skillNodeId);
        } else {
          if (plannedSkillNodeIdsBeforeWeek.has(skillNodeId)) {
            continue;
          }
          eligibleNew.push(skillNodeId);
        }
      }

      // Internal sorting for branch queues based on phase and soft edges
      const sortBranchQueue = (queue: string[]) => {
        return queue.sort((a, b) => {
          // 1. Phase priority
          const phaseA = phaseIndexById.get(phaseIdBySkillNodeId.get(a) ?? "") ?? Infinity;
          const phaseB = phaseIndexById.get(phaseIdBySkillNodeId.get(b) ?? "") ?? Infinity;
          if (phaseA !== phaseB) return phaseA - phaseB;

          // 2. Recommended Before (simple heuristic: if A is recommended before B, A < B)
          const aBeforeB = recommendedBeforeBySkillNodeId.get(b)?.includes(a);
          const bBeforeA = recommendedBeforeBySkillNodeId.get(a)?.includes(b);
          if (aBeforeB && !bBeforeA) return -1;
          if (bBeforeA && !aBeforeB) return 1;

          // 3. Revisit After / Co Practice (similar heuristic)
          const aRevisitB = revisitAfterBySkillNodeId.get(a)?.includes(b);
          const bRevisitA = revisitAfterBySkillNodeId.get(b)?.includes(a);
          if (aRevisitB && !bRevisitA) return 1; // A follows B
          if (bRevisitA && !aRevisitB) return -1;

          // 4. Tree order as tie-breaker
          const posA = canonicalPositionBySkillNodeId.get(a) ?? Infinity;
          const posB = canonicalPositionBySkillNodeId.get(b) ?? Infinity;
          return posA - posB;
        });
      };

      return {
        branchNodeId: branchNode.id,
        branchNodePath: branchNode.normalizedPath,
        branchWeight: getBranchWeight(profile, branchNode.id),
        unfinishedQueue: sortBranchQueue(eligibleUnfinishedScheduled),
        newQueue: sortBranchQueue(eligibleNew),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value != null)
    .sort((left, right) => left.branchNodePath.localeCompare(right.branchNodePath));

  if (openingSkillNodeIds.length > 0) {
    const openingOrderBySkillNodeId = new Map(
      openingSkillNodeIds.map((skillNodeId, index) => [skillNodeId, index]),
    );
    const remainingOpeningSkillNodeIds = openingSkillNodeIds
      .filter((skillNodeId) => nodeById.has(skillNodeId))
      .filter((skillNodeId) => {
        const status = skillStateBySkillNodeId.get(skillNodeId) ?? "not_started";
        if (!isSchedulableStatus(status)) {
          return false;
        }

        return !plannedSkillNodeIdsBeforeWeek.has(skillNodeId)
          || UNFINISHED_SCHEDULED_STATUSES.has(status);
      })
      .sort((left, right) => {
        const launchOrder =
          (openingOrderBySkillNodeId.get(left) ?? Number.MAX_SAFE_INTEGER)
          - (openingOrderBySkillNodeId.get(right) ?? Number.MAX_SAFE_INTEGER);
        if (launchOrder !== 0) {
          return launchOrder;
        }

        return (canonicalPositionBySkillNodeId.get(left) ?? Number.MAX_SAFE_INTEGER)
          - (canonicalPositionBySkillNodeId.get(right) ?? Number.MAX_SAFE_INTEGER);
      });

    if (remainingOpeningSkillNodeIds.length > 0) {
      return {
        orderedSkillNodeIds: remainingOpeningSkillNodeIds.slice(0, targetItemsPerWeek),
        targetItemsPerWeek,
        targetItemsPerDay,
        planningDayCount,
        enabledDayOffsets,
        generationBasis: {
          algorithmVersion: "2026-04-18-launch-window-v1",
          targetItemsPerWeek,
          targetItemsPerDay,
          planningDayCount,
          enabledDayOffsets,
          launchMode: "opening_window",
          openingSkillNodeIds,
          selectedCount: remainingOpeningSkillNodeIds.length,
        },
      };
    }
  }

  if (activeBranchActivations.length === 0) {
    return {
      orderedSkillNodeIds: [],
      targetItemsPerWeek,
      targetItemsPerDay,
      planningDayCount,
      enabledDayOffsets,
      generationBasis: {
        algorithmVersion: "2026-04-01-progression-v1",
        reason: "no_active_branch_activations",
        targetItemsPerWeek,
        targetItemsPerDay,
        planningDayCount,
        enabledDayOffsets,
      },
    };
  }

  const weightedBranchCycle: string[] = [];
  for (const branch of branchInputs) {
    for (let index = 0; index < branch.branchWeight; index += 1) {
      weightedBranchCycle.push(branch.branchNodeId);
    }
  }

  const branchById = new Map(branchInputs.map((branch) => [branch.branchNodeId, branch]));
  const selectedSkillNodeIds: string[] = [];
  const selectedSet = new Set<string>();

  const selectFromQueues = (params: {
    queueName: "unfinishedQueue" | "newQueue";
    targetPhaseId?: string;
  }) => {
    if (weightedBranchCycle.length === 0) {
      return;
    }

    let madeProgress = true;
    while (selectedSkillNodeIds.length < targetItemsPerWeek && madeProgress) {
      madeProgress = false;
      for (const branchNodeId of weightedBranchCycle) {
        if (selectedSkillNodeIds.length >= targetItemsPerWeek) {
          break;
        }

        const branch = branchById.get(branchNodeId);
        if (!branch) {
          continue;
        }

        const queue = branch[params.queueName];
        
        // Skip skills already selected
        while (queue.length > 0 && selectedSet.has(queue[0])) {
          queue.shift();
        }

        if (queue.length === 0) {
          continue;
        }

        // If a target phase is specified, only pick if the skill is in that phase
        if (params.targetPhaseId) {
          const skillPhaseId = phaseIdBySkillNodeId.get(queue[0]);
          if (skillPhaseId !== params.targetPhaseId) {
            continue;
          }
        }

        const nextSkillNodeId = queue.shift();
        if (!nextSkillNodeId) {
          continue;
        }

        selectedSet.add(nextSkillNodeId);
        selectedSkillNodeIds.push(nextSkillNodeId);
        madeProgress = true;
      }
    }
  };

  // 1. Unfinished scheduled work across all phases first
  selectFromQueues({ queueName: "unfinishedQueue" });

  // 2. New work, phase by phase (Step 11.2)
  const orderedPhaseIds = phases.map((p) => p.id);
  for (const phaseId of orderedPhaseIds) {
    selectFromQueues({ queueName: "newQueue", targetPhaseId: phaseId });
  }

  // 3. Any remaining new work (in case some skills have no phase)
  selectFromQueues({ queueName: "newQueue" });

  const orderedSkillNodeIds = [...selectedSkillNodeIds];

  // Summarize generation basis for observability (Step 15)
  const activePhases = Array.from(
    new Set(
      orderedSkillNodeIds
        .map((sid) => phaseIdBySkillNodeId.get(sid))
        .filter((pid): pid is string => pid != null),
    ),
  ).map((pid) => phases.find((p) => p.id === pid)?.title ?? pid);

  return {
    orderedSkillNodeIds,
    targetItemsPerWeek,
    targetItemsPerDay,
    planningDayCount,
    enabledDayOffsets,
    generationBasis: {
      algorithmVersion: "2026-04-01-progression-v1",
      targetItemsPerWeek,
      targetItemsPerDay,
      planningDayCount,
      enabledDayOffsets,
      branchCount: branchInputs.length,
      weightedBranchCycle,
      selectedCount: orderedSkillNodeIds.length,
      activePhases,
      hardPrerequisitesConsidered: true,
      softEdgesConsidered: true,
    },
  };
}

async function persistGeneratedRoute(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate: string;
  orderedSkillNodeIds: string[];
  targetItemsPerDay: number;
  enabledDayOffsets: number[];
  generationBasis: Record<string, unknown>;
}) {
  const scheduledPlacements = buildSuggestedSchedulePlacements({
    weekStartDate: params.weekStartDate,
    itemCount: params.orderedSkillNodeIds.length,
    targetItemsPerDay: params.targetItemsPerDay,
    enabledDayOffsets: params.enabledDayOffsets,
  });

  return getDb().transaction(async (tx) => {
    const [route] = await tx
      .insert(weeklyRoutes)
      .values({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate: params.weekStartDate,
        generationVersion: "agent-b-2026-03-31-v1",
        generationBasis: params.generationBasis,
        status: "active",
      })
      .onConflictDoUpdate({
        target: [weeklyRoutes.learnerId, weeklyRoutes.sourceId, weeklyRoutes.weekStartDate],
        set: {
          generationVersion: "agent-b-2026-03-31-v1",
          generationBasis: params.generationBasis,
          status: "active",
          updatedAt: new Date(),
        },
      })
      .returning();

    await tx.delete(weeklyRouteItems).where(eq(weeklyRouteItems.weeklyRouteId, route.id));

    if (params.orderedSkillNodeIds.length > 0) {
      const inserts: Array<typeof weeklyRouteItems.$inferInsert> = params.orderedSkillNodeIds.map(
        (skillNodeId, index) => ({
          weeklyRouteId: route.id,
          learnerId: params.learnerId,
          skillNodeId,
          recommendedPosition: index,
          currentPosition: index,
          scheduledDate: scheduledPlacements[index]?.scheduledDate ?? null,
          scheduledSlotIndex: scheduledPlacements[index]?.scheduledSlotIndex ?? null,
          manualOverrideKind: "none",
          manualOverrideNote: null,
          state: scheduledPlacements[index]?.scheduledDate ? "scheduled" : "queued",
        }),
      );

      await tx.insert(weeklyRouteItems).values(inserts);
    }

    return route;
  });
}

export async function getWeeklyRouteBoard(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate: string;
}): Promise<WeeklyRouteBoard | null> {
  const weekStartDate = toWeekStartDate(params.weekStartDate);
  const route = await loadRouteByWeek({
    learnerId: params.learnerId,
    sourceId: params.sourceId,
    weekStartDate,
  });
  if (!route) {
    return null;
  }

  return buildRouteBoard(route);
}

export async function getWeeklyRouteBoardById(params: {
  learnerId: string;
  weeklyRouteId: string;
}): Promise<WeeklyRouteBoard | null> {
  const route = await loadRouteById(params);
  if (!route) {
    return null;
  }

  return buildRouteBoard(route);
}

export async function generateWeeklyRoute(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate?: string;
}): Promise<WeeklyRouteBoard> {
  const weekStartDate = toWeekStartDate(params.weekStartDate);
  const [context, plannedSkillNodeIdsBeforeWeek] = await Promise.all([
    loadGenerationContext({
      learnerId: params.learnerId,
      sourceId: params.sourceId,
    }),
    loadPlannedSkillNodeIdsBeforeWeek({
      learnerId: params.learnerId,
      sourceId: params.sourceId,
      weekStartDate,
    }),
  ]);

  context.plannedSkillNodeIdsBeforeWeek = plannedSkillNodeIdsBeforeWeek;

  const recommendation = buildRecommendations(context);
  const route = await persistGeneratedRoute({
    learnerId: params.learnerId,
    sourceId: params.sourceId,
    weekStartDate,
    orderedSkillNodeIds: recommendation.orderedSkillNodeIds,
    targetItemsPerDay: recommendation.targetItemsPerDay,
    enabledDayOffsets: recommendation.enabledDayOffsets,
    generationBasis: recommendation.generationBasis,
  });

  return buildRouteBoard(route);
}

export async function reorderWeeklyRouteItem(params: {
  learnerId: string;
  weeklyRouteId: string;
  weeklyRouteItemId: string;
  targetPosition: number;
  manualOverrideNote?: string;
  createdByAdultUserId?: string | null;
}): Promise<WeeklyRouteBoard> {
  const route = await loadRouteById({ learnerId: params.learnerId, weeklyRouteId: params.weeklyRouteId });
  if (!route) {
    throw new Error("Weekly route not found.");
  }

  const board = await buildRouteBoard(route);
  const orderedItems = [...board.items].sort((left, right) => left.currentPosition - right.currentPosition);
  const fromIndex = orderedItems.findIndex((item) => item.id === params.weeklyRouteItemId);
  if (fromIndex < 0) {
    throw new Error("Weekly route item not found.");
  }

  const clampedTarget = Math.max(0, Math.min(params.targetPosition, orderedItems.length - 1));
  if (fromIndex === clampedTarget) {
    return board;
  }

  const reorderedItems = moveArrayItem(orderedItems, fromIndex, clampedTarget);
  const movedItemBefore = orderedItems[fromIndex];

  const nextOrder = reorderedItems.map((item, index) => ({
    id: item.id,
    nextPosition: index,
  }));

  const movedItemAfterPosition = nextOrder.find((entry) => entry.id === movedItemBefore.id)?.nextPosition ?? movedItemBefore.currentPosition;
  const nextMovedOverrideKind: WeeklyRouteManualOverrideKind =
    movedItemBefore.manualOverrideKind === "pinned" ||
    movedItemBefore.manualOverrideKind === "deferred" ||
    movedItemBefore.manualOverrideKind === "skip_acknowledged"
      ? movedItemBefore.manualOverrideKind
      : movedItemAfterPosition === movedItemBefore.recommendedPosition
        ? "none"
        : "reordered";

  await getDb().transaction(async (tx) => {
    for (const item of nextOrder) {
      const previous = orderedItems.find((entry) => entry.id === item.id)!;
      const nextOverrideKind =
        item.id === movedItemBefore.id ? nextMovedOverrideKind : previous.manualOverrideKind;
      const nextManualOverrideNote =
        item.id === movedItemBefore.id ? params.manualOverrideNote ?? previous.manualOverrideNote : previous.manualOverrideNote;

      if (
        previous.currentPosition !== item.nextPosition ||
        previous.manualOverrideKind !== nextOverrideKind ||
        previous.manualOverrideNote !== nextManualOverrideNote
      ) {
        await tx
          .update(weeklyRouteItems)
          .set({
            currentPosition: item.nextPosition,
            manualOverrideKind: nextOverrideKind,
            manualOverrideNote: nextManualOverrideNote,
            updatedAt: new Date(),
          })
          .where(eq(weeklyRouteItems.id, item.id));
      }
    }

    await tx.insert(routeOverrideEvents).values({
      learnerId: params.learnerId,
      weeklyRouteItemId: movedItemBefore.id,
      eventType: "reorder",
      payload: {
        fromPosition: movedItemBefore.currentPosition,
        toPosition: movedItemAfterPosition,
        weekStartDate: route.weekStartDate,
      },
      createdByAdultUserId: params.createdByAdultUserId ?? null,
    });
  });

  return (await getWeeklyRouteBoardById({
    learnerId: params.learnerId,
    weeklyRouteId: params.weeklyRouteId,
  }))!;
}

function toProjection(items: WeeklyRouteBoardItem[]): RouteItemProjection[] {
  return items
    .map((item) => ({
      id: item.id,
      skillNodeId: item.skillNodeId,
      currentPosition: item.currentPosition,
      scheduledDate: item.scheduledDate,
      scheduledSlotIndex: item.scheduledSlotIndex,
      state: item.state,
      manualOverrideKind: item.manualOverrideKind,
    }))
    .sort((left, right) => left.currentPosition - right.currentPosition);
}

function projectionToBoardItems(
  baseItems: WeeklyRouteBoardItem[],
  projection: RouteItemProjection[],
): WeeklyRouteBoardItem[] {
  const baseById = new Map(baseItems.map((item) => [item.id, item]));
  return projection
    .map((projected) => {
      const base = baseById.get(projected.id);
      if (!base) {
        throw new Error(`Missing base route item for projection: ${projected.id}`);
      }

      const projectedItem: WeeklyRouteBoardItem = {
        ...base,
        currentPosition: projected.currentPosition,
        scheduledDate: projected.scheduledDate,
        scheduledSlotIndex: projected.scheduledSlotIndex,
        state: projected.state,
        manualOverrideKind: projected.manualOverrideKind,
      };

      return {
        ...projectedItem,
        dailySelection: mapDailySelection(projectedItem),
      };
    })
    .sort((left, right) => left.currentPosition - right.currentPosition);
}

function buildRepairPreview(params: {
  board: WeeklyRouteBoard;
  context: RouteBoardContext;
}): WeeklyRouteRepairPreview {
  const { board, context } = params;
  let projected = toProjection(board.items);
  const operations: WeeklyRouteRepairOperation[] = [];

  const recordOperation = (operation: WeeklyRouteRepairOperation) => {
    operations.push(operation);
  };

  const firstByScheduledSkillKey = new Map<string, string>();
  for (const entry of projected) {
    const conflictKey = entry.scheduledDate ? `${entry.skillNodeId}::${entry.scheduledDate}` : null;
    if (!conflictKey) {
      continue;
    }

    const firstItemId = firstByScheduledSkillKey.get(conflictKey);
    if (!firstItemId) {
      firstByScheduledSkillKey.set(conflictKey, entry.id);
      continue;
    }

    const fromState = entry.state;
    const fromOverrideKind = entry.manualOverrideKind;
    if (entry.state !== "removed") {
      entry.state = "removed";
      entry.manualOverrideKind = "deferred";
      recordOperation({
        action: "drop_duplicate",
        itemId: entry.id,
        reason: "Duplicate scheduled skill on the same day.",
        fromPosition: entry.currentPosition,
        toPosition: entry.currentPosition,
        fromState,
        toState: entry.state,
        fromOverrideKind,
        toOverrideKind: entry.manualOverrideKind,
      });
    }
  }

  const firstActivePositionBySkillNodeId = new Map<string, number>();
  for (const entry of projected) {
    if (entry.state === "removed") {
      continue;
    }

    const existingFirst = firstActivePositionBySkillNodeId.get(entry.skillNodeId);
    if (existingFirst == null || entry.currentPosition < existingFirst) {
      firstActivePositionBySkillNodeId.set(entry.skillNodeId, entry.currentPosition);
    }
  }

  let movedForDependencies = true;
  while (movedForDependencies) {
    movedForDependencies = false;
    projected = normalizeProjectedPositions(projected);

    const projectedBySkillNodeId = new Map<string, RouteItemProjection[]>();
    for (const entry of projected) {
      const existing = projectedBySkillNodeId.get(entry.skillNodeId) ?? [];
      existing.push(entry);
      projectedBySkillNodeId.set(entry.skillNodeId, existing);
    }

    const isResolved = (skillNodeId: string) => {
      const status = context.skillStatusBySkillNodeId.get(skillNodeId) ?? "not_started";
      if (isSkillComplete(status)) {
        return true;
      }
      const routeItems = projectedBySkillNodeId.get(skillNodeId) ?? [];
      return routeItems.some((routeItem) => routeItem.state === "done");
    };

    for (const entry of projected) {
      if (entry.state === "removed") {
        continue;
      }

      const firstActivePosition = firstActivePositionBySkillNodeId.get(entry.skillNodeId);
      if (firstActivePosition != null && entry.currentPosition > firstActivePosition) {
        continue;
      }

      const dependencySkillNodeIds = [
        ...(context.hardPrerequisitesBySkillNodeId.get(entry.skillNodeId) ?? []),
        ...(context.recommendedBeforeBySkillNodeId.get(entry.skillNodeId) ?? []),
      ];

      const blockingPositions = dependencySkillNodeIds
        .filter((skillNodeId) => !isResolved(skillNodeId))
        .flatMap((skillNodeId) =>
          (projectedBySkillNodeId.get(skillNodeId) ?? [])
            .filter((value) => value.state !== "removed")
            .map((value) => value.currentPosition),
        );

      if (blockingPositions.length === 0) {
        continue;
      }

      const maxBlockingPosition = Math.max(...blockingPositions);
      if (maxBlockingPosition < entry.currentPosition) {
        continue;
      }

      const fromPosition = entry.currentPosition;
      const toPosition = Math.min(projected.length - 1, maxBlockingPosition + 1);
      if (fromPosition === toPosition) {
        continue;
      }

      const fromIndex = projected.findIndex((item) => item.id === entry.id);
      projected = moveArrayItem(projected, fromIndex, toPosition);
      projected = normalizeProjectedPositions(projected);
      movedForDependencies = true;

      recordOperation({
        action: "move_item_later",
        itemId: entry.id,
        reason: "Move dependent skill behind unresolved prerequisite/predecessor.",
        fromPosition,
        toPosition,
        fromState: entry.state,
        toState: entry.state,
        fromOverrideKind: entry.manualOverrideKind,
        toOverrideKind: entry.manualOverrideKind,
      });

      break;
    }
  }

  projected = normalizeProjectedPositions(projected);
  const activeItems = projected.filter((entry) => CAPACITY_STATES.has(entry.state));
  if (activeItems.length > context.targetItemsPerWeek) {
    const overflow = activeItems
      .sort((left, right) => left.currentPosition - right.currentPosition)
      .slice(context.targetItemsPerWeek);

    for (const entry of overflow) {
      const fromState = entry.state;
      const fromOverrideKind = entry.manualOverrideKind;
      entry.state = "removed";
      if (entry.manualOverrideKind === "none") {
        entry.manualOverrideKind = "deferred";
      }

      recordOperation({
        action: "rebalance_over_capacity",
        itemId: entry.id,
        reason: "Remove overflow item to respect weekly capacity.",
        fromPosition: entry.currentPosition,
        toPosition: entry.currentPosition,
        fromState,
        toState: entry.state,
        fromOverrideKind,
        toOverrideKind: entry.manualOverrideKind,
      });
    }
  }

  projected = normalizeProjectedPositions(projected);
  const projectedItems = projectionToBoardItems(board.items, projected);
  const afterConflicts = computeConflicts(projectedItems, context);

  return {
    weeklyRouteId: board.summary.weeklyRouteId,
    beforeConflicts: board.conflicts,
    afterConflicts,
    operations,
    projectedItems,
  };
}

function mapRepairActionToEventType(action: WeeklyRouteRepairAction) {
  if (action === "drop_duplicate") {
    return "remove_from_week" as const;
  }
  if (action === "rebalance_over_capacity") {
    return "defer" as const;
  }
  if (action === "acknowledge_skip") {
    return "skip_acknowledged" as const;
  }
  return "repair_applied" as const;
}

export async function previewWeeklyRouteRepair(params: {
  learnerId: string;
  weeklyRouteId: string;
}): Promise<WeeklyRouteRepairPreview> {
  const db = getDb();
  const board = await getWeeklyRouteBoardById({
    learnerId: params.learnerId,
    weeklyRouteId: params.weeklyRouteId,
  });
  if (!board) {
    throw new Error("Weekly route not found.");
  }

  // We need to fetch the full progression graph again to build the context
  const prerequisites = await db.query.curriculumSkillPrerequisites.findMany({
    where: eq(curriculumSkillPrerequisites.sourceId, board.summary.sourceId),
  });

  const phases = await db.query.curriculumPhases.findMany({
    where: eq(curriculumPhases.sourceId, board.summary.sourceId),
    orderBy: [asc(curriculumPhases.position), asc(curriculumPhases.createdAt)],
  });

  const phaseNodes = phases.length > 0
    ? await db.query.curriculumPhaseNodes.findMany({
        where: inArray(
          curriculumPhaseNodes.phaseId,
          phases.map((p) => p.id),
        ),
      })
    : [];

  const hardPrerequisitesBySkillNodeId = new Map<string, string[]>();
  const recommendedBeforeBySkillNodeId = new Map<string, string[]>();
  const revisitAfterBySkillNodeId = new Map<string, string[]>();
  const coPracticeBySkillNodeId = new Map<string, string[]>();

  for (const prerequisite of prerequisites) {
    let map: Map<string, string[]>;
    switch (prerequisite.kind) {
      case "hardPrerequisite":
      case "explicit":
        map = hardPrerequisitesBySkillNodeId;
        break;
      case "recommendedBefore":
      case "inferred":
        map = recommendedBeforeBySkillNodeId;
        break;
      case "revisitAfter":
        map = revisitAfterBySkillNodeId;
        break;
      case "coPractice":
        map = coPracticeBySkillNodeId;
        break;
      default:
        continue;
    }
    const values = map.get(prerequisite.skillNodeId) ?? [];
    values.push(prerequisite.prerequisiteSkillNodeId);
    map.set(prerequisite.skillNodeId, values);
  }

  const phaseIdBySkillNodeId = new Map<string, string>();
  for (const pn of phaseNodes) {
    phaseIdBySkillNodeId.set(pn.curriculumNodeId, pn.phaseId);
  }

  const context: RouteBoardContext = {
    sourceId: board.summary.sourceId,
    targetItemsPerWeek: board.summary.targetItemsPerWeek,
    skillStatusBySkillNodeId: new Map(
      board.items.map((item) => [item.skillNodeId, item.learnerSkillStatus as SkillStatus]),
    ),
    hardPrerequisitesBySkillNodeId,
    recommendedBeforeBySkillNodeId,
    revisitAfterBySkillNodeId,
    coPracticeBySkillNodeId,
    phaseIdBySkillNodeId,
    orderedPhaseIds: phases.map((p) => p.id),
  };

  return buildRepairPreview({
    board,
    context,
  });
}

export async function applyWeeklyRouteRepair(params: {
  learnerId: string;
  weeklyRouteId: string;
  createdByAdultUserId?: string | null;
}): Promise<WeeklyRouteBoard> {
  const board = await getWeeklyRouteBoardById({
    learnerId: params.learnerId,
    weeklyRouteId: params.weeklyRouteId,
  });
  if (!board) {
    throw new Error("Weekly route not found.");
  }

  const preview = await previewWeeklyRouteRepair({
    learnerId: params.learnerId,
    weeklyRouteId: params.weeklyRouteId,
  });

  const projectedById = new Map(preview.projectedItems.map((item) => [item.id, item]));
  const changedItems = board.items.filter((item) => {
    const projected = projectedById.get(item.id);
    if (!projected) {
      return false;
    }

    return (
      projected.currentPosition !== item.currentPosition ||
      projected.state !== item.state ||
      projected.manualOverrideKind !== item.manualOverrideKind
    );
  });

  if (changedItems.length > 0 || preview.operations.length > 0) {
    await getDb().transaction(async (tx) => {
      for (const item of changedItems) {
        const projected = projectedById.get(item.id)!;
        await tx
          .update(weeklyRouteItems)
          .set({
            currentPosition: projected.currentPosition,
            state: projected.state,
            manualOverrideKind: projected.manualOverrideKind,
            updatedAt: new Date(),
          })
          .where(eq(weeklyRouteItems.id, item.id));
      }

      for (const operation of preview.operations) {
        await tx.insert(routeOverrideEvents).values({
          learnerId: params.learnerId,
          weeklyRouteItemId: operation.itemId,
          eventType: mapRepairActionToEventType(operation.action),
          payload: {
            action: operation.action,
            reason: operation.reason,
            fromPosition: operation.fromPosition,
            toPosition: operation.toPosition,
            fromState: operation.fromState,
            toState: operation.toState,
            fromOverrideKind: operation.fromOverrideKind,
            toOverrideKind: operation.toOverrideKind,
          },
          createdByAdultUserId: params.createdByAdultUserId ?? null,
        });
      }
    });
  }

  return (await getWeeklyRouteBoardById({
    learnerId: params.learnerId,
    weeklyRouteId: params.weeklyRouteId,
  }))!;
}
