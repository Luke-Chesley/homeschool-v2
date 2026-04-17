export type ComplianceProgramStatus = "draft" | "active" | "completed" | "archived";

export type ComplianceAttendanceMode = "days" | "hours" | "days_or_hours" | "minimal";
export type ComplianceAttendanceSource = "manual" | "derived_from_sessions" | "imported";
export type ComplianceGradeBand = "elementary" | "secondary";
export type ComplianceSubjectCoverageStatus =
  | "not_started"
  | "in_progress"
  | "satisfied"
  | "unknown";
export type CompliancePeriodType = "month" | "quarter" | "year" | "custom";
export type ComplianceSnapshotStatus = "draft" | "final";
export type ComplianceEvaluationType =
  | "parent_summary"
  | "teacher_letter"
  | "standardized_test"
  | "portfolio_review"
  | "external_assessment";
export type ComplianceEvaluationStatus = "draft" | "completed" | "waived" | "not_applicable";
export type ComplianceTaskType =
  | "notice"
  | "ihip"
  | "quarterly_report"
  | "annual_evaluation"
  | "affidavit"
  | "portfolio_ready"
  | "termination"
  | "transfer_letter"
  | "attendance_summary"
  | "progress_snapshot"
  | "test_evidence"
  | "health_attestation";
export type ComplianceTaskStatus =
  | "upcoming"
  | "ready"
  | "completed"
  | "overdue"
  | "not_applicable";
export type ComplianceReportKind =
  | "attendance_summary"
  | "quarterly_report"
  | "annual_summary"
  | "evaluation_packet"
  | "portfolio_checklist"
  | "transcript_skeleton";
export type ComplianceReportStatus = "draft" | "final";
export type PortfolioArtifactKind =
  | "work_sample"
  | "photo"
  | "pdf"
  | "test_result"
  | "evaluator_letter"
  | "report_card"
  | "reading_log_export"
  | "checklist_attachment"
  | "note"
  | "other";
export type PortfolioEntryStatus = "inbox" | "saved" | "archived";

export interface RequirementSubjectGroup {
  key: string;
  label: string;
  aliases?: string[];
  description?: string;
}

export interface RequirementDocument {
  key: string;
  label: string;
  description: string;
  optional?: boolean;
}

export type DeadlineRule =
  | {
      kind: "offset_from_start";
      taskType: ComplianceTaskType;
      title: string;
      offsetDays: number;
      notes?: string;
    }
  | {
      kind: "offset_from_end";
      taskType: ComplianceTaskType;
      title: string;
      offsetDays: number;
      notes?: string;
    }
  | {
      kind: "quarterly";
      taskType: Extract<ComplianceTaskType, "quarterly_report" | "progress_snapshot">;
      title: string;
      notes?: string;
    };

export interface RequirementProfile {
  jurisdictionCode: string;
  jurisdictionLabel: string;
  pathwayCode: string;
  pathwayLabel: string;
  version: string;
  attendanceMode: ComplianceAttendanceMode;
  attendanceTargetDays?: number;
  attendanceTargetHoursElementary?: number;
  attendanceTargetHoursSecondary?: number;
  requiresPeriodicReports: boolean;
  periodicReportCadence: "quarterly" | "annual" | "none";
  requiresAnnualEvaluation: boolean;
  requiresPortfolio: boolean;
  requiresTestEvidence: boolean;
  subjectCoverageMode: "required_subjects" | "portfolio_signal" | "minimal";
  requiredSubjectGroups: RequirementSubjectGroup[];
  requiredDocuments: RequirementDocument[];
  deadlineRules: DeadlineRule[];
  retentionHints: string[];
  suggestedExports: ComplianceReportKind[];
  reportSectionPrompts: {
    quarterly: string[];
    annual: string[];
    evaluation: string[];
  };
  framingNote: string;
}

export interface ComplianceProgramDefinition {
  schoolYearLabel: string;
  startDate: string;
  endDate: string;
  jurisdictionCode: string;
  pathwayCode: string;
  requirementProfileVersion: string;
  gradeBand: ComplianceGradeBand;
  status: ComplianceProgramStatus;
}

export interface AttendanceLedgerEntry {
  id: string;
  date: string;
  status: string;
  instructionalMinutes: number;
  source: ComplianceAttendanceSource;
  note: string | null;
  derivedSessionIds: string[];
  isSuggested: boolean;
}

export interface AttendanceProgressSummary {
  loggedInstructionalDays: number;
  instructionalHours: number;
  nonInstructionalDays: number;
  targetDays: number | null;
  targetHours: number | null;
  progressLabel: string;
  readinessLabel: string;
}

export interface SubjectCoverageSummary {
  subjectKey: string;
  label: string;
  minutesLogged: number;
  daysTouched: number;
  unitsTouched: number;
  lastCoveredAt: string | null;
  coverageStatus: ComplianceSubjectCoverageStatus;
  supportingRefs: string[];
}

export interface ProgressSnapshotSummary {
  id: string;
  periodType: CompliancePeriodType;
  periodLabel: string;
  summaryText: string;
  strengths: string;
  struggles: string;
  nextSteps: string;
  subjectNotes: Array<{
    subject: string;
    note: string;
  }>;
  evidenceRefs: string[];
  status: ComplianceSnapshotStatus;
}

export interface EvaluationRecordSummary {
  id: string;
  evaluationType: ComplianceEvaluationType;
  completedAt: string | null;
  resultSummary: string;
  evaluatorName: string | null;
  evaluatorRole: string | null;
  status: ComplianceEvaluationStatus;
}

export interface ComplianceTaskSummary {
  id: string;
  taskType: ComplianceTaskType;
  title: string;
  dueDate: string;
  status: ComplianceTaskStatus;
  notes: string | null;
  completionRefs: string[];
}

export interface ComplianceReportDraftSummary {
  id: string;
  reportKind: ComplianceReportKind;
  title: string;
  periodLabel: string;
  status: ComplianceReportStatus;
  content: string;
  exportFileName: string;
}
