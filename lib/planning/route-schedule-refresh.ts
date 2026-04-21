import type {
  WeeklyRouteItemState,
  WeeklyRouteManualOverrideKind,
} from "@/lib/curriculum-routing/types";
import { hasExplicitSeparateLessonSlotNote } from "@/lib/planning/lesson-slot-grouping";

const WEEKDAY_COUNT = 7;
const FIXED_STATES = new Set<WeeklyRouteItemState>(["done", "in_progress"]);
const MANUAL_SCHEDULE_ANCHOR_OVERRIDE_KINDS = new Set<WeeklyRouteManualOverrideKind>(["pinned"]);

export interface ScheduleRefreshItem {
  id: string;
  weeklyRouteId: string;
  recommendedPosition: number;
  currentPosition: number;
  scheduledDate: string | null;
  scheduledSlotIndex: number | null;
  state: WeeklyRouteItemState;
  manualOverrideKind: WeeklyRouteManualOverrideKind;
  manualOverrideNote: string | null;
}

export interface ScheduleSlot {
  weeklyRouteId: string;
  scheduledDate: string;
  scheduledSlotIndex: number;
}

export interface ScheduleDay {
  weeklyRouteId: string;
  scheduledDate: string;
  baseSlotCount: number;
}

export interface ScheduleRefreshProjectionItem extends ScheduleRefreshItem {
  nextWeeklyRouteId: string;
  nextCurrentPosition: number;
  nextScheduledDate: string | null;
  nextScheduledSlotIndex: number | null;
  nextState: WeeklyRouteItemState;
  nextManualOverrideKind: WeeklyRouteManualOverrideKind;
}

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

function slotKey(slot: ScheduleSlot) {
  return `${slot.weeklyRouteId}::${slot.scheduledDate}::${slot.scheduledSlotIndex}`;
}

function dayKey(day: Pick<ScheduleDay, "weeklyRouteId" | "scheduledDate">) {
  return `${day.weeklyRouteId}::${day.scheduledDate}`;
}

function isMutableState(state: WeeklyRouteItemState) {
  return !FIXED_STATES.has(state) && state !== "removed";
}

function isScheduleAnchor(item: ScheduleRefreshItem) {
  return (
    item.scheduledDate != null &&
    (
      FIXED_STATES.has(item.state) ||
      MANUAL_SCHEDULE_ANCHOR_OVERRIDE_KINDS.has(item.manualOverrideKind) ||
      isExplicitTodaySlot(item, item.scheduledDate)
    )
  );
}

function isExplicitTodaySlot(item: ScheduleRefreshItem, nextScheduledDate: string | null) {
  if (
    nextScheduledDate == null ||
    item.scheduledDate == null ||
    nextScheduledDate !== item.scheduledDate ||
    item.scheduledSlotIndex == null ||
    item.scheduledSlotIndex <= 1
  ) {
    return false;
  }

  return hasExplicitSeparateLessonSlotNote(item.manualOverrideNote);
}

function deriveOverrideKind(
  item: ScheduleRefreshItem,
  nextCurrentPosition: number,
  nextScheduledDate: string | null,
  nextState: WeeklyRouteItemState,
): WeeklyRouteManualOverrideKind {
  if (!isMutableState(item.state) || nextState === "removed") {
    return item.manualOverrideKind;
  }

  if (
    item.manualOverrideKind === "pinned" &&
    item.scheduledDate != null &&
    nextScheduledDate === item.scheduledDate
  ) {
    return "pinned";
  }

  return nextCurrentPosition === item.recommendedPosition ? "none" : "reordered";
}

function reserveAnchoredSlots(items: ScheduleRefreshItem[], slots: ScheduleSlot[]) {
  const reservedByItemId = new Map<string, ScheduleSlot>();
  const reservedKeys = new Set<string>();
  const slotsByDay = new Map<string, ScheduleSlot[]>();

  for (const slot of slots) {
    const key = dayKey(slot);
    const existing = slotsByDay.get(key) ?? [];
    existing.push(slot);
    slotsByDay.set(key, existing);
  }

  for (const item of items) {
    if (!isScheduleAnchor(item) || item.scheduledDate == null) {
      continue;
    }

    const key = dayKey({
      weeklyRouteId: item.weeklyRouteId,
      scheduledDate: item.scheduledDate,
    });
    const daySlots = slotsByDay.get(key) ?? [];
    if (daySlots.length === 0) {
      continue;
    }

    const preferredSlot =
      item.scheduledSlotIndex != null
        ? daySlots.find(
            (slot) =>
              slot.scheduledSlotIndex === item.scheduledSlotIndex &&
              !reservedKeys.has(slotKey(slot)),
          )
        : null;

    const fallbackSlot = daySlots.find((slot) => !reservedKeys.has(slotKey(slot)));
    const chosenSlot = preferredSlot ?? fallbackSlot;

    if (chosenSlot) {
      reservedByItemId.set(item.id, chosenSlot);
      reservedKeys.add(slotKey(chosenSlot));
    }
  }

  return reservedByItemId;
}

export function buildScheduleDaysForWeek(params: {
  weeklyRouteId: string;
  weekStartDate: string;
  targetItemsPerDay: number;
  enabledDayOffsets: number[];
}): ScheduleDay[] {
  const allWeekDates = Array.from({ length: WEEKDAY_COUNT }, (_, index) =>
    addDays(params.weekStartDate, index),
  );
  const enabledOffsets = new Set(params.enabledDayOffsets);
  const baseSlotCount = Math.max(1, params.targetItemsPerDay);

  return allWeekDates.map((scheduledDate, index) => ({
    weeklyRouteId: params.weeklyRouteId,
    scheduledDate,
    baseSlotCount: enabledOffsets.has(index) ? baseSlotCount : 0,
  }));
}

export function buildWeeklyScheduleSlots(params: {
  weeklyRouteId: string;
  weekStartDate: string;
  targetItemsPerDay: number;
  enabledDayOffsets: number[];
}): ScheduleSlot[] {
  return buildScheduleDaysForWeek(params).flatMap((day) =>
    Array.from({ length: day.baseSlotCount }, (_, index) => ({
      weeklyRouteId: day.weeklyRouteId,
      scheduledDate: day.scheduledDate,
      scheduledSlotIndex: index + 1,
    })),
  );
}

export function buildAdaptiveScheduleSlots(params: {
  items: ScheduleRefreshItem[];
  days: ScheduleDay[];
}): ScheduleSlot[] {
  const slotCountByDayKey = new Map(
    params.days.map((day) => [dayKey(day), Math.max(0, day.baseSlotCount)]),
  );
  const dayIndexByDayKey = new Map(
    params.days.map((day, index) => [dayKey(day), index]),
  );
  const anchoredCountByDayKey = new Map<string, number>();
  let schedulablePrefixCount = 0;

  for (const item of params.items) {
    if (item.state === "removed") {
      continue;
    }

    schedulablePrefixCount += 1;

    if (!isScheduleAnchor(item) || item.scheduledDate == null) {
      continue;
    }

    const key = dayKey({
      weeklyRouteId: item.weeklyRouteId,
      scheduledDate: item.scheduledDate,
    });
    if (!slotCountByDayKey.has(key)) {
      continue;
    }

    const anchoredCount = (anchoredCountByDayKey.get(key) ?? 0) + 1;
    anchoredCountByDayKey.set(key, anchoredCount);
    slotCountByDayKey.set(key, Math.max(slotCountByDayKey.get(key) ?? 0, anchoredCount));

    const anchorDayIndex = dayIndexByDayKey.get(key);
    if (anchorDayIndex == null) {
      continue;
    }

    let cumulativeCapacity = 0;
    for (let index = 0; index <= anchorDayIndex; index += 1) {
      cumulativeCapacity += slotCountByDayKey.get(dayKey(params.days[index])) ?? 0;
    }

    if (schedulablePrefixCount > cumulativeCapacity) {
      slotCountByDayKey.set(
        key,
        (slotCountByDayKey.get(key) ?? 0) + (schedulablePrefixCount - cumulativeCapacity),
      );
    }
  }

  return params.days.flatMap((day) =>
    Array.from({ length: slotCountByDayKey.get(dayKey(day)) ?? 0 }, (_, index) => ({
      weeklyRouteId: day.weeklyRouteId,
      scheduledDate: day.scheduledDate,
      scheduledSlotIndex: index + 1,
    })),
  );
}

export function buildScheduleRefreshProjection(params: {
  items: ScheduleRefreshItem[];
  slots: ScheduleSlot[];
}): ScheduleRefreshProjectionItem[] {
  const reservedSlotsByItemId = reserveAnchoredSlots(params.items, params.slots);
  const reservedSlotKeys = new Set(
    Array.from(reservedSlotsByItemId.values(), (slot) => slotKey(slot)),
  );
  const slotIndexByKey = new Map(
    params.slots.map((slot, index) => [slotKey(slot), index]),
  );
  let slotCursor = 0;

  const provisional = params.items.map((item) => {
    if (item.state === "removed") {
      return {
        ...item,
        nextWeeklyRouteId: item.weeklyRouteId,
        nextScheduledDate: null,
        nextScheduledSlotIndex: null,
        nextState: "removed" as const,
      };
    }

    if (isScheduleAnchor(item)) {
      const chosenSlot = reservedSlotsByItemId.get(item.id) ?? null;
      if (chosenSlot) {
        const chosenIndex = slotIndexByKey.get(slotKey(chosenSlot));
        if (chosenIndex != null) {
          slotCursor = Math.max(slotCursor, chosenIndex + 1);
        }
      }

      return {
        ...item,
        nextWeeklyRouteId: chosenSlot?.weeklyRouteId ?? item.weeklyRouteId,
        nextScheduledDate: chosenSlot?.scheduledDate ?? item.scheduledDate,
        nextScheduledSlotIndex: chosenSlot?.scheduledSlotIndex ?? item.scheduledSlotIndex,
        nextState: item.state,
      };
    }

    while (
      slotCursor < params.slots.length &&
      reservedSlotKeys.has(slotKey(params.slots[slotCursor]))
    ) {
      slotCursor += 1;
    }

    const nextSlot = params.slots[slotCursor] ?? null;
    if (nextSlot) {
      slotCursor += 1;
    }

    return {
      ...item,
      nextWeeklyRouteId: nextSlot?.weeklyRouteId ?? item.weeklyRouteId,
      nextScheduledDate: nextSlot?.scheduledDate ?? null,
      nextScheduledSlotIndex: nextSlot?.scheduledSlotIndex ?? null,
      nextState: nextSlot ? ("scheduled" as const) : ("queued" as const),
    };
  });

  const routeIds = Array.from(new Set(provisional.map((item) => item.nextWeeklyRouteId)));
  const nextPositionById = new Map<string, number>();

  for (const routeId of routeIds) {
    provisional
      .filter((item) => item.nextWeeklyRouteId === routeId)
      .forEach((item, index) => {
        nextPositionById.set(item.id, index);
      });
  }

  return provisional.map((item) => {
    const nextCurrentPosition = nextPositionById.get(item.id) ?? item.currentPosition;
    const nextScheduledSlotIndex =
      item.nextScheduledDate == null
        ? null
        : isExplicitTodaySlot(item, item.nextScheduledDate)
          ? item.scheduledSlotIndex
          : 1;
    return {
      ...item,
      nextCurrentPosition,
      nextScheduledSlotIndex,
      nextManualOverrideKind: deriveOverrideKind(
        item,
        nextCurrentPosition,
        item.nextScheduledDate,
        item.nextState,
      ),
    };
  });
}
