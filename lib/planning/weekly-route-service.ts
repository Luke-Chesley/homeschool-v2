import { and, asc, eq } from "drizzle-orm";

import {
  generateWeeklyRoute,
  getWeeklyRouteBoard,
  getWeeklyRouteBoardById,
  toWeekStartDate,
  type WeeklyRouteBoard,
} from "@/lib/curriculum-routing";
import { getDb } from "@/lib/db/server";
import {
  curriculumNodes,
  learnerBranchActivations,
  routeOverrideEvents,
  weeklyRouteItems,
  weeklyRoutes,
} from "@/lib/db/schema";

type WeeklyRouteItemRow = typeof weeklyRouteItems.$inferSelect;
type WeeklyRouteOverrideKind = WeeklyRouteItemRow["manualOverrideKind"];

const WEEKDAY_COUNT = 5;

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

export async function getOrCreateWeeklyRouteBoardForLearner(params: {
  learnerId: string;
  sourceId: string;
  weekStartDate?: string;
}): Promise<{ weekStartDate: string; board: WeeklyRouteBoard }> {
  const weekStartDate = toWeekStartDate(params.weekStartDate);
  const existing = await getWeeklyRouteBoard({
    learnerId: params.learnerId,
    sourceId: params.sourceId,
    weekStartDate,
  });

  if (existing) {
    if (existing.items.length === 0) {
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

  await db.insert(learnerBranchActivations).values(
    inserts.map((row) => ({
      ...row,
      status: row.status ?? "active",
    })),
  );

  return true;
}

export async function moveWeeklyRouteItem(params: {
  learnerId: string;
  weeklyRouteId: string;
  weeklyRouteItemId: string;
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

  const weekdayDates = buildWeekdayDates(route.weekStartDate);
  const targetColumnKey =
    params.targetScheduledDate == null
      ? "unassigned"
      : toColumnKey(params.targetScheduledDate, weekdayDates);

  if (params.targetScheduledDate != null && targetColumnKey === "unassigned") {
    throw new Error("Scheduled date must be within this week (Monday-Friday).");
  }

  const rows = await db.query.weeklyRouteItems.findMany({
    where: eq(weeklyRouteItems.weeklyRouteId, route.id),
    orderBy: [asc(weeklyRouteItems.currentPosition), asc(weeklyRouteItems.createdAt)],
  });

  const movingItem = rows.find((row) => row.id === params.weeklyRouteItemId);
  if (!movingItem) {
    throw new Error("Weekly route item not found.");
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
      const nextOverrideKind = deriveOverrideKind(row, position, nextScheduledDate);
      const nextManualOverrideNote =
        itemId === movingItem.id
          ? params.manualOverrideNote ?? row.manualOverrideNote
          : row.manualOverrideNote;

      if (
        row.currentPosition !== position ||
        row.scheduledDate !== nextScheduledDate ||
        row.manualOverrideKind !== nextOverrideKind ||
        row.manualOverrideNote !== nextManualOverrideNote
      ) {
        await tx
          .update(weeklyRouteItems)
          .set({
            currentPosition: position,
            scheduledDate: nextScheduledDate,
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

export function buildPlanningWeekdayDates(weekStartDate: string) {
  return buildWeekdayDates(weekStartDate);
}
