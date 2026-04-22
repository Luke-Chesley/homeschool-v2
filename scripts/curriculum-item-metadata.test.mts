import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLegacyCurriculumItemMetadataRepairs,
  deriveLegacyLessonRef,
  deriveLegacyUnitRef,
} from "@/lib/curriculum/item-metadata";

test("deriveLegacyUnitRef produces a stable canonical ref", () => {
  assert.equal(
    deriveLegacyUnitRef({
      title: "Week 1: Fractions, Decimals, and Percents in One System",
      position: 0,
    }),
    "unit:1:week-1-fractions-decimals-and-percents-in-one-system",
  );
});

test("buildLegacyCurriculumItemMetadataRepairs backfills missing unit and lesson metadata", () => {
  const repairs = buildLegacyCurriculumItemMetadataRepairs([
    {
      id: "unit-1",
      parentItemId: null,
      itemType: "unit",
      title: "Week 1: Fractions, Decimals, and Percents in One System",
      position: 0,
      metadata: {
        estimatedWeeks: 1,
        estimatedSessions: 5,
      },
    },
    {
      id: "lesson-1",
      parentItemId: "unit-1",
      itemType: "lesson",
      title: "Day 1: Fraction Warm-Up and Compare",
      position: 0,
      metadata: {
        materials: ["fraction strips"],
      },
    },
  ]);

  assert.equal(repairs.length, 2);
  assert.deepEqual(repairs[0], {
    id: "unit-1",
    metadata: {
      estimatedWeeks: 1,
      estimatedSessions: 5,
      unitRef: "unit:1:week-1-fractions-decimals-and-percents-in-one-system",
    },
  });
  assert.deepEqual(repairs[1], {
    id: "lesson-1",
    metadata: {
      materials: ["fraction strips"],
      unitRef: "unit:1:week-1-fractions-decimals-and-percents-in-one-system",
      lessonRef: deriveLegacyLessonRef({
        title: "Day 1: Fraction Warm-Up and Compare",
        position: 0,
        unitRef: "unit:1:week-1-fractions-decimals-and-percents-in-one-system",
      }),
      lessonType: "task",
    },
  });
});
