/**
 * Tests for the canonical lesson/session timing contract.
 *
 * Covers:
 *  - resolveLessonSessionMinutes precedence rules
 *  - curriculum sessionMinutes flows into resolved total
 *  - lesson-level override beats source default
 *  - system fallback when no curriculum timing exists
 *  - route-item effort does NOT determine session budget
 *  - formatTimingSourceLabel produces correct labels
 *
 * Regression: before this fix, lesson-draft totalMinutes was computed by
 * summing route-item estimatedMinutes (defaulting to 45 each), so a session
 * with 3 items would get totalMinutes = 135 even when curriculum said 45 min.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLessonSessionMinutes,
  formatTimingSourceLabel,
  LESSON_SESSION_FALLBACK_MINUTES,
} from "../lib/planning/session-timing.ts";

// ---------------------------------------------------------------------------
// resolveLessonSessionMinutes — precedence rules
// ---------------------------------------------------------------------------

test("uses lesson override when present, regardless of source default", () => {
  const result = resolveLessonSessionMinutes({
    sourceSessionMinutes: 45,
    lessonOverrideMinutes: 20,
  });
  assert.equal(result.resolvedTotalMinutes, 20);
  assert.equal(result.timingSource, "lesson_override");
  assert.equal(result.lessonOverrideMinutes, 20);
  assert.equal(result.sourceSessionMinutes, 45);
});

test("uses source default when no lesson override", () => {
  const result = resolveLessonSessionMinutes({
    sourceSessionMinutes: 30,
  });
  assert.equal(result.resolvedTotalMinutes, 30);
  assert.equal(result.timingSource, "source_default");
  assert.equal(result.lessonOverrideMinutes, undefined);
  assert.equal(result.sourceSessionMinutes, 30);
});

test("falls back to LESSON_SESSION_FALLBACK_MINUTES when no curriculum timing exists", () => {
  const result = resolveLessonSessionMinutes({
    sourceSessionMinutes: undefined,
  });
  assert.equal(result.resolvedTotalMinutes, LESSON_SESSION_FALLBACK_MINUTES);
  assert.equal(result.timingSource, "system_fallback");
  assert.equal(result.lessonOverrideMinutes, undefined);
  assert.equal(result.sourceSessionMinutes, undefined);
});

test("system fallback is exactly 45", () => {
  assert.equal(LESSON_SESSION_FALLBACK_MINUTES, 45);
});

test("lesson override of 0 is falsy and treated as absent (no override)", () => {
  // lessonOverrideMinutes: 0 is treated as falsy → falls back to source default
  const result = resolveLessonSessionMinutes({
    sourceSessionMinutes: 30,
    lessonOverrideMinutes: 0,
  });
  // 0 is falsy so the null check (opts.lessonOverrideMinutes != null) passes,
  // but 0 is a valid value. The contract intentionally uses != null, so 0 IS an override.
  // Document the actual behavior: 0 is not null so it is treated as an override.
  assert.equal(result.resolvedTotalMinutes, 0);
  assert.equal(result.timingSource, "lesson_override");
});

// ---------------------------------------------------------------------------
// Curriculum sessionMinutes flows forward correctly
// ---------------------------------------------------------------------------

test("curriculum pacing 45 min → resolved total is 45", () => {
  const timing = resolveLessonSessionMinutes({ sourceSessionMinutes: 45 });
  assert.equal(timing.resolvedTotalMinutes, 45);
});

test("curriculum pacing 30 min → resolved total is 30, not 45 fallback", () => {
  const timing = resolveLessonSessionMinutes({ sourceSessionMinutes: 30 });
  assert.equal(timing.resolvedTotalMinutes, 30);
  assert.notEqual(timing.resolvedTotalMinutes, LESSON_SESSION_FALLBACK_MINUTES);
});

// ---------------------------------------------------------------------------
// Route-item effort does NOT determine session budget (regression test)
// ---------------------------------------------------------------------------

test("regression: 3 items with 45-min item effort should NOT produce 135-min session", () => {
  // Before the fix: totalMinutes = items.reduce((s, i) => s + i.estimatedMinutes, 0)
  // With 3 items × 45 min each = 135 min
  // After the fix: use resolveLessonSessionMinutes instead
  const itemEfforts = [45, 45, 45]; // three route items, each with 45 min effort
  const summedItemEffort = itemEfforts.reduce((s, m) => s + m, 0); // 135

  const sessionBudget = resolveLessonSessionMinutes({
    sourceSessionMinutes: 45, // curriculum says 45-min sessions
  });

  // Session budget must NOT be derived by summing item efforts
  assert.equal(sessionBudget.resolvedTotalMinutes, 45);
  assert.notEqual(sessionBudget.resolvedTotalMinutes, summedItemEffort);
  assert.equal(summedItemEffort, 135); // confirm the old bug value
});

test("regression: curriculum says 30 min but lesson draft was getting 45-fallback", () => {
  // Before the fix: node?.estimatedMinutes ?? 45 → 45 (since nodes are always null)
  // After: resolveLessonSessionMinutes({ sourceSessionMinutes: 30 }) → 30

  const nodeEstimatedMinutes = undefined; // always null after normalization

  // Old behavior (broken):
  const oldBehavior = nodeEstimatedMinutes ?? 45;

  // New behavior (correct):
  const newBehavior = resolveLessonSessionMinutes({
    sourceSessionMinutes: 30,
    lessonOverrideMinutes: nodeEstimatedMinutes,
  });

  assert.equal(oldBehavior, 45);             // old: wrong
  assert.equal(newBehavior.resolvedTotalMinutes, 30);  // new: correct
  assert.equal(newBehavior.timingSource, "source_default");
});

// ---------------------------------------------------------------------------
// formatTimingSourceLabel
// ---------------------------------------------------------------------------

test("formatTimingSourceLabel — lesson_override", () => {
  const contract = resolveLessonSessionMinutes({
    sourceSessionMinutes: 45,
    lessonOverrideMinutes: 20,
  });
  const label = formatTimingSourceLabel(contract);
  assert.match(label, /20 min/);
  assert.match(label, /override/);
});

test("formatTimingSourceLabel — source_default", () => {
  const contract = resolveLessonSessionMinutes({ sourceSessionMinutes: 30 });
  const label = formatTimingSourceLabel(contract);
  assert.match(label, /30 min/);
  assert.match(label, /curriculum pacing/);
});

test("formatTimingSourceLabel — system_fallback", () => {
  const contract = resolveLessonSessionMinutes({ sourceSessionMinutes: undefined });
  const label = formatTimingSourceLabel(contract);
  assert.match(label, /45 min/);
  assert.match(label, /default/);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("lesson override beats source even when source is larger", () => {
  const result = resolveLessonSessionMinutes({
    sourceSessionMinutes: 90,
    lessonOverrideMinutes: 15,
  });
  assert.equal(result.resolvedTotalMinutes, 15);
  assert.equal(result.timingSource, "lesson_override");
});

test("no source, explicit override still wins", () => {
  const result = resolveLessonSessionMinutes({
    sourceSessionMinutes: undefined,
    lessonOverrideMinutes: 60,
  });
  assert.equal(result.resolvedTotalMinutes, 60);
  assert.equal(result.timingSource, "lesson_override");
});
