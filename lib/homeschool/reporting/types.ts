export type HomeschoolReportKind =
  | "weekly_summary"
  | "monthly_summary"
  | "progress_report"
  | "transcript_skeleton";

export type HomeschoolWeeklySummary = {
  completedCount: number;
  partialCount: number;
  skippedCount: number;
  attendanceCount: number;
  narrative: string;
};

export type HomeschoolMonthlySummary = {
  attendanceRate: number;
  totalLessonCount: number;
  completedLessonCount: number;
  subjectBreakdown: Array<{
    subject: string;
    count: number;
  }>;
};

export type HomeschoolTranscriptSkeleton = {
  learnerName: string;
  gradeLabel: string;
  entries: Array<{
    subject: string;
    courseTitle: string;
    status: string;
    evidenceCount: number;
  }>;
};
