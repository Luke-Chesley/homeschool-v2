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

// ---------------------------------------------------------------------------
// Session access
// ---------------------------------------------------------------------------

export async function listSessions(learnerId: string): Promise<ActivitySession[]> {
  // Integration point: query sessions assigned to learnerId from DB
  return FIXTURE_SESSIONS.filter((s) => s.learnerId === learnerId);
}

export async function getSession(sessionId: string): Promise<ActivitySession | null> {
  return FIXTURE_SESSIONS.find((s) => s.id === sessionId) ?? null;
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
  // TODO: import { recordActivityOutcome } from "@/lib/tracking"
  //       await recordActivityOutcome(outcome)
  console.info("[activities] outcome reported (stub)", {
    attemptId: outcome.attemptId,
    score: outcome.score,
    timeSpentMs: outcome.timeSpentMs,
  });
}
