import assert from "node:assert/strict";
import test from "node:test";

import { buildSuggestedSchedulePlacements } from "../lib/curriculum-routing/service.ts";
import { resolveEffectiveScheduledSlotIndex } from "../lib/planning/lesson-slot-grouping.ts";
import { buildSuggestedWeeklyAssignments } from "../lib/planning/weekly-route-service.ts";

test("buildSuggestedSchedulePlacements keeps same-day skills in lesson slot 1", () => {
  const placements = buildSuggestedSchedulePlacements({
    weekStartDate: "2026-04-20",
    itemCount: 3,
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
      scheduledSlotIndex: 1,
    },
    {
      scheduledDate: "2026-04-21",
      scheduledSlotIndex: 1,
    },
  ]);
});

test("buildSuggestedWeeklyAssignments assigns multiple same-day skills to lesson slot 1", () => {
  const assignments = buildSuggestedWeeklyAssignments({
    rows: [
      {
        id: "item_1",
        skillNodeId: "skill_1",
        scheduledDate: null,
        scheduledSlotIndex: null,
        state: "queued",
      },
      {
        id: "item_2",
        skillNodeId: "skill_2",
        scheduledDate: null,
        scheduledSlotIndex: null,
        state: "queued",
      },
    ],
    weekStartDate: "2026-04-20",
    enabledDayOffsets: [0, 1, 2, 3, 4],
    targetItemsPerDay: 2,
  });

  assert.deepEqual(assignments, [
    {
      id: "item_1",
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 1,
    },
    {
      id: "item_2",
      scheduledDate: "2026-04-20",
      scheduledSlotIndex: 1,
    },
  ]);
});

test("resolveEffectiveScheduledSlotIndex collapses legacy auto-generated extra slots", () => {
  assert.equal(
    resolveEffectiveScheduledSlotIndex({
      scheduledSlotIndex: 2,
      manualOverrideNote: null,
    }),
    1,
  );
});

test("resolveEffectiveScheduledSlotIndex preserves explicit separate lesson blocks", () => {
  assert.equal(
    resolveEffectiveScheduledSlotIndex({
      scheduledSlotIndex: 2,
      manualOverrideNote: "Pulled forward into lesson 2 on 2026-04-21.",
    }),
    2,
  );
});
