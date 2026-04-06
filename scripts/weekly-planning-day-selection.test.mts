import assert from "node:assert/strict";
import test from "node:test";

import { getEnabledPlanningDayOffsets } from "../lib/curriculum-routing/planning-days.ts";

// ── null / undefined / empty → Mon–Fri default ──────────────────────────────

test("returns Mon–Fri default when planningDays is null", () => {
  assert.deepEqual(getEnabledPlanningDayOffsets(null), [0, 1, 2, 3, 4]);
});

test("returns Mon–Fri default when planningDays is undefined", () => {
  assert.deepEqual(getEnabledPlanningDayOffsets(undefined), [0, 1, 2, 3, 4]);
});

test("returns Mon–Fri default for empty array", () => {
  assert.deepEqual(getEnabledPlanningDayOffsets([]), [0, 1, 2, 3, 4]);
});

test("returns Mon–Fri default for array with all false", () => {
  assert.deepEqual(getEnabledPlanningDayOffsets([false, false, false, false, false, false, false]), [0, 1, 2, 3, 4]);
});

test("returns Mon–Fri default for empty object", () => {
  assert.deepEqual(getEnabledPlanningDayOffsets({}), [0, 1, 2, 3, 4]);
});

// ── array format ─────────────────────────────────────────────────────────────

test("array: returns exact enabled offsets for standard Mon–Fri pattern", () => {
  assert.deepEqual(
    getEnabledPlanningDayOffsets([true, true, true, true, true, false, false]),
    [0, 1, 2, 3, 4],
  );
});

test("array: includes Saturday and Sunday when all seven days enabled", () => {
  assert.deepEqual(
    getEnabledPlanningDayOffsets([true, true, true, true, true, true, true]),
    [0, 1, 2, 3, 4, 5, 6],
  );
});

test("array: sparse selection — Mon, Wed, Fri only", () => {
  assert.deepEqual(
    getEnabledPlanningDayOffsets([true, false, true, false, true, false, false]),
    [0, 2, 4],
  );
});

test("array: weekend-only selection — Sat and Sun", () => {
  assert.deepEqual(
    getEnabledPlanningDayOffsets([false, false, false, false, false, true, true]),
    [5, 6],
  );
});

test("array: null entries inside array are treated as disabled", () => {
  assert.deepEqual(
    getEnabledPlanningDayOffsets([true, null, true, null, true, null, null]),
    [0, 2, 4],
  );
});

// ── object format ────────────────────────────────────────────────────────────

test("object: returns exact enabled offsets for Mon–Fri pattern", () => {
  assert.deepEqual(
    getEnabledPlanningDayOffsets({ "0": true, "1": true, "2": true, "3": true, "4": true }),
    [0, 1, 2, 3, 4],
  );
});

test("object: includes Saturday (5) and Sunday (6) when enabled", () => {
  assert.deepEqual(
    getEnabledPlanningDayOffsets({ "0": true, "5": true, "6": true }),
    [0, 5, 6],
  );
});

test("object: false values are excluded", () => {
  assert.deepEqual(
    getEnabledPlanningDayOffsets({ "0": true, "1": false, "2": true }),
    [0, 2],
  );
});

test("object: out-of-range keys are ignored", () => {
  assert.deepEqual(
    getEnabledPlanningDayOffsets({ "0": true, "7": true, "-1": true }),
    [0],
  );
});

test("object: result is sorted by offset", () => {
  const result = getEnabledPlanningDayOffsets({ "6": true, "0": true, "3": true });
  assert.deepEqual(result, [0, 3, 6]);
});

// ── default fallback when all values disabled ─────────────────────────────────

test("array with all-false falls back to Mon–Fri default", () => {
  const result = getEnabledPlanningDayOffsets([false, false, false, false, false, false, false]);
  assert.deepEqual(result, [0, 1, 2, 3, 4]);
});

test("object with all-false falls back to Mon–Fri default", () => {
  const result = getEnabledPlanningDayOffsets({ "0": false, "1": false });
  assert.deepEqual(result, [0, 1, 2, 3, 4]);
});
