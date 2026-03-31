import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";

import type { ActivityAttempt, AttemptAnswer, ActivityOutcome } from "./types";

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

class DbAttemptStore implements AttemptStore {
  async findInProgress(sessionId: string, learnerId: string): Promise<ActivityAttempt | null> {
    const attempt = await createRepositories(getDb()).activities.findInProgressAttempt(
      sessionId,
      learnerId,
    );

    return attempt ? toDomainAttempt(attempt) : null;
  }

  async create(params: {
    sessionId: string;
    learnerId: string;
    activityId: string;
  }): Promise<ActivityAttempt> {
    const repos = createRepositories(getDb());
    const priorAttempts = await repos.activities.listAttemptsForActivity(params.activityId);
    const attempt = await repos.activities.createAttempt({
      activityId: params.activityId,
      learnerId: params.learnerId,
      status: "in_progress",
      attemptNumber: priorAttempts.length + 1,
      responses: {
        answers: [],
      },
      startedAt: new Date().toISOString(),
      metadata: {
        sessionId: params.sessionId,
        uiState: {},
      },
    });

    return toDomainAttempt(attempt);
  }

  async save(
    attemptId: string,
    answers: AttemptAnswer[],
    uiState?: Record<string, unknown>
  ): Promise<ActivityAttempt> {
    const repos = createRepositories(getDb());
    const attempt = await repos.activities.getAttempt(attemptId);
    if (!attempt) throw new Error(`Attempt not found: ${attemptId}`);

    const updated = await repos.activities.updateAttempt(attemptId, {
      responses: {
        answers,
      },
      metadata: {
        ...(attempt.metadata ?? {}),
        sessionId: (attempt.metadata?.sessionId as string | undefined) ?? attempt.activityId,
        uiState: uiState ?? ((attempt.metadata?.uiState as Record<string, unknown> | undefined) ?? {}),
      },
    });

    return toDomainAttempt(updated);
  }

  async submit(attemptId: string): Promise<ActivityOutcome> {
    const repos = createRepositories(getDb());
    const attempt = await repos.activities.getAttempt(attemptId);
    if (!attempt) throw new Error(`Attempt not found: ${attemptId}`);

    const completedAt = new Date().toISOString();
    const updated = await repos.activities.updateAttempt(attemptId, {
      status: "submitted",
      submittedAt: completedAt,
      completedAt,
      scorePercent: computeScorePercent(extractAnswers(attempt.responses)),
      metadata: attempt.metadata ?? {},
    });
    const activity = await repos.activities.getActivity(attempt.activityId);
    const metadata = (activity?.metadata ?? {}) as Record<string, unknown>;
    const startMs = new Date(attempt.startedAt ?? updated.startedAt ?? completedAt).getTime();
    const endMs = new Date(completedAt).getTime();
    const responses = extractAnswers(updated.responses);
    const score =
      typeof updated.scorePercent === "number" ? updated.scorePercent / 100 : undefined;

    const outcome: ActivityOutcome = {
      attemptId,
      sessionId: ((updated.metadata?.sessionId as string | undefined) ?? updated.activityId),
      learnerId: updated.learnerId,
      activityId: updated.activityId,
      lessonId: (metadata.lessonId as string | undefined) ?? undefined,
      score,
      timeSpentMs: endMs - startMs,
      completedAt,
      standardIds: Array.isArray(metadata.standardIds) ? (metadata.standardIds as string[]) : [],
    };

    return outcome;
  }

  async get(attemptId: string): Promise<ActivityAttempt | null> {
    const attempt = await createRepositories(getDb()).activities.getAttempt(attemptId);
    return attempt ? toDomainAttempt(attempt) : null;
  }
}

function computeScorePercent(answers: AttemptAnswer[]) {
  const gradedAnswers = answers.filter((answer) => answer.correct !== undefined);

  if (gradedAnswers.length === 0) {
    return null;
  }

  return Math.round(
    (gradedAnswers.filter((answer) => answer.correct === true).length / gradedAnswers.length) * 100,
  );
}

function extractAnswers(responses: unknown): AttemptAnswer[] {
  if (
    typeof responses === "object" &&
    responses !== null &&
    Array.isArray((responses as { answers?: unknown }).answers)
  ) {
    return (responses as { answers: AttemptAnswer[] }).answers;
  }

  return [];
}

function toDomainAttempt(attempt: {
  id: string;
  activityId: string;
  learnerId: string;
  responses: unknown;
  status: "in_progress" | "submitted" | "graded" | "abandoned";
  startedAt: string | null;
  submittedAt: string | null;
  scorePercent: number | null;
  metadata: Record<string, unknown>;
}) {
  return {
    id: attempt.id,
    sessionId: (attempt.metadata?.sessionId as string | undefined) ?? attempt.activityId,
    learnerId: attempt.learnerId,
    activityId: attempt.activityId,
    answers: extractAnswers(attempt.responses),
    score:
      typeof attempt.scorePercent === "number" ? Math.max(0, attempt.scorePercent) / 100 : undefined,
    status: attempt.status === "abandoned" ? "submitted" : attempt.status,
    startedAt: attempt.startedAt ?? new Date().toISOString(),
    submittedAt: attempt.submittedAt ?? undefined,
    uiState: (attempt.metadata?.uiState as Record<string, unknown> | undefined) ?? undefined,
  } satisfies ActivityAttempt;
}

let _store: AttemptStore | null = null;

export function getAttemptStore(): AttemptStore {
  if (!_store) {
    _store = new DbAttemptStore();
  }
  return _store;
}
