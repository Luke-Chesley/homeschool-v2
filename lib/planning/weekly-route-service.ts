import { and, asc, eq, inArray, lt, ne } from "drizzle-orm";

import {
  generateWeeklyRoute,
  getEnabledPlanningDayOffsets,
  getWeeklyRouteBoard,
  getWeeklyRouteBoardById,
  toWeekStartDate,
  type WeeklyRouteBoard,
} from "@/lib/curriculum-routing";
import { normalizeTargetItemsPerDay } from "@/lib/curriculum-routing/defaults";
import { hasExplicitSeparateLessonSlotNote } from "@/lib/planning/lesson-slot-grouping";
import { getDb } from "@/lib/db/server";
import {
  buildAdaptiveScheduleSlots,
  buildScheduleRefreshProjection,
  buildScheduleDaysForWeek,
} from "@/lib/planning/route-schedule-refresh";
import {
  curriculumNodes,
  learnerBranchActivations,
  learnerRouteProfiles,
  routeOverrideEvents,
  weeklyRouteItems,
  weeklyRoutes,
} from "@/lib/db/schema";
import type { DailyWorkspaceExpansionScope } from "@/lib/planning/types";

type WeeklyRouteItemRow = typeof weeklyRouteItems.$inferSelect;
type WeeklyRouteRecord = typeof weeklyRoutes.$inferSelect;
type WeeklyRouteOverrideKind = WeeklyRouteItemRow["manualOverrideKind"];
type WeeklyRouteBoardMaintenanceReason =
  | "missing_route"
  | "overdue_carry_forward"
  | "empty_board"
  | "unscheduled_items"
  | "capacity_drift"
  | "prior_week_overlap"
  | "read_safe";

const ACTIVE_ROUTE_STATES = new Set<WeeklyRouteItemRow["state"]>(["queued", "scheduled", "in_progress"]);

const WEEKDAY_COUNT = 7;
const WEEKLY_REFRESH_HORIZON_WEEKS = 6;

function parseDateOrThrow(value: string): Date {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed;
}

function addDays(baseDate: string, days: number): string {
  const date = parseDateOrThrow(baseDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildWeekdayDates(weekStartDate: string) {
  return Array.from({ length: WEEKDAY_COUNT }, (_, index) => addDays(weekStartDate, index));
}

function getMonthWeekStartDates(anchorDate: string) {
  const parsed = parseDateOrThrow(anchorDate);
  const firstOfMonth = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  const lastOfMonth = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0));
  const weekStarts: string[] = [];

  let current = toWeekStartDate(firstOfMonth.toISOString().slice(0, 10));
  while (parseDateOrThrow(current) <= lastOfMonth) {
    weekStarts.push(current);
    current = addDays(current, 7);
  }

  return weekStarts;
}

function getForwardWeekStartDates(weekStartDate: string, weekCount: number) {
  return Array.from({ length: weekCount }, (_, index) => addDays(weekStartDate, index * 7));
}

async function findPlannedSkillNodeIdsBeforeWeek(route: WeeklyRouteRecord) {
  const rows = await getDb()
    .select({
      skillNodeId: weeklyRouteItems.skillNodeId,
    })
    .from(weeklyRouteItems)
    .innerJoin(weeklyRoutes, eq(weeklyRouteItems.weeklyRouteId, weeklyRoutes.id))
    .where(
      and(
        eq(weeklyRoutes.learnerId, route.learnerId),
        eq(weeklyRoutes.sourceId, route.sourceId),
        inArray(weeklyRoutes.status, ["draft", "active"]),
        lt(weeklyRoutes.weekStartDate, route.weekStartDate),
        ne(weeklyRouteItems.state, "removed"),
      ),
    );

  return new Set(rows.map((row) => row.skillNodeId));
}

async function shouldRegenerateForPriorWeekOverlap(route: WeeklyRouteRecord, board: WeeklyRouteBoard) {
  if (board.items.length === 0) {
    return false;
  }

  if (board.items.some((item) => item.manualOverrideKind !== "none")) {
    return false;
  }

  const priorPlannedSkillNodeIds = await findPlannedSkillNodeIdsBeforeWeek(route);
  if (priorPlannedSkillNodeIds.size === 0) {
    return false;
  }

  return board.items.some(
    (item) => item.state !== "removed" && priorPlannedSkillNodeIds.has(item.skillNodeId),
  );
}

async function findOverdueScheduledItemsBeforeWeek(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate: string;
}) {
  const db = getDb();
  const priorRouteIds = await db
    .select({ id: weeklyRoutes.id })
    .from(weeklyRoutes)
    .where(
      and(
        eq(weeklyRoutes.learnerId, params.learnerId),
        eq(weeklyRoutes.sourceId, params.sourceId),
        inArray(weeklyRoutes.status, ["draft", "active"]),
        lt(weeklyRoutes.weekStartDate, params.weekStartDate),
      ),
    );

  if (priorRouteIds.length === 0) {
    return [];
  }

  return db.query.weeklyRouteItems.findMany({
    where: and(
      inArray(
        weeklyRouteItems.weeklyRouteId,
        priorRouteIds.map((route) => route.id),
      ),
      inArray(weeklyRouteItems.state, Array.from(ACTIVE_ROUTE_STATES)),
      lt(weeklyRouteItems.scheduledDate, params.weekStartDate),
    ),
    orderBy: [
      asc(weeklyRouteItems.scheduledDate),
      asc(weeklyRouteItems.currentPosition),
      asc(weeklyRouteItems.createdAt),
    ],
  });
}

async function repairOverdueCarryForwardForWeek(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate: string;
  weeklyRouteId: string;
}) {
  const futureWeekStartDates = getForwardWeekStartDates(
    params.weekStartDate,
    WEEKLY_REFRESH_HORIZON_WEEKS,
  ).slice(1);

  const futureRouteDescriptors = await Promise.all(
    futureWeekStartDates.map(async (weekStartDate) => {
      const existing = await getWeeklyRouteBoard({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate,
      });

      if (existing) {
        return {
          weekStartDate,
          weeklyRouteId: existing.summary.weeklyRouteId,
        };
      }

      const generated = await generateWeeklyRoute({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate,
      });

      return {
        weekStartDate,
        weeklyRouteId: generated.summary.weeklyRouteId,
      };
    }),
  );

  const routeDescriptors = [
    { weekStartDate: params.weekStartDate, weeklyRouteId: params.weeklyRouteId },
    ...futureRouteDescriptors,
  ];

  const db = getDb();
  const [overdueRows, futureRows, profile] = await Promise.all([
    findOverdueScheduledItemsBeforeWeek({
      learnerId: params.learnerId,
      sourceId: params.sourceId,
      weekStartDate: params.weekStartDate,
    }),
    db.query.weeklyRouteItems.findMany({
      where: inArray(
        weeklyRouteItems.weeklyRouteId,
        routeDescriptors.map((descriptor) => descriptor.weeklyRouteId),
      ),
      orderBy: [asc(weeklyRouteItems.currentPosition), asc(weeklyRouteItems.createdAt)],
    }),
    db.query.learnerRouteProfiles.findFirst({
      where: and(
        eq(learnerRouteProfiles.learnerId, params.learnerId),
        eq(learnerRouteProfiles.sourceId, params.sourceId),
      ),
    }),
  ]);

  if (overdueRows.length === 0) {
    const board = await getWeeklyRouteBoardById({
      learnerId: params.learnerId,
      weeklyRouteId: params.weeklyRouteId,
    });

    if (!board) {
      throw new Error("Failed to reload weekly route board after carry-forward repair.");
    }

    return board;
  }

  const rowsByRouteId = new Map<string, WeeklyRouteItemRow[]>();
  for (const row of futureRows) {
    const existing = rowsByRouteId.get(row.weeklyRouteId) ?? [];
    existing.push(row);
    rowsByRouteId.set(row.weeklyRouteId, existing);
  }

  const enabledDayOffsets = getEnabledPlanningDayOffsets(profile?.planningDays ?? null);
  const targetItemsPerDay = getTargetItemsPerDay(profile);
  const orderedRows = [
    ...overdueRows,
    ...routeDescriptors.flatMap((descriptor) => rowsByRouteId.get(descriptor.weeklyRouteId) ?? []),
  ];
  const days = routeDescriptors.flatMap((descriptor) =>
    buildScheduleDaysForWeek({
      weeklyRouteId: descriptor.weeklyRouteId,
      weekStartDate: descriptor.weekStartDate,
      targetItemsPerDay,
      enabledDayOffsets,
    }),
  );
  const slots = buildAdaptiveScheduleSlots({
    items: orderedRows.map(toScheduleRefreshItem),
    days,
  });
  const projections = buildScheduleRefreshProjection({
    items: orderedRows.map(toScheduleRefreshItem),
    slots,
  });

  await applyScheduleRefreshProjection({
    learnerId: params.learnerId,
    rows: orderedRows,
    projections,
    scope: "week",
  });

  const board = await getWeeklyRouteBoardById({
    learnerId: params.learnerId,
    weeklyRouteId: params.weeklyRouteId,
  });

  if (!board) {
    throw new Error("Failed to reload weekly route board after carry-forward repair.");
  }

  return board;
}

function shouldRegenerateForCapacityDrift(params: {
  board: WeeklyRouteBoard;
  profile: typeof learnerRouteProfiles.$inferSelect | null | undefined;
}) {
  const { board, profile } = params;

  if (board.items.length === 0) {
    return false;
  }

  if (
    board.items.some(
      (item) =>
        item.manualOverrideKind !== "none" ||
        hasExplicitSeparateLessonSlotNote(item.manualOverrideNote),
    )
  ) {
    return false;
  }

  const activeItems = board.items.filter((item) => ACTIVE_ROUTE_STATES.has(item.state));
  if (activeItems.length > board.summary.targetItemsPerWeek) {
    return true;
  }

  const targetItemsPerDay = getTargetItemsPerDay(profile);
  const scheduledCountByDate = new Map<string, number>();

  for (const item of activeItems) {
    if (item.scheduledDate == null) {
      continue;
    }

    const nextCount = (scheduledCountByDate.get(item.scheduledDate) ?? 0) + 1;
    if (nextCount > targetItemsPerDay) {
      return true;
    }
    scheduledCountByDate.set(item.scheduledDate, nextCount);
  }

  return false;
}

export interface SuggestedWeeklyAssignmentItem {
  id: string;
  skillNodeId: string;
  scheduledDate: string | null;
  scheduledSlotIndex: number | null;
  state: WeeklyRouteItemRow["state"];
}

export interface SuggestedWeeklyAssignment {
  id: string;
  scheduledDate: string;
  scheduledSlotIndex: number;
}

export function buildSuggestedWeeklyAssignments(params: {
  rows: SuggestedWeeklyAssignmentItem[];
  weekStartDate: string;
  enabledDayOffsets: number[];
  targetItemsPerDay: number | null | undefined;
}) {
  const allWeekDates = buildWeekdayDates(params.weekStartDate);
  const weekdayDates = params.enabledDayOffsets
    .map((offset) => allWeekDates[offset])
    .filter((date): date is string => date != null);
  const targetItemsPerDay = normalizeTargetItemsPerDay(params.targetItemsPerDay);
  const occupiedCountByDate = new Map<string, number>();
  const occupiedSkillDateKeys = new Set<string>();

  for (const row of params.rows) {
    if (row.scheduledDate == null || !weekdayDates.includes(row.scheduledDate)) {
      continue;
    }

    occupiedCountByDate.set(row.scheduledDate, (occupiedCountByDate.get(row.scheduledDate) ?? 0) + 1);
    occupiedSkillDateKeys.add(`${row.skillNodeId}::${row.scheduledDate}`);
  }

  const unscheduledRows = params.rows.filter(
    (row) => row.state !== "removed" && row.scheduledDate == null,
  );
  const assignments: SuggestedWeeklyAssignment[] = [];

  for (const row of unscheduledRows) {
    const nextDate = weekdayDates.find((date) => {
      const occupiedCount = occupiedCountByDate.get(date) ?? 0;
      return (
        occupiedCount < targetItemsPerDay &&
        !occupiedSkillDateKeys.has(`${row.skillNodeId}::${date}`)
      );
    });
    if (!nextDate) {
      continue;
    }

    assignments.push({
      id: row.id,
      scheduledDate: nextDate,
      scheduledSlotIndex: 1,
    });
    occupiedCountByDate.set(nextDate, (occupiedCountByDate.get(nextDate) ?? 0) + 1);
    occupiedSkillDateKeys.add(`${row.skillNodeId}::${nextDate}`);
  }

  return assignments;
}

async function ensureSuggestedWeeklyRouteSchedule(route: WeeklyRouteRecord) {
  const db = getDb();
  const [rows, profile] = await Promise.all([
    db.query.weeklyRouteItems.findMany({
      where: eq(weeklyRouteItems.weeklyRouteId, route.id),
      orderBy: [asc(weeklyRouteItems.currentPosition), asc(weeklyRouteItems.createdAt)],
    }),
    db.query.learnerRouteProfiles.findFirst({
      where: and(
        eq(learnerRouteProfiles.learnerId, route.learnerId),
        eq(learnerRouteProfiles.sourceId, route.sourceId),
      ),
    }),
  ]);

  const enabledOffsets = getEnabledPlanningDayOffsets(profile?.planningDays ?? null);
  const assignments = buildSuggestedWeeklyAssignments({
    rows: rows.map((row) => ({
      id: row.id,
      skillNodeId: row.skillNodeId,
      scheduledDate: row.scheduledDate,
      scheduledSlotIndex: row.scheduledSlotIndex,
      state: row.state,
    })),
    weekStartDate: route.weekStartDate,
    enabledDayOffsets: enabledOffsets,
    targetItemsPerDay: profile?.targetItemsPerDay ?? null,
  });

  if (assignments.length === 0) {
    return false;
  }

  await db.transaction(async (tx) => {
    for (const assignment of assignments) {
      await tx
        .update(weeklyRouteItems)
        .set({
          scheduledDate: assignment.scheduledDate,
          scheduledSlotIndex: assignment.scheduledSlotIndex,
          state: "scheduled",
          updatedAt: new Date(),
        })
        .where(eq(weeklyRouteItems.id, assignment.id));
    }
  });

  return true;
}

function toColumnKey(scheduledDate: string | null, weekdayDates: string[]) {
  if (!scheduledDate) {
    return "unassigned";
  }

  if (!weekdayDates.includes(scheduledDate)) {
    return "unassigned";
  }

  return scheduledDate;
}

function deriveOverrideKind(item: WeeklyRouteItemRow, nextPosition: number, nextScheduledDate: string | null): WeeklyRouteOverrideKind {
  if (nextScheduledDate) {
    return "pinned";
  }

  if (nextPosition !== item.recommendedPosition) {
    return "reordered";
  }

  return "none";
}

function deriveNextState(
  item: WeeklyRouteItemRow,
  nextScheduledDate: string | null,
): WeeklyRouteItemRow["state"] {
  if (item.state === "done" || item.state === "in_progress") {
    return item.state;
  }

  if (nextScheduledDate) {
    return "scheduled";
  }

  return item.state === "removed" ? "removed" : "queued";
}

function getTargetItemsPerDay(profile: typeof learnerRouteProfiles.$inferSelect | null | undefined) {
  return normalizeTargetItemsPerDay(profile?.targetItemsPerDay ?? null);
}

function toScheduleRefreshItem(row: WeeklyRouteItemRow) {
  return {
    id: row.id,
    weeklyRouteId: row.weeklyRouteId,
    recommendedPosition: row.recommendedPosition,
    currentPosition: row.currentPosition,
    scheduledDate: row.scheduledDate,
    scheduledSlotIndex: row.scheduledSlotIndex,
    state: row.state,
    manualOverrideKind: row.manualOverrideKind,
    manualOverrideNote: row.manualOverrideNote,
  };
}

async function applyScheduleRefreshProjection(params: {
  learnerId: string;
  rows: WeeklyRouteItemRow[];
  projections: ReturnType<typeof buildScheduleRefreshProjection>;
  scope: "week" | "month";
  createdByAdultUserId?: string | null;
}) {
  const db = getDb();
  const projectionById = new Map(params.projections.map((item) => [item.id, item]));
  const changedRows = params.rows.filter((row) => {
    const projected = projectionById.get(row.id);
    if (!projected) {
      return false;
    }

    return (
      projected.nextWeeklyRouteId !== row.weeklyRouteId ||
      projected.nextCurrentPosition !== row.currentPosition ||
      projected.nextScheduledDate !== row.scheduledDate ||
      projected.nextScheduledSlotIndex !== row.scheduledSlotIndex ||
      projected.nextState !== row.state ||
      projected.nextManualOverrideKind !== row.manualOverrideKind
    );
  });

  if (changedRows.length === 0) {
    return 0;
  }

  await db.transaction(async (tx) => {
    for (const row of changedRows) {
      await tx
        .update(weeklyRouteItems)
        .set({
          scheduledDate: null,
          scheduledSlotIndex: null,
          updatedAt: new Date(),
        })
        .where(eq(weeklyRouteItems.id, row.id));
    }

    for (const row of changedRows) {
      const projected = projectionById.get(row.id)!;
      await tx
        .update(weeklyRouteItems)
        .set({
          weeklyRouteId: projected.nextWeeklyRouteId,
          currentPosition: projected.nextCurrentPosition,
          scheduledDate: projected.nextScheduledDate,
          scheduledSlotIndex: projected.nextScheduledSlotIndex,
          state: projected.nextState,
          manualOverrideKind: projected.nextManualOverrideKind,
          updatedAt: new Date(),
        })
        .where(eq(weeklyRouteItems.id, row.id));

      await tx.insert(routeOverrideEvents).values({
        learnerId: params.learnerId,
        weeklyRouteItemId: row.id,
        eventType: "repair_applied",
        payload: {
          action: "refresh_schedule",
          scope: params.scope,
          fromWeeklyRouteId: row.weeklyRouteId,
          toWeeklyRouteId: projected.nextWeeklyRouteId,
          fromPosition: row.currentPosition,
          toPosition: projected.nextCurrentPosition,
          fromScheduledDate: row.scheduledDate,
          toScheduledDate: projected.nextScheduledDate,
          fromScheduledSlotIndex: row.scheduledSlotIndex,
          toScheduledSlotIndex: projected.nextScheduledSlotIndex,
          fromState: row.state,
          toState: projected.nextState,
          fromOverrideKind: row.manualOverrideKind,
          toOverrideKind: projected.nextManualOverrideKind,
        },
        createdByAdultUserId: params.createdByAdultUserId ?? null,
      });
    }
  });

  return changedRows.length;
}

export async function getOrCreateWeeklyRouteBoardForLearner(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate?: string;
}): Promise<{ weekStartDate: string; board: WeeklyRouteBoard }> {
  const state = await inspectWeeklyRouteBoardMaintenanceState(params);
  const { weekStartDate, route, existing } = state;

  if (existing) {
    if (state.maintenanceReason === "overdue_carry_forward") {
      const repaired = await repairOverdueCarryForwardForWeek({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate,
        weeklyRouteId: existing.summary.weeklyRouteId,
      });

      return { weekStartDate, board: repaired };
    }

    if (state.maintenanceReason === "empty_board") {
      const activated = await ensureDefaultBranchActivations({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
      });

      if (activated) {
        const regenerated = await generateWeeklyRoute({
          learnerId: params.learnerId,
          sourceId: params.sourceId,
          weekStartDate,
        });
        return { weekStartDate, board: regenerated };
      }
    }

    if (state.maintenanceReason === "unscheduled_items") {
      if (route && (await ensureSuggestedWeeklyRouteSchedule(route))) {
        const refreshed = await getWeeklyRouteBoardById({
          learnerId: params.learnerId,
          weeklyRouteId: existing.summary.weeklyRouteId,
        });

        if (refreshed) {
          return { weekStartDate, board: refreshed };
        }
      }
    }

    if (state.maintenanceReason === "prior_week_overlap") {
      const regenerated = await generateWeeklyRoute({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate,
      });

      return { weekStartDate, board: regenerated };
    }

    if (state.maintenanceReason === "capacity_drift") {
      const regenerated = await generateWeeklyRoute({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate,
      });

      return { weekStartDate, board: regenerated };
    }

    return { weekStartDate, board: existing };
  }

  let generated = await generateWeeklyRoute({
    learnerId: params.learnerId,
    sourceId: params.sourceId,
    weekStartDate,
  });

  if (generated.items.length === 0) {
    const activated = await ensureDefaultBranchActivations({
      learnerId: params.learnerId,
      sourceId: params.sourceId,
    });

    if (activated) {
      generated = await generateWeeklyRoute({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate,
      });
    }
  }

  return { weekStartDate, board: generated };
}

async function inspectWeeklyRouteBoardMaintenanceState(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate?: string;
}) {
  const weekStartDate = toWeekStartDate(params.weekStartDate);
  const route = await getDb().query.weeklyRoutes.findFirst({
    where: and(
      eq(weeklyRoutes.learnerId, params.learnerId),
      eq(weeklyRoutes.sourceId, params.sourceId),
      eq(weeklyRoutes.weekStartDate, weekStartDate),
    ),
  });
  const existing = await getWeeklyRouteBoard({
    learnerId: params.learnerId,
    sourceId: params.sourceId,
    weekStartDate,
  });
  const profile = await getDb().query.learnerRouteProfiles.findFirst({
    where: and(
      eq(learnerRouteProfiles.learnerId, params.learnerId),
      eq(learnerRouteProfiles.sourceId, params.sourceId),
    ),
  });

  let maintenanceReason: WeeklyRouteBoardMaintenanceReason;
  if (!existing) {
    maintenanceReason = "missing_route";
  } else if (
    existing.items.length === 0 &&
    (await findOverdueScheduledItemsBeforeWeek({
      learnerId: params.learnerId,
      sourceId: params.sourceId,
      weekStartDate,
    })).length > 0
  ) {
    maintenanceReason = "overdue_carry_forward";
  } else if (existing.items.length === 0) {
    maintenanceReason = "empty_board";
  } else if (existing.items.some((item) => item.state !== "removed" && item.scheduledDate == null)) {
    maintenanceReason = "unscheduled_items";
  } else if (shouldRegenerateForCapacityDrift({ board: existing, profile })) {
    maintenanceReason = "capacity_drift";
  } else if (route && (await shouldRegenerateForPriorWeekOverlap(route, existing))) {
    maintenanceReason = "prior_week_overlap";
  } else {
    maintenanceReason = "read_safe";
  }

  return {
    weekStartDate,
    route,
    existing,
    maintenanceReason,
  };
}

export async function getReadOptimizedWeeklyRouteBoardForToday(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate?: string;
}) {
  const state = await inspectWeeklyRouteBoardMaintenanceState(params);

  return state.maintenanceReason === "read_safe" && state.existing
    ? {
        weekStartDate: state.weekStartDate,
        board: state.existing,
        mode: "read" as const,
        maintenanceReason: state.maintenanceReason,
      }
    : {
        weekStartDate: state.weekStartDate,
        board: null,
        mode: "repair" as const,
        maintenanceReason: state.maintenanceReason,
      };
}

function getLaunchAnchorItem(board: WeeklyRouteBoard, date: string) {
  return (
    board.items.find((item) => item.state !== "removed" && item.scheduledDate === date) ??
    board.items.find(
      (item) => item.state !== "removed" && item.scheduledDate != null && item.scheduledDate > date,
    ) ??
    board.items.find((item) => item.state !== "removed") ??
    null
  );
}

function getExpansionTargetDates(params: {
  scope: DailyWorkspaceExpansionScope;
  date: string;
  weekdayDates: string[];
}) {
  const futureDates = params.weekdayDates.filter((candidate) => candidate > params.date);

  switch (params.scope) {
    case "tomorrow":
      return futureDates.slice(0, 1);
    case "next_few_days":
      return futureDates.slice(0, 3);
    case "current_week":
      return futureDates;
  }
}

export async function expandWeeklyRouteFromToday(params: {
  learnerId: string;
  sourceId: string;
  date: string;
  scope: DailyWorkspaceExpansionScope;
}) {
  const weekStartDate = toWeekStartDate(params.date);
  const db = getDb();
  const route = await db.query.weeklyRoutes.findFirst({
    where: and(
      eq(weeklyRoutes.learnerId, params.learnerId),
      eq(weeklyRoutes.sourceId, params.sourceId),
      eq(weeklyRoutes.weekStartDate, weekStartDate),
    ),
  });

  if (!route) {
    throw new Error("Weekly route not found.");
  }

  const profile = await db.query.learnerRouteProfiles.findFirst({
    where: and(
      eq(learnerRouteProfiles.learnerId, params.learnerId),
      eq(learnerRouteProfiles.sourceId, params.sourceId),
    ),
  });
  const enabledOffsets = getEnabledPlanningDayOffsets(profile?.planningDays ?? null);
  const weekdayDates = enabledOffsets
    .map((offset) => buildWeekdayDates(route.weekStartDate)[offset])
    .filter((candidate): candidate is string => candidate != null);
  const targetDates = getExpansionTargetDates({
    scope: params.scope,
    date: params.date,
    weekdayDates,
  });

  let { board } = await getOrCreateWeeklyRouteBoardForLearner({
    learnerId: params.learnerId,
    sourceId: params.sourceId,
    weekStartDate,
  });

  const anchor = getLaunchAnchorItem(board, params.date);
  const anchorPosition = anchor?.currentPosition ?? -1;

  if (targetDates.length === 0) {
    return {
      board,
      status: "blocked" as const,
      scheduledCount: 0,
      scheduledDates: [] as string[],
      targetDates,
      reason: "No future planning days remain in this week.",
    };
  }

  const scheduledFutureDates = new Set(
    board.items
      .filter(
        (item) =>
          item.state !== "removed" &&
          item.scheduledDate != null &&
          item.scheduledDate > params.date,
      )
      .map((item) => item.scheduledDate as string),
  );
  const datesToFill = targetDates.filter((candidate) => !scheduledFutureDates.has(candidate));

  if (datesToFill.length === 0) {
    return {
      board,
      status: "already_scheduled" as const,
      scheduledCount: 0,
      scheduledDates: [] as string[],
      targetDates,
      reason: "Future days are already scheduled through this scope.",
    };
  }

  const scheduledDates: string[] = [];

  for (const targetDate of datesToFill) {
    const nextQueuedItem = board.items.find(
      (item) =>
        item.state !== "removed" &&
        item.scheduledDate == null &&
        item.currentPosition > anchorPosition,
    );

    if (!nextQueuedItem) {
      break;
    }

    const targetIndex = board.items.filter(
      (item) => item.state !== "removed" && item.scheduledDate === targetDate,
    ).length;

    board = await moveWeeklyRouteItem({
      learnerId: params.learnerId,
      weeklyRouteId: board.summary.weeklyRouteId,
      weeklyRouteItemId: nextQueuedItem.id,
      targetScheduledDate: targetDate,
      targetIndex,
      manualOverrideNote: `fast_path_expand:${params.scope}`,
    });
    scheduledDates.push(targetDate);
  }

  if (scheduledDates.length === 0) {
    return {
      board,
      status: "blocked" as const,
      scheduledCount: 0,
      scheduledDates,
      targetDates,
      reason: "This route is still bounded to today. Add more source depth before expanding further.",
    };
  }

  return {
    board,
    status: "expanded" as const,
    scheduledCount: scheduledDates.length,
    scheduledDates,
    targetDates,
    reason: null,
  };
}

async function ensureDefaultBranchActivations(params: {
  learnerId: string;
  sourceId: string;
}) {
  const db = getDb();
  const existing = await db.query.learnerBranchActivations.findMany({
    where: and(
      eq(learnerBranchActivations.learnerId, params.learnerId),
      eq(learnerBranchActivations.sourceId, params.sourceId),
    ),
    limit: 1,
  });

  if (existing.length > 0) {
    return false;
  }

  const rootNodes = await db.query.curriculumNodes.findMany({
    where: and(
      eq(curriculumNodes.sourceId, params.sourceId),
      eq(curriculumNodes.isActive, true),
      eq(curriculumNodes.depth, 0),
    ),
    orderBy: [asc(curriculumNodes.sequenceIndex), asc(curriculumNodes.createdAt)],
  });

  if (rootNodes.length === 0) {
    return false;
  }

  const inserts: Array<typeof learnerBranchActivations.$inferInsert> = rootNodes.map((node) => ({
    learnerId: params.learnerId,
    sourceId: params.sourceId,
    nodeId: node.id,
    status: "active",
    startedAt: new Date(),
    metadata: {
      bootstrap: "planning_weekly_route_auto_activation",
    },
  }));

  await db
    .insert(learnerBranchActivations)
    .values(
      inserts.map((row) => ({
        ...row,
        status: row.status ?? "active",
      })),
    )
    .onConflictDoNothing();

  const activations = await db.query.learnerBranchActivations.findMany({
    where: and(
      eq(learnerBranchActivations.learnerId, params.learnerId),
      eq(learnerBranchActivations.sourceId, params.sourceId),
    ),
    limit: 1,
  });

  return activations.length > 0;
}

export async function moveWeeklyRouteItem(params: {
  learnerId: string;
  weeklyRouteId: string;
  weeklyRouteItemId: string;
  targetWeeklyRouteId?: string;
  targetScheduledDate: string | null;
  targetIndex: number;
  manualOverrideNote?: string;
}): Promise<WeeklyRouteBoard> {
  const db = getDb();
  const route = await db.query.weeklyRoutes.findFirst({
    where: and(eq(weeklyRoutes.id, params.weeklyRouteId), eq(weeklyRoutes.learnerId, params.learnerId)),
  });
  if (!route) {
    throw new Error("Weekly route not found.");
  }

  const rows = await db.query.weeklyRouteItems.findMany({
    where: eq(weeklyRouteItems.weeklyRouteId, route.id),
    orderBy: [asc(weeklyRouteItems.currentPosition), asc(weeklyRouteItems.createdAt)],
  });

  const movingItem = rows.find((row) => row.id === params.weeklyRouteItemId);
  if (!movingItem) {
    throw new Error("Weekly route item not found.");
  }

  const targetWeeklyRouteId = params.targetWeeklyRouteId ?? route.id;

  if (targetWeeklyRouteId === route.id) {
    const weekdayDates = buildWeekdayDates(route.weekStartDate);
    const targetColumnKey =
      params.targetScheduledDate == null
        ? "unassigned"
        : toColumnKey(params.targetScheduledDate, weekdayDates);

    if (params.targetScheduledDate != null && targetColumnKey === "unassigned") {
      throw new Error("Scheduled date must be within this week.");
    }

    const sameDayDuplicate = rows.find(
      (row) =>
        row.id !== movingItem.id &&
        row.skillNodeId === movingItem.skillNodeId &&
        row.scheduledDate === (targetColumnKey === "unassigned" ? null : targetColumnKey),
    );
    if (sameDayDuplicate) {
      throw new Error("This skill is already scheduled for that day.");
    }

    const columnOrder = ["unassigned", ...weekdayDates];
    const itemsByColumn = new Map<string, string[]>();
    for (const columnKey of columnOrder) {
      itemsByColumn.set(columnKey, []);
    }

    for (const item of rows) {
      const columnKey = toColumnKey(item.scheduledDate, weekdayDates);
      itemsByColumn.get(columnKey)!.push(item.id);
    }

    const sourceColumnKey = toColumnKey(movingItem.scheduledDate, weekdayDates);
    itemsByColumn.set(
      sourceColumnKey,
      (itemsByColumn.get(sourceColumnKey) ?? []).filter((id) => id !== movingItem.id),
    );

    const targetColumnItems = [...(itemsByColumn.get(targetColumnKey) ?? [])];
    const clampedTargetIndex = Math.max(0, Math.min(params.targetIndex, targetColumnItems.length));
    targetColumnItems.splice(clampedTargetIndex, 0, movingItem.id);
    itemsByColumn.set(targetColumnKey, targetColumnItems);

    const columnByItemId = new Map<string, string>();
    for (const columnKey of columnOrder) {
      for (const itemId of itemsByColumn.get(columnKey) ?? []) {
        columnByItemId.set(itemId, columnKey);
      }
    }

    const nextOrderedIds = columnOrder.flatMap((columnKey) => itemsByColumn.get(columnKey) ?? []);
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    await db.transaction(async (tx) => {
      for (const [position, itemId] of nextOrderedIds.entries()) {
        const row = rowsById.get(itemId)!;
        const columnKey = columnByItemId.get(itemId)!;
        const nextScheduledDate = columnKey === "unassigned" ? null : columnKey;
        const nextScheduledSlotIndex = nextScheduledDate ? 1 : null;
        const nextOverrideKind = deriveOverrideKind(row, position, nextScheduledDate);
        const nextState = deriveNextState(row, nextScheduledDate);
        const nextManualOverrideNote =
          itemId === movingItem.id
            ? params.manualOverrideNote ?? row.manualOverrideNote
            : row.manualOverrideNote;

        if (
          row.currentPosition !== position ||
          row.scheduledDate !== nextScheduledDate ||
          row.scheduledSlotIndex !== nextScheduledSlotIndex ||
          row.state !== nextState ||
          row.manualOverrideKind !== nextOverrideKind ||
          row.manualOverrideNote !== nextManualOverrideNote
        ) {
          await tx
            .update(weeklyRouteItems)
            .set({
              currentPosition: position,
              scheduledDate: nextScheduledDate,
              scheduledSlotIndex: nextScheduledSlotIndex,
              state: nextState,
              manualOverrideKind: nextOverrideKind,
              manualOverrideNote: nextManualOverrideNote,
              updatedAt: new Date(),
            })
            .where(eq(weeklyRouteItems.id, itemId));
        }
      }

      const fromDate = movingItem.scheduledDate;
      const toDate = targetColumnKey === "unassigned" ? null : targetColumnKey;
      const nextGlobalPosition = nextOrderedIds.indexOf(movingItem.id);

      const eventType =
        fromDate === toDate ? "reorder" : toDate == null ? "defer" : "pin";

      await tx.insert(routeOverrideEvents).values({
        learnerId: params.learnerId,
        weeklyRouteItemId: movingItem.id,
        eventType,
        payload: {
          weeklyRouteId: route.id,
          fromPosition: movingItem.currentPosition,
          toPosition: nextGlobalPosition,
          toColumnIndex: clampedTargetIndex,
          fromScheduledDate: fromDate,
          toScheduledDate: toDate,
        },
        createdByAdultUserId: null,
      });
    });

    const board = await getWeeklyRouteBoardById({
      learnerId: params.learnerId,
      weeklyRouteId: route.id,
    });

    if (!board) {
      throw new Error("Failed to reload weekly route board after update.");
    }

    return board;
  }

  const targetRoute = await db.query.weeklyRoutes.findFirst({
    where: and(eq(weeklyRoutes.id, targetWeeklyRouteId), eq(weeklyRoutes.learnerId, params.learnerId)),
  });
  if (!targetRoute) {
    throw new Error("Target weekly route not found.");
  }

  if (targetRoute.sourceId !== route.sourceId) {
    throw new Error("Target weekly route must use the same curriculum source.");
  }

  const targetRows = await db.query.weeklyRouteItems.findMany({
    where: eq(weeklyRouteItems.weeklyRouteId, targetRoute.id),
    orderBy: [asc(weeklyRouteItems.currentPosition), asc(weeklyRouteItems.createdAt)],
  });

  const sourceWeekdayDates = buildWeekdayDates(route.weekStartDate);
  const targetWeekdayDates = buildWeekdayDates(targetRoute.weekStartDate);
  const targetColumnKey =
    params.targetScheduledDate == null
      ? "unassigned"
      : toColumnKey(params.targetScheduledDate, targetWeekdayDates);

  if (params.targetScheduledDate != null && targetColumnKey === "unassigned") {
    throw new Error("Scheduled date must be within the target week.");
  }

  const sameDayDuplicate = targetRows.find(
    (row) =>
      row.id !== movingItem.id &&
      row.skillNodeId === movingItem.skillNodeId &&
      row.scheduledDate === (targetColumnKey === "unassigned" ? null : targetColumnKey),
  );
  if (sameDayDuplicate) {
    throw new Error("This skill is already scheduled for that day.");
  }

  const sourceColumnOrder = ["unassigned", ...sourceWeekdayDates];
  const sourceItemsByColumn = new Map<string, string[]>();
  for (const columnKey of sourceColumnOrder) {
    sourceItemsByColumn.set(columnKey, []);
  }

  for (const item of rows) {
    const columnKey = toColumnKey(item.scheduledDate, sourceWeekdayDates);
    sourceItemsByColumn.get(columnKey)!.push(item.id);
  }

  const sourceColumnKey = toColumnKey(movingItem.scheduledDate, sourceWeekdayDates);
  sourceItemsByColumn.set(
    sourceColumnKey,
    (sourceItemsByColumn.get(sourceColumnKey) ?? []).filter((id) => id !== movingItem.id),
  );

  const targetColumnOrder = ["unassigned", ...targetWeekdayDates];
  const targetItemsByColumn = new Map<string, string[]>();
  for (const columnKey of targetColumnOrder) {
    targetItemsByColumn.set(columnKey, []);
  }

  for (const item of targetRows) {
    const columnKey = toColumnKey(item.scheduledDate, targetWeekdayDates);
    targetItemsByColumn.get(columnKey)!.push(item.id);
  }

  const targetColumnItems = [...(targetItemsByColumn.get(targetColumnKey) ?? [])];
  const clampedTargetIndex = Math.max(0, Math.min(params.targetIndex, targetColumnItems.length));
  targetColumnItems.splice(clampedTargetIndex, 0, movingItem.id);
  targetItemsByColumn.set(targetColumnKey, targetColumnItems);

  const sourceColumnByItemId = new Map<string, string>();
  for (const columnKey of sourceColumnOrder) {
    for (const itemId of sourceItemsByColumn.get(columnKey) ?? []) {
      sourceColumnByItemId.set(itemId, columnKey);
    }
  }

  const targetColumnByItemId = new Map<string, string>();
  for (const columnKey of targetColumnOrder) {
    for (const itemId of targetItemsByColumn.get(columnKey) ?? []) {
      targetColumnByItemId.set(itemId, columnKey);
    }
  }

  const nextSourceOrderedIds = sourceColumnOrder.flatMap(
    (columnKey) => sourceItemsByColumn.get(columnKey) ?? [],
  );
  const nextTargetOrderedIds = targetColumnOrder.flatMap(
    (columnKey) => targetItemsByColumn.get(columnKey) ?? [],
  );
  const sourceRowsById = new Map(rows.map((row) => [row.id, row]));
  const targetRowsById = new Map(targetRows.map((row) => [row.id, row]));

  await db.transaction(async (tx) => {
    for (const [position, itemId] of nextSourceOrderedIds.entries()) {
      const row = sourceRowsById.get(itemId)!;
      const columnKey = sourceColumnByItemId.get(itemId)!;
      const nextScheduledDate = columnKey === "unassigned" ? null : columnKey;
      const nextScheduledSlotIndex = nextScheduledDate ? 1 : null;
      const nextOverrideKind = deriveOverrideKind(row, position, nextScheduledDate);
      const nextState = deriveNextState(row, nextScheduledDate);

      if (
        row.currentPosition !== position ||
        row.scheduledDate !== nextScheduledDate ||
        row.scheduledSlotIndex !== nextScheduledSlotIndex ||
        row.state !== nextState ||
        row.manualOverrideKind !== nextOverrideKind
      ) {
        await tx
          .update(weeklyRouteItems)
          .set({
            currentPosition: position,
            scheduledDate: nextScheduledDate,
            scheduledSlotIndex: nextScheduledSlotIndex,
            state: nextState,
            manualOverrideKind: nextOverrideKind,
            updatedAt: new Date(),
          })
          .where(eq(weeklyRouteItems.id, itemId));
      }
    }

    for (const [position, itemId] of nextTargetOrderedIds.entries()) {
      const row = itemId === movingItem.id ? movingItem : targetRowsById.get(itemId)!;
      const columnKey = targetColumnByItemId.get(itemId)!;
      const nextScheduledDate = columnKey === "unassigned" ? null : columnKey;
      const nextScheduledSlotIndex = nextScheduledDate ? 1 : null;
      const nextOverrideKind = deriveOverrideKind(row, position, nextScheduledDate);
      const nextState = deriveNextState(row, nextScheduledDate);
      const nextManualOverrideNote =
        itemId === movingItem.id
          ? params.manualOverrideNote ?? row.manualOverrideNote
          : row.manualOverrideNote;

      if (
        row.weeklyRouteId !== targetRoute.id ||
        row.currentPosition !== position ||
        row.scheduledDate !== nextScheduledDate ||
        row.scheduledSlotIndex !== nextScheduledSlotIndex ||
        row.state !== nextState ||
        row.manualOverrideKind !== nextOverrideKind ||
        row.manualOverrideNote !== nextManualOverrideNote
      ) {
        await tx
          .update(weeklyRouteItems)
          .set({
            weeklyRouteId: targetRoute.id,
            currentPosition: position,
            scheduledDate: nextScheduledDate,
            scheduledSlotIndex: nextScheduledSlotIndex,
            state: nextState,
            manualOverrideKind: nextOverrideKind,
            manualOverrideNote: nextManualOverrideNote,
            updatedAt: new Date(),
          })
          .where(eq(weeklyRouteItems.id, itemId));
      }
    }

    const fromDate = movingItem.scheduledDate;
    const toDate = targetColumnKey === "unassigned" ? null : targetColumnKey;
    const nextGlobalPosition = nextTargetOrderedIds.indexOf(movingItem.id);

    const eventType =
      fromDate === toDate ? "reorder" : toDate == null ? "defer" : "pin";

    await tx.insert(routeOverrideEvents).values({
      learnerId: params.learnerId,
      weeklyRouteItemId: movingItem.id,
      eventType,
      payload: {
        weeklyRouteId: route.id,
        targetWeeklyRouteId: targetRoute.id,
        fromPosition: movingItem.currentPosition,
        toPosition: nextGlobalPosition,
        toColumnIndex: clampedTargetIndex,
        fromScheduledDate: fromDate,
        toScheduledDate: toDate,
      },
      createdByAdultUserId: null,
    });
  });

  const board = await getWeeklyRouteBoardById({
    learnerId: params.learnerId,
    weeklyRouteId: targetRoute.id,
  });

  if (!board) {
    throw new Error("Failed to reload weekly route board after update.");
  }

  return board;
}

export async function duplicateWeeklyRouteItem(params: {
  learnerId: string;
  weeklyRouteId: string;
  weeklyRouteItemId: string;
  targetScheduledDate?: string | null;
  manualOverrideNote?: string;
}): Promise<WeeklyRouteBoard> {
  const db = getDb();
  const route = await db.query.weeklyRoutes.findFirst({
    where: and(eq(weeklyRoutes.id, params.weeklyRouteId), eq(weeklyRoutes.learnerId, params.learnerId)),
  });

  if (!route) {
    throw new Error("Weekly route not found.");
  }

  const rows = await db.query.weeklyRouteItems.findMany({
    where: eq(weeklyRouteItems.weeklyRouteId, route.id),
    orderBy: [asc(weeklyRouteItems.currentPosition), asc(weeklyRouteItems.createdAt)],
  });

  const sourceItem = rows.find((row) => row.id === params.weeklyRouteItemId);
  if (!sourceItem) {
    throw new Error("Weekly route item not found.");
  }

  const targetScheduledDate = params.targetScheduledDate ?? sourceItem.scheduledDate ?? null;
  if (targetScheduledDate != null && targetScheduledDate === sourceItem.scheduledDate) {
    throw new Error("This skill is already scheduled for that day.");
  }

  const sameDayDuplicate = rows.find(
    (row) =>
      row.id !== sourceItem.id &&
      row.skillNodeId === sourceItem.skillNodeId &&
      row.scheduledDate === targetScheduledDate,
  );

  if (sameDayDuplicate) {
    throw new Error("This skill is already scheduled for that day.");
  }

  const insertPosition = Math.max(0, Math.min(sourceItem.currentPosition + 1, rows.length));
  const shiftedRows = rows
    .filter((row) => row.currentPosition >= insertPosition)
    .sort((left, right) => right.currentPosition - left.currentPosition);

  await db.transaction(async (tx) => {
    for (const row of shiftedRows) {
      await tx
        .update(weeklyRouteItems)
        .set({
          currentPosition: row.currentPosition + 1,
          updatedAt: new Date(),
        })
        .where(eq(weeklyRouteItems.id, row.id));
    }

    const [created] = await tx
      .insert(weeklyRouteItems)
      .values({
        weeklyRouteId: route.id,
        learnerId: params.learnerId,
        skillNodeId: sourceItem.skillNodeId,
        recommendedPosition: insertPosition,
        currentPosition: insertPosition,
        scheduledDate: targetScheduledDate,
        scheduledSlotIndex: targetScheduledDate ? 1 : null,
        manualOverrideKind: targetScheduledDate ? "pinned" : sourceItem.manualOverrideKind,
        manualOverrideNote:
          params.manualOverrideNote ??
          `Repeated from ${sourceItem.scheduledDate ?? "the route"}${targetScheduledDate ? ` to ${targetScheduledDate}` : ""}.`,
        state: targetScheduledDate ? "scheduled" : sourceItem.state,
        metadata: {
          repeatedFromWeeklyRouteItemId: sourceItem.id,
          repeatScheduledDate: targetScheduledDate,
        },
      })
      .returning();

    await tx.insert(routeOverrideEvents).values({
      learnerId: params.learnerId,
      weeklyRouteItemId: created.id,
      eventType: "repair_applied",
      payload: {
        action: "duplicate",
        sourceWeeklyRouteItemId: sourceItem.id,
        sourceScheduledDate: sourceItem.scheduledDate,
        targetScheduledDate,
        targetPosition: insertPosition,
      },
      createdByAdultUserId: null,
    });
  });

  return (await getWeeklyRouteBoardById({
    learnerId: params.learnerId,
    weeklyRouteId: params.weeklyRouteId,
  }))!;
}

export async function updateWeeklyRouteItemState(params: {
  learnerId: string;
  weeklyRouteId: string;
  weeklyRouteItemId: string;
  state: WeeklyRouteItemRow["state"];
  manualOverrideNote?: string;
}): Promise<WeeklyRouteBoard> {
  const db = getDb();
  const route = await db.query.weeklyRoutes.findFirst({
    where: and(eq(weeklyRoutes.id, params.weeklyRouteId), eq(weeklyRoutes.learnerId, params.learnerId)),
  });

  if (!route) {
    throw new Error("Weekly route not found.");
  }

  const routeItem = await db.query.weeklyRouteItems.findFirst({
    where: and(
      eq(weeklyRouteItems.id, params.weeklyRouteItemId),
      eq(weeklyRouteItems.weeklyRouteId, route.id),
    ),
  });

  if (!routeItem) {
    throw new Error("Weekly route item not found.");
  }

  if (routeItem.state === params.state && routeItem.manualOverrideNote === params.manualOverrideNote) {
    const board = await getWeeklyRouteBoardById({
      learnerId: params.learnerId,
      weeklyRouteId: route.id,
    });

    if (!board) {
      throw new Error("Failed to reload weekly route board after state update.");
    }

    return board;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(weeklyRouteItems)
      .set({
        state: params.state,
        manualOverrideNote: params.manualOverrideNote ?? routeItem.manualOverrideNote,
        updatedAt: new Date(),
      })
      .where(eq(weeklyRouteItems.id, routeItem.id));

    await tx.insert(routeOverrideEvents).values({
      learnerId: params.learnerId,
      weeklyRouteItemId: routeItem.id,
      eventType: "repair_applied",
      payload: {
        weeklyRouteId: route.id,
        action: "set_state",
        fromState: routeItem.state,
        toState: params.state,
      },
      createdByAdultUserId: null,
    });
  });

  const board = await getWeeklyRouteBoardById({
    learnerId: params.learnerId,
    weeklyRouteId: route.id,
  });

  if (!board) {
    throw new Error("Failed to reload weekly route board after state update.");
  }

  return board;
}

export async function refreshWeeklyRouteSchedule(params: {
  learnerId: string;
  weeklyRouteId: string;
  createdByAdultUserId?: string | null;
}) {
  const db = getDb();
  const route = await db.query.weeklyRoutes.findFirst({
    where: and(
      eq(weeklyRoutes.id, params.weeklyRouteId),
      eq(weeklyRoutes.learnerId, params.learnerId),
    ),
  });

  if (!route) {
    throw new Error("Weekly route not found.");
  }

  const weekStartDates = getForwardWeekStartDates(
    route.weekStartDate,
    WEEKLY_REFRESH_HORIZON_WEEKS,
  );
  const routeDescriptors = await Promise.all(
    weekStartDates.map(async (weekStartDate) => {
      const { board } = await getOrCreateWeeklyRouteBoardForLearner({
        learnerId: params.learnerId,
        sourceId: route.sourceId,
        weekStartDate,
      });

      return {
        weekStartDate,
        weeklyRouteId: board.summary.weeklyRouteId,
      };
    }),
  );

  const [rows, profile] = await Promise.all([
    db.query.weeklyRouteItems.findMany({
      where: inArray(
        weeklyRouteItems.weeklyRouteId,
        routeDescriptors.map((descriptor) => descriptor.weeklyRouteId),
      ),
      orderBy: [asc(weeklyRouteItems.currentPosition), asc(weeklyRouteItems.createdAt)],
    }),
    db.query.learnerRouteProfiles.findFirst({
      where: and(
        eq(learnerRouteProfiles.learnerId, route.learnerId),
        eq(learnerRouteProfiles.sourceId, route.sourceId),
      ),
    }),
  ]);

  const rowsByRouteId = new Map<string, WeeklyRouteItemRow[]>();
  for (const row of rows) {
    const existing = rowsByRouteId.get(row.weeklyRouteId) ?? [];
    existing.push(row);
    rowsByRouteId.set(row.weeklyRouteId, existing);
  }

  const enabledDayOffsets = getEnabledPlanningDayOffsets(profile?.planningDays ?? null);
  const targetItemsPerDay = getTargetItemsPerDay(profile);
  const orderedRows = routeDescriptors.flatMap(
    (descriptor) => rowsByRouteId.get(descriptor.weeklyRouteId) ?? [],
  );
  const days = routeDescriptors.flatMap((descriptor) =>
    buildScheduleDaysForWeek({
      weeklyRouteId: descriptor.weeklyRouteId,
      weekStartDate: descriptor.weekStartDate,
      targetItemsPerDay,
      enabledDayOffsets,
    }),
  );
  const slots = buildAdaptiveScheduleSlots({
    items: orderedRows.map(toScheduleRefreshItem),
    days,
  });
  const projections = buildScheduleRefreshProjection({
    items: orderedRows.map(toScheduleRefreshItem),
    slots,
  });

  await applyScheduleRefreshProjection({
    learnerId: params.learnerId,
    rows: orderedRows,
    projections,
    scope: "week",
    createdByAdultUserId: params.createdByAdultUserId,
  });

  const board = await getWeeklyRouteBoardById({
    learnerId: params.learnerId,
    weeklyRouteId: route.id,
  });

  if (!board) {
    throw new Error("Failed to reload weekly route board after schedule refresh.");
  }

  return board;
}

export async function refreshMonthlyRouteSchedules(params: {
  learnerId: string;
  sourceId: string;
  monthDate: string;
  createdByAdultUserId?: string | null;
}) {
  const weekStartDates = getMonthWeekStartDates(params.monthDate);
  const routeDescriptors = await Promise.all(
    weekStartDates.map(async (weekStartDate) => {
      const { board } = await getOrCreateWeeklyRouteBoardForLearner({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate,
      });

      return {
        weekStartDate,
        weeklyRouteId: board.summary.weeklyRouteId,
      };
    }),
  );

  const db = getDb();
  const [rows, profile] = await Promise.all([
    db.query.weeklyRouteItems.findMany({
      where: inArray(
        weeklyRouteItems.weeklyRouteId,
        routeDescriptors.map((descriptor) => descriptor.weeklyRouteId),
      ),
      orderBy: [asc(weeklyRouteItems.currentPosition), asc(weeklyRouteItems.createdAt)],
    }),
    db.query.learnerRouteProfiles.findFirst({
      where: and(
        eq(learnerRouteProfiles.learnerId, params.learnerId),
        eq(learnerRouteProfiles.sourceId, params.sourceId),
      ),
    }),
  ]);

  const rowsByRouteId = new Map<string, WeeklyRouteItemRow[]>();
  for (const row of rows) {
    const existing = rowsByRouteId.get(row.weeklyRouteId) ?? [];
    existing.push(row);
    rowsByRouteId.set(row.weeklyRouteId, existing);
  }

  const orderedRows = routeDescriptors.flatMap(
    (descriptor) => rowsByRouteId.get(descriptor.weeklyRouteId) ?? [],
  );
  const enabledDayOffsets = getEnabledPlanningDayOffsets(profile?.planningDays ?? null);
  const targetItemsPerDay = getTargetItemsPerDay(profile);
  const days = routeDescriptors.flatMap((descriptor) =>
    buildScheduleDaysForWeek({
      weeklyRouteId: descriptor.weeklyRouteId,
      weekStartDate: descriptor.weekStartDate,
      targetItemsPerDay,
      enabledDayOffsets,
    }),
  );
  const slots = buildAdaptiveScheduleSlots({
    items: orderedRows.map(toScheduleRefreshItem),
    days,
  });
  const projections = buildScheduleRefreshProjection({
    items: orderedRows.map(toScheduleRefreshItem),
    slots,
  });

  await applyScheduleRefreshProjection({
    learnerId: params.learnerId,
    rows: orderedRows,
    projections,
    scope: "month",
    createdByAdultUserId: params.createdByAdultUserId,
  });

  return {
    weekStartDates,
    updatedRouteCount: routeDescriptors.length,
  };
}

export function buildPlanningWeekdayDates(weekStartDate: string) {
  return buildWeekdayDates(weekStartDate);
}
