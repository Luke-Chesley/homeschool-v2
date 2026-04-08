export const homeschoolTemplate = {
  labels: {
    primaryGuide: "Parent",
    learner: "Learner",
    session: "Lesson",
    module: "Unit",
    activity: "Activity",
    checkpoint: "Checkpoint",
  },
  defaults: {
    workflowMode: "family_guided" as const,
    reportingMode: "progress_journal" as const,
    schoolDays: [1, 2, 3, 4, 5],
    dailyTimeBudgetMinutes: 180,
    plannerView: "week" as const,
    preferredPlannerStyle: "balanced" as const,
    reportPacks: ["progress_journal", "homeschool_records", "weekly_summary"],
  },
  plannerPolicy: {
    maxItemsPerDay: 4,
    defaultBufferMinutes: 20,
    carryForwardLimit: 2,
    allowWeekendRecovery: true,
    partialCreditWeight: 0.5,
    lifeHappenedActions: [
      "skip_today",
      "push_unfinished_forward",
      "lighten_tomorrow",
      "mark_partial",
      "replace_with_lighter_activity",
      "pause_subject_for_week",
    ] as const,
  },
  reporting: {
    attendanceMode: "daily" as const,
    evidenceKinds: ["note", "artifact_output", "activity_outcome", "photo"],
    transcriptMinimumGradeBand: "7-12",
  },
} as const;

export type HomeschoolTemplate = typeof homeschoolTemplate;
