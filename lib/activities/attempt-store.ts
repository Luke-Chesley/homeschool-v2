import "@/lib/server-only";

import type { InferSelectModel } from "drizzle-orm";

import { createRepositories } from "@/lib/db";
import { ensureLocalDemoData } from "@/lib/db/fixtures/local-demo-persistence";
import { getDb } from "@/lib/db/server";
import { activityAttempts } from "@/lib/db/schema";
import { LOCAL_DEMO_LEARNER_ID } from "@/lib/db/fixtures/local-demo-persistence";
import type { ActivityAttempt, AttemptAnswer, ActivityOutcome, ActivitySession } from "./types";
import { parseActivityDefinition } from "./types";
import { isActivitySpec, parseActivitySpec } from "./spec";

export interface AttemptStore {
  findInProgress(sessionId: string, learnerId: string): Promise<ActivityAttempt | null>;
  findLatest(sessionId: string, learnerId: string): Promise<ActivityAttempt | null>;
  create(params: {
    sessionId: string;
    learnerId: string;
    activityId: string;
  }): Promise<ActivityAttempt>;
  save(
    attemptId: string,
    answers: AttemptAnswer[],
    uiState?: Record<string, unknown>
  ): Promise<ActivityAttempt>;
  submit(attemptId: string): Promise<ActivityOutcome>;
  get(attemptId: string): Promise<ActivityAttempt | null>;
}

type PersistedAttemptRecord = InferSelectModel<typeof activityAttempts>;

function getActivitiesRepo() {
  return createRepositories(getDb()).activities;
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

function getActivityLessonId(activity: {
  lessonSessionId: string | null;
  metadata: Record<string, unknown>;
}) {
  if (activity.lessonSessionId) {
    return activity.lessonSessionId;
  }

  return typeof activity.metadata.lessonId === "string" ? activity.metadata.lessonId : undefined;
}

async function getActivitySession(sessionId: string): Promise<ActivitySession | null> {
  const activity =
    (await getActivitiesRepo().findPrimaryActivityForSession(sessionId)) ??
    (await getActivitiesRepo().findActivityBySessionId(sessionId)) ??
    (await getActivitiesRepo().findActivityById(sessionId));

  if (!activity || !activity.learnerId) {
    return null;
  }

  // v2 ActivitySpec takes precedence
  if (isActivitySpec(activity.definition)) {
    const spec = parseActivitySpec(activity.definition);
    if (!spec) return null;
    return {
      id: getActivitySessionId(activity),
      learnerId: activity.learnerId,
      activityId: activity.id,
      definition: spec as unknown as ActivitySession["definition"],
      status: "not_started",
      estimatedMinutes: spec.estimatedMinutes,
      lessonId: getActivityLessonId(activity),
      standardIds: getActivityStandardIds(activity),
    };
  }

  // v1 legacy definition
  const definition = parseActivityDefinition(activity.definition);
  if (!definition) {
    return null;
  }

  return {
    id: getActivitySessionId(activity),
    learnerId: activity.learnerId,
    activityId: activity.id,
    definition,
    status: "not_started",
    estimatedMinutes:
      typeof activity.metadata.estimatedMinutes === "number"
        ? activity.metadata.estimatedMinutes
        : undefined,
    lessonId: getActivityLessonId(activity),
    standardIds: getActivityStandardIds(activity),
  };
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
    const attempt = await getActivitiesRepo().findInProgressAttemptForSession(sessionId, learnerId);
    return attempt ? mapAttempt(attempt) : null;
  }

  async findLatest(sessionId: string, learnerId: string): Promise<ActivityAttempt | null> {
    await ensureLocalDemoData();
    const attempt = await getActivitiesRepo().findLatestAttemptForSession(sessionId, learnerId);
    return attempt ? mapAttempt(attempt) : null;
  }

  async create(params: {
    sessionId: string;
    learnerId: string;
    activityId: string;
  }): Promise<ActivityAttempt> {
    await ensureLocalDemoData();
    const existingAttempts = await getActivitiesRepo().listAttemptsForActivityAndLearner(
      params.activityId,
      params.learnerId
    );
    const created = await getActivitiesRepo().createAttempt({
      activityId: params.activityId,
      learnerId: params.learnerId,
      lessonSessionId: params.sessionId,
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
    const existing = await getActivitiesRepo().findAttemptById(attemptId);
    if (!existing) {
      throw new Error(`Attempt not found: ${attemptId}`);
    }

    const updated = await getActivitiesRepo().updateAttempt(attemptId, {
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
    const existing = await getActivitiesRepo().findAttemptById(attemptId);
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
        ? await getActivitiesRepo().updateAttempt(attemptId, {
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
    const session = await getActivitySession(mappedAttempt.sessionId);
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
    const attempt = await getActivitiesRepo().findAttemptById(attemptId);
    return attempt ? mapAttempt(attempt) : null;
  }
}

let _store: AttemptStore | null = null;

export function getAttemptStore(): AttemptStore {
  if (!_store) {
    _store = new DbAttemptStore();
  }

  return _store;
}
