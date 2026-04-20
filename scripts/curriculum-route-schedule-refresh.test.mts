import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdaptiveScheduleSlots,
  buildScheduleDaysForWeek,
  buildScheduleRefreshProjection,
  type ScheduleRefreshItem,
} from "../lib/planning/route-schedule-refresh.ts";

function makeItem(
  id: string,
  overrides: Partial<ScheduleRefreshItem> = {},
): ScheduleRefreshItem {
  return {
    id,
    weeklyRouteId: "route_week_1",
    recommendedPosition: 0,
    currentPosition: 0,
    scheduledDate: null,
    scheduledSlotIndex: null,
    state: "scheduled",
    manualOverrideKind: "none",
    manualOverrideNote: null,
    ...overrides,
  };
}

test("buildScheduleRefreshProjection reflows later week items after a manual reorder", () => {
  const items = [
    makeItem("item_b", {
      recommendedPosition: 1,
      currentPosition: 0,
      scheduledDate: "2026-04-21",
      scheduledSlotIndex: 1,
      manualOverrideKind: "reordered",
    }),
    makeItem("item_a", {
      recommendedPosition: 0,
      currentPosition: 1,
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 1,
      manualOverrideKind: "reordered",
    }),
    makeItem("item_c", {
      recommendedPosition: 2,
      currentPosition: 2,
      scheduledDate: "2026-04-22",
      scheduledSlotIndex: 1,
    }),
    makeItem("item_d", {
      recommendedPosition: 3,
      currentPosition: 3,
      scheduledDate: "2026-04-23",
      scheduledSlotIndex: 1,
    }),
  ];
  const slots = buildAdaptiveScheduleSlots({
    items,
    days: buildScheduleDaysForWeek({
      weeklyRouteId: "route_week_1",
      weekStartDate: "2026-04-20",
      targetItemsPerDay: 1,
      enabledDayOffsets: [0, 1, 2, 3, 4],
    }),
  });

  const projection = buildScheduleRefreshProjection({ items, slots });

  assert.deepEqual(
    projection.map((item) => ({
      id: item.id,
      nextScheduledDate: item.nextScheduledDate,
      nextScheduledSlotIndex: item.nextScheduledSlotIndex,
      nextCurrentPosition: item.nextCurrentPosition,
      nextManualOverrideKind: item.nextManualOverrideKind,
    })),
    [
      {
        id: "item_b",
        nextScheduledDate: "2026-04-20",
        nextScheduledSlotIndex: 1,
        nextCurrentPosition: 0,
        nextManualOverrideKind: "reordered",
      },
      {
        id: "item_a",
        nextScheduledDate: "2026-04-21",
        nextScheduledSlotIndex: 1,
        nextCurrentPosition: 1,
        nextManualOverrideKind: "reordered",
      },
      {
        id: "item_c",
        nextScheduledDate: "2026-04-22",
        nextScheduledSlotIndex: 1,
        nextCurrentPosition: 2,
        nextManualOverrideKind: "none",
      },
      {
        id: "item_d",
        nextScheduledDate: "2026-04-23",
        nextScheduledSlotIndex: 1,
        nextCurrentPosition: 3,
        nextManualOverrideKind: "none",
      },
    ],
  );
});

test("buildScheduleRefreshProjection keeps pinned same-day edits and only reflows later cards", () => {
  const items = [
    makeItem("item_a", {
      recommendedPosition: 0,
      currentPosition: 0,
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 1,
    }),
    makeItem("item_b", {
      recommendedPosition: 1,
      currentPosition: 1,
      scheduledDate: "2026-04-20",
      manualOverrideKind: "pinned",
    }),
    makeItem("item_c", {
      recommendedPosition: 2,
      currentPosition: 2,
      scheduledDate: "2026-04-22",
      scheduledSlotIndex: 1,
    }),
    makeItem("item_d", {
      recommendedPosition: 3,
      currentPosition: 3,
      scheduledDate: "2026-04-23",
      scheduledSlotIndex: 1,
    }),
  ];
  const slots = buildAdaptiveScheduleSlots({
    items,
    days: buildScheduleDaysForWeek({
      weeklyRouteId: "route_week_1",
      weekStartDate: "2026-04-20",
      targetItemsPerDay: 1,
      enabledDayOffsets: [0, 1, 2, 3, 4],
    }),
  });

  const projection = buildScheduleRefreshProjection({ items, slots });

  assert.deepEqual(
    projection.map((item) => ({
      id: item.id,
      nextScheduledDate: item.nextScheduledDate,
      nextScheduledSlotIndex: item.nextScheduledSlotIndex,
      nextCurrentPosition: item.nextCurrentPosition,
      nextManualOverrideKind: item.nextManualOverrideKind,
    })),
    [
      {
        id: "item_a",
        nextScheduledDate: "2026-04-20",
        nextScheduledSlotIndex: 1,
        nextCurrentPosition: 0,
        nextManualOverrideKind: "none",
      },
      {
        id: "item_b",
        nextScheduledDate: "2026-04-20",
        nextScheduledSlotIndex: 1,
        nextCurrentPosition: 1,
        nextManualOverrideKind: "pinned",
      },
      {
        id: "item_c",
        nextScheduledDate: "2026-04-21",
        nextScheduledSlotIndex: 1,
        nextCurrentPosition: 2,
        nextManualOverrideKind: "none",
      },
      {
        id: "item_d",
        nextScheduledDate: "2026-04-22",
        nextScheduledSlotIndex: 1,
        nextCurrentPosition: 3,
        nextManualOverrideKind: "none",
      },
    ],
  );
});

test("buildScheduleRefreshProjection preserves explicit today pull-forward slots", () => {
  const items = [
    makeItem("item_a", {
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 1,
    }),
    makeItem("item_b", {
      currentPosition: 1,
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 2,
      manualOverrideKind: "reordered",
      manualOverrideNote: "Pulled forward into lesson 2 on 2026-04-20.",
    }),
  ];
  const slots = buildAdaptiveScheduleSlots({
    items,
    days: buildScheduleDaysForWeek({
      weeklyRouteId: "route_week_1",
      weekStartDate: "2026-04-20",
      targetItemsPerDay: 1,
      enabledDayOffsets: [0, 1, 2, 3, 4],
    }),
  });

  const projection = buildScheduleRefreshProjection({ items, slots });

  assert.deepEqual(
    projection.map((item) => ({
      id: item.id,
      nextScheduledDate: item.nextScheduledDate,
      nextScheduledSlotIndex: item.nextScheduledSlotIndex,
    })),
    [
      {
        id: "item_a",
        nextScheduledDate: "2026-04-20",
        nextScheduledSlotIndex: 1,
      },
      {
        id: "item_b",
        nextScheduledDate: "2026-04-20",
        nextScheduledSlotIndex: 2,
      },
    ],
  );
});

test("buildScheduleRefreshProjection keeps fixed in-progress items anchored before placing later cards", () => {
  const items = [
    makeItem("item_a", {
      recommendedPosition: 0,
      currentPosition: 0,
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 1,
    }),
    makeItem("item_anchor", {
      recommendedPosition: 1,
      currentPosition: 1,
      scheduledDate: "2026-04-22",
      scheduledSlotIndex: 1,
      state: "in_progress",
    }),
    makeItem("item_c", {
      recommendedPosition: 2,
      currentPosition: 2,
      scheduledDate: "2026-04-21",
      scheduledSlotIndex: 1,
    }),
  ];
  const slots = buildAdaptiveScheduleSlots({
    items,
    days: buildScheduleDaysForWeek({
      weeklyRouteId: "route_week_1",
      weekStartDate: "2026-04-20",
      targetItemsPerDay: 1,
      enabledDayOffsets: [0, 1, 2, 3, 4],
    }),
  });

  const projection = buildScheduleRefreshProjection({ items, slots });

  assert.deepEqual(
    projection.map((item) => ({
      id: item.id,
      nextScheduledDate: item.nextScheduledDate,
      nextState: item.nextState,
    })),
    [
      {
        id: "item_a",
        nextScheduledDate: "2026-04-20",
        nextState: "scheduled",
      },
      {
        id: "item_anchor",
        nextScheduledDate: "2026-04-22",
        nextState: "in_progress",
      },
      {
        id: "item_c",
        nextScheduledDate: "2026-04-23",
        nextState: "scheduled",
      },
    ],
  );
});

test("buildScheduleRefreshProjection backfills current-week gaps from next-week items", () => {
  const items = [
    makeItem("item_a", {
      weeklyRouteId: "route_week_1",
      recommendedPosition: 0,
      currentPosition: 0,
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 1,
    }),
    makeItem("item_d", {
      weeklyRouteId: "route_week_1",
      recommendedPosition: 3,
      currentPosition: 1,
      scheduledDate: "2026-04-20",
      manualOverrideKind: "pinned",
    }),
    makeItem("item_e", {
      weeklyRouteId: "route_week_1",
      recommendedPosition: 4,
      currentPosition: 2,
      scheduledDate: "2026-04-20",
      manualOverrideKind: "pinned",
    }),
    makeItem("item_b", {
      weeklyRouteId: "route_week_1",
      recommendedPosition: 1,
      currentPosition: 3,
      scheduledDate: "2026-04-21",
      scheduledSlotIndex: 1,
    }),
    makeItem("item_c", {
      weeklyRouteId: "route_week_1",
      recommendedPosition: 2,
      currentPosition: 4,
      scheduledDate: "2026-04-22",
      scheduledSlotIndex: 1,
    }),
    makeItem("item_f", {
      weeklyRouteId: "route_week_2",
      recommendedPosition: 5,
      currentPosition: 0,
      scheduledDate: "2026-04-27",
      scheduledSlotIndex: 1,
    }),
    makeItem("item_g", {
      weeklyRouteId: "route_week_2",
      recommendedPosition: 6,
      currentPosition: 1,
      scheduledDate: "2026-04-28",
      scheduledSlotIndex: 1,
    }),
  ];
  const slots = buildAdaptiveScheduleSlots({
    items,
    days: [
      ...buildScheduleDaysForWeek({
        weeklyRouteId: "route_week_1",
        weekStartDate: "2026-04-20",
        targetItemsPerDay: 1,
        enabledDayOffsets: [0, 1, 2, 3, 4],
      }),
      ...buildScheduleDaysForWeek({
        weeklyRouteId: "route_week_2",
        weekStartDate: "2026-04-27",
        targetItemsPerDay: 1,
        enabledDayOffsets: [0, 1, 2, 3, 4],
      }),
    ],
  });

  const projection = buildScheduleRefreshProjection({ items, slots });

  assert.deepEqual(
    projection.map((item) => ({
      id: item.id,
      nextWeeklyRouteId: item.nextWeeklyRouteId,
      nextScheduledDate: item.nextScheduledDate,
    })),
    [
      {
        id: "item_a",
        nextWeeklyRouteId: "route_week_1",
        nextScheduledDate: "2026-04-20",
      },
      {
        id: "item_d",
        nextWeeklyRouteId: "route_week_1",
        nextScheduledDate: "2026-04-20",
      },
      {
        id: "item_e",
        nextWeeklyRouteId: "route_week_1",
        nextScheduledDate: "2026-04-20",
      },
      {
        id: "item_b",
        nextWeeklyRouteId: "route_week_1",
        nextScheduledDate: "2026-04-21",
      },
      {
        id: "item_c",
        nextWeeklyRouteId: "route_week_1",
        nextScheduledDate: "2026-04-22",
      },
      {
        id: "item_f",
        nextWeeklyRouteId: "route_week_1",
        nextScheduledDate: "2026-04-23",
      },
      {
        id: "item_g",
        nextWeeklyRouteId: "route_week_1",
        nextScheduledDate: "2026-04-24",
      },
    ],
  );
});

test("buildScheduleRefreshProjection spills overflow into later month routes", () => {
  const items = [
    makeItem("item_1", {
      weeklyRouteId: "route_week_1",
      recommendedPosition: 0,
      currentPosition: 0,
    }),
    makeItem("item_2", {
      weeklyRouteId: "route_week_1",
      recommendedPosition: 1,
      currentPosition: 1,
    }),
    makeItem("item_3", {
      weeklyRouteId: "route_week_1",
      recommendedPosition: 2,
      currentPosition: 2,
    }),
  ];
  const slots = buildAdaptiveScheduleSlots({
    items,
    days: [
      ...buildScheduleDaysForWeek({
        weeklyRouteId: "route_week_1",
        weekStartDate: "2026-04-20",
        targetItemsPerDay: 1,
        enabledDayOffsets: [0, 1],
      }),
      ...buildScheduleDaysForWeek({
        weeklyRouteId: "route_week_2",
        weekStartDate: "2026-04-27",
        targetItemsPerDay: 1,
        enabledDayOffsets: [0, 1],
      }),
    ],
  });

  const projection = buildScheduleRefreshProjection({ items, slots });

  assert.deepEqual(
    projection.map((item) => ({
      id: item.id,
      nextWeeklyRouteId: item.nextWeeklyRouteId,
      nextScheduledDate: item.nextScheduledDate,
      nextCurrentPosition: item.nextCurrentPosition,
    })),
    [
      {
        id: "item_1",
        nextWeeklyRouteId: "route_week_1",
        nextScheduledDate: "2026-04-20",
        nextCurrentPosition: 0,
      },
      {
        id: "item_2",
        nextWeeklyRouteId: "route_week_1",
        nextScheduledDate: "2026-04-21",
        nextCurrentPosition: 1,
      },
      {
        id: "item_3",
        nextWeeklyRouteId: "route_week_2",
        nextScheduledDate: "2026-04-27",
        nextCurrentPosition: 0,
      },
    ],
  );
});
