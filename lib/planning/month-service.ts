import {
  getOrCreateWeeklyRouteBoardForLearner,
} from "@/lib/planning/weekly-route-service";
import type {
  MonthlyPlan,
  MonthlyPlanDay,
  MonthlyPlanWeek,
} from "@/lib/planning/types";
import type { WeeklyRouteBoard, WeeklyRouteBoardItem } from "@/lib/curriculum-routing/types";
import { toWeekStartDate } from "@/lib/curriculum-routing";

function parseDateOrThrow(value: string): Date {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return parsed;
}

function addDays(baseDate: string, days: number) {
  const date = parseDateOrThrow(baseDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(parseDateOrThrow(date));
}

function formatWeekLabel(weekStartDate: string) {
  return `Week of ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parseDateOrThrow(weekStartDate))}`;
}

function formatDayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseDateOrThrow(date));
}

function formatShortDayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(parseDateOrThrow(date));
}

function isWeekend(date: string) {
  const weekday = parseDateOrThrow(date).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function isInMonth(date: string, monthStartDate: string) {
  const value = parseDateOrThrow(date);
  const monthStart = parseDateOrThrow(monthStartDate);
  return (
    value.getUTCFullYear() === monthStart.getUTCFullYear() &&
    value.getUTCMonth() === monthStart.getUTCMonth()
  );
}

function buildCalendarWeekDates(weekStartDate: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
}

function getMonthWeekStarts(anchorDate: string) {
  const parsed = parseDateOrThrow(anchorDate);
  const firstOfMonth = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  const lastOfMonth = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0));
  const cursor = toWeekStartDate(firstOfMonth.toISOString().slice(0, 10));
  const weekStarts: string[] = [];

  let current = cursor;
  while (parseDateOrThrow(current) <= lastOfMonth) {
    weekStarts.push(current);
    current = addDays(current, 7);
  }

  return weekStarts;
}

function sumMinutes(items: WeeklyRouteBoardItem[]) {
  return items.reduce((total, item) => total + (item.estimatedMinutes ?? 0), 0);
}

function buildMonthWeek(
  board: WeeklyRouteBoard,
  weekStartDate: string,
  monthStartDate: string,
): MonthlyPlanWeek {
  const weekDates = buildCalendarWeekDates(weekStartDate);
  const itemsByDate = new Map<string, WeeklyRouteBoardItem[]>();

  for (const date of weekDates) {
    itemsByDate.set(date, []);
  }

  const unassignedItems: WeeklyRouteBoardItem[] = [];
  for (const item of board.items) {
    if (item.scheduledDate && itemsByDate.has(item.scheduledDate)) {
      itemsByDate.get(item.scheduledDate)!.push(item);
    } else {
      unassignedItems.push(item);
    }
  }

  const days: MonthlyPlanDay[] = weekDates.map((date) => {
    const items = itemsByDate.get(date) ?? [];
    return {
      date,
      label: formatDayLabel(date),
      shortLabel: formatShortDayLabel(date),
      dayNumber: parseDateOrThrow(date).getUTCDate(),
      inMonth: isInMonth(date, monthStartDate),
      isWeekend: isWeekend(date),
      isDroppable: !isWeekend(date),
      weekStartDate,
      weeklyRouteId: board.summary.weeklyRouteId,
      items,
      scheduledMinutes: sumMinutes(items),
    };
  });

  const scheduledItems = days.flatMap((day) => day.items);
  const overrideCount = board.items.filter((item) => item.manualOverrideKind !== "none").length;

  return {
    weekStartDate,
    weekLabel: formatWeekLabel(weekStartDate),
    weeklyRouteId: board.summary.weeklyRouteId,
    days,
    unassignedItems,
    scheduledMinutes: sumMinutes(scheduledItems),
    scheduledCount: scheduledItems.length,
    overrideCount,
    conflictCount: board.conflicts.length,
  };
}

export async function getMonthlyPlanningView(params: {
  learnerId: string;
  learnerName: string;
  sourceId: string;
  sourceTitle: string;
  monthDate?: string;
}): Promise<MonthlyPlan> {
  const monthAnchorDate = params.monthDate ?? new Date().toISOString().slice(0, 10);
  const parsedMonthAnchor = parseDateOrThrow(monthAnchorDate);
  const monthStartDate = new Date(
    Date.UTC(parsedMonthAnchor.getUTCFullYear(), parsedMonthAnchor.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const daysInMonth = new Date(
    Date.UTC(parsedMonthAnchor.getUTCFullYear(), parsedMonthAnchor.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const weekStartDates = getMonthWeekStarts(monthAnchorDate);

  const weeks = await Promise.all(
    weekStartDates.map(async (weekStartDate) => {
      const { board } = await getOrCreateWeeklyRouteBoardForLearner({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate,
      });

      return buildMonthWeek(board, weekStartDate, monthStartDate);
    }),
  );

  const scheduledCount = weeks.reduce((total, week) => total + week.scheduledCount, 0);
  const scheduledMinutes = weeks.reduce((total, week) => total + week.scheduledMinutes, 0);
  const unassignedCount = weeks.reduce((total, week) => total + week.unassignedItems.length, 0);
  const overrideCount = weeks.reduce((total, week) => total + week.overrideCount, 0);
  const conflictCount = weeks.reduce((total, week) => total + week.conflictCount, 0);

  return {
    monthStartDate,
    monthLabel: formatMonthLabel(monthStartDate),
    learner: {
      id: params.learnerId,
      name: params.learnerName,
      gradeLabel: "",
      pacingPreference: "Month-level placement draft",
      currentSeason: "",
    },
    sourceId: params.sourceId,
    sourceTitle: params.sourceTitle,
    weeks,
    summary: {
      weeksInView: weeks.length,
      daysInMonth,
      scheduledCount,
      scheduledMinutes,
      unassignedCount,
      overrideCount,
      conflictCount,
    },
  };
}
