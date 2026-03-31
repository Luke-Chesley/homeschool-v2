import "server-only";

import type { InferSelectModel } from "drizzle-orm";

import { FIXTURE_SESSIONS } from "@/lib/activities/fixtures";
import { ensureLocalDemoData } from "@/lib/db/fixtures/local-demo-persistence";
import { getRepositories } from "@/lib/db/server";
import { activityAttempts } from "@/lib/db/schema";
import type { ActivityAttempt, AttemptAnswer, ActivityOutcome, ActivitySession } from "./types";

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface AttemptStore {
  /** Find an existing in-progress attempt for this session+learner */
  findInProgress(sessionId: string, learnerId: string): Promise<ActivityAttempt | null>;

  /** Find the latest attempt for this session+learner */
  findLatest(sessionId: string, learnerId: string): Promise<ActivityAttempt | null>;

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

type PersistedAttemptRecord = InferSelectModel<typeof activityAttempts>;

function getFixtureSession(sessionId: string): ActivitySession | null {
  return FIXTURE_SESSIONS.find((session) => session.id === sessionId) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAttemptAnswers(record: PersistedAttemptRecord): AttemptAnswer[] {
  const responses = record.responses;
  if (!isRecord(responses)) {
    return [];
  }

  return Array.isArray(responses.answers) ? (responses.answers as AttemptAnswer[]) : [];
}

function getAttemptUiState(record: PersistedAttemptRecord): Record<string, unknown> | undefined {
  const responses = record.responses;
  if (!isRecord(responses) || !isRecord(responses.uiState)) {
    return undefined;
  }

  return responses.uiState;
}

function getAttemptSessionId(record: PersistedAttemptRecord): string {
  if (isRecord(record.metadata) && typeof record.metadata.sessionId === "string") {
    return record.metadata.sessionId;
  }

  return record.activityId;
}

function toIsoString(value: string | Date | null | undefined, fallback: Date): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return fallback.toISOString();
}

function toAttemptStatus(
  status: PersistedAttemptRecord["status"]
): ActivityAttempt["status"] {
  if (status === "graded") {
    return "graded";
  }

  if (status === "abandoned") {
    return "submitted";
  }

  return status;
}

function mapAttempt(record: PersistedAttemptRecord): ActivityAttempt {
  return {
    id: record.id,
    sessionId: getAttemptSessionId(record),
    learnerId: record.learnerId,
    activityId: record.activityId,
    answers: getAttemptAnswers(record),
    score: typeof record.scorePercent === "number" ? record.scorePercent / 100 : undefined,
    status: toAttemptStatus(record.status),
    startedAt: toIsoString(record.startedAt, record.createdAt),
    submittedAt: typeof record.submittedAt === "string" ? record.submittedAt : undefined,
    uiState: getAttemptUiState(record),
  };
}

function computeScore(answers: AttemptAnswer[]) {
  const gradedAnswers = answers.filter((answer) => answer.correct !== undefined);
  if (gradedAnswers.length === 0) {
    return undefined;
  }

  return gradedAnswers.filter((answer) => answer.correct === true).length / gradedAnswers.length;
}

class DbAttemptStore implements AttemptStore {
  async findInProgress(sessionId: string, learnerId: string): Promise<ActivityAttempt | null> {
    await ensureLocalDemoData();
    const repos = await getRepositories();
    const attempt = await repos.activities.findInProgressAttemptForSession(sessionId, learnerId);
    return attempt ? mapAttempt(attempt) : null;
  }

  async findLatest(sessionId: string, learnerId: string): Promise<ActivityAttempt | null> {
    await ensureLocalDemoData();
    const repos = await getRepositories();
    const attempt = await repos.activities.findLatestAttemptForSession(sessionId, learnerId);
    return attempt ? mapAttempt(attempt) : null;
  }

  async create(params: {
    sessionId: string;
    learnerId: string;
    activityId: string;
  }): Promise<ActivityAttempt> {
    await ensureLocalDemoData();
    const repos = await getRepositories();
    const existingAttempts = await repos.activities.listAttemptsForActivityAndLearner(
      params.activityId,
      params.learnerId
    );
    const created = await repos.activities.createAttempt({
      activityId: params.activityId,
      learnerId: params.learnerId,
      attemptNumber: (existingAttempts[0]?.attemptNumber ?? 0) + 1,
      status: "in_progress",
      responses: {
        answers: [],
      },
      startedAt: new Date().toISOString(),
      metadata: {
        source: "local-db",
        sessionId: params.sessionId,
      },
    });

    return mapAttempt(created);
  }

  async save(
    attemptId: string,
    answers: AttemptAnswer[],
    uiState?: Record<string, unknown>
  ): Promise<ActivityAttempt> {
    await ensureLocalDemoData();
    const repos = await getRepositories();
    const existing = await repos.activities.findAttemptById(attemptId);
    if (!existing) {
      throw new Error(`Attempt not found: ${attemptId}`);
    }

    const updated = await repos.activities.updateAttempt(attemptId, {
      responses: {
        answers,
        uiState: uiState ?? getAttemptUiState(existing) ?? {},
      },
    });

    if (!updated) {
      throw new Error(`Attempt not found: ${attemptId}`);
    }

    return mapAttempt(updated);
  }

  async submit(attemptId: string): Promise<ActivityOutcome> {
    await ensureLocalDemoData();
    const repos = await getRepositories();
    const existing = await repos.activities.findAttemptById(attemptId);
    if (!existing) {
      throw new Error(`Attempt not found: ${attemptId}`);
    }

    const answers = getAttemptAnswers(existing);
    const completedAt =
      typeof existing.completedAt === "string"
        ? existing.completedAt
        : typeof existing.submittedAt === "string"
          ? existing.submittedAt
          : new Date().toISOString();
    const score = computeScore(answers);

    const submitted =
      existing.status === "in_progress"
        ? await repos.activities.updateAttempt(attemptId, {
            status: "submitted",
            scorePercent: typeof score === "number" ? Math.round(score * 100) : null,
            submittedAt: completedAt,
            completedAt,
          })
        : existing;

    if (!submitted) {
      throw new Error(`Attempt not found: ${attemptId}`);
    }

    const mappedAttempt = mapAttempt(submitted);
    const session = getFixtureSession(mappedAttempt.sessionId);
    const startedAtMs = new Date(mappedAttempt.startedAt).getTime();
    const completedAtMs = new Date(completedAt).getTime();

    return {
      attemptId: mappedAttempt.id,
      sessionId: mappedAttempt.sessionId,
      learnerId: mappedAttempt.learnerId,
      activityId: mappedAttempt.activityId,
      lessonId: session?.lessonId,
      score: mappedAttempt.score ?? score,
      timeSpentMs:
        Number.isFinite(startedAtMs) && Number.isFinite(completedAtMs)
          ? Math.max(0, completedAtMs - startedAtMs)
          : undefined,
      completedAt,
      standardIds: session?.standardIds ?? [],
    };
  }

  async get(attemptId: string): Promise<ActivityAttempt | null> {
    await ensureLocalDemoData();
    const repos = await getRepositories();
    const attempt = await repos.activities.findAttemptById(attemptId);
    return attempt ? mapAttempt(attempt) : null;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _store: AttemptStore | null = null;

export function getAttemptStore(): AttemptStore {
  if (!_store) {
    _store = new DbAttemptStore();
  }

  return _store;
}
