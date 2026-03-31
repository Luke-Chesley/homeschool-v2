/**
 * Activity session service.
 *
 * Provides operations for listing, starting, and resuming activity sessions.
 * Uses fixture data for now; replace with a real repository query when plan 02
 * is merged.
 *
 * Integration point: `reportOutcome()` should forward to lib/tracking once
 * plan 07 is merged.
 */

import { FIXTURE_SESSIONS } from "./fixtures";
import { getAttemptStore } from "./attempt-store";
import type { ActivitySession, ActivityAttempt, AttemptAnswer, ActivityOutcome } from "./types";
import { ensureLocalDemoData } from "@/lib/db/fixtures/local-demo-persistence";
import { getRepositories } from "@/lib/db/server";

function normalizeAttemptStatus(
  status: "in_progress" | "submitted" | "graded" | "abandoned"
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
  attempt: ActivityAttempt | undefined
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

// ---------------------------------------------------------------------------
// Session access
// ---------------------------------------------------------------------------

export async function listSessions(learnerId: string): Promise<ActivitySession[]> {
  await ensureLocalDemoData();

  const sessions = FIXTURE_SESSIONS.filter((session) => session.learnerId === learnerId);
  const repos = await getRepositories();
  const attempts = await repos.activities.listAttemptsForLearner(learnerId);
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

  return sessions.map((session) => mergeAttemptStatus(session, latestBySession.get(session.id)));
}

export async function getSession(sessionId: string): Promise<ActivitySession | null> {
  await ensureLocalDemoData();

  const session = FIXTURE_SESSIONS.find((s) => s.id === sessionId) ?? null;
  if (!session) {
    return null;
  }

  const attempt = await getAttemptStore().findLatest(sessionId, session.learnerId);
  return mergeAttemptStatus(session, attempt ?? undefined);
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
  await ensureLocalDemoData();

  const store = getAttemptStore();
  const session = await getSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const existing = await store.findLatest(sessionId, learnerId);
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
  await ensureLocalDemoData();

  const repos = await getRepositories();
  const existingRecord = await repos.tracking.findProgressByAttemptId(outcome.attemptId);
  if (existingRecord) {
    return;
  }

  const progressRecord = await repos.tracking.createProgressRecord({
    learnerId: outcome.learnerId,
    activityAttemptId: outcome.attemptId,
    status:
      typeof outcome.score === "number" && outcome.score >= 0.8 ? "mastered" : "completed",
    completionPercent: 100,
    timeSpentMinutes:
      typeof outcome.timeSpentMs === "number"
        ? Math.max(1, Math.ceil(outcome.timeSpentMs / 60000))
        : undefined,
    metadata: {
      source: "activity-submit",
      sessionId: outcome.sessionId,
      activityId: outcome.activityId,
      lessonId: outcome.lessonId ?? null,
      score: outcome.score ?? null,
      standardIds: outcome.standardIds,
      ...outcome.meta,
    },
  });

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
  }
}
