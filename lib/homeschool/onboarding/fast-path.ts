import type { IntakeSourcePackageContext } from "@/lib/homeschool/intake/types";

import type {
  CurriculumGenerationHorizon,
  CurriculumHorizonDecisionSource,
  CurriculumIntakeConfidence,
  FastPathHorizonIntent,
  FastPathIntakeRoute,
  HomeschoolFastPathLaunchSummary,
  HomeschoolFastPathOnboardingInput,
  HomeschoolFastPathPreview,
  SourceInterpretSliceStrategy,
  SourceInterpretSourceKind,
  SourceInterpretSourceScale,
} from "./types";

const HORIZON_RANK: Record<CurriculumGenerationHorizon, number> = {
  today: 1,
  tomorrow: 2,
  next_few_days: 3,
  current_week: 4,
  starter_module: 5,
  starter_week: 6,
};

const HORIZON_BY_RANK: Record<number, CurriculumGenerationHorizon> = {
  1: "today",
  2: "tomorrow",
  3: "next_few_days",
  4: "current_week",
  5: "starter_module",
  6: "starter_week",
};

function buildPreviewTitle(input: {
  intakeRoute: FastPathIntakeRoute;
  sourceInput: string;
}) {
  const prefix =
    input.intakeRoute === "topic"
      ? "Topic starter"
      : input.intakeRoute === "weekly_plan"
        ? "Week plan"
        : input.intakeRoute === "outline"
          ? "Outline plan"
          : input.intakeRoute === "manual_shell"
            ? "Starter shell"
            : "Lesson plan";

  return `${prefix}: ${input.sourceInput.trim().slice(0, 48)}`;
}

export function extractDetectedChunks(sourceInput: string) {
  const trimmedLines = sourceInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  return trimmedLines.length > 0 ? trimmedLines : [sourceInput.trim().slice(0, 80)];
}

export function sourceKindToRoute(sourceKind: SourceInterpretSourceKind): FastPathIntakeRoute {
  switch (sourceKind) {
    case "single_day_material":
      return "single_lesson";
    case "weekly_assignments":
      return "weekly_plan";
    case "sequence_outline":
      return "outline";
    case "topic_seed":
      return "topic";
    case "manual_shell":
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
      return 2;
    case "weekly_plan":
    case "outline":
      return 4;
    case "topic":
      return 5;
    case "manual_shell":
      return 6;
  }
}

function maxHorizonRankForSourceKind(sourceKind: SourceInterpretSourceKind) {
  switch (sourceKind) {
    case "single_day_material":
      return 2;
    case "weekly_assignments":
    case "sequence_outline":
      return 4;
    case "topic_seed":
      return 5;
    case "manual_shell":
      return 6;
    case "ambiguous":
      return 1;
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

function getSliceDescriptor(params: {
  sliceStrategy?: SourceInterpretSliceStrategy | null;
  sliceNotes?: string[];
}) {
  const preferredNote = params.sliceNotes?.find((value) => value.trim().length > 0)?.trim();
  if (preferredNote) {
    return preferredNote;
  }

  switch (params.sliceStrategy) {
    case "explicit_range":
      return "the range you specified";
    case "first_chapter":
      return "the first chapter";
    case "first_unit":
      return "the first unit";
    case "first_few_sections":
      return "the first section";
    case "first_lesson":
      return "the first lesson";
    case "current_week_only":
      return "the current week portion";
    case "manual_shell_only":
      return "a lightweight starter shell";
    case "single_lesson":
      return "today's lesson";
    default:
      return null;
  }
}

export function usesInitialSourceSlice(params: {
  sourceScale?: SourceInterpretSourceScale | null;
  sliceStrategy?: SourceInterpretSliceStrategy | null;
}) {
  if (params.sourceScale === "large") {
    return true;
  }

  return Boolean(
    params.sliceStrategy &&
      params.sliceStrategy !== "single_lesson" &&
      params.sliceStrategy !== "manual_shell_only" &&
      params.sliceStrategy !== "current_week_only",
  );
}

function buildScopeSummary(params: {
  chosenHorizon: CurriculumGenerationHorizon;
  sourceScale?: SourceInterpretSourceScale | null;
  sliceStrategy?: SourceInterpretSliceStrategy | null;
  sliceNotes?: string[];
}) {
  const sliceDescriptor = getSliceDescriptor(params);
  const usedSlice = usesInitialSourceSlice(params);

  if (params.sourceScale === "large" || usedSlice) {
    return sliceDescriptor
      ? `This looks like a larger source, so we'll start with ${sliceDescriptor} and keep the rest available for later.`
      : "This looks like a larger source, so we'll start with a bounded first slice and keep the rest available for later.";
  }

  switch (params.chosenHorizon) {
    case "today":
    case "tomorrow":
      return "This looks like enough to set up today first.";
    case "next_few_days":
      return "This looks like enough to set up the next few lessons and open day 1.";
    case "current_week":
      return "This looks like enough for the current week. We'll open day 1 and keep the rest ready.";
    case "starter_module":
      return "This looks like a topic starter, so we'll build a small launch-safe module and open day 1.";
    case "starter_week":
      return "This looks like a lightweight starter week. We'll open day 1 and keep the rest reversible.";
  }
}

function shouldRequireFastPathPreview(params: {
  interpretation: {
    confidence: CurriculumIntakeConfidence;
    followUpQuestion?: string | null;
    needsConfirmation: boolean;
    sourceScale?: SourceInterpretSourceScale | null;
    sliceStrategy?: SourceInterpretSliceStrategy | null;
  };
  requestedRouteWasExplicit: boolean;
  routedByPolicy: FastPathIntakeRoute;
  requestedRoute: FastPathIntakeRoute;
  sourcePackages: IntakeSourcePackageContext[];
}) {
  const requiresReview = params.sourcePackages.some(
    (sourcePackage) => sourcePackage.extractionStatus === "requires_review",
  );
  const routeMismatch =
    params.requestedRouteWasExplicit && params.routedByPolicy !== params.requestedRoute;
  const largeSliceIsAmbiguous =
    params.interpretation.sourceScale === "large" &&
    (!params.interpretation.sliceStrategy ||
      params.interpretation.needsConfirmation ||
      params.interpretation.confidence === "low");

  return (
    params.interpretation.needsConfirmation ||
    params.interpretation.confidence === "low" ||
    Boolean(params.interpretation.followUpQuestion) ||
    requiresReview ||
    routeMismatch ||
    largeSliceIsAmbiguous
  );
}

export function resolveFastPathChosenHorizon(params: {
  recommendedHorizon: CurriculumGenerationHorizon;
  sourceKind: SourceInterpretSourceKind;
  intakeRoute: FastPathIntakeRoute;
  legacyHorizonIntent?: FastPathHorizonIntent;
  legacyChosenHorizon?: CurriculumGenerationHorizon;
  previewConfirmed?: boolean;
}) {
  let requestedHorizon = params.recommendedHorizon;
  let decisionSource: CurriculumHorizonDecisionSource = "model_inferred";

  if (params.legacyChosenHorizon) {
    requestedHorizon = params.legacyChosenHorizon;
    decisionSource = "internal_override";
  } else if (params.legacyHorizonIntent === "today_only") {
    requestedHorizon = "today";
    decisionSource = "legacy_user_override";
  }

  const chosenHorizon = clampHorizon({
    sourceKind: params.sourceKind,
    intakeRoute: params.intakeRoute,
    requestedHorizon,
  });

  if (decisionSource === "model_inferred" && params.previewConfirmed) {
    decisionSource = "preview_confirmed";
  }

  return {
    chosenHorizon,
    horizonDecisionSource: decisionSource,
    wasClamped: chosenHorizon !== requestedHorizon,
  };
}

export function buildFastPathPreview(params: {
  learnerName: string;
  intakeRoute: FastPathIntakeRoute;
  intakeRouteExplicit: boolean;
  sourceInput: string;
  sourcePackages: IntakeSourcePackageContext[];
  horizonIntent?: FastPathHorizonIntent;
  interpretation: {
    sourceKind: SourceInterpretSourceKind;
    sourceScale?: SourceInterpretSourceScale | null;
    sliceStrategy?: SourceInterpretSliceStrategy | null;
    sliceNotes?: string[];
    suggestedTitle: string;
    confidence: CurriculumIntakeConfidence;
    recommendedHorizon: CurriculumGenerationHorizon;
    assumptions: string[];
    detectedChunks: string[];
    followUpQuestion?: string | null;
    needsConfirmation: boolean;
  };
  corrections?: HomeschoolFastPathOnboardingInput["previewCorrections"];
  previewConfirmed?: boolean;
}): HomeschoolFastPathPreview {
  const routedByPolicy = sourceKindToRoute(params.interpretation.sourceKind);
  const requestedRoute = params.intakeRoute;
  const requestedRouteWasExplicit = params.intakeRouteExplicit;
  const intakeRoute = params.corrections?.intakeRoute ?? routedByPolicy;
  const resolvedHorizon = resolveFastPathChosenHorizon({
    recommendedHorizon: params.interpretation.recommendedHorizon,
    sourceKind: params.interpretation.sourceKind,
    intakeRoute,
    legacyHorizonIntent: params.horizonIntent,
    legacyChosenHorizon: params.corrections?.chosenHorizon,
    previewConfirmed: params.previewConfirmed,
  });
  const detectedChunks =
    params.interpretation.detectedChunks.length > 0
      ? params.interpretation.detectedChunks
      : extractDetectedChunks(params.sourceInput);
  const assumptions = [...params.interpretation.assumptions];

  if (requestedRouteWasExplicit && routedByPolicy !== requestedRoute) {
    assumptions.push(
      `We are routing this as ${routedByPolicy.replaceAll("_", " ")} instead of ${requestedRoute.replaceAll("_", " ")}.`,
    );
  }

  if (resolvedHorizon.wasClamped) {
    assumptions.push("We kept the launch horizon conservative so the first plan stays bounded.");
  }

  const scopeSummary = buildScopeSummary({
    chosenHorizon: resolvedHorizon.chosenHorizon,
    sourceScale: params.interpretation.sourceScale,
    sliceStrategy: params.interpretation.sliceStrategy,
    sliceNotes: params.interpretation.sliceNotes,
  });

  return {
    learnerTarget: params.corrections?.learnerName?.trim() || params.learnerName.trim(),
    requestedRoute,
    requestedRouteWasExplicit,
    intakeRoute,
    sourceKind: params.interpretation.sourceKind,
    sourceScale: params.interpretation.sourceScale ?? null,
    sliceStrategy: params.interpretation.sliceStrategy ?? null,
    sliceNotes: params.interpretation.sliceNotes ?? [],
    initialSliceUsed: usesInitialSourceSlice({
      sourceScale: params.interpretation.sourceScale,
      sliceStrategy: params.interpretation.sliceStrategy,
    }),
    title:
      params.corrections?.title?.trim() ||
      params.interpretation.suggestedTitle ||
      buildPreviewTitle({ intakeRoute, sourceInput: params.sourceInput }),
    detectedChunks,
    assumptions: assumptions.length > 0 ? assumptions : ["We will keep the first plan bounded."],
    inferredHorizon: params.interpretation.recommendedHorizon,
    chosenHorizon: resolvedHorizon.chosenHorizon,
    horizonDecisionSource: resolvedHorizon.horizonDecisionSource,
    scopeSummary,
    confidence: params.interpretation.confidence,
    followUpQuestion: params.interpretation.followUpQuestion ?? null,
    needsConfirmation: shouldRequireFastPathPreview({
      interpretation: params.interpretation,
      requestedRouteWasExplicit,
      routedByPolicy,
      requestedRoute,
      sourcePackages: params.sourcePackages,
    }),
  };
}

export function buildFastPathLaunchSummary(params: {
  preview: Pick<
    HomeschoolFastPathPreview,
    "chosenHorizon" | "sourceScale" | "sliceStrategy" | "sliceNotes" | "scopeSummary" | "initialSliceUsed"
  >;
  lessonCount: number;
  initialSliceLabel?: string | null;
}): HomeschoolFastPathLaunchSummary {
  const sliceLabel = params.initialSliceLabel?.trim() || getSliceDescriptor(params.preview);
  const pluralizedLessons = params.lessonCount === 1 ? "lesson" : "lessons";
  let summaryText: string;

  if (params.lessonCount <= 1 && params.preview.chosenHorizon === "today" && !params.preview.initialSliceUsed) {
    summaryText = "We set this up for today.";
  } else if (params.preview.initialSliceUsed) {
    summaryText = sliceLabel
      ? `We started with ${sliceLabel}, set up ${params.lessonCount} ${pluralizedLessons}, and opened day 1.`
      : `We started with the first part of your source, set up ${params.lessonCount} ${pluralizedLessons}, and opened day 1.`;
  } else if (params.preview.chosenHorizon === "current_week") {
    summaryText = `We organized this into your current week, set up ${params.lessonCount} ${pluralizedLessons}, and opened day 1.`;
  } else {
    summaryText = `We set up ${params.lessonCount} ${pluralizedLessons} and opened day 1.`;
  }

  return {
    chosenHorizon: params.preview.chosenHorizon,
    lessonCount: params.lessonCount,
    summaryText,
    scopeSummary: params.preview.scopeSummary,
    usedSlice: params.preview.initialSliceUsed,
    initialSliceLabel: sliceLabel,
  };
}
