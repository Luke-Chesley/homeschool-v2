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
  curriculumSourceMetadata?: Record<string, unknown>;
};

export type FastPathIntakeRoute = (typeof FAST_PATH_INTAKE_ROUTES)[number];

export type LegacyFastPathIntakeRoute = (typeof LEGACY_FAST_PATH_INTAKE_ROUTES)[number];

export type FastPathIntakeType = FastPathIntakeRoute | LegacyFastPathIntakeRoute;

export type FastPathHorizonIntent = "today_only" | "auto";

export type CurriculumGenerationHorizon = (typeof CURRICULUM_GENERATION_HORIZONS)[number];

export type CurriculumHorizonDecisionSource =
  (typeof CURRICULUM_HORIZON_DECISION_SOURCES)[number];

export type CurriculumIntakeConfidence = (typeof CURRICULUM_INTAKE_CONFIDENCE_LEVELS)[number];

export type SourceInterpretSourceKind = (typeof SOURCE_INTERPRET_SOURCE_KINDS)[number];

export type HomeschoolFastPathOnboardingInput = {
  organizationId: string;
  learnerName: string;
  intakeRoute?: FastPathIntakeRoute;
  intakeRouteExplicit?: boolean;
  sourceInput?: string;
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
  title: string;
  detectedChunks: string[];
  assumptions: string[];
  inferredHorizon: CurriculumGenerationHorizon;
  chosenHorizon: CurriculumGenerationHorizon;
  horizonDecisionSource: CurriculumHorizonDecisionSource;
  confidence: CurriculumIntakeConfidence;
  followUpQuestion?: string | null;
  needsConfirmation: boolean;
};

export type HomeschoolOnboardingStatus = {
  isComplete: boolean;
  completedAt: string | null;
  milestones: OnboardingMilestone[];
  currentMilestone: OnboardingMilestone | null;
};
