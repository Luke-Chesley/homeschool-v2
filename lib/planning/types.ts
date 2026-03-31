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
  curriculum?: {
    sourceId: string;
    skillNodeId: string;
    weeklyRouteItemId: string;
    origin: PlanItemOrigin;
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
}
