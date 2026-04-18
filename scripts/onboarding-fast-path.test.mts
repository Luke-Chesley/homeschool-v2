import assert from "node:assert/strict";
import test from "node:test";

import { CurriculumSourceIntakeSchema } from "../lib/curriculum/types.ts";
import {
  AI_LAUNCH_ROUTING_RULES,
  AI_LAUNCH_RULES,
} from "../lib/homeschool/ai-launch-contract.ts";
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
      sourceKind: "bounded_material",
      entryStrategy: "use_as_is",
      entryLabel: null,
      continuationMode: "none",
      suggestedTitle: "Fractions practice",
      confidence: "high",
      recommendedHorizon: "single_day",
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

test("launch contract keeps comprehensive sources bounded and removes user horizon choice", () => {
  const comprehensiveRule = AI_LAUNCH_ROUTING_RULES.find(
    (rule) => rule.routeFamily === "comprehensive_source",
  );

  assert.ok(comprehensiveRule);
  assert.equal(comprehensiveRule.defaultHorizon, "one_week");
  assert.equal(comprehensiveRule.maxHorizon, "two_weeks");
  assert.match(comprehensiveRule.notes, /whole-book|whole book/i);
  assert.equal(AI_LAUNCH_RULES.noUserHorizonChoice, true);
});

test("durable intake metadata accepts only the canonical source model", () => {
  const parsed = CurriculumSourceIntakeSchema.parse({
    route: "outline",
    requestedRoute: "outline",
    routeVersion: 1,
    rawText: "Whole workbook with chapter 1 selected.",
    assetIds: ["asset-1"],
    learnerId: "learner-1",
    sourcePackageIds: ["ipkg-1"],
    sourcePackages: [buildSourcePackage()],
    sourceModalities: ["pdf"],
    sourcePackageId: "ipkg-1",
    sourceModality: "pdf",
    sourceModel: {
      requestedRoute: "outline",
      routedRoute: "outline",
      confidence: "medium",
      sourceKind: "comprehensive_source",
      entryStrategy: "explicit_range",
      entryLabel: "chapter 1",
      continuationMode: "sequential",
      recommendedHorizon: "one_week",
      assumptions: ["Launch from chapter 1 and keep the rest for continuation."],
      detectedChunks: ["Chapter 1", "Chapter 2", "Chapter 3"],
      needsConfirmation: false,
      sourcePackageIds: ["ipkg-1"],
      sourcePackages: [buildSourcePackage()],
      sourceModalities: ["pdf"],
      sourcePackageId: "ipkg-1",
      sourceModality: "pdf",
      lineage: { operation: "source_interpret" },
    },
    launchPlan: {
      recommendedHorizon: "one_week",
      entryStrategy: "explicit_range",
      entryLabel: "chapter 1",
      continuationMode: "sequential",
      scopeSummary: "Start with chapter 1 and keep the rest available for later.",
      initialSliceUsed: true,
      initialSliceLabel: "chapter 1",
      openingLessonCount: 4,
    },
    curriculumLineage: { operation: "curriculum_generate" },
    createdFrom: "onboarding_fast_path",
  });

  assert.equal(parsed.route, "outline");
  assert.equal(parsed.sourceModel?.confidence, "medium");
  assert.equal(parsed.sourceModel?.sourceKind, "comprehensive_source");
  assert.equal(parsed.sourceModel?.entryStrategy, "explicit_range");
  assert.equal(parsed.sourceModel?.entryLabel, "chapter 1");
  assert.equal(parsed.sourceModel?.continuationMode, "sequential");
  assert.equal(parsed.sourceModel?.recommendedHorizon, "one_week");
  assert.equal(parsed.launchPlan?.recommendedHorizon, "one_week");
  assert.equal(parsed.sourceModel?.lineage?.operation, "source_interpret");
  assert.equal(parsed.launchPlan?.openingLessonCount, 4);
  assert.equal(parsed.curriculumLineage?.operation, "curriculum_generate");
});

test("legacy flattened launch metadata is rejected", () => {
  const parsed = CurriculumSourceIntakeSchema.safeParse({
    route: "outline",
    requestedRoute: "outline",
    routeVersion: 1,
    rawText: "Whole workbook with chapter 1 selected.",
    assetIds: ["asset-1"],
    learnerId: "learner-1",
    confidence: "medium",
    sourceKind: "comprehensive_source",
    recommendedHorizon: "one_week",
    chosenHorizon: "one_week",
    curriculumLineage: { operation: "curriculum_generate" },
    createdFrom: "onboarding_fast_path",
  });

  assert.equal(parsed.success, false);
});

test("case A: single bounded lesson stays on a single-day launch without preview", () => {
  const preview = buildPreview();

  assert.equal(preview.sourceKind, "bounded_material");
  assert.equal(preview.chosenHorizon, "single_day");
  assert.equal(preview.needsConfirmation, false);
  assert.equal(preview.initialSliceUsed, false);
});

test("case B: weekly plan infers one week and produces a bounded launch summary", () => {
  const preview = buildPreview({
    intakeRoute: "weekly_plan",
    interpretation: {
      sourceKind: "timeboxed_plan",
      entryStrategy: "timebox_start",
      entryLabel: "week 1",
      continuationMode: "timebox",
      suggestedTitle: "Week 1 assignments",
      recommendedHorizon: "one_week",
      detectedChunks: ["Monday", "Wednesday", "Friday"],
    },
  });
  const summary = buildFastPathLaunchSummary({
    preview,
    openingLessonCount: 4,
  });

  assert.equal(preview.chosenHorizon, "one_week");
  assert.equal(preview.needsConfirmation, false);
  assert.match(summary.summaryText, /opening 4 lessons/i);
  assert.equal(summary.openingLessonCount, 4);
});

test("case C: clean outline stays bounded to a few days", () => {
  const preview = buildPreview({
    intakeRoute: "outline",
    interpretation: {
      sourceKind: "structured_sequence",
      entryStrategy: "sequential_start",
      entryLabel: "the beginning",
      continuationMode: "sequential",
      suggestedTitle: "Kitchen sequence",
      recommendedHorizon: "few_days",
      detectedChunks: ["Setup", "Wash", "Mix", "Serve"],
    },
  });

  assert.equal(preview.sourceKind, "structured_sequence");
  assert.equal(preview.chosenHorizon, "few_days");
  assert.equal(preview.needsConfirmation, false);
});

test("case D: topic seed becomes a starter module", () => {
  const preview = buildPreview({
    intakeRoute: "topic",
    sourceInput: "Teach chess openings to my 9-year-old.",
    interpretation: {
      sourceKind: "topic_seed",
      entryStrategy: "scaffold_only",
      entryLabel: null,
      continuationMode: "manual_review",
      suggestedTitle: "Teach chess openings",
      recommendedHorizon: "starter_module",
      detectedChunks: ["Teach chess openings"],
    },
  });

  assert.equal(preview.chosenHorizon, "starter_module");
  assert.equal(preview.entryStrategy, "scaffold_only");
  assert.equal(preview.needsConfirmation, false);
});

test("case E: ambiguous source requires preview and stays conservative", () => {
  const preview = buildPreview({
    sourcePackages: [buildSourcePackage({ modality: "image", extractionStatus: "requires_review" })],
    sourceInput: "blurry cropped page",
    interpretation: {
      sourceKind: "ambiguous",
      entryStrategy: "scaffold_only",
      entryLabel: null,
      continuationMode: "manual_review",
      suggestedTitle: "Review needed",
      confidence: "low",
      recommendedHorizon: "single_day",
      followUpQuestion: "Is this one page or part of a larger assignment?",
      needsConfirmation: true,
    },
  });

  assert.equal(preview.chosenHorizon, "single_day");
  assert.equal(preview.needsConfirmation, true);
  assert.match(preview.followUpQuestion ?? "", /one page/i);
});

test("case F: comprehensive source stays bounded and preserves its entry slice", () => {
  const preview = buildPreview({
    intakeRoute: "outline",
    sourceInput: "Large PDF cookbook.",
    interpretation: {
      sourceKind: "comprehensive_source",
      entryStrategy: "section_start",
      entryLabel: "chapter 1",
      continuationMode: "sequential",
      suggestedTitle: "Kids in the Kitchen",
      recommendedHorizon: "two_weeks",
      detectedChunks: ["Chapter 1", "Chapter 2", "Recipes"],
      assumptions: ["Use chapter 1 as the initial launch slice."],
    },
  });
  const summary = buildFastPathLaunchSummary({
    preview,
    openingLessonCount: 6,
    initialSliceLabel: "chapter 1",
  });

  assert.equal(preview.chosenHorizon, "two_weeks");
  assert.equal(preview.initialSliceUsed, true);
  assert.match(preview.scopeSummary, /chapter 1/i);
  assert.match(summary.summaryText, /chapter 1/i);
  assert.equal(summary.openingLessonCount, 6);
});

test("case G: large source with explicit narrow request stays anchored to that range", () => {
  const preview = buildPreview({
    intakeRoute: "outline",
    sourceInput: "Workbook pages 1-12 only.",
    interpretation: {
      sourceKind: "comprehensive_source",
      entryStrategy: "explicit_range",
      entryLabel: "pages 1-12",
      continuationMode: "sequential",
      suggestedTitle: "Workbook launch",
      recommendedHorizon: "few_days",
      detectedChunks: ["pages 1-12", "later chapters"],
      assumptions: ["Parent explicitly asked to start with pages 1-12."],
    },
  });

  assert.equal(preview.entryStrategy, "explicit_range");
  assert.equal(preview.entryLabel, "pages 1-12");
  assert.equal(preview.chosenHorizon, "few_days");
  assert.match(preview.scopeSummary, /pages 1-12/i);
});

test("case H: chosen horizon clamps when the route ceiling is narrower", () => {
  const resolved = resolveFastPathChosenHorizon({
    recommendedHorizon: "two_weeks",
    sourceKind: "bounded_material",
    intakeRoute: "single_lesson",
    confidence: "high",
  });

  assert.equal(resolved.chosenHorizon, "single_day");
  assert.equal(resolved.horizonDecisionSource, "internal_override");
});

test("preview carries canonical sourceModel and launchPlan blocks", () => {
  const preview = buildPreview({
    intakeRoute: "outline",
    interpretation: {
      sourceKind: "comprehensive_source",
      entryStrategy: "explicit_range",
      entryLabel: "chapter 1",
      continuationMode: "sequential",
      recommendedHorizon: "one_week",
    },
  });

  assert.equal(preview.sourceModel.routedRoute, "outline");
  assert.equal(preview.sourceModel.sourceKind, "comprehensive_source");
  assert.equal(preview.launchPlan.chosenHorizon, "one_week");
  assert.equal(preview.launchPlan.initialSliceUsed, true);
  assert.equal(preview.launchPlan.initialSliceLabel, "chapter 1");
});

test("launch summary can be derived directly from launchPlan metadata", () => {
  const summary = buildFastPathLaunchSummary({
    launchPlan: {
      chosenHorizon: "few_days",
      scopeSummary: "Start with chapter 1 and keep the rest available for later.",
      initialSliceUsed: true,
      initialSliceLabel: "chapter 1",
      openingLessonCount: 4,
    },
  });

  assert.equal(summary.openingLessonCount, 4);
  assert.equal(summary.initialSliceUsed, true);
  assert.match(summary.summaryText, /chapter 1/i);
});
