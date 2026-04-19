import type { OnboardingMilestone } from "@/lib/homeschool/onboarding/activation-contracts";

export const FAST_PATH_INTAKE_ROUTES = [
  "single_lesson",
  "weekly_plan",
  "outline",
  "topic",
  "manual_shell",
] as const;

export const CURRICULUM_GENERATION_HORIZONS = [
  "single_day",
  "few_days",
  "one_week",
  "two_weeks",
  "starter_module",
] as const;

export const CURRICULUM_HORIZON_DECISION_SOURCES = [
  "model_inferred",
  "internal_override",
  "confidence_limited",
  "manual_regeneration",
] as const;

export const CURRICULUM_INTAKE_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export const SOURCE_INTERPRET_SOURCE_KINDS = [
  "bounded_material",
  "timeboxed_plan",
  "structured_sequence",
  "comprehensive_source",
  "topic_seed",
  "shell_request",
  "ambiguous",
] as const;

export const SOURCE_ENTRY_STRATEGIES = [
  "use_as_is",
  "explicit_range",
  "sequential_start",
  "section_start",
  "timebox_start",
  "scaffold_only",
] as const;

export const SOURCE_CONTINUATION_MODES = [
  "none",
  "sequential",
  "timebox",
  "manual_review",
] as const;

export const SOURCE_DELIVERY_PATTERNS = [
  "task_first",
  "skill_first",
  "concept_first",
  "timeboxed",
  "mixed",
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

export type CurriculumGenerationHorizon = (typeof CURRICULUM_GENERATION_HORIZONS)[number];

export type CurriculumHorizonDecisionSource =
  (typeof CURRICULUM_HORIZON_DECISION_SOURCES)[number];

export type CurriculumIntakeConfidence = (typeof CURRICULUM_INTAKE_CONFIDENCE_LEVELS)[number];

export type SourceInterpretSourceKind = (typeof SOURCE_INTERPRET_SOURCE_KINDS)[number];

export type SourceEntryStrategy = (typeof SOURCE_ENTRY_STRATEGIES)[number];

export type SourceContinuationMode = (typeof SOURCE_CONTINUATION_MODES)[number];

export type SourceDeliveryPattern = (typeof SOURCE_DELIVERY_PATTERNS)[number];

export type HomeschoolFastPathOnboardingInput = {
  organizationId: string;
  learnerName: string;
  intakeRoute?: FastPathIntakeRoute;
  intakeRouteExplicit?: boolean;
  sourceInput?: string;
  sourcePackageIds?: string[];
  confirmPreview?: boolean;
  previewCorrections?: {
    learnerName?: string;
    intakeRoute?: FastPathIntakeRoute;
    title?: string;
  };
};

export type HomeschoolFastPathPreview = {
  learnerTarget: string;
  requestedRoute: FastPathIntakeRoute;
  requestedRouteWasExplicit: boolean;
  intakeRoute: FastPathIntakeRoute;
  sourceKind: SourceInterpretSourceKind;
  entryStrategy: SourceEntryStrategy;
  entryLabel?: string | null;
  continuationMode: SourceContinuationMode;
  deliveryPattern: SourceDeliveryPattern;
  title: string;
  detectedChunks: string[];
  assumptions: string[];
  recommendedHorizon: CurriculumGenerationHorizon;
  chosenHorizon: CurriculumGenerationHorizon;
  horizonDecisionSource: CurriculumHorizonDecisionSource;
  scopeSummary: string;
  confidence: CurriculumIntakeConfidence;
  followUpQuestion?: string | null;
  needsConfirmation: boolean;
  initialSliceUsed: boolean;
  initialSliceLabel?: string | null;
  sourceModel: HomeschoolFastPathSourceModel;
  launchPlan: HomeschoolFastPathLaunchPlan;
};

export type HomeschoolFastPathSourceModel = {
  requestedRoute: FastPathIntakeRoute;
  routedRoute: FastPathIntakeRoute;
  confidence: CurriculumIntakeConfidence;
  sourceKind: SourceInterpretSourceKind;
  entryStrategy: SourceEntryStrategy;
  entryLabel?: string | null;
  continuationMode: SourceContinuationMode;
  deliveryPattern: SourceDeliveryPattern;
  recommendedHorizon: CurriculumGenerationHorizon;
  assumptions: string[];
  detectedChunks: string[];
  followUpQuestion?: string | null;
  needsConfirmation: boolean;
};

export type HomeschoolFastPathLaunchPlan = {
  chosenHorizon: CurriculumGenerationHorizon;
  horizonDecisionSource: CurriculumHorizonDecisionSource;
  scopeSummary?: string | null;
  initialSliceUsed: boolean;
  initialSliceLabel?: string | null;
  openingUnitRefs?: string[];
  openingSkillNodeIds?: string[];
  lastGeneratedLessonTitle?: string | null;
};

export type HomeschoolFastPathLaunchSummary = {
  chosenHorizon: CurriculumGenerationHorizon;
  summaryText: string;
  scopeSummary?: string | null;
  initialSliceUsed: boolean;
  initialSliceLabel?: string | null;
};

export type HomeschoolOnboardingStatus = {
  isComplete: boolean;
  completedAt: string | null;
  milestones: OnboardingMilestone[];
  currentMilestone: OnboardingMilestone | null;
};
