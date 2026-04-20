import "@/lib/server-only";

import { and, desc, eq } from "drizzle-orm";

import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import {
  evidenceRecords,
  feedbackEntries,
  planItemStandards,
  progressRecordStandards,
  progressRecords,
  reviewQueueItems,
} from "@/lib/db/schema";
import {
  getLessonEvaluationLabel,
  getLessonEvaluationRating,
  type LessonEvaluationLevel,
} from "@/lib/session-workspace/evaluation";

type CompletionStatus =
  | "completed_as_planned"
  | "partially_completed"
  | "skipped"
  | "needs_review"
  | "needs_follow_up";

function mapCompletionToLessonStatus(completionStatus: CompletionStatus) {
  if (completionStatus === "skipped") {
    return "abandoned" as const;
  }

  return "completed" as const;
}

function mapCompletionToProgressStatus(completionStatus: CompletionStatus) {
  switch (completionStatus) {
    case "completed_as_planned":
      return "completed" as const;
    case "partially_completed":
      return "in_progress" as const;
    case "skipped":
      return "not_started" as const;
    case "needs_review":
    case "needs_follow_up":
      return "needs_review" as const;
  }
}

function mapCompletionToReviewState(params: {
  completionStatus: CompletionStatus;
  reviewRequired?: boolean;
}) {
  if (params.reviewRequired) {
    return "awaiting_review" as const;
  }

  if (
    params.completionStatus === "needs_review" ||
    params.completionStatus === "needs_follow_up"
  ) {
    return "awaiting_review" as const;
  }

  return "not_required" as const;
}

function buildProgressValue(completionStatus: CompletionStatus) {
  switch (completionStatus) {
    case "completed_as_planned":
      return 100;
    case "partially_completed":
      return 50;
    case "skipped":
      return 0;
    case "needs_review":
    case "needs_follow_up":
      return 75;
  }
}

export async function ensureSessionWorkspace(params: {
  organizationId: string;
  learnerId: string;
  planId: string | null;
  planDayId: string | null;
  planDaySlotId?: string | null;
  planItemId: string;
  sessionDate: string;
  scheduledMinutes?: number | null;
  reviewRequired?: boolean;
  workspaceType?: "homeschool_day" | "classroom_block" | "bootcamp_lab" | "onboarding_session" | "self_guided_queue";
  metadata?: Record<string, unknown>;
}) {
  const repos = createRepositories(getDb());

  return repos.planning.upsertLessonSession({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    planId: params.planId,
    planDayId: params.planDayId,
    planDaySlotId: params.planDaySlotId ?? null,
    planItemId: params.planItemId,
    sessionDate: params.sessionDate,
    workspaceType: params.workspaceType ?? "homeschool_day",
    status: "planned",
    completionStatus: "not_started",
    reviewState: params.reviewRequired ? "awaiting_review" : "not_required",
    reviewRequired: params.reviewRequired ?? false,
    scheduledMinutes: params.scheduledMinutes ?? null,
    actualMinutes: null,
    startedAt: null,
    completedAt: null,
    reviewedAt: null,
    reviewedByAdultUserId: null,
    summary: null,
    notes: null,
    retrospective: null,
    nextAction: null,
    deviationReason: null,
    metadata: params.metadata ?? {},
  });
}

export async function completeSessionWorkspace(params: {
  organizationId: string;
  learnerId: string;
  planId: string | null;
  planDayId: string | null;
  planDaySlotId?: string | null;
  planItemId: string;
  sessionDate: string;
  scheduledMinutes?: number | null;
  actualMinutes?: number | null;
  completionStatus: CompletionStatus;
  summary?: string | null;
  notes?: string | null;
  retrospective?: string | null;
  nextAction?: string | null;
  deviationReason?: string | null;
  reviewRequired?: boolean;
  reviewerAdultUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  const repos = createRepositories(db);
  const now = new Date();
  const reviewState = mapCompletionToReviewState({
    completionStatus: params.completionStatus,
    reviewRequired: params.reviewRequired,
  });

  const session = await ensureSessionWorkspace({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    planId: params.planId,
    planDayId: params.planDayId,
    planDaySlotId: params.planDaySlotId ?? null,
    planItemId: params.planItemId,
    sessionDate: params.sessionDate,
    scheduledMinutes: params.scheduledMinutes,
    reviewRequired: params.reviewRequired,
    metadata: params.metadata,
  });

  const updatedSession = await repos.planning.updateLessonSession(session.id, {
    status: mapCompletionToLessonStatus(params.completionStatus),
    completionStatus: params.completionStatus,
    reviewState,
    reviewRequired: params.reviewRequired ?? false,
    reviewedByAdultUserId: params.reviewerAdultUserId ?? null,
    actualMinutes: params.actualMinutes ?? params.scheduledMinutes ?? null,
    completedAt: now,
    summary: params.summary ?? null,
    notes: params.notes ?? null,
    retrospective: params.retrospective ?? null,
    nextAction: params.nextAction ?? null,
    deviationReason: params.deviationReason ?? null,
    metadata: {
      ...(session.metadata ?? {}),
      ...(params.metadata ?? {}),
      completionSource: "session-workspace-service",
    },
  });

  if (!updatedSession) {
    throw new Error(`Session workspace not found after upsert: ${session.id}`);
  }

  const existingProgress = await db.query.progressRecords.findFirst({
    where: and(
      eq(progressRecords.lessonSessionId, updatedSession.id),
      eq(progressRecords.planItemId, params.planItemId),
    ),
    orderBy: [desc(progressRecords.createdAt)],
  });

  const progressRecord =
    existingProgress ??
    (await repos.tracking.createProgressRecord({
      learnerId: params.learnerId,
      planItemId: params.planItemId,
      lessonSessionId: updatedSession.id,
      activityAttemptId: null,
      status: mapCompletionToProgressStatus(params.completionStatus),
      progressModel: "percent_completion",
      progressValue: buildProgressValue(params.completionStatus),
      reviewState,
      masteryLevel:
        params.completionStatus === "completed_as_planned" ? "developing" : null,
      completionPercent: buildProgressValue(params.completionStatus),
      timeSpentMinutes: params.actualMinutes ?? params.scheduledMinutes ?? null,
      parentNote: params.notes ?? null,
      metadata: {
        source: "session_completion",
        summary: params.summary ?? null,
        retrospective: params.retrospective ?? null,
        nextAction: params.nextAction ?? null,
      },
    }));

  const linkedStandards = await db.query.planItemStandards.findMany({
    where: eq(planItemStandards.planItemId, params.planItemId),
  });

  if (existingProgress == null && linkedStandards.length > 0) {
    for (const link of linkedStandards) {
      await repos.tracking.attachStandard({
        progressRecordId: progressRecord.id,
        standardNodeId: link.standardNodeId,
        metadata: {
          source: "plan_item_standard",
        },
      });
    }
  }

  const existingEvidence = await db.query.evidenceRecords.findFirst({
    where: eq(evidenceRecords.lessonSessionId, updatedSession.id),
    orderBy: [desc(evidenceRecords.createdAt)],
  });

  const evidenceRecord =
    existingEvidence ??
    (await repos.tracking.createEvidenceRecord({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      lessonSessionId: updatedSession.id,
      planItemId: params.planItemId,
      activityAttemptId: null,
      progressRecordId: progressRecord.id,
      artifactId: null,
      evidenceType: "note",
      reviewState: reviewState === "awaiting_review" ? "awaiting_review" : "submitted",
      title: params.summary ?? "Session evidence",
      body: [params.summary, params.notes, params.retrospective].filter(Boolean).join("\n\n") || null,
      storagePath: null,
      audience: "shared",
      createdByAdultUserId: null,
      metadata: {
        source: "session_completion",
      },
    }));

  if (existingEvidence == null && linkedStandards.length > 0) {
    for (const link of linkedStandards) {
      await repos.tracking.attachObjectiveToEvidence({
        evidenceRecordId: evidenceRecord.id,
        standardNodeId: link.standardNodeId,
        metadata: {
          source: "plan_item_standard",
        },
      });
    }
  }

  if (params.summary || params.notes || params.retrospective) {
    await repos.tracking.createFeedbackEntry({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      authorAdultUserId: null,
      lessonSessionId: updatedSession.id,
      planItemId: params.planItemId,
      activityAttemptId: null,
      progressRecordId: progressRecord.id,
      evidenceRecordId: evidenceRecord.id,
      artifactId: null,
      scopeType: "session",
      feedbackType: reviewState === "awaiting_review" ? "coaching" : "narrative",
      rating: null,
      body: [params.summary, params.notes, params.retrospective].filter(Boolean).join("\n\n"),
      actionItems: {
        nextAction: params.nextAction ?? null,
      },
      visibility: "shared",
      metadata: {
        source: "session_completion",
      },
    });
  }

  let reviewQueueItem = await db.query.reviewQueueItems.findFirst({
    where: and(
      eq(reviewQueueItems.subjectType, "session"),
      eq(reviewQueueItems.subjectId, updatedSession.id),
    ),
    orderBy: [desc(reviewQueueItems.createdAt)],
  });

  if (!reviewQueueItem && reviewState === "awaiting_review") {
    reviewQueueItem = await repos.tracking.enqueueReviewItem({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      subjectType: "session",
      subjectId: updatedSession.id,
      state: "awaiting_review",
      assignedAdultUserId: params.reviewerAdultUserId ?? null,
      decisionSummary: null,
      dueAt: null,
      resolvedAt: null,
      metadata: {
        source: "session_completion",
      },
    });
  }

  return {
    session: updatedSession,
    progressRecord,
    evidenceRecord,
    reviewQueueItem: reviewQueueItem ?? null,
  };
}

export async function recordSessionEvaluation(params: {
  organizationId: string;
  learnerId: string;
  planItemId: string;
  lessonSessionId: string;
  evaluationLevel: LessonEvaluationLevel;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const repos = createRepositories(getDb());
  const now = new Date();
  const evaluationLabel = getLessonEvaluationLabel(params.evaluationLevel);
  const rating = getLessonEvaluationRating(params.evaluationLevel);
  const body = params.note?.trim() || evaluationLabel;

  const feedbackEntry = await repos.tracking.createFeedbackEntry({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    authorAdultUserId: null,
    lessonSessionId: params.lessonSessionId,
    planItemId: params.planItemId,
    activityAttemptId: null,
    progressRecordId: null,
    evidenceRecordId: null,
    artifactId: null,
    scopeType: "session",
    feedbackType: "rubric",
    rating,
    body,
    visibility: "shared",
    metadata: {
      source: "lesson_evaluation",
      evaluationLevel: params.evaluationLevel,
      evaluationLabel,
      note: params.note?.trim() || null,
      ...(params.metadata ?? {}),
    },
  });

  return {
    feedbackEntry,
    createdAt: now.toISOString(),
    evaluationLevel: params.evaluationLevel,
    evaluationLabel,
    rating,
    note: params.note?.trim() || null,
  };
}
