import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";

import { getAttemptStore } from "./attempt-store";
import type { ActivitySession, ActivityAttempt, AttemptAnswer, ActivityOutcome } from "./types";

type ActivityMetadata = {
  estimatedMinutes?: number | null;
  lessonId?: string | null;
  standardIds?: string[];
};

// ---------------------------------------------------------------------------
// Session access
// ---------------------------------------------------------------------------

export async function listSessions(learnerId: string): Promise<ActivitySession[]> {
  const repos = createRepositories(getDb());
  const activities = await repos.activities.listActivitiesForLearner(learnerId);

  return Promise.all(activities.map((activity) => mapActivityToSession(activity)));
}

export async function getSession(sessionId: string): Promise<ActivitySession | null> {
  const activity = await createRepositories(getDb()).activities.getActivity(sessionId);
  return activity ? mapActivityToSession(activity) : null;
}

// ---------------------------------------------------------------------------
// Attempt lifecycle
// ---------------------------------------------------------------------------

/**
 * Start or resume an attempt for a session.
 * Returns an existing in-progress attempt if one exists (resume support).
 */
export async function startOrResumeAttempt(
  sessionId: string,
  learnerId: string
): Promise<ActivityAttempt> {
  const store = getAttemptStore();
  const session = await getSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const existing = await store.findInProgress(sessionId, learnerId);
  if (existing) return existing;

  return store.create({
    sessionId,
    learnerId,
    activityId: session.activityId,
  });
}

/**
 * Autosave the current answer state for an attempt.
 */
export async function autosave(
  attemptId: string,
  answers: AttemptAnswer[],
  uiState?: Record<string, unknown>
): Promise<ActivityAttempt> {
  return getAttemptStore().save(attemptId, answers, uiState);
}

/**
 * Submit an attempt and return the outcome.
 *
 * Integration point: forward outcome to tracking domain (plan 07).
 */
export async function submitAttempt(attemptId: string): Promise<ActivityOutcome> {
  const outcome = await getAttemptStore().submit(attemptId);
  await reportOutcome(outcome);
  return outcome;
}

/**
 * Stub: report outcome to tracking domain.
 *
 * Integration point: call lib/tracking once plan 07 ships.
 */
async function reportOutcome(outcome: ActivityOutcome): Promise<void> {
  await createRepositories(getDb()).tracking.createProgressRecord({
    learnerId: outcome.learnerId,
    lessonSessionId: outcome.lessonId ?? null,
    activityAttemptId: outcome.attemptId,
    status: outcome.score != null && outcome.score >= 0.8 ? "mastered" : "completed",
    masteryLevel:
      outcome.score == null
        ? null
        : outcome.score >= 0.8
          ? "secure"
          : outcome.score >= 0.6
            ? "developing"
            : "needs_review",
    completionPercent: outcome.score != null ? Math.round(outcome.score * 100) : null,
    timeSpentMinutes:
      typeof outcome.timeSpentMs === "number" ? Math.max(1, Math.round(outcome.timeSpentMs / 60000)) : null,
    parentNote: null,
    metadata: {
      sessionId: outcome.sessionId,
      activityId: outcome.activityId,
      standardIds: outcome.standardIds,
      completedAt: outcome.completedAt,
      source: "activity.submit",
    },
  });
}

async function mapActivityToSession(activity: {
  id: string;
  learnerId: string | null;
  title: string;
  definition: Record<string, unknown>;
  metadata: Record<string, unknown>;
}) {
  const repos = createRepositories(getDb());
  const attempts = await repos.activities.listAttemptsForActivity(activity.id);
  const latestAttempt = attempts.at(-1) ?? null;
  const metadata = activity.metadata as ActivityMetadata;
  const status =
    latestAttempt?.status === "submitted" || latestAttempt?.status === "graded"
      ? "completed"
      : latestAttempt?.status === "in_progress"
        ? "in_progress"
        : "not_started";

  return {
    id: activity.id,
    learnerId: activity.learnerId ?? "unknown-learner",
    activityId: activity.id,
    definition: activity.definition as ActivitySession["definition"],
    status,
    startedAt: latestAttempt?.startedAt ?? undefined,
    completedAt: latestAttempt?.completedAt ?? latestAttempt?.submittedAt ?? undefined,
    estimatedMinutes:
      typeof metadata.estimatedMinutes === "number" ? metadata.estimatedMinutes : undefined,
    lessonId: typeof metadata.lessonId === "string" ? metadata.lessonId : undefined,
    standardIds: Array.isArray(metadata.standardIds) ? metadata.standardIds : [],
  } satisfies ActivitySession;
}
