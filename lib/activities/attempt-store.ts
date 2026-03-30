/**
 * Attempt store — in-memory implementation for local development.
 *
 * Integration point: swap for a Supabase-backed repository once plan 02 is
 * merged. The interface stays the same.
 */

import { randomUUID } from "crypto";
import type { ActivityAttempt, AttemptAnswer, ActivityOutcome, ActivitySession } from "./types";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AttemptStore {
  /** Find an existing in-progress attempt for this session+learner */
  findInProgress(sessionId: string, learnerId: string): Promise<ActivityAttempt | null>;

  /** Create a new attempt */
  create(params: {
    sessionId: string;
    learnerId: string;
    activityId: string;
  }): Promise<ActivityAttempt>;

  /** Autosave answers and optional UI state */
  save(
    attemptId: string,
    answers: AttemptAnswer[],
    uiState?: Record<string, unknown>
  ): Promise<ActivityAttempt>;

  /** Submit the attempt and produce an outcome */
  submit(attemptId: string): Promise<ActivityOutcome>;

  /** Get a specific attempt */
  get(attemptId: string): Promise<ActivityAttempt | null>;
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

class InMemoryAttemptStore implements AttemptStore {
  private attempts = new Map<string, ActivityAttempt>();
  private sessions = new Map<string, ActivitySession>();

  registerSession(session: ActivitySession) {
    this.sessions.set(session.id, session);
  }

  async findInProgress(sessionId: string, learnerId: string): Promise<ActivityAttempt | null> {
    for (const attempt of this.attempts.values()) {
      if (
        attempt.sessionId === sessionId &&
        attempt.learnerId === learnerId &&
        attempt.status === "in_progress"
      ) {
        return attempt;
      }
    }
    return null;
  }

  async create(params: {
    sessionId: string;
    learnerId: string;
    activityId: string;
  }): Promise<ActivityAttempt> {
    const attempt: ActivityAttempt = {
      id: randomUUID(),
      sessionId: params.sessionId,
      learnerId: params.learnerId,
      activityId: params.activityId,
      answers: [],
      status: "in_progress",
      startedAt: new Date().toISOString(),
    };
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async save(
    attemptId: string,
    answers: AttemptAnswer[],
    uiState?: Record<string, unknown>
  ): Promise<ActivityAttempt> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) throw new Error(`Attempt not found: ${attemptId}`);
    const updated: ActivityAttempt = {
      ...attempt,
      answers,
      uiState: uiState ?? attempt.uiState,
    };
    this.attempts.set(attemptId, updated);
    return updated;
  }

  async submit(attemptId: string): Promise<ActivityOutcome> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt) throw new Error(`Attempt not found: ${attemptId}`);

    const completedAt = new Date().toISOString();
    const submitted: ActivityAttempt = {
      ...attempt,
      status: "submitted",
      submittedAt: completedAt,
    };
    this.attempts.set(attemptId, submitted);

    const session = this.sessions.get(attempt.sessionId);
    const startMs = new Date(attempt.startedAt).getTime();
    const endMs = new Date(completedAt).getTime();

    // Simple score: fraction of correct answers for graded questions
    const gradedAnswers = attempt.answers.filter((a) => a.correct !== undefined);
    const score =
      gradedAnswers.length > 0
        ? gradedAnswers.filter((a) => a.correct === true).length / gradedAnswers.length
        : undefined;

    const outcome: ActivityOutcome = {
      attemptId,
      sessionId: attempt.sessionId,
      learnerId: attempt.learnerId,
      activityId: attempt.activityId,
      lessonId: session?.lessonId,
      score,
      timeSpentMs: endMs - startMs,
      completedAt,
      standardIds: session?.standardIds ?? [],
    };

    return outcome;
  }

  async get(attemptId: string): Promise<ActivityAttempt | null> {
    return this.attempts.get(attemptId) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _store: InMemoryAttemptStore | null = null;

export function getAttemptStore(): AttemptStore & {
  registerSession: (s: ActivitySession) => void;
} {
  if (!_store) {
    _store = new InMemoryAttemptStore();
    // Register fixture sessions
    import("./fixtures").then(({ FIXTURE_SESSIONS }) => {
      for (const s of FIXTURE_SESSIONS) {
        _store!.registerSession(s);
      }
    });
  }
  return _store;
}
