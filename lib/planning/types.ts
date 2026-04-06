import type { WeeklyRouteBoardItem } from "@/lib/curriculum-routing/types";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";

export type EnergyLevel = "low" | "steady" | "high";

export type PlanItemKind = "lesson" | "practice" | "project" | "review";

export type PlanItemStatus =
  | "ready"
  | "in_progress"
  | "completed"
  | "blocked"
  | "carried_over";

export type PlanItemOrigin = "manual" | "curriculum_route" | "recovery" | "review";

export type WeeklyRouteItemState =
  | "queued"
  | "scheduled"
  | "in_progress"
  | "done"
  | "removed";

export type WeeklyRouteOverrideKind =
  | "none"
  | "reordered"
  | "pinned"
  | "deferred"
  | "skip_acknowledged";

export type PlanningActionKind =
  | "reschedule"
  | "compress"
  | "expand"
  | "recover";

export type DayLoad = "light" | "balanced" | "packed";

export interface LearnerSummary {
  id: string;
  name: string;
  gradeLabel: string;
  pacingPreference: string;
  currentSeason: string;
}

export interface ScheduleConstraint {
  date: string;
  availableMinutes: number;
  hardStop: string;
  energy: EnergyLevel;
  notes: string;
  flags: string[];
}

export interface PlanItem {
  id: string;
  date: string;
  ordering?: number;
  startTime?: string;
  title: string;
  subject: string;
  kind: PlanItemKind;
  objective: string;
  estimatedMinutes: number;
  status: PlanItemStatus;
  standards: string[];
  goals: string[];
  materials: string[];
  artifactSlots: string[];
  copilotPrompts: string[];
  sourceLabel: string;
  lessonLabel: string;
  planOrigin?: PlanItemOrigin;
  planRecordId?: string;
  sessionRecordId?: string;
  reviewState?: string;
  completionStatus?: string;
  curriculum?: {
    sourceId: string;
    skillNodeId: string;
    weeklyRouteItemId: string;
    origin: PlanItemOrigin;
  };
  workflow?: {
    planItemId: string;
    lessonSessionId: string | null;
    completionStatus: string | null;
    reviewState: string | null;
    evidenceCount: number;
    activityCount: number;
  };
  note?: string;
}

export interface WeeklyRouteItem {
  id: string;
  weeklyRouteId: string;
  sourceId: string;
  skillNodeId: string;
  skillTitle: string;
  skillDescription?: string;
  subject: string;
  estimatedMinutes: number;
  recommendedPosition: number;
  currentPosition: number;
  scheduledDate?: string;
  manualOverrideKind: WeeklyRouteOverrideKind;
  state: WeeklyRouteItemState;
}

export interface RecoveryAction {
  type: PlanningActionKind;
  itemIds: string[];
  targetDate?: string;
  minutesDelta?: number;
}

export interface RecoveryOption {
  id: string;
  title: string;
  rationale: string;
  impact: string;
  actionLabel: string;
  action: RecoveryAction;
}

export interface PlanDay {
  date: string;
  label: string;
  focus: string;
  availableMinutes: number;
  scheduledMinutes: number;
  bufferMinutes: number;
  load: DayLoad;
  constraint: ScheduleConstraint;
  items: PlanItem[];
  selectableRouteItems: WeeklyRouteItem[];
  carryoverItems: PlanItem[];
  recoveryOptions: RecoveryOption[];
  alerts: string[];
}

export interface WeeklyPlanSummary {
  scheduledMinutes: number;
  availableMinutes: number;
  bufferMinutes: number;
  carryoverCount: number;
  recoveryCount: number;
}

export interface WeeklyPlan {
  weekOf: string;
  weekLabel: string;
  learner: LearnerSummary;
  days: PlanDay[];
  standardsFocus: string[];
  goalsFocus: string[];
  summary: WeeklyPlanSummary;
}

export interface MonthlyPlanDay {
  date: string;
  label: string;
  shortLabel: string;
  dayNumber: number;
  inMonth: boolean;
  isWeekend: boolean;
  isDroppable: boolean;
  weekStartDate: string;
  weeklyRouteId: string;
  items: WeeklyRouteBoardItem[];
  scheduledMinutes: number;
}

export interface MonthlyPlanWeek {
  weekStartDate: string;
  weekLabel: string;
  weeklyRouteId: string;
  days: MonthlyPlanDay[];
  unassignedItems: WeeklyRouteBoardItem[];
  scheduledMinutes: number;
  scheduledCount: number;
  overrideCount: number;
  conflictCount: number;
}

export interface MonthlyPlanSummary {
  weeksInView: number;
  daysInMonth: number;
  scheduledMinutes: number;
  scheduledCount: number;
  unassignedCount: number;
  overrideCount: number;
  conflictCount: number;
}

export interface MonthlyPlan {
  monthStartDate: string;
  monthLabel: string;
  learner: LearnerSummary;
  sourceId: string;
  sourceTitle: string;
  weeks: MonthlyPlanWeek[];
  summary: MonthlyPlanSummary;
}

export interface RecoveryPreview {
  openCount: number;
  nextBestMove: string;
  options: RecoveryOption[];
}

export interface DailyWorkspaceArtifactSlot {
  label: string;
  status: "open" | "suggested" | "waiting";
  description: string;
}

export interface DailyWorkspaceLessonDraft {
  /** Structured lesson draft (schema_version "1.0"). Present for new drafts. */
  structured?: StructuredLessonDraft;
  /** Legacy markdown string. Present for drafts generated before v2.0.0. */
  markdown?: string;
  sourceId: string;
  sourceTitle: string;
  routeFingerprint: string;
  promptVersion?: string;
  savedAt: string;
}

export interface DailyWorkspace {
  date: string;
  headline: string;
  learner: LearnerSummary;
  leadItem: PlanItem;
  items: PlanItem[];
  prepChecklist: string[];
  sessionTargets: string[];
  artifactSlots: DailyWorkspaceArtifactSlot[];
  copilotInsertions: string[];
  completionPrompts: string[];
  familyNotes: string[];
  recoveryOptions: RecoveryOption[];
  alternatesByPlanItemId: Record<string, WeeklyRouteItem[]>;
  lessonDraft: DailyWorkspaceLessonDraft | null;
}
