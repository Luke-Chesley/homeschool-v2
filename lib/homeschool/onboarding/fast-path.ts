import type { IntakeSourcePackageContext } from "@/lib/homeschool/intake/types";

import type {
  CurriculumGenerationHorizon,
  CurriculumHorizonDecisionSource,
  CurriculumIntakeConfidence,
  FastPathIntakeRoute,
  HomeschoolFastPathLaunchPlan,
  HomeschoolFastPathLaunchSummary,
  HomeschoolFastPathOnboardingInput,
  HomeschoolFastPathPreview,
  HomeschoolFastPathSourceModel,
  SourceContinuationMode,
  SourceEntryStrategy,
  SourceInterpretSourceKind,
} from "./types";

const HORIZON_RANK: Record<CurriculumGenerationHorizon, number> = {
  single_day: 1,
  few_days: 2,
  one_week: 3,
  two_weeks: 4,
  starter_module: 5,
};

const HORIZON_BY_RANK: Record<number, CurriculumGenerationHorizon> = {
  1: "single_day",
  2: "few_days",
  3: "one_week",
  4: "two_weeks",
  5: "starter_module",
};

function buildPreviewTitle(input: {
  intakeRoute: FastPathIntakeRoute;
  sourceInput: string;
}) {
  const prefix =
    input.intakeRoute === "topic"
      ? "Topic starter"
      : input.intakeRoute === "weekly_plan"
        ? "Timed plan"
        : input.intakeRoute === "outline"
          ? "Structured launch"
          : input.intakeRoute === "manual_shell"
            ? "Starter shell"
            : "Lesson launch";

  return `${prefix}: ${input.sourceInput.trim().slice(0, 48)}`;
}

export function extractDetectedChunks(sourceInput: string) {
  const trimmedLines = sourceInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  return trimmedLines.length > 0 ? trimmedLines : [sourceInput.trim().slice(0, 80)];
}

export function sourceKindToRoute(sourceKind: SourceInterpretSourceKind): FastPathIntakeRoute {
  switch (sourceKind) {
    case "bounded_material":
      return "single_lesson";
    case "timeboxed_plan":
      return "weekly_plan";
    case "structured_sequence":
    case "comprehensive_source":
      return "outline";
    case "topic_seed":
      return "topic";
    case "shell_request":
    case "ambiguous":
      return "manual_shell";
  }
}

export function routeToCurriculumMode(intakeRoute: FastPathIntakeRoute) {
  switch (intakeRoute) {
    case "weekly_plan":
    case "outline":
      return "paste_outline" as const;
    case "single_lesson":
    case "topic":
    case "manual_shell":
      return "manual_shell" as const;
  }
}

function maxHorizonRankForRoute(intakeRoute: FastPathIntakeRoute) {
  switch (intakeRoute) {
    case "single_lesson":
      return HORIZON_RANK.single_day;
    case "weekly_plan":
      return HORIZON_RANK.two_weeks;
    case "outline":
      return HORIZON_RANK.two_weeks;
    case "topic":
    case "manual_shell":
      return HORIZON_RANK.starter_module;
  }
}

function maxHorizonRankForSourceKind(sourceKind: SourceInterpretSourceKind) {
  switch (sourceKind) {
    case "bounded_material":
      return HORIZON_RANK.few_days;
    case "timeboxed_plan":
      return HORIZON_RANK.two_weeks;
    case "structured_sequence":
      return HORIZON_RANK.one_week;
    case "comprehensive_source":
      return HORIZON_RANK.two_weeks;
    case "topic_seed":
    case "shell_request":
      return HORIZON_RANK.starter_module;
    case "ambiguous":
      return HORIZON_RANK.single_day;
  }
}

function clampHorizon(params: {
  sourceKind: SourceInterpretSourceKind;
  intakeRoute: FastPathIntakeRoute;
  requestedHorizon: CurriculumGenerationHorizon;
}) {
  const maxRank = Math.min(
    maxHorizonRankForRoute(params.intakeRoute),
    maxHorizonRankForSourceKind(params.sourceKind),
  );
  const requestedRank = HORIZON_RANK[params.requestedHorizon];

  if (requestedRank <= maxRank) {
    return params.requestedHorizon;
  }

  return HORIZON_BY_RANK[maxRank];
}

function usesInitialSourceSlice(params: {
  sourceKind: SourceInterpretSourceKind;
  entryStrategy: SourceEntryStrategy;
}) {
  if (params.sourceKind === "comprehensive_source") {
    return true;
  }

  return params.entryStrategy !== "use_as_is" && params.entryStrategy !== "scaffold_only";
}

function getInitialSliceLabel(params: {
  entryStrategy: SourceEntryStrategy;
  entryLabel?: string | null;
}) {
  if (params.entryLabel?.trim()) {
    return params.entryLabel.trim();
  }

  switch (params.entryStrategy) {
    case "explicit_range":
      return "the assigned range";
    case "section_start":
      return "the first section";
    case "sequential_start":
      return "the beginning";
    case "timebox_start":
      return "week 1";
    case "scaffold_only":
      return "a starter shell";
    case "use_as_is":
      return null;
  }
}

function buildScopeSummary(params: {
  sourceKind: SourceInterpretSourceKind;
  entryStrategy: SourceEntryStrategy;
  entryLabel?: string | null;
  chosenHorizon: CurriculumGenerationHorizon;
}) {
  const sliceLabel = getInitialSliceLabel(params);

  if (params.sourceKind === "comprehensive_source") {
    return sliceLabel
      ? `This looks like a larger source, so we'll start with ${sliceLabel} and keep the rest available for later.`
      : "This looks like a larger source, so we'll start with a bounded opening and keep the rest available for later.";
  }

  switch (params.sourceKind) {
    case "bounded_material":
      return params.chosenHorizon === "few_days"
        ? "This source supports a short opening sequence, so we'll set up the next few lessons and open day 1."
        : "This source looks bounded enough to set up today first.";
    case "timeboxed_plan":
      return params.chosenHorizon === "two_weeks"
        ? `This already looks timeboxed, so we'll start with ${sliceLabel ?? "the first window"} and set up the next two weeks.`
        : `This already looks timeboxed, so we'll start with ${sliceLabel ?? "the first window"} and open day 1.`;
    case "structured_sequence":
      return sliceLabel
        ? `This looks like an ordered sequence, so we'll start with ${sliceLabel} and keep the opening bounded.`
        : "This looks like an ordered sequence, so we'll start at the beginning and keep the opening bounded.";
    case "topic_seed":
      return "This looks like a topic start, so we'll build a small starter module and open day 1.";
    case "shell_request":
      return "This looks like a shell request, so we'll build a lightweight starter module and open day 1.";
    case "ambiguous":
      return "This source is still ambiguous, so we'll keep the opening conservative until it is confirmed.";
  }
}

function shouldRequireFastPathPreview(params: {
  interpretation: {
    confidence: CurriculumIntakeConfidence;
    followUpQuestion?: string | null;
    needsConfirmation: boolean;
    sourceKind: SourceInterpretSourceKind;
  };
}) {
  return (
    params.interpretation.needsConfirmation ||
    params.interpretation.confidence === "low" ||
    Boolean(params.interpretation.followUpQuestion) ||
    params.interpretation.sourceKind === "ambiguous"
  );
}

export function resolveFastPathChosenHorizon(params: {
  recommendedHorizon: CurriculumGenerationHorizon;
  sourceKind: SourceInterpretSourceKind;
  intakeRoute: FastPathIntakeRoute;
  confidence: CurriculumIntakeConfidence;
}) {
  let decisionSource: CurriculumHorizonDecisionSource = "model_inferred";
  let chosenHorizon = clampHorizon({
    sourceKind: params.sourceKind,
    intakeRoute: params.intakeRoute,
    requestedHorizon: params.recommendedHorizon,
  });

  if (chosenHorizon !== params.recommendedHorizon) {
    decisionSource = "internal_override";
  }

  if (params.confidence === "low" && HORIZON_RANK[chosenHorizon] > HORIZON_RANK.single_day) {
    chosenHorizon = "single_day";
    decisionSource = "confidence_limited";
  }

  return {
    chosenHorizon,
    horizonDecisionSource: decisionSource,
  };
}

export function buildFastPathPreview(params: {
  learnerName: string;
  intakeRoute: FastPathIntakeRoute;
  intakeRouteExplicit: boolean;
  sourceInput: string;
  sourcePackages: IntakeSourcePackageContext[];
  interpretation: {
    sourceKind: SourceInterpretSourceKind;
    entryStrategy: SourceEntryStrategy;
    entryLabel?: string | null;
    continuationMode: SourceContinuationMode;
    suggestedTitle: string;
    confidence: CurriculumIntakeConfidence;
    recommendedHorizon: CurriculumGenerationHorizon;
    assumptions: string[];
    detectedChunks: string[];
    followUpQuestion?: string | null;
    needsConfirmation: boolean;
  };
  corrections?: HomeschoolFastPathOnboardingInput["previewCorrections"];
}): HomeschoolFastPathPreview {
  const routedByPolicy = sourceKindToRoute(params.interpretation.sourceKind);
  const intakeRoute = params.corrections?.intakeRoute ?? routedByPolicy;
  const resolvedHorizon = resolveFastPathChosenHorizon({
    recommendedHorizon: params.interpretation.recommendedHorizon,
    sourceKind: params.interpretation.sourceKind,
    intakeRoute,
    confidence: params.interpretation.confidence,
  });
  const initialSliceLabel = getInitialSliceLabel({
    entryStrategy: params.interpretation.entryStrategy,
    entryLabel: params.interpretation.entryLabel,
  });
  const sourceModel: HomeschoolFastPathSourceModel = {
    requestedRoute: params.intakeRoute,
    routedRoute: intakeRoute,
    confidence: params.interpretation.confidence,
    sourceKind: params.interpretation.sourceKind,
    entryStrategy: params.interpretation.entryStrategy,
    entryLabel: params.interpretation.entryLabel ?? null,
    continuationMode: params.interpretation.continuationMode,
    recommendedHorizon: params.interpretation.recommendedHorizon,
    assumptions: params.interpretation.assumptions,
    detectedChunks:
      params.interpretation.detectedChunks.length > 0
        ? params.interpretation.detectedChunks
        : extractDetectedChunks(params.sourceInput),
    followUpQuestion: params.interpretation.followUpQuestion ?? null,
    needsConfirmation: shouldRequireFastPathPreview({
      interpretation: params.interpretation,
    }),
  };
  const launchPlan: HomeschoolFastPathLaunchPlan = {
    chosenHorizon: resolvedHorizon.chosenHorizon,
    horizonDecisionSource: resolvedHorizon.horizonDecisionSource,
    scopeSummary: buildScopeSummary({
      sourceKind: params.interpretation.sourceKind,
      entryStrategy: params.interpretation.entryStrategy,
      entryLabel: params.interpretation.entryLabel,
      chosenHorizon: resolvedHorizon.chosenHorizon,
    }),
    initialSliceUsed: usesInitialSourceSlice({
      sourceKind: params.interpretation.sourceKind,
      entryStrategy: params.interpretation.entryStrategy,
    }),
    initialSliceLabel,
  };

  return {
    learnerTarget: params.corrections?.learnerName?.trim() || params.learnerName,
    requestedRoute: params.intakeRoute,
    requestedRouteWasExplicit: params.intakeRouteExplicit,
    intakeRoute,
    sourceKind: params.interpretation.sourceKind,
    entryStrategy: params.interpretation.entryStrategy,
    entryLabel: params.interpretation.entryLabel ?? null,
    continuationMode: params.interpretation.continuationMode,
    title:
      params.corrections?.title?.trim()
      || params.interpretation.suggestedTitle
      || buildPreviewTitle({ intakeRoute, sourceInput: params.sourceInput }),
    detectedChunks:
      sourceModel.detectedChunks,
    assumptions: params.interpretation.assumptions,
    recommendedHorizon: params.interpretation.recommendedHorizon,
    chosenHorizon: resolvedHorizon.chosenHorizon,
    horizonDecisionSource: resolvedHorizon.horizonDecisionSource,
    scopeSummary: launchPlan.scopeSummary ?? "",
    confidence: params.interpretation.confidence,
    followUpQuestion: params.interpretation.followUpQuestion ?? null,
    needsConfirmation: sourceModel.needsConfirmation,
    initialSliceUsed: launchPlan.initialSliceUsed,
    initialSliceLabel,
    sourceModel,
    launchPlan,
  };
}

function describeChosenHorizon(horizon: CurriculumGenerationHorizon) {
  switch (horizon) {
    case "single_day":
      return "today";
    case "few_days":
      return "the next few lessons";
    case "one_week":
      return "the next week";
    case "two_weeks":
      return "the next 2 weeks";
    case "starter_module":
      return "a starter module";
  }
}

function resolveSummaryLaunchPlan(params: {
  preview?: Pick<
    HomeschoolFastPathPreview,
    | "chosenHorizon"
    | "scopeSummary"
    | "initialSliceUsed"
    | "initialSliceLabel"
    | "launchPlan"
  >;
  launchPlan?: Pick<
    HomeschoolFastPathLaunchPlan,
    | "chosenHorizon"
    | "scopeSummary"
    | "initialSliceUsed"
    | "initialSliceLabel"
    | "openingLessonCount"
  >;
  openingLessonCount?: number;
  initialSliceLabel?: string | null;
}) {
  const previewLaunchPlan = params.preview?.launchPlan;
  const chosenHorizon =
    params.launchPlan?.chosenHorizon
    ?? previewLaunchPlan?.chosenHorizon
    ?? params.preview?.chosenHorizon;

  if (!chosenHorizon) {
    throw new Error("Launch summary requires a chosen horizon.");
  }

  const openingLessonCount =
    params.openingLessonCount
    ?? params.launchPlan?.openingLessonCount
    ?? previewLaunchPlan?.openingLessonCount;

  if (openingLessonCount == null || openingLessonCount < 1) {
    throw new Error("Launch summary requires a positive opening lesson count.");
  }

  return {
    chosenHorizon,
    openingLessonCount,
    scopeSummary:
      params.launchPlan?.scopeSummary
      ?? previewLaunchPlan?.scopeSummary
      ?? params.preview?.scopeSummary
      ?? null,
    initialSliceUsed:
      params.launchPlan?.initialSliceUsed
      ?? previewLaunchPlan?.initialSliceUsed
      ?? params.preview?.initialSliceUsed
      ?? false,
    initialSliceLabel:
      params.initialSliceLabel
      ?? params.launchPlan?.initialSliceLabel
      ?? previewLaunchPlan?.initialSliceLabel
      ?? params.preview?.initialSliceLabel
      ?? null,
  };
}

export function buildFastPathLaunchSummary(params: {
  preview?: Pick<
    HomeschoolFastPathPreview,
    | "chosenHorizon"
    | "scopeSummary"
    | "initialSliceUsed"
    | "initialSliceLabel"
    | "launchPlan"
  >;
  launchPlan?: Pick<
    HomeschoolFastPathLaunchPlan,
    | "chosenHorizon"
    | "scopeSummary"
    | "initialSliceUsed"
    | "initialSliceLabel"
    | "openingLessonCount"
  >;
  openingLessonCount?: number;
  initialSliceLabel?: string | null;
}): HomeschoolFastPathLaunchSummary {
  const launchPlan = resolveSummaryLaunchPlan(params);
  let summaryText: string;

  if (launchPlan.chosenHorizon === "single_day") {
    summaryText = "We set this up for today.";
  } else if (launchPlan.initialSliceUsed && launchPlan.initialSliceLabel) {
    summaryText = `We started with ${launchPlan.initialSliceLabel}, set up the opening ${launchPlan.openingLessonCount} lessons, and opened day 1.`;
  } else if (launchPlan.chosenHorizon === "starter_module") {
    summaryText = `We built a starter module with ${launchPlan.openingLessonCount} lessons and opened day 1.`;
  } else if (launchPlan.chosenHorizon === "two_weeks") {
    summaryText = `We set up the opening ${launchPlan.openingLessonCount} lessons across ${describeChosenHorizon(
      launchPlan.chosenHorizon,
    )} and opened day 1.`;
  } else {
    summaryText = `We set up the opening ${launchPlan.openingLessonCount} lessons and opened day 1.`;
  }

  return {
    chosenHorizon: launchPlan.chosenHorizon,
    openingLessonCount: launchPlan.openingLessonCount,
    summaryText,
    scopeSummary: launchPlan.scopeSummary,
    initialSliceUsed: launchPlan.initialSliceUsed,
    initialSliceLabel: launchPlan.initialSliceLabel,
  };
}
