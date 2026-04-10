import "@/lib/server-only";

import type { ActivityComponentFeedback, RequestActivityComponentFeedback } from "./feedback";
import type { RequestActivityComponentTransition } from "./widget-transition";
import { getAttemptStore } from "./attempt-store";
import type { ActivityAttempt, ActivityOutcome, ActivitySession, AttemptAnswer } from "./types";
import { parseActivityDefinition } from "./types";
import { parseActivitySpec, isActivitySpec, ActivitySpecSchema } from "./spec";
import { ensurePublishedActivitiesForLearner } from "./assignment-service";
import { requestLearningCoreActivityFeedback } from "@/lib/learning-core/activity-feedback";
import { requestLearningCoreWidgetTransition } from "@/lib/learning-core/widget-transition";
import {
  applyOutcomeFeedbackToSkillState,
  classifyProgressOutcome,
  type CurriculumOutcomeLinkage,
} from "@/lib/curriculum/learner-skill-feedback";
import { createRepositories } from "@/lib/db";
import { LOCAL_DEMO_LEARNER_ID, ensureLocalDemoData } from "@/lib/db/fixtures/local-demo-persistence";
import { getDb } from "@/lib/db/server";

function getActivitiesRepo() {
  return createRepositories(getDb()).activities;
}

function getTrackingRepos() {
  const repos = createRepositories(getDb());
  return {
    activities: repos.activities,
    copilot: repos.copilot,
    curriculumRouting: repos.curriculumRouting,
    planning: repos.planning,
    standards: repos.standards,
    tracking: repos.tracking,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAttemptStatus(
  status: "in_progress" | "submitted" | "graded" | "abandoned",
): ActivityAttempt["status"] {
  if (status === "graded") {
    return "graded";
  }

  if (status === "abandoned") {
    return "submitted";
  }

  return status;
}

function mergeAttemptStatus(
  session: ActivitySession,
  attempt: ActivityAttempt | undefined,
): ActivitySession {
  if (!attempt) {
    return session;
  }

  if (attempt.status === "in_progress") {
    return {
      ...session,
      status: "in_progress",
      startedAt: attempt.startedAt,
    };
  }

  if (attempt.status === "submitted" || attempt.status === "graded") {
    return {
      ...session,
      status: "completed",
      startedAt: attempt.startedAt,
      completedAt: attempt.submittedAt,
    };
  }

  return session;
}

function getAttemptSessionId(attemptMetadata: unknown, fallback: string) {
  if (
    typeof attemptMetadata === "object" &&
    attemptMetadata !== null &&
    !Array.isArray(attemptMetadata) &&
    typeof (attemptMetadata as Record<string, unknown>).sessionId === "string"
  ) {
    return (attemptMetadata as Record<string, string>).sessionId;
  }

  return fallback;
}

function getActivitySessionId(activity: {
  id: string;
  metadata: Record<string, unknown>;
}) {
  if (typeof activity.metadata.sessionId === "string") {
    return activity.metadata.sessionId;
  }

  return activity.id;
}

function getActivityStandardIds(activity: {
  metadata: Record<string, unknown>;
}) {
  const value = activity.metadata.standardIds;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapActivityToSession(activity: {
  id: string;
  learnerId: string | null;
  lessonSessionId: string | null;
  definition: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): ActivitySession | null {
  // v2 ActivitySpec (schemaVersion "2") takes precedence
  if (isActivitySpec(activity.definition)) {
    const spec = parseActivitySpec(activity.definition);
    if (!spec) {
      const result = ActivitySpecSchema.safeParse(activity.definition);
      if (!result.success) {
        console.error("[mapActivityToSession] ActivitySpec parse failed for activity", activity.id, ":", JSON.stringify(result.error.issues.slice(0, 5)));
      }
      return null;
    }
    return {
      id: getActivitySessionId(activity),
      learnerId: activity.learnerId ?? LOCAL_DEMO_LEARNER_ID,
      activityId: activity.id,
      // Wrap the ActivitySpec in a definition-compatible shape for the session
      // The ActivitySpecRenderer handles rendering; the definition is passed through
      definition: spec as unknown as ActivitySession["definition"],
      status: "not_started",
      estimatedMinutes: spec.estimatedMinutes,
      lessonId:
        activity.lessonSessionId ??
        (typeof activity.metadata.lessonId === "string" ? activity.metadata.lessonId : undefined),
      standardIds: getActivityStandardIds(activity),
    };
  }

  // v1 legacy definition (quiz, flashcards, guided_practice, etc.)
  const definition = parseActivityDefinition(activity.definition);
  if (!definition) {
    return null;
  }

  return {
    id: getActivitySessionId(activity),
    learnerId: activity.learnerId ?? LOCAL_DEMO_LEARNER_ID,
    activityId: activity.id,
    definition,
    status: "not_started",
    estimatedMinutes:
      typeof activity.metadata.estimatedMinutes === "number"
        ? activity.metadata.estimatedMinutes
        : undefined,
    lessonId:
      activity.lessonSessionId ??
      (typeof activity.metadata.lessonId === "string" ? activity.metadata.lessonId : undefined),
    standardIds: getActivityStandardIds(activity),
  };
}

function toScorePercent(score: number | undefined) {
  return typeof score === "number" ? Math.round(score * 100) : null;
}

function toOutcomeCompletedAt(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

type RecommendationSummary = {
  recommendationType:
    | "advance"
    | "review"
    | "reteach"
    | "finish_scheduled_first"
    | "repair_sequence"
    | "none";
  title: string;
  description: string;
};

function shouldPersistRecommendation(recommendation: RecommendationSummary["recommendationType"]) {
  return recommendation !== "advance" && recommendation !== "none";
}

function buildRecommendationSummary(params: {
  learnerName: string;
  activityTitle: string;
  recommendation: RecommendationSummary["recommendationType"];
}): RecommendationSummary {
  switch (params.recommendation) {
    case "review":
      return {
        recommendationType: "review",
        title: `Queue a review checkpoint for ${params.learnerName}`,
        description: `${params.activityTitle} finished in the review band. Keep the next session focused on retrieval, clarification, and another evidence check.`,
      };
    case "reteach":
      return {
        recommendationType: "reteach",
        title: "Re-plan the next session around reteaching",
        description: `${params.activityTitle} came in below the review threshold. Slow the pace, tighten the target, and collect another work sample before advancing.`,
      };
    case "finish_scheduled_first":
      return {
        recommendationType: "finish_scheduled_first",
        title: "Finish scheduled work before adapting the route",
        description: "The latest outcome suggests a change, but there is still scheduled work in flight. Hold the recommendation until the current queue is cleared.",
      };
    case "repair_sequence":
      return {
        recommendationType: "repair_sequence",
        title: "Repair the sequence before moving ahead",
        description: "This outcome was recorded out of sequence. Restore the missing prerequisite work, then decide whether to review or advance.",
      };
    case "advance":
      return {
        recommendationType: "advance",
        title: "Advance to the next objective",
        description: `${params.activityTitle} showed a strong enough signal to move forward.`,
      };
    case "none":
    default:
      return {
        recommendationType: "none",
        title: "No recommendation",
        description: `${params.activityTitle} does not need a separate recommendation record.`,
      };
  }
}

async function ensureAssignedActivities(learnerId: string) {
  await ensureLocalDemoData();

  const existing = await getActivitiesRepo().listPublishedActivitiesForLearner(learnerId);
  if (existing.length > 0) {
    return existing;
  }

  const learner = await getDb().query.learners.findFirst({
    where: (table, { eq }) => eq(table.id, learnerId),
  });

  if (!learner) {
    return existing;
  }

  await ensurePublishedActivitiesForLearner({
    organizationId: learner.organizationId,
    learnerId: learner.id,
    learnerName: learner.displayName,
  });

  return getActivitiesRepo().listPublishedActivitiesForLearner(learnerId);
}

async function resolveCurriculumOutcomeLink(args: {
  activityId: string;
  repos: ReturnType<typeof getTrackingRepos>;
}): Promise<{ linkage: CurriculumOutcomeLinkage | null; planItemId: string | null }> {
  const activity = await args.repos.activities.findActivityById(args.activityId);
  if (!activity?.planItemId) {
    return {
      linkage: null,
      planItemId: null,
    };
  }

  const link = await args.repos.curriculumRouting.findPlanItemCurriculumLink(activity.planItemId);
  if (!link) {
    return {
      linkage: null,
      planItemId: activity.planItemId,
    };
  }

  return {
    linkage: {
      sourceId: link.sourceId,
      skillNodeId: link.skillNodeId,
      planItemId: link.planItemId,
      weeklyRouteItemId: link.weeklyRouteItemId ?? null,
      origin: "plan_item_curriculum_link",
    },
    planItemId: link.planItemId,
  };
}

export async function listSessions(learnerId: string): Promise<ActivitySession[]> {
  const activities = await ensureAssignedActivities(learnerId);
  const attempts = await getActivitiesRepo().listAttemptsForLearner(learnerId);
  const latestBySession = new Map<string, ActivityAttempt>();

  for (const attempt of attempts) {
    const sessionId = getAttemptSessionId(attempt.metadata, attempt.activityId);
    if (!latestBySession.has(sessionId)) {
      latestBySession.set(sessionId, {
        id: attempt.id,
        sessionId,
        learnerId: attempt.learnerId,
        activityId: attempt.activityId,
        answers:
          typeof attempt.responses === "object" &&
          attempt.responses !== null &&
          !Array.isArray(attempt.responses) &&
          Array.isArray((attempt.responses as Record<string, unknown>).answers)
            ? ((attempt.responses as Record<string, unknown>).answers as AttemptAnswer[])
            : [],
        score:
          typeof attempt.scorePercent === "number" ? attempt.scorePercent / 100 : undefined,
        status: normalizeAttemptStatus(attempt.status),
        startedAt:
          typeof attempt.startedAt === "string"
            ? attempt.startedAt
            : attempt.createdAt.toISOString(),
        submittedAt:
          typeof attempt.submittedAt === "string" ? attempt.submittedAt : undefined,
      });
    }
  }

  return activities
    .map((activity) => mapActivityToSession(activity))
    .filter((session): session is ActivitySession => session != null)
    .map((session) => mergeAttemptStatus(session, latestBySession.get(session.id)));
}

export async function getSession(sessionId: string): Promise<ActivitySession | null> {
  await ensureLocalDemoData();

  const activity =
    (await getActivitiesRepo().findPrimaryActivityForSession(sessionId)) ??
    (await getActivitiesRepo().findActivityBySessionId(sessionId)) ??
    (await getActivitiesRepo().findActivityById(sessionId));

  if (!activity) {
    console.warn("[getSession] No activity found for sessionId:", sessionId);
    return null;
  }

  const session = mapActivityToSession(activity);
  if (!session) {
    // Log details to help diagnose parse failures
    const defKeys = Object.keys(activity.definition ?? {});
    const schemaVer = (activity.definition as Record<string, unknown>)?.schemaVersion;
    console.warn(
      "[getSession] mapActivityToSession returned null for activity:",
      activity.id,
      "| status:", activity.status,
      "| schemaVersion:", schemaVer,
      "| definition keys:", defKeys.slice(0, 8).join(", "),
    );
    return null;
  }

  const attempt = await getAttemptStore().findLatest(sessionId, session.learnerId);
  return mergeAttemptStatus(session, attempt ?? undefined);
}

export async function startOrResumeAttempt(
  sessionId: string,
  learnerId: string,
): Promise<ActivityAttempt> {
  const store = getAttemptStore();
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const existing = await store.findLatest(sessionId, learnerId);
  if (existing) {
    return existing;
  }

  return store.create({
    sessionId,
    learnerId,
    activityId: session.activityId,
  });
}

export async function autosave(
  attemptId: string,
  answers: AttemptAnswer[],
  uiState?: Record<string, unknown>,
): Promise<ActivityAttempt> {
  return getAttemptStore().save(attemptId, answers, uiState);
}

export async function requestActivityComponentFeedback(
  attemptId: string,
  input: RequestActivityComponentFeedback,
  learnerId: string,
): Promise<ActivityComponentFeedback> {
  const attempt = await getAttemptStore().get(attemptId);
  if (!attempt) {
    throw new Error(`Attempt not found: ${attemptId}`);
  }

  if (attempt.learnerId !== learnerId) {
    throw new Error("Attempt does not belong to the active learner.");
  }

  const session = await getSession(attempt.sessionId);
  if (!session || !isActivitySpec(session.definition)) {
    throw new Error("Runtime feedback is only available for structured activity specs.");
  }

  const spec = parseActivitySpec(session.definition);
  if (!spec) {
    throw new Error("Could not parse the activity spec for runtime feedback.");
  }

  const component = spec.components.find((item) => item.id === input.componentId);
  if (!component || component.type !== input.componentType) {
    throw new Error("Requested component feedback for an unknown component.");
  }

  return requestLearningCoreActivityFeedback({
    activityId: session.activityId,
    activitySpec: spec,
    componentId: component.id,
    componentType: component.type,
    widget: component.type === "interactive_widget" ? component.widget : undefined,
    learnerResponse: input.learnerResponse,
    learnerId,
    lessonSessionId: session.lessonId ?? session.id,
    attemptId,
    timeSpentMs: input.timeSpentMs,
  });
}

export async function requestActivityComponentTransition(
  attemptId: string,
  input: RequestActivityComponentTransition,
  learnerId: string,
) {
  const attempt = await getAttemptStore().get(attemptId);
  if (!attempt) {
    throw new Error(`Attempt not found: ${attemptId}`);
  }

  if (attempt.learnerId !== learnerId) {
    throw new Error("Attempt does not belong to the active learner.");
  }

  const session = await getSession(attempt.sessionId);
  if (!session || !isActivitySpec(session.definition)) {
    throw new Error("Widget transitions are only available for structured activity specs.");
  }

  const spec = parseActivitySpec(session.definition);
  if (!spec) {
    throw new Error("Could not parse the activity spec for widget transition.");
  }

  const component = spec.components.find((item) => item.id === input.componentId);
  if (!component || component.type !== input.componentType || component.type !== "interactive_widget") {
    throw new Error("Requested widget transition for an unknown interactive widget component.");
  }

  return requestLearningCoreWidgetTransition({
    activityId: session.activityId,
    componentId: component.id,
    componentType: component.type,
    widget: input.widget,
    learnerAction: input.learnerAction,
    currentResponse: input.currentResponse,
    learnerId,
    lessonSessionId: session.lessonId ?? session.id,
    attemptId,
    timeSpentMs: input.timeSpentMs,
  });
}

export async function submitAttempt(attemptId: string): Promise<ActivityOutcome> {
  const outcome = await getAttemptStore().submit(attemptId);
  await reportOutcome(outcome);
  return outcome;
}

async function reportOutcome(outcome: ActivityOutcome): Promise<void> {
  const repos = getTrackingRepos();
  const existingRecord = await repos.tracking.findProgressByAttemptId(outcome.attemptId);
  if (existingRecord) {
    return;
  }

  const learner = await getDb().query.learners.findFirst({
    where: (table, { eq }) => eq(table.id, outcome.learnerId),
    columns: {
      displayName: true,
      organizationId: true,
    },
  });

  if (!learner) {
    return;
  }

  const [activity, lessonSession] = await Promise.all([
    repos.activities.findActivityById(outcome.activityId),
    outcome.lessonId ? repos.planning.findLessonSessionById(outcome.lessonId) : Promise.resolve(null),
  ]);

  const scorePercent = toScorePercent(outcome.score);
  const completedAt = toOutcomeCompletedAt(outcome.completedAt);
  const progressClassification = classifyProgressOutcome(scorePercent);
  const curriculumLink = await resolveCurriculumOutcomeLink({
    activityId: outcome.activityId,
    repos,
  });

  const progressRecord = await repos.tracking.createProgressRecord({
    learnerId: outcome.learnerId,
    planItemId: curriculumLink.planItemId,
    activityAttemptId: outcome.attemptId,
    lessonSessionId: outcome.lessonId ?? null,
    progressModel: "percent_completion",
    progressValue: scorePercent ?? 100,
    reviewState:
      progressClassification.progressStatus === "needs_review"
        ? "awaiting_review"
        : "not_required",
    status: progressClassification.progressStatus,
    masteryLevel: progressClassification.masteryLevel,
    completionPercent: scorePercent ?? 100,
    timeSpentMinutes:
      typeof outcome.timeSpentMs === "number"
        ? Math.max(1, Math.ceil(outcome.timeSpentMs / 60000))
        : null,
    parentNote: null,
    metadata: {
      source: "activity-submit",
      sessionId: outcome.sessionId,
      activityId: outcome.activityId,
      lessonId: outcome.lessonId ?? null,
      score: outcome.score ?? null,
      standardIds: outcome.standardIds,
      curriculumLink: curriculumLink.linkage,
      masterySignal: progressClassification.masterySignal,
      ...outcome.meta,
    },
  });

  const reviewState =
    progressClassification.progressStatus === "needs_review"
      ? "awaiting_review"
      : "submitted";

  const evidenceRecord = await repos.tracking.createEvidenceRecord({
    organizationId: learner.organizationId,
    learnerId: outcome.learnerId,
    lessonSessionId: outcome.lessonId ?? null,
    planItemId: curriculumLink.planItemId,
    activityAttemptId: outcome.attemptId,
    progressRecordId: progressRecord.id,
    artifactId: null,
    evidenceType: "activity_outcome",
    reviewState,
    title: "Activity outcome",
    body: "Recorded from learner activity completion.",
    storagePath: null,
    audience: "shared",
    createdByAdultUserId: null,
    metadata: {
      source: "activity-submit",
      progressRecordId: progressRecord.id,
      scorePercent,
      masterySignal: progressClassification.masterySignal,
    },
  });

  if (reviewState === "awaiting_review") {
    await repos.tracking.enqueueReviewItem({
      organizationId: learner.organizationId,
      learnerId: outcome.learnerId,
      subjectType: "evidence",
      subjectId: evidenceRecord.id,
      state: "awaiting_review",
      assignedAdultUserId: null,
      decisionSummary: null,
      dueAt: null,
      resolvedAt: null,
      metadata: {
        source: "activity-submit",
        progressRecordId: progressRecord.id,
      },
    });
  }

  if (curriculumLink.linkage) {
    const currentSkillState = await repos.curriculumRouting.findLearnerSkillState(
      outcome.learnerId,
      curriculumLink.linkage.skillNodeId,
    );
    const unfinishedScheduledCount =
      await repos.curriculumRouting.countUnfinishedScheduledSkills({
        learnerId: outcome.learnerId,
        sourceId: curriculumLink.linkage.sourceId,
        excludeSkillNodeId: curriculumLink.linkage.skillNodeId,
      });

    const nextState = applyOutcomeFeedbackToSkillState({
      currentState: currentSkillState
        ? {
            status: currentSkillState.status,
            firstScheduledAt: currentSkillState.firstScheduledAt,
            lastScheduledAt: currentSkillState.lastScheduledAt,
            completedAt: currentSkillState.completedAt,
            masteredAt: currentSkillState.masteredAt,
          }
        : null,
      completedAt,
      attemptId: outcome.attemptId,
      progressRecordId: progressRecord.id,
      scorePercent,
      unfinishedScheduledCount,
      linkage: curriculumLink.linkage,
    });

    await repos.curriculumRouting.upsertLearnerSkillStateSummary({
      learnerId: outcome.learnerId,
      sourceId: curriculumLink.linkage.sourceId,
      skillNodeId: curriculumLink.linkage.skillNodeId,
      status: nextState.status,
      statusReason: nextState.statusReason,
      firstScheduledAt: nextState.firstScheduledAt,
      lastScheduledAt: nextState.lastScheduledAt,
      completedAt: nextState.completedAt,
      masteredAt: nextState.masteredAt,
      lastActivityAttemptId: nextState.lastActivityAttemptId,
      lastOutcomeSummary: nextState.lastOutcomeSummary,
      metadata: {
        source: "activity-submit",
        lastProgressRecordId: progressRecord.id,
        linkageOrigin: curriculumLink.linkage.origin,
      },
    });

    const recommendationSummary = buildRecommendationSummary({
      learnerName: learner.displayName,
      activityTitle: activity?.title ?? "This activity",
      recommendation: nextState.lastOutcomeSummary.recommendation,
    });

    if (shouldPersistRecommendation(recommendationSummary.recommendationType)) {
      const insight = await repos.copilot.createInsight({
        organizationId: learner.organizationId,
        learnerId: outcome.learnerId,
        planId: lessonSession?.planId ?? null,
        lessonSessionId: outcome.lessonId ?? null,
        signalType: "activity_outcome",
        summary: recommendationSummary.description,
        evidence: {
          attemptId: outcome.attemptId,
          progressRecordId: progressRecord.id,
          scorePercent,
          recommendation: recommendationSummary.recommendationType,
          recommendationReason: nextState.lastOutcomeSummary.recommendationReason,
          linkage: curriculumLink.linkage,
        },
        metadata: {
          source: "activity-submit",
        },
      });

      await repos.copilot.createRecommendation({
        organizationId: learner.organizationId,
        learnerId: outcome.learnerId,
        insightId: insight.id,
        recommendationType: recommendationSummary.recommendationType,
        status: "proposed",
        title: recommendationSummary.title,
        description: recommendationSummary.description,
        payload: {
          attemptId: outcome.attemptId,
          progressRecordId: progressRecord.id,
          lessonSessionId: outcome.lessonId ?? null,
          planItemId: curriculumLink.planItemId,
          sourceId: curriculumLink.linkage.sourceId,
          skillNodeId: curriculumLink.linkage.skillNodeId,
          recommendationReason: nextState.lastOutcomeSummary.recommendationReason,
        },
        acceptedAt: null,
        dismissedAt: null,
        metadata: {
          source: "activity-submit",
          masterySignal: nextState.lastOutcomeSummary.masterySignal,
        },
      });
    }
  }

  const standardNodes = await repos.standards.listNodesByCodes(outcome.standardIds);
  for (const node of standardNodes) {
    await repos.tracking.attachStandard({
      progressRecordId: progressRecord.id,
      standardNodeId: node.id,
      metadata: {
        source: "activity-submit",
        standardCode: node.code,
      },
    });

    await repos.tracking.attachObjectiveToEvidence({
      evidenceRecordId: evidenceRecord.id,
      standardNodeId: node.id,
      metadata: {
        source: "activity-submit",
        standardCode: node.code,
      },
    });
  }

  if (outcome.lessonId) {
    await repos.planning.updateLessonSession(outcome.lessonId, {
      status: "completed",
      completionStatus:
        progressClassification.progressStatus === "needs_review"
          ? "needs_review"
          : "completed_as_planned",
      reviewState:
        progressClassification.progressStatus === "needs_review"
          ? "awaiting_review"
          : "not_required",
      actualMinutes:
        typeof outcome.timeSpentMs === "number"
          ? Math.max(1, Math.ceil(outcome.timeSpentMs / 60000))
          : null,
      completedAt,
      summary: "Completed from learner activity runtime.",
      metadata: {
        source: "activity-submit",
        attemptId: outcome.attemptId,
      },
    });
  }
}
