import type { LessonEvaluationLevel } from "@/lib/session-workspace/evaluation";
import type {
  AttendanceLedgerEntry,
  AttendanceProgressSummary,
  ComplianceGradeBand,
  ComplianceReportDraftSummary,
  ComplianceTaskSummary,
  EvaluationRecordSummary,
  ProgressSnapshotSummary,
  RequirementProfile,
  SubjectCoverageSummary,
} from "@/lib/compliance/types";

export type OutcomeStatus = "completed" | "partial" | "skipped";
export type MasterySignal = "secure" | "developing" | "emerging" | "needs_review";
export type EvidenceKind = "worksheet" | "photo" | "activity" | "note" | "audio";
export type ObservationTone = "bright_spot" | "watch" | "adjustment";
export type ReviewQueueState =
  | "awaiting_review"
  | "approved"
  | "revision_requested"
  | "insufficient_evidence"
  | "closed";
export type RecommendationState = "proposed" | "accepted" | "dismissed" | "applied";

export interface TrackingLearnerSummary {
  id: string;
  name: string;
  gradeLabel: string;
  reportingWindow: string;
}

export interface TrackingComplianceProgram {
  id: string;
  schoolYearLabel: string;
  startDate: string;
  endDate: string;
  jurisdictionCode: string;
  jurisdictionLabel: string;
  pathwayCode: string;
  pathwayLabel: string;
  gradeBand: ComplianceGradeBand;
  status: string;
  framingNote: string;
}

export interface TrackingOutcome {
  id: string;
  date: string;
  title: string;
  subject: string;
  plannedMinutes: number;
  actualMinutes: number;
  status: OutcomeStatus;
  mastery: MasterySignal;
  standards: string[];
  goals: string[];
  deviationNote?: string;
  evidenceCount: number;
}

export interface ObservationEntry {
  id: string;
  date: string;
  title: string;
  tone: ObservationTone;
  body: string;
  linkedOutcomeId?: string;
}

export interface EvaluationEntry {
  id: string;
  date: string;
  title: string;
  level: LessonEvaluationLevel;
  note: string;
}

export interface EvidenceRecord {
  id: string;
  title: string;
  kind: EvidenceKind;
  linkedTo: string;
  capturedAt: string;
  note: string;
  portfolioStatus: string;
  portfolioArtifactKind: string | null;
  portfolioSubjectKey?: string | null;
  portfolioPeriodLabel?: string | null;
  storagePath?: string | null;
}

export interface StandardCoverageRow {
  id: string;
  code: string;
  label: string;
  subject: string;
  status: "covered" | "in_progress" | "gap";
  evidenceCount: number;
  latestEvidence: string;
}

export interface GoalProgressRow {
  id: string;
  title: string;
  subject: string;
  progressLabel: string;
  nextMove: string;
  linkedStandards: string[];
}

export interface ReviewQueueEntry {
  id: string;
  subjectType: string;
  state: ReviewQueueState;
  dueAt?: string;
  decisionSummary?: string;
}

export interface AdaptationRecommendation {
  id: string;
  title: string;
  description: string;
  status: RecommendationState;
  recommendationType: string;
}

export interface TrackingSummary {
  plannedMinutes: number;
  actualMinutes: number;
  completionRate: number;
  secureCount: number;
  needsAttentionCount: number;
}

export interface TrackingCurriculumContext {
  sourceId: string;
  sourceTitle: string;
  selectionReason: string;
  weekStartDate?: string;
  scheduledItemCount: number;
  totalNodeCount: number;
  totalSkillCount: number;
}

export interface TrackingDashboard {
  learner: TrackingLearnerSummary;
  curriculum: TrackingCurriculumContext | null;
  program: TrackingComplianceProgram | null;
  requirementProfile: RequirementProfile | null;
  summary: TrackingSummary;
  attendance: {
    summary: AttendanceProgressSummary;
    records: AttendanceLedgerEntry[];
  };
  outcomes: TrackingOutcome[];
  observations: ObservationEntry[];
  evaluations: EvaluationEntry[];
  progressSnapshots: ProgressSnapshotSummary[];
  evaluationRecords: EvaluationRecordSummary[];
  evidence: EvidenceRecord[];
  portfolioSavedCount: number;
  subjectCoverage: SubjectCoverageSummary[];
  standards: StandardCoverageRow[];
  goals: GoalProgressRow[];
  complianceTasks: ComplianceTaskSummary[];
  reportDrafts: ComplianceReportDraftSummary[];
  reviewQueue: ReviewQueueEntry[];
  recommendations: AdaptationRecommendation[];
}

export interface TrackingExportRow {
  date: string;
  lesson: string;
  subject: string;
  status: OutcomeStatus;
  plannedMinutes: number;
  actualMinutes: number;
  mastery: MasterySignal;
  standards: string;
  goals: string;
  deviationNote: string;
}

export interface StandardsExportRow {
  code: string;
  status: string;
  subject: string;
  evidenceCount: number;
  latestEvidence: string;
}
