import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFastPathLaunchSummary,
  buildFastPathPreview,
  resolveFastPathChosenHorizon,
} from "../lib/homeschool/onboarding/fast-path.ts";
import type { IntakeSourcePackageContext } from "../lib/homeschool/intake/types.ts";

type BuildPreviewParams = Parameters<typeof buildFastPathPreview>[0];

function buildSourcePackage(
  overrides: Partial<IntakeSourcePackageContext> = {},
): IntakeSourcePackageContext {
  return {
    id: "ipkg-1",
    title: "Source package",
    modality: "pdf",
    summary: "PDF source package",
    extractionStatus: "ready",
    assetCount: 1,
    assetIds: ["asset-1"],
    detectedChunks: ["Chapter 1"],
    sourceFingerprint: "fp-1",
    ...overrides,
  };
}

function buildPreview(
  overrides: Partial<Omit<BuildPreviewParams, "interpretation">> & {
    interpretation?: Partial<BuildPreviewParams["interpretation"]>;
  } = {},
) {
  const defaults: BuildPreviewParams = {
    learnerName: "Ava",
    intakeRoute: "single_lesson",
    intakeRouteExplicit: false,
    sourceInput: "One worksheet page about fractions.",
    sourcePackages: [buildSourcePackage()],
    interpretation: {
      sourceKind: "single_day_material",
      sourceScale: "small",
      sliceStrategy: "single_lesson",
      sliceNotes: [],
      suggestedTitle: "Fractions practice",
      confidence: "high",
      recommendedHorizon: "today",
      assumptions: [],
      detectedChunks: ["Fractions practice"],
      followUpQuestion: null,
      needsConfirmation: false,
    },
  };

  return buildFastPathPreview({
    ...defaults,
    ...overrides,
    sourcePackages: overrides.sourcePackages ?? defaults.sourcePackages,
    interpretation: {
      ...defaults.interpretation,
      ...overrides.interpretation,
    },
  });
}

test("case A: one lesson stays on today without preview", () => {
  const preview = buildPreview();

  assert.equal(preview.chosenHorizon, "today");
  assert.equal(preview.needsConfirmation, false);
  assert.equal(preview.initialSliceUsed, false);
  assert.match(preview.scopeSummary, /today first/i);
});

test("case B: weekly plan infers current_week and produces a multi-day launch summary", () => {
  const preview = buildPreview({
    intakeRoute: "weekly_plan",
    interpretation: {
      sourceKind: "weekly_assignments",
      sourceScale: "medium",
      sliceStrategy: "current_week_only",
      suggestedTitle: "Week 1 assignments",
      recommendedHorizon: "current_week",
      detectedChunks: ["Monday", "Wednesday", "Friday"],
    },
  });
  const summary = buildFastPathLaunchSummary({
    preview,
    lessonCount: 4,
  });

  assert.equal(preview.chosenHorizon, "current_week");
  assert.equal(preview.needsConfirmation, false);
  assert.match(summary.summaryText, /current week/i);
  assert.equal(summary.lessonCount, 4);
});

test("case C: clean outline stays bounded to next_few_days", () => {
  const preview = buildPreview({
    intakeRoute: "outline",
    interpretation: {
      sourceKind: "sequence_outline",
      sourceScale: "medium",
      sliceStrategy: null,
      suggestedTitle: "Kitchen sequence",
      recommendedHorizon: "next_few_days",
      detectedChunks: ["Setup", "Wash", "Mix", "Serve"],
    },
  });

  assert.equal(preview.chosenHorizon, "next_few_days");
  assert.equal(preview.needsConfirmation, false);
  assert.equal(preview.initialSliceUsed, false);
});

test("case D: topic seed becomes a small starter module", () => {
  const preview = buildPreview({
    intakeRoute: "topic",
    sourceInput: "Teach chess openings to my 9-year-old.",
    interpretation: {
      sourceKind: "topic_seed",
      sourceScale: null,
      sliceStrategy: "manual_shell_only",
      suggestedTitle: "Teach chess openings",
      recommendedHorizon: "starter_module",
      detectedChunks: ["Teach chess openings"],
    },
  });

  assert.equal(preview.chosenHorizon, "starter_module");
  assert.equal(preview.needsConfirmation, false);
  assert.equal(preview.initialSliceUsed, false);
});

test("case E: ambiguous upload requires preview and keeps the launch conservative", () => {
  const preview = buildPreview({
    sourcePackages: [buildSourcePackage({ modality: "image", extractionStatus: "requires_review" })],
    sourceInput: "blurry cropped page",
    interpretation: {
      sourceKind: "ambiguous",
      sourceScale: "small",
      sliceStrategy: null,
      suggestedTitle: "Review needed",
      confidence: "low",
      recommendedHorizon: "today",
      followUpQuestion: "Is this one page or part of a larger assignment?",
      needsConfirmation: true,
    },
  });

  assert.equal(preview.chosenHorizon, "today");
  assert.equal(preview.needsConfirmation, true);
  assert.match(preview.followUpQuestion ?? "", /one page/i);
});

test("case F: legacy today_only override is still honored", () => {
  const resolved = resolveFastPathChosenHorizon({
    recommendedHorizon: "current_week",
    sourceKind: "weekly_assignments",
    intakeRoute: "weekly_plan",
    legacyHorizonIntent: "today_only",
  });

  assert.equal(resolved.chosenHorizon, "today");
  assert.equal(resolved.horizonDecisionSource, "legacy_user_override");
});

test("case G: whole book uses a bounded initial slice without forcing preview", () => {
  const preview = buildPreview({
    sourceInput: "Large PDF cookbook.",
    interpretation: {
      sourceKind: "sequence_outline",
      sourceScale: "large",
      sliceStrategy: "first_chapter",
      sliceNotes: ["the first chapter"],
      suggestedTitle: "Kids in the Kitchen",
      recommendedHorizon: "current_week",
      detectedChunks: ["Chapter 1", "Chapter 2", "Recipes"],
      assumptions: ["Use the first chapter as the initial launch slice."],
    },
  });
  const summary = buildFastPathLaunchSummary({
    preview,
    lessonCount: 4,
    initialSliceLabel: "the first chapter",
  });

  assert.equal(preview.chosenHorizon, "current_week");
  assert.equal(preview.needsConfirmation, false);
  assert.equal(preview.initialSliceUsed, true);
  assert.match(preview.scopeSummary, /first chapter/i);
  assert.match(summary.summaryText, /first chapter/i);
});

test("case H: explicit assigned range stays anchored to the narrower slice", () => {
  const preview = buildPreview({
    sourceInput: "Workbook pages 1-12 only.",
    interpretation: {
      sourceKind: "sequence_outline",
      sourceScale: "large",
      sliceStrategy: "explicit_range",
      sliceNotes: ["pages 1-12"],
      suggestedTitle: "Workbook launch",
      recommendedHorizon: "next_few_days",
      detectedChunks: ["pages 1-12", "later chapters"],
      assumptions: ["Parent explicitly asked to start with pages 1-12."],
    },
  });
  const summary = buildFastPathLaunchSummary({
    preview,
    lessonCount: 3,
    initialSliceLabel: "pages 1-12",
  });

  assert.equal(preview.chosenHorizon, "next_few_days");
  assert.equal(preview.initialSliceUsed, true);
  assert.equal(preview.needsConfirmation, false);
  assert.match(preview.scopeSummary, /pages 1-12/i);
  assert.match(summary.summaryText, /pages 1-12/i);
});
