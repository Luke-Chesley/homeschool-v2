import type { OnboardingMilestone } from "@/lib/homeschool/onboarding/activation-contracts";

export const FAST_PATH_INTAKE_ROUTES = [
  "single_lesson",
  "weekly_plan",
  "outline",
  "topic",
  "manual_shell",
] as const;

export const LEGACY_FAST_PATH_INTAKE_ROUTES = [
  "book_curriculum",
  "outline_weekly_plan",
] as const;

export const CURRICULUM_GENERATION_HORIZONS = [
  "today",
  "tomorrow",
  "next_few_days",
  "current_week",
  "starter_module",
  "starter_week",
] as const;

export const CURRICULUM_HORIZON_DECISION_SOURCES = [
  "model_inferred",
  "legacy_user_override",
  "internal_override",
  "preview_confirmed",
  "system_default",
  "confidence_limited",
  "user_selected",
  "user_corrected_in_preview",
  "manual_regeneration",
] as const;

export const CURRICULUM_INTAKE_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export const SOURCE_INTERPRET_SOURCE_KINDS = [
  "single_day_material",
  "weekly_assignments",
  "sequence_outline",
  "topic_seed",
  "manual_shell",
  "ambiguous",
] as const;

export const SOURCE_INTERPRET_SOURCE_SCALES = [
  "small",
  "medium",
  "large",
] as const;

export const SOURCE_INTERPRET_SLICE_STRATEGIES = [
  "single_lesson",
  "first_lesson",
  "first_chapter",
  "first_unit",
  "first_few_sections",
  "current_week_only",
  "explicit_range",
  "manual_shell_only",
] as const;

export type HomeschoolOnboardingInput = {
  organizationId: string;
  householdName: string;
  schoolYearLabel?: string;
  termStartDate?: string;
  termEndDate?: string;
  preferredSchoolDays: number[];
  dailyTimeBudgetMinutes: number;
  subjects: string[];
  standardsPreference?: string;
  teachingStyle?: string;
  learners: Array<{
    displayName: string;
    gradeLevel?: string;
    ageBand?: string;
    pacePreference?: "gentle" | "balanced" | "accelerated";
    loadPreference?: "light" | "balanced" | "ambitious";
  }>;
  curriculumMode: "manual_shell" | "paste_outline" | "ai_decompose";
  curriculumTitle: string;
  curriculumSummary?: string;
  curriculumText?: string;
  sourcePackageIds?: string[];
  curriculumSourceMetadata?: Record<string, unknown>;
};

export type FastPathIntakeRoute = (typeof FAST_PATH_INTAKE_ROUTES)[number];

export type LegacyFastPathIntakeRoute = (typeof LEGACY_FAST_PATH_INTAKE_ROUTES)[number];

export type FastPathIntakeType = FastPathIntakeRoute | LegacyFastPathIntakeRoute;

/** Internal and legacy-only override. Normal onboarding now defaults to auto inference. */
export type FastPathHorizonIntent = "today_only" | "auto";

export type CurriculumGenerationHorizon = (typeof CURRICULUM_GENERATION_HORIZONS)[number];

export type CurriculumHorizonDecisionSource =
  (typeof CURRICULUM_HORIZON_DECISION_SOURCES)[number];

export type CurriculumIntakeConfidence = (typeof CURRICULUM_INTAKE_CONFIDENCE_LEVELS)[number];

export type SourceInterpretSourceKind = (typeof SOURCE_INTERPRET_SOURCE_KINDS)[number];

export type SourceInterpretSourceScale = (typeof SOURCE_INTERPRET_SOURCE_SCALES)[number];

export type SourceInterpretSliceStrategy = (typeof SOURCE_INTERPRET_SLICE_STRATEGIES)[number];

export type HomeschoolFastPathOnboardingInput = {
  organizationId: string;
  learnerName: string;
  intakeRoute?: FastPathIntakeRoute;
  intakeRouteExplicit?: boolean;
  sourceInput?: string;
  sourcePackageIds?: string[];
  /** Backward-compatible single-package entrypoint. */
  sourcePackageId?: string;
  horizonIntent?: FastPathHorizonIntent;
  confirmPreview?: boolean;
  previewCorrections?: {
    learnerName?: string;
    intakeRoute?: FastPathIntakeRoute;
    title?: string;
    chosenHorizon?: CurriculumGenerationHorizon;
  };
};

export type HomeschoolFastPathPreview = {
  learnerTarget: string;
  requestedRoute: FastPathIntakeRoute;
  requestedRouteWasExplicit: boolean;
  intakeRoute: FastPathIntakeRoute;
  sourceKind: SourceInterpretSourceKind;
  sourceScale?: SourceInterpretSourceScale | null;
  sliceStrategy?: SourceInterpretSliceStrategy | null;
  sliceNotes: string[];
  initialSliceUsed: boolean;
  title: string;
  detectedChunks: string[];
  assumptions: string[];
  inferredHorizon: CurriculumGenerationHorizon;
  chosenHorizon: CurriculumGenerationHorizon;
  horizonDecisionSource: CurriculumHorizonDecisionSource;
  scopeSummary: string;
  confidence: CurriculumIntakeConfidence;
  followUpQuestion?: string | null;
  needsConfirmation: boolean;
};

export type HomeschoolFastPathLaunchSummary = {
  chosenHorizon: CurriculumGenerationHorizon;
  lessonCount: number;
  summaryText: string;
  scopeSummary?: string | null;
  usedSlice: boolean;
  initialSliceLabel?: string | null;
};

export type HomeschoolOnboardingStatus = {
  isComplete: boolean;
  completedAt: string | null;
  milestones: OnboardingMilestone[];
  currentMilestone: OnboardingMilestone | null;
};
