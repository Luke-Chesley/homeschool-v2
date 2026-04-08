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
