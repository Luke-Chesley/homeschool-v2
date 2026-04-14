import type { OnboardingMilestone } from "@/lib/homeschool/onboarding/activation-contracts";

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
};

export type FastPathIntakeType = "book_curriculum" | "outline_weekly_plan" | "topic";

export type FastPathHorizonIntent = "today_only" | "auto";

export type HomeschoolFastPathOnboardingInput = {
  organizationId: string;
  learnerName: string;
  intakeType: FastPathIntakeType;
  sourceInput: string;
  horizonIntent?: FastPathHorizonIntent;
  confirmPreview?: boolean;
};

export type HomeschoolFastPathPreview = {
  learnerTarget: string;
  intakeType: FastPathIntakeType;
  title: string;
  detectedChunks: string[];
  plannedHorizon: "today" | "next_few_days";
  confidence: "low" | "moderate";
};

export type HomeschoolOnboardingStatus = {
  isComplete: boolean;
  completedAt: string | null;
  milestones: OnboardingMilestone[];
  currentMilestone: OnboardingMilestone | null;
};
