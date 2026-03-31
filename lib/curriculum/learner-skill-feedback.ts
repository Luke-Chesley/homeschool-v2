import { learnerSkillStateStatusEnum, progressRecordStatusEnum } from "@/lib/db/schema";

const STRONG_MASTERY_SCORE_PERCENT = 85;
const REVIEW_SCORE_PERCENT = 60;
const FEEDBACK_VERSION = 1;

type LearnerSkillStateStatus = (typeof learnerSkillStateStatusEnum.enumValues)[number];
type ProgressRecordStatus = (typeof progressRecordStatusEnum.enumValues)[number];

export type MasterySignal = "strong" | "proficient" | "weak" | "unknown";

export type RecommendationKind =
  | "none"
  | "advance"
  | "review"
  | "reteach"
  | "finish_scheduled_first"
  | "repair_sequence";

export interface LearnerSkillStateSnapshot {
  status: LearnerSkillStateStatus;
  firstScheduledAt: Date | null;
  lastScheduledAt: Date | null;
  completedAt: Date | null;
  masteredAt: Date | null;
}

export interface CurriculumOutcomeLinkage {
  sourceId: string;
  skillNodeId: string;
  planItemId: string | null;
  weeklyRouteItemId: string | null;
  origin: "plan_item_curriculum_link";
}

export interface OutcomeFeedbackDecision {
  status: LearnerSkillStateStatus;
  statusReason: string;
  masterySignal: MasterySignal;
  recommendation: RecommendationKind;
  recommendationReason: string;
}

export interface ApplyOutcomeFeedbackInput {
  currentState: LearnerSkillStateSnapshot | null;
  completedAt: Date;
  attemptId: string;
  progressRecordId: string;
  scorePercent: number | null;
  unfinishedScheduledCount: number;
  linkage: CurriculumOutcomeLinkage;
}

export interface OutcomeFeedbackSummary {
  // Downstream route-generation contract: this summary captures deterministic
  // recommendation inputs tied to the latest attempt.
  schemaVersion: number;
  attemptId: string;
  progressRecordId: string;
  scorePercent: number | null;
  masterySignal: MasterySignal;
  recommendation: RecommendationKind;
  recommendationReason: string;
  unfinishedScheduledCount: number;
  linkage: CurriculumOutcomeLinkage;
  completedAt: string;
}

export type OutcomeFeedbackSummaryRecord = OutcomeFeedbackSummary & Record<string, unknown>;

export interface LearnerSkillStateUpdateFromOutcome {
  // Downstream route-generation contract:
  // - status drives queue placement (scheduled/in_progress/recommended/mastered)
  // - statusReason disambiguates review vs reteach intent
  // - completedAt/masteredAt preserve completion vs mastery as separate signals
  status: LearnerSkillStateStatus;
  statusReason: string;
  firstScheduledAt: Date | null;
  lastScheduledAt: Date | null;
  completedAt: Date;
  masteredAt: Date | null;
  lastActivityAttemptId: string;
  lastOutcomeSummary: OutcomeFeedbackSummaryRecord;
}

export interface ProgressOutcomeClassification {
  progressStatus: ProgressRecordStatus;
  masteryLevel: "secure" | "developing" | "needs_review" | null;
  masterySignal: MasterySignal;
}

export interface ScheduledTransitionResult {
  status: LearnerSkillStateStatus;
  statusReason: string;
  firstScheduledAt: Date;
  lastScheduledAt: Date;
  completedAt: Date | null;
  masteredAt: Date | null;
}

export interface InProgressTransitionResult {
  status: LearnerSkillStateStatus;
  statusReason: string;
  firstScheduledAt: Date | null;
  lastScheduledAt: Date | null;
  completedAt: Date | null;
  masteredAt: Date | null;
}

export interface RecommendationAdaptationInputs {
  learnerId: string;
  sourceId: string;
  preferUnfinishedScheduled: boolean;
  unfinishedScheduledSkillNodeIds: string[];
  outOfSequenceSkillNodeIds: string[];
  reteachSkillNodeIds: string[];
  reviewSkillNodeIds: string[];
  blockedSkillNodeIds: string[];
  skippedSkillNodeIds: string[];
  prioritySkillNodeIds: string[];
}

function mapMasterySignal(scorePercent: number | null): MasterySignal {
  if (scorePercent == null) {
    return "unknown";
  }

  if (scorePercent >= STRONG_MASTERY_SCORE_PERCENT) {
    return "strong";
  }

  if (scorePercent >= REVIEW_SCORE_PERCENT) {
    return "proficient";
  }

  return "weak";
}

function decideRecommendation(hasUnfinishedScheduled: boolean, fallback: RecommendationKind) {
  if (hasUnfinishedScheduled) {
    return "finish_scheduled_first" as const;
  }

  return fallback;
}

function isReteachReason(statusReason: string | null) {
  return statusReason?.includes("reteach") ?? false;
}

function isReviewReason(statusReason: string | null) {
  return statusReason?.includes("review") ?? false;
}

function sortByDateAscending<T extends { lastScheduledAt?: Date | null; updatedAt?: Date | null }>(
  rows: T[],
) {
  return [...rows].sort((left, right) => {
    const leftDate = left.lastScheduledAt ?? left.updatedAt ?? null;
    const rightDate = right.lastScheduledAt ?? right.updatedAt ?? null;
    const leftTime = leftDate ? leftDate.getTime() : 0;
    const rightTime = rightDate ? rightDate.getTime() : 0;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return 0;
  });
}

export function classifyProgressOutcome(scorePercent: number | null): ProgressOutcomeClassification {
  const masterySignal = mapMasterySignal(scorePercent);
  if (masterySignal === "strong") {
    return {
      progressStatus: "mastered",
      masteryLevel: "secure",
      masterySignal,
    };
  }

  if (masterySignal === "proficient") {
    return {
      progressStatus: "completed",
      masteryLevel: "developing",
      masterySignal,
    };
  }

  if (masterySignal === "weak") {
    return {
      progressStatus: "needs_review",
      masteryLevel: "needs_review",
      masterySignal,
    };
  }

  return {
    progressStatus: "completed",
    masteryLevel: null,
    masterySignal,
  };
}

export function applyScheduledTransition(
  currentState: LearnerSkillStateSnapshot | null,
  scheduledAt: Date,
): ScheduledTransitionResult {
  return {
    status: "scheduled",
    statusReason: "scheduled_from_route_assignment",
    firstScheduledAt: currentState?.firstScheduledAt ?? scheduledAt,
    lastScheduledAt: scheduledAt,
    completedAt: currentState?.completedAt ?? null,
    masteredAt: currentState?.masteredAt ?? null,
  };
}

export function applyInProgressTransition(
  currentState: LearnerSkillStateSnapshot | null,
): InProgressTransitionResult {
  return {
    status: "in_progress",
    statusReason: "attempt_started",
    firstScheduledAt: currentState?.firstScheduledAt ?? null,
    lastScheduledAt: currentState?.lastScheduledAt ?? null,
    completedAt: currentState?.completedAt ?? null,
    masteredAt: currentState?.masteredAt ?? null,
  };
}

export function evaluateOutcomeFeedbackDecision(
  currentStatus: LearnerSkillStateStatus | null,
  masterySignal: MasterySignal,
  hasUnfinishedScheduled: boolean,
): OutcomeFeedbackDecision {
  if (currentStatus === "out_of_sequence") {
    return {
      status: "out_of_sequence",
      statusReason: "out_of_sequence_completed_requires_repair",
      masterySignal,
      recommendation: decideRecommendation(hasUnfinishedScheduled, "repair_sequence"),
      recommendationReason: hasUnfinishedScheduled
        ? "unfinished_scheduled_work_exists"
        : "repair_out_of_sequence_state_before_advancement",
    };
  }

  if (currentStatus === "mastered") {
    const needsReview = masterySignal === "weak" || masterySignal === "proficient";
    return {
      status: "mastered",
      statusReason: needsReview ? "mastered_with_review_watch" : "mastery_confirmed_from_outcome",
      masterySignal,
      recommendation: decideRecommendation(hasUnfinishedScheduled, needsReview ? "review" : "advance"),
      recommendationReason: hasUnfinishedScheduled
        ? "unfinished_scheduled_work_exists"
        : needsReview
          ? "recent_outcome_below_mastery_threshold"
          : "strong_mastery_signal",
    };
  }

  if (masterySignal === "strong") {
    return {
      status: "mastered",
      statusReason: "mastery_confirmed_from_outcome",
      masterySignal,
      recommendation: decideRecommendation(hasUnfinishedScheduled, "advance"),
      recommendationReason: hasUnfinishedScheduled
        ? "unfinished_scheduled_work_exists"
        : "strong_mastery_signal",
    };
  }

  if (masterySignal === "proficient") {
    return {
      status: "recommended",
      statusReason: "completion_recorded_review_recommended",
      masterySignal,
      recommendation: decideRecommendation(hasUnfinishedScheduled, "review"),
      recommendationReason: hasUnfinishedScheduled
        ? "unfinished_scheduled_work_exists"
        : "outcome_in_review_band",
    };
  }

  if (masterySignal === "weak") {
    return {
      status: "recommended",
      statusReason: "completion_recorded_reteach_recommended",
      masterySignal,
      recommendation: decideRecommendation(hasUnfinishedScheduled, "reteach"),
      recommendationReason: hasUnfinishedScheduled
        ? "unfinished_scheduled_work_exists"
        : "outcome_below_review_band",
    };
  }

  return {
    status: "completed",
    statusReason: "completion_recorded_without_mastery_signal",
    masterySignal,
    recommendation: decideRecommendation(hasUnfinishedScheduled, "none"),
    recommendationReason: hasUnfinishedScheduled
      ? "unfinished_scheduled_work_exists"
      : "no_numeric_outcome_available",
  };
}

export function applyOutcomeFeedbackToSkillState(
  input: ApplyOutcomeFeedbackInput,
): LearnerSkillStateUpdateFromOutcome {
  const masterySignal = mapMasterySignal(input.scorePercent);
  const decision = evaluateOutcomeFeedbackDecision(
    input.currentState?.status ?? null,
    masterySignal,
    input.unfinishedScheduledCount > 0,
  );

  const completedAt = input.currentState?.completedAt ?? input.completedAt;
  const masteredAt =
    decision.status === "mastered"
      ? input.currentState?.masteredAt ?? input.completedAt
      : input.currentState?.status === "out_of_sequence" &&
          masterySignal === "strong" &&
          input.currentState.masteredAt == null
        ? input.completedAt
        : input.currentState?.masteredAt ?? null;

  return {
    status: decision.status,
    statusReason: decision.statusReason,
    firstScheduledAt: input.currentState?.firstScheduledAt ?? null,
    lastScheduledAt: input.currentState?.lastScheduledAt ?? null,
    completedAt,
    masteredAt,
    lastActivityAttemptId: input.attemptId,
    lastOutcomeSummary: {
      schemaVersion: FEEDBACK_VERSION,
      attemptId: input.attemptId,
      progressRecordId: input.progressRecordId,
      scorePercent: input.scorePercent,
      masterySignal,
      recommendation: decision.recommendation,
      recommendationReason: decision.recommendationReason,
      unfinishedScheduledCount: input.unfinishedScheduledCount,
      linkage: input.linkage,
      completedAt: input.completedAt.toISOString(),
    },
  };
}

export function buildRecommendationAdaptationInputs(args: {
  learnerId: string;
  sourceId: string;
  states: Array<{
    skillNodeId: string;
    status: LearnerSkillStateStatus;
    statusReason: string | null;
    lastScheduledAt: Date | null;
    updatedAt: Date;
  }>;
}): RecommendationAdaptationInputs {
  const unfinishedScheduledSkillNodeIds = sortByDateAscending(
    args.states.filter((state) => state.status === "scheduled" || state.status === "in_progress"),
  ).map((state) => state.skillNodeId);

  const outOfSequenceSkillNodeIds = sortByDateAscending(
    args.states.filter((state) => state.status === "out_of_sequence"),
  ).map((state) => state.skillNodeId);

  const reteachSkillNodeIds = sortByDateAscending(
    args.states.filter(
      (state) => state.status === "recommended" && isReteachReason(state.statusReason),
    ),
  ).map((state) => state.skillNodeId);

  const reviewSkillNodeIds = sortByDateAscending(
    args.states.filter((state) => state.status === "recommended" && isReviewReason(state.statusReason)),
  ).map((state) => state.skillNodeId);

  const blockedSkillNodeIds = sortByDateAscending(
    args.states.filter((state) => state.status === "blocked"),
  ).map((state) => state.skillNodeId);

  const skippedSkillNodeIds = sortByDateAscending(
    args.states.filter((state) => state.status === "skipped"),
  ).map((state) => state.skillNodeId);

  return {
    learnerId: args.learnerId,
    sourceId: args.sourceId,
    preferUnfinishedScheduled: unfinishedScheduledSkillNodeIds.length > 0,
    unfinishedScheduledSkillNodeIds,
    outOfSequenceSkillNodeIds,
    reteachSkillNodeIds,
    reviewSkillNodeIds,
    blockedSkillNodeIds,
    skippedSkillNodeIds,
    prioritySkillNodeIds: [
      ...unfinishedScheduledSkillNodeIds,
      ...outOfSequenceSkillNodeIds,
      ...reteachSkillNodeIds,
      ...reviewSkillNodeIds,
    ],
  };
}
