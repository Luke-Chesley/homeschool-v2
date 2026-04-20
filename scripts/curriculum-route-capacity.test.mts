import assert from "node:assert/strict";
import test from "node:test";

import { buildSuggestedSchedulePlacements } from "../lib/curriculum-routing/service.ts";
import { buildSuggestedWeeklyAssignments } from "../lib/planning/weekly-route-service.ts";

test("buildSuggestedSchedulePlacements assigns sequential slots on repeated dates", () => {
  const placements = buildSuggestedSchedulePlacements({
    weekStartDate: "2026-04-20",
    itemCount: 5,
    targetItemsPerDay: 2,
    enabledDayOffsets: [0, 1, 2, 3, 4],
  });

  assert.deepEqual(placements, [
    {
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 1,
    },
    {
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 2,
    },
    {
      scheduledDate: "2026-04-21",
      scheduledSlotIndex: 1,
    },
    {
      scheduledDate: "2026-04-21",
      scheduledSlotIndex: 2,
    },
    {
      scheduledDate: "2026-04-22",
      scheduledSlotIndex: 1,
    },
  ]);
});

test("buildSuggestedWeeklyAssignments fills open second slots before moving to a new day", () => {
  const assignments = buildSuggestedWeeklyAssignments({
    weekStartDate: "2026-04-20",
    enabledDayOffsets: [0, 1, 2, 3, 4],
    targetItemsPerDay: 2,
    rows: [
      {
        id: "item_a",
        skillNodeId: "skill_a",
        scheduledDate: "2026-04-20",
        scheduledSlotIndex: 1,
        state: "scheduled",
      },
      {
        id: "item_b",
        skillNodeId: "skill_b",
        scheduledDate: null,
        scheduledSlotIndex: null,
        state: "queued",
      },
      {
        id: "item_c",
        skillNodeId: "skill_c",
        scheduledDate: null,
        scheduledSlotIndex: null,
        state: "queued",
      },
    ],
  });

  assert.deepEqual(assignments, [
    {
      id: "item_b",
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 2,
    },
    {
      id: "item_c",
      scheduledDate: "2026-04-21",
      scheduledSlotIndex: 1,
    },
  ]);
});

test("buildSuggestedWeeklyAssignments treats duplicated slot-one rows as a full day", () => {
  const assignments = buildSuggestedWeeklyAssignments({
    weekStartDate: "2026-04-20",
    enabledDayOffsets: [0, 1, 2, 3, 4],
    targetItemsPerDay: 2,
    rows: [
      {
        id: "item_a",
        skillNodeId: "skill_a",
        scheduledDate: "2026-04-20",
        scheduledSlotIndex: 1,
        state: "scheduled",
      },
      {
        id: "item_b",
        skillNodeId: "skill_b",
        scheduledDate: "2026-04-20",
        scheduledSlotIndex: 1,
        state: "scheduled",
      },
      {
        id: "item_c",
        skillNodeId: "skill_c",
        scheduledDate: null,
        scheduledSlotIndex: null,
        state: "queued",
      },
    ],
  });

  assert.deepEqual(assignments, [
    {
      id: "item_c",
      scheduledDate: "2026-04-21",
      scheduledSlotIndex: 1,
    },
  ]);
});
