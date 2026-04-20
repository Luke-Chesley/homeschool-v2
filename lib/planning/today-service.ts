import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { cache } from "react";

import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import { isStructuredLessonDraft } from "@/lib/lesson-draft/types";
import { computeLessonDraftFingerprint } from "@/lib/lesson-draft/fingerprint";

import {
  getCurriculumTree,
  getLiveCurriculumSource,
  listCurriculumNodes,
  listCurriculumSources,
} from "@/lib/curriculum/service";
import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import {
  evidenceRecordObjectives,
  evidenceRecords,
  feedbackEntries,
  interactiveActivities,
  lessonSessions,
  planDays,
  planDaySlots,
  planItemCurriculumLinks,
  planItems,
  plans,
  progressRecords,
  progressRecordStandards,
  reviewQueueItems,
  routeOverrideEvents,
  weeklyRouteItems,
  weeklyRoutes,
} from "@/lib/db/schema";
import type {
  DailyWorkspaceActivityBuild,
  DailyWorkspaceActivityState,
  DailyWorkspaceActivityBuildStatus,
  DailyWorkspaceActivityBuildTrigger,
  DailyWorkspaceExpansionIntent,
  DailyWorkspace,
  DailyWorkspaceSlot,
  DailyWorkspaceLessonBuild,
  DailyWorkspaceLessonDraft,
  PlanItem,
  DailyWorkspaceLessonBuildStatus,
  DailyWorkspaceLessonBuildTrigger,
  WeeklyRouteItem,
} from "@/lib/planning/types";
import { completeSessionWorkspace, ensureSessionWorkspace } from "@/lib/session-workspace/service";
import {
  getLessonEvaluationLabel,
  getLessonEvaluationLevelFromRating,
  type LessonEvaluationLevel,
} from "@/lib/session-workspace/evaluation";
import type { AppWorkspace } from "@/lib/users/service";
import {
  duplicateWeeklyRouteItem,
  getOrCreateWeeklyRouteBoardForLearner,
  getReadOptimizedWeeklyRouteBoardForToday,
} from "@/lib/planning/weekly-route-service";
import type { WeeklyRouteBoard } from "@/lib/curriculum-routing";
import { toWeekStartDate } from "@/lib/curriculum-routing";
import { buildCopilotPlanningContext } from "@/lib/planning/copilot-snapshot";
import {
  resolveLessonSessionMinutes,
  type LessonTimingContract,
} from "@/lib/planning/session-timing";
import type { CurriculumSource } from "@/lib/curriculum/types";

const DEFAULT_UNSCHEDULED_ITEM_COUNT = 4;
const TODAY_WORKSPACE_PLAN_PURPOSE = "today_workspace";
const TODAY_LESSON_DRAFTS_KEY = "todayLessonDrafts";
const TODAY_LESSON_BUILDS_KEY = "todayLessonBuilds";
const TODAY_ACTIVITY_BUILDS_KEY = "todayActivityBuilds";
const TODAY_LESSON_REGEN_NOTES_KEY = "todayLessonRegenerationNotes";
const TODAY_EXPANSION_INTENTS_KEY = "todayExpansionIntents";
const TODAY_WORKSPACE_FRESHNESS_KEY = "todayWorkspaceFreshness";

type TodayMaterializedWorkflowEntry = {
  planParentId: string;
  planDayRecordId: string;
  planDaySlotId: string | null;
  planDaySlotIndex: number | null;
  planItemId: string;
  lessonSessionId: string | null;
  completionStatus: string | null;
  reviewState: string | null;
  evidenceCount: number;
  activityCount: number;
};

type TodayRouteSlotSelection = {
  slotIndex: number;
  title: string;
  routeFingerprint: string;
  routeItems: WeeklyRouteBoard["items"];
};

type TodayWorkspaceContext = {
  selectedSource: CurriculumSource;
  sourceId: string;
  sourceTitle: string;
  sessionTiming: LessonTimingContract;
  sessionBudgetMinutes: number;
  board: WeeklyRouteBoard;
  selectedRouteSlots: TodayRouteSlotSelection[];
  selectedRouteItems: WeeklyRouteBoard["items"];
  nodeById: Map<string, Awaited<ReturnType<typeof listCurriculumNodes>>[number]>;
  planningContext: ReturnType<typeof buildCopilotPlanningContext>;
  routeFingerprint: string;
};

type TodayWorkspaceMetadataState = {
  lessonDraft: DailyWorkspaceLessonDraft | null;
  lessonBuild: DailyWorkspaceLessonBuild | null;
  activityBuild: DailyWorkspaceActivityBuild | null;
  lessonRegenerationNote: string | null;
  expansionIntent: DailyWorkspaceExpansionIntent | null;
};

type TodayWorkspaceFreshnessRecord = {
  sourceId: string;
  routeFingerprint: string;
  itemCount: number;
  syncedAt: string;
};

type TodayWorkspaceStoredState = {
  metadataState: TodayWorkspaceMetadataState;
  freshness: TodayWorkspaceFreshnessRecord | null;
};

type TodayWorkspaceFreshnessState = {
  status: "fresh" | "stale" | "missing";
  storedState: TodayWorkspaceStoredState;
};

type TodayPlanItemPayload = {
  planId: string;
  planDayId: string;
  planDaySlotId: string;
  curriculumItemId: null;
  title: string;
  description: string;
  subject: string;
  status: typeof planItems.$inferInsert.status;
  scheduledDate: string;
  estimatedMinutes: number;
  ordering: number;
  metadata: {
    sourceLabel: string;
    lessonLabel: string;
    weeklyRouteItemId: string;
    skillNodeId: string;
  };
};

function addDays(baseDate: string, days: number) {
  const date = new Date(`${baseDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readWeeklyRouteItemIdFromMetadata(metadata: unknown) {
  if (!isRecord(metadata)) {
    return null;
  }

  return typeof metadata.weeklyRouteItemId === "string" ? metadata.weeklyRouteItemId : null;
}

function formatPlannerDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function isLessonEvaluationLevel(value: unknown): value is LessonEvaluationLevel {
  return (
    value === "needs_more_work" ||
    value === "partial" ||
    value === "successful" ||
    value === "exceeded"
  );
}

export function buildTodayLessonDraftFingerprint(itemIds: string[]) {
  return itemIds.join("::");
}

function normalizeSlotIndex(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? value : 1;
}

function isLessonBuildStatus(value: unknown): value is DailyWorkspaceLessonBuildStatus {
  return value === "queued" || value === "generating" || value === "failed" || value === "ready";
}

function isLessonBuildTrigger(value: unknown): value is DailyWorkspaceLessonBuildTrigger {
  return value === "onboarding_auto" || value === "today_resume" || value === "manual";
}

function isActivityBuildStatus(value: unknown): value is DailyWorkspaceActivityBuildStatus {
  return value === "queued" || value === "generating" || value === "failed" || value === "ready";
}

function isActivityBuildTrigger(value: unknown): value is DailyWorkspaceActivityBuildTrigger {
  return value === "after_lesson_auto" || value === "today_resume" || value === "manual";
}

function isExpansionIntent(value: unknown): value is DailyWorkspaceExpansionIntent {
  return value === "keep_today" || value === "expand_from_here";
}

async function withTodayTiming<T>(
  label: string,
  meta: Record<string, unknown>,
  operation: () => Promise<T>,
) {
  const startedAt = performance.now();

  try {
    return await operation();
  } finally {
    const durationMs = Number((performance.now() - startedAt).toFixed(1));
    console.info(`[today-runtime] ${label}`, {
      durationMs,
      ...meta,
    });
  }
}

async function buildTodayActivityState(
  workspace: Pick<DailyWorkspace, "leadItem" | "lessonDraft">,
): Promise<DailyWorkspaceActivityState> {
  return buildTodayActivityStateFromDraft({
    lessonDraft: workspace.lessonDraft,
    lessonSessionId:
      workspace.leadItem.sessionRecordId ?? workspace.leadItem.workflow?.lessonSessionId ?? null,
  });
}

async function buildTodayActivityStateFromDraft(params: {
  lessonDraft: DailyWorkspaceLessonDraft | null;
  lessonSessionId?: string | null;
}): Promise<DailyWorkspaceActivityState> {
  const lessonDraft = params.lessonDraft?.structured;
  if (!lessonDraft) {
    return { status: "no_draft" };
  }

  const leadSessionId = params.lessonSessionId ?? null;
  if (!leadSessionId) {
    return { status: "no_activity" };
  }

  const repos = createRepositories(getDb());
  const currentFingerprint = computeLessonDraftFingerprint(lessonDraft);
  const existingActivity = await repos.activities.findPublishedActivityForSession(leadSessionId);

  if (!existingActivity) {
    return { status: "no_activity", sessionId: leadSessionId };
  }

  return {
    status:
      existingActivity.lessonDraftFingerprint === currentFingerprint ? "ready" : "stale",
    sessionId: leadSessionId,
    activityId: existingActivity.id,
  };
}

function readLessonDraftFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  sourceId: string,
  routeFingerprint: string,
): DailyWorkspaceLessonDraft | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const draftSources = metadata[TODAY_LESSON_DRAFTS_KEY];
  if (!isRecord(draftSources)) {
    return null;
  }

  const sourceDrafts = draftSources[sourceId];
  if (!isRecord(sourceDrafts)) {
    return null;
  }

  const candidate = sourceDrafts[routeFingerprint];
  if (!isRecord(candidate)) {
    return null;
  }

  // New format: has a "structured" key with schema_version "1.0"
  const hasStructured =
    isRecord(candidate.structured) &&
    (candidate.structured as Record<string, unknown>).schema_version === "1.0";

  // Legacy format: has a "markdown" string key
  const hasMarkdown = typeof candidate.markdown === "string";

  if (!hasStructured && !hasMarkdown) {
    return null;
  }

  return {
    structured: hasStructured
      ? (candidate.structured as StructuredLessonDraft)
      : undefined,
    markdown: hasMarkdown ? (candidate.markdown as string) : undefined,
    sourceId: typeof candidate.sourceId === "string" ? candidate.sourceId : sourceId,
    sourceTitle: typeof candidate.sourceTitle === "string" ? candidate.sourceTitle : "Curriculum",
    routeFingerprint:
      typeof candidate.routeFingerprint === "string"
        ? candidate.routeFingerprint
        : routeFingerprint,
    promptVersion:
      typeof candidate.promptVersion === "string" ? candidate.promptVersion : undefined,
    savedAt:
      typeof candidate.savedAt === "string"
        ? candidate.savedAt
        : new Date().toISOString(),
  };
}

function readLessonBuildFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  sourceId: string,
  routeFingerprint: string,
): DailyWorkspaceLessonBuild | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const buildSources = metadata[TODAY_LESSON_BUILDS_KEY];
  if (!isRecord(buildSources)) {
    return null;
  }

  const sourceBuilds = buildSources[sourceId];
  if (!isRecord(sourceBuilds)) {
    return null;
  }

  const candidate = sourceBuilds[routeFingerprint];
  if (!isRecord(candidate) || !isLessonBuildStatus(candidate.status)) {
    return null;
  }

  const updatedAt =
    typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString();

  return {
    status: candidate.status,
    trigger: isLessonBuildTrigger(candidate.trigger) ? candidate.trigger : undefined,
    sourceId: typeof candidate.sourceId === "string" ? candidate.sourceId : sourceId,
    routeFingerprint:
      typeof candidate.routeFingerprint === "string"
        ? candidate.routeFingerprint
        : routeFingerprint,
    queuedAt: typeof candidate.queuedAt === "string" ? candidate.queuedAt : undefined,
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : undefined,
    completedAt: typeof candidate.completedAt === "string" ? candidate.completedAt : undefined,
    failedAt: typeof candidate.failedAt === "string" ? candidate.failedAt : undefined,
    updatedAt,
    error:
      typeof candidate.error === "string"
        ? candidate.error
        : candidate.error == null
          ? null
          : undefined,
  };
}

function readActivityBuildFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  sourceId: string,
  routeFingerprint: string,
): DailyWorkspaceActivityBuild | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const buildSources = metadata[TODAY_ACTIVITY_BUILDS_KEY];
  if (!isRecord(buildSources)) {
    return null;
  }

  const sourceBuilds = buildSources[sourceId];
  if (!isRecord(sourceBuilds)) {
    return null;
  }

  const candidate = sourceBuilds[routeFingerprint];
  if (!isRecord(candidate) || !isActivityBuildStatus(candidate.status)) {
    return null;
  }

  const updatedAt =
    typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString();

  return {
    status: candidate.status,
    trigger: isActivityBuildTrigger(candidate.trigger) ? candidate.trigger : undefined,
    sourceId: typeof candidate.sourceId === "string" ? candidate.sourceId : sourceId,
    routeFingerprint:
      typeof candidate.routeFingerprint === "string"
        ? candidate.routeFingerprint
        : routeFingerprint,
    lessonSessionId:
      typeof candidate.lessonSessionId === "string" ? candidate.lessonSessionId : null,
    activityId: typeof candidate.activityId === "string" ? candidate.activityId : null,
    queuedAt: typeof candidate.queuedAt === "string" ? candidate.queuedAt : undefined,
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : undefined,
    completedAt: typeof candidate.completedAt === "string" ? candidate.completedAt : undefined,
    failedAt: typeof candidate.failedAt === "string" ? candidate.failedAt : undefined,
    updatedAt,
    error:
      typeof candidate.error === "string"
        ? candidate.error
        : candidate.error == null
          ? null
          : undefined,
  };
}

function readLessonRegenerationNoteFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  sourceId: string,
  routeFingerprint: string,
) {
  if (!isRecord(metadata)) {
    return null;
  }

  const noteSources = metadata[TODAY_LESSON_REGEN_NOTES_KEY];
  if (!isRecord(noteSources)) {
    return null;
  }

  const sourceNotes = noteSources[sourceId];
  if (!isRecord(sourceNotes)) {
    return null;
  }

  const candidate = sourceNotes[routeFingerprint];
  return typeof candidate === "string" ? candidate : null;
}

function readExpansionIntentFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  sourceId: string,
  routeFingerprint: string,
) {
  if (!isRecord(metadata)) {
    return null;
  }

  const intentSources = metadata[TODAY_EXPANSION_INTENTS_KEY];
  if (!isRecord(intentSources)) {
    return null;
  }

  const sourceIntents = intentSources[sourceId];
  if (!isRecord(sourceIntents)) {
    return null;
  }

  const candidate = sourceIntents[routeFingerprint];
  return isExpansionIntent(candidate) ? candidate : null;
}

function readTodayWorkspaceFreshnessFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  sourceId: string,
  routeFingerprint: string,
): TodayWorkspaceFreshnessRecord | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const freshnessSources = metadata[TODAY_WORKSPACE_FRESHNESS_KEY];
  if (!isRecord(freshnessSources)) {
    return null;
  }

  const sourceFreshness = freshnessSources[sourceId];
  if (!isRecord(sourceFreshness)) {
    return null;
  }

  const candidate = sourceFreshness[routeFingerprint];
  if (!isRecord(candidate)) {
    return null;
  }

  return {
    sourceId: typeof candidate.sourceId === "string" ? candidate.sourceId : sourceId,
    routeFingerprint:
      typeof candidate.routeFingerprint === "string"
        ? candidate.routeFingerprint
        : routeFingerprint,
    itemCount: typeof candidate.itemCount === "number" ? candidate.itemCount : 0,
    syncedAt: typeof candidate.syncedAt === "string" ? candidate.syncedAt : new Date().toISOString(),
  };
}

async function getTodayWorkspacePlan(organizationId: string, learnerId: string) {
  const db = getDb();
  const [workspacePlan] = await db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.organizationId, organizationId),
        eq(plans.learnerId, learnerId),
        sql`${plans.metadata}->>'purpose' = ${TODAY_WORKSPACE_PLAN_PURPOSE}`,
      ),
    )
    .orderBy(desc(plans.updatedAt), desc(plans.createdAt))
    .limit(1);

  return workspacePlan ?? null;
}

async function getOrCreateTodayWorkspacePlan(organizationId: string, learnerId: string) {
  const existingPlan = await getTodayWorkspacePlan(organizationId, learnerId);
  if (existingPlan) {
    return existingPlan;
  }

  const db = getDb();
  const [createdPlan] = await db
    .insert(plans)
    .values({
      organizationId,
      learnerId,
      title: "Today workspace",
      status: "active",
      metadata: {
        purpose: TODAY_WORKSPACE_PLAN_PURPOSE,
      },
    })
    .returning();

  return createdPlan;
}

async function getTodayWorkspaceDay(params: {
  organizationId: string;
  learnerId: string;
  date: string;
}) {
  const workspacePlan = await getTodayWorkspacePlan(params.organizationId, params.learnerId);
  if (!workspacePlan) {
    return null;
  }

  const db = getDb();
  return (
    (await db.query.planDays.findFirst({
      where: and(eq(planDays.planId, workspacePlan.id), eq(planDays.date, params.date)),
    })) ?? null
  );
}

async function getOrCreateTodayWorkspaceDay(params: {
  organizationId: string;
  learnerId: string;
  date: string;
}) {
  const workspacePlan = await getOrCreateTodayWorkspacePlan(params.organizationId, params.learnerId);
  const db = getDb();
  const existingDay = await db.query.planDays.findFirst({
    where: and(eq(planDays.planId, workspacePlan.id), eq(planDays.date, params.date)),
  });

  if (existingDay) {
    return existingDay;
  }

  const [createdDay] = await db
    .insert(planDays)
    .values({
      planId: workspacePlan.id,
      date: params.date,
      status: "planned",
      metadata: {},
    })
    .returning();

  return createdDay;
}

async function getTodayWorkspaceDaySlots(params: {
  organizationId: string;
  learnerId: string;
  date: string;
}) {
  const workspacePlan = await getTodayWorkspacePlan(params.organizationId, params.learnerId);
  if (!workspacePlan) {
    return [];
  }

  const workspaceDay = await getTodayWorkspaceDay(params);
  if (!workspaceDay) {
    return [];
  }

  const db = getDb();
  return db.query.planDaySlots.findMany({
    where: eq(planDaySlots.planDayId, workspaceDay.id),
    orderBy: [asc(planDaySlots.slotIndex), asc(planDaySlots.createdAt)],
  });
}

async function getOrCreateTodayWorkspaceDaySlot(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotIndex: number;
  title: string;
  origin?: typeof planDaySlots.$inferInsert.origin;
  sourceId?: string;
  routeFingerprint?: string;
}) {
  const workspacePlan = await getOrCreateTodayWorkspacePlan(params.organizationId, params.learnerId);
  const workspaceDay = await getOrCreateTodayWorkspaceDay(params);
  const db = getDb();
  const existing = await db.query.planDaySlots.findFirst({
    where: and(
      eq(planDaySlots.planDayId, workspaceDay.id),
      eq(planDaySlots.slotIndex, params.slotIndex),
    ),
  });

  if (existing) {
    const nextMetadata = {
      ...(isRecord(existing.metadata) ? existing.metadata : {}),
      sourceId: params.sourceId ?? (isRecord(existing.metadata) ? existing.metadata.sourceId : null),
      routeFingerprint:
        params.routeFingerprint ??
        (isRecord(existing.metadata) ? existing.metadata.routeFingerprint : null),
    };
    const needsUpdate =
      existing.title !== params.title ||
      existing.origin !== (params.origin ?? existing.origin) ||
      JSON.stringify(existing.metadata ?? null) !== JSON.stringify(nextMetadata);

    if (!needsUpdate) {
      return existing;
    }

    const [updated] = await db
      .update(planDaySlots)
      .set({
        title: params.title,
        origin: params.origin ?? existing.origin,
        metadata: nextMetadata,
        updatedAt: new Date(),
      })
      .where(eq(planDaySlots.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(planDaySlots)
    .values({
      planId: workspacePlan.id,
      planDayId: workspaceDay.id,
      slotIndex: params.slotIndex,
      title: params.title,
      origin: params.origin ?? "system_generated",
      status: "planned",
      metadata: {
        sourceId: params.sourceId ?? null,
        routeFingerprint: params.routeFingerprint ?? null,
      },
    })
    .returning();

  return created;
}

function readTodaySlotMetadataState(
  metadata: unknown,
  sourceId: string,
  routeFingerprint: string,
): TodayWorkspaceMetadataState {
  if (!isRecord(metadata)) {
    return {
      lessonDraft: null,
      lessonBuild: null,
      activityBuild: null,
      lessonRegenerationNote: null,
      expansionIntent: null,
    };
  }

  const resolvedSourceId =
    typeof metadata.sourceId === "string" ? metadata.sourceId : sourceId;
  const resolvedRouteFingerprint =
    typeof metadata.routeFingerprint === "string" ? metadata.routeFingerprint : routeFingerprint;

  return {
    lessonDraft: readLessonDraftFromMetadata(
      {
        [TODAY_LESSON_DRAFTS_KEY]: {
          [resolvedSourceId]: {
            [resolvedRouteFingerprint]: metadata.lessonDraft,
          },
        },
      },
      resolvedSourceId,
      resolvedRouteFingerprint,
    ),
    lessonBuild: readLessonBuildFromMetadata(
      {
        [TODAY_LESSON_BUILDS_KEY]: {
          [resolvedSourceId]: {
            [resolvedRouteFingerprint]: metadata.lessonBuild,
          },
        },
      },
      resolvedSourceId,
      resolvedRouteFingerprint,
    ),
    activityBuild: readActivityBuildFromMetadata(
      {
        [TODAY_ACTIVITY_BUILDS_KEY]: {
          [resolvedSourceId]: {
            [resolvedRouteFingerprint]: metadata.activityBuild,
          },
        },
      },
      resolvedSourceId,
      resolvedRouteFingerprint,
    ),
    lessonRegenerationNote:
      typeof metadata.lessonRegenerationNote === "string" ? metadata.lessonRegenerationNote : null,
    expansionIntent: isExpansionIntent(metadata.expansionIntent) ? metadata.expansionIntent : null,
  };
}

function readTodaySlotFreshness(
  metadata: unknown,
  sourceId: string,
  routeFingerprint: string,
): TodayWorkspaceFreshnessRecord | null {
  if (!isRecord(metadata) || !isRecord(metadata.freshness)) {
    return null;
  }

  const freshness = metadata.freshness;
  return {
    sourceId: typeof freshness.sourceId === "string" ? freshness.sourceId : sourceId,
    routeFingerprint:
      typeof freshness.routeFingerprint === "string"
        ? freshness.routeFingerprint
        : routeFingerprint,
    itemCount: typeof freshness.itemCount === "number" ? freshness.itemCount : 0,
    syncedAt:
      typeof freshness.syncedAt === "string" ? freshness.syncedAt : new Date().toISOString(),
  };
}

async function findTodayWorkspaceSlot(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}) {
  const db = getDb();
  if (params.slotId) {
    const slot = await db.query.planDaySlots.findFirst({
      where: eq(planDaySlots.id, params.slotId),
    });
    if (slot) {
      return slot;
    }
  }

  const slots = await getTodayWorkspaceDaySlots(params);
  return (
    slots.find((slot) => {
      const metadata = isRecord(slot.metadata) ? slot.metadata : null;
      return (
        metadata?.sourceId === params.sourceId &&
        metadata?.routeFingerprint === params.routeFingerprint
      );
    }) ?? null
  );
}

async function readTodayWorkspaceStoredStateForSlot(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}): Promise<TodayWorkspaceStoredState> {
  const slot = await findTodayWorkspaceSlot(params);
  if (!slot) {
    return {
      metadataState: {
        lessonDraft: null,
        lessonBuild: null,
        activityBuild: null,
        lessonRegenerationNote: null,
        expansionIntent: null,
      },
      freshness: null,
    };
  }

  return {
    metadataState: readTodaySlotMetadataState(slot.metadata, params.sourceId, params.routeFingerprint),
    freshness: readTodaySlotFreshness(slot.metadata, params.sourceId, params.routeFingerprint),
  };
}

async function updateTodayWorkspaceSlotMetadata(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  patch: (metadata: Record<string, unknown>, now: string) => Record<string, unknown>;
}) {
  const slot =
    (await findTodayWorkspaceSlot(params)) ??
    (params.slotIndex && params.title
      ? await getOrCreateTodayWorkspaceDaySlot({
          organizationId: params.organizationId,
          learnerId: params.learnerId,
          date: params.date,
          slotIndex: params.slotIndex,
          title: params.title,
          sourceId: params.sourceId,
          routeFingerprint: params.routeFingerprint,
        })
      : null);

  if (!slot) {
    throw new Error("Today workspace slot not found.");
  }

  const db = getDb();
  const now = new Date().toISOString();
  const currentMetadata = isRecord(slot.metadata) ? slot.metadata : {};
  const nextMetadata = {
    ...currentMetadata,
    sourceId: params.sourceId,
    routeFingerprint: params.routeFingerprint,
    ...params.patch(currentMetadata, now),
  };

  const [updated] = await db
    .update(planDaySlots)
    .set({
      metadata: nextMetadata,
      updatedAt: new Date(now),
    })
    .where(eq(planDaySlots.id, slot.id))
    .returning();

  return updated;
}

async function writeTodayWorkspaceFreshness(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
  itemCount: number;
}) {
  const day = await getOrCreateTodayWorkspaceDay(params);
  const db = getDb();
  const metadata = isRecord(day.metadata) ? day.metadata : {};
  const freshnessSources = isRecord(metadata[TODAY_WORKSPACE_FRESHNESS_KEY])
    ? (metadata[TODAY_WORKSPACE_FRESHNESS_KEY] as Record<string, unknown>)
    : {};
  const sourceFreshness = isRecord(freshnessSources[params.sourceId])
    ? (freshnessSources[params.sourceId] as Record<string, unknown>)
    : {};
  const syncedAt = new Date().toISOString();

  await db
    .update(planDays)
    .set({
      metadata: {
        ...metadata,
        [TODAY_WORKSPACE_FRESHNESS_KEY]: {
          ...freshnessSources,
          [params.sourceId]: {
            ...sourceFreshness,
            [params.routeFingerprint]: {
              sourceId: params.sourceId,
              routeFingerprint: params.routeFingerprint,
              itemCount: params.itemCount,
              syncedAt,
            },
          },
        },
      },
      updatedAt: new Date(syncedAt),
    })
    .where(eq(planDays.id, day.id));
}

async function readTodayWorkspaceStoredState(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}): Promise<TodayWorkspaceStoredState> {
  if (!params.routeFingerprint) {
    return {
      metadataState: {
        lessonDraft: null,
        lessonBuild: null,
        activityBuild: null,
        lessonRegenerationNote: null,
        expansionIntent: null,
      },
      freshness: null,
    };
  }

  return readTodayWorkspaceStoredStateForSlot(params);
}

async function readTodayWorkspaceFreshnessState(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  selectedRouteItemCount: number;
}) {
  return withTodayTiming(
    "readTodayWorkspaceFreshnessState",
    {
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: params.sourceId,
      routeFingerprint: params.routeFingerprint,
      selectedRouteItemCount: params.selectedRouteItemCount,
    },
    async (): Promise<TodayWorkspaceFreshnessState> => {
      const storedState = await readTodayWorkspaceStoredState(params);
      const isFresh = isTodayWorkspaceFresh({
        freshness: storedState.freshness,
        routeFingerprint: params.routeFingerprint,
        selectedRouteItemCount: params.selectedRouteItemCount,
      });

      return {
        status:
          isFresh
            ? "fresh"
            : storedState.freshness === null
              ? "missing"
              : "stale",
        storedState,
      };
    },
  );
}

function isTodayWorkspaceFresh(params: {
  freshness: TodayWorkspaceFreshnessRecord | null;
  routeFingerprint: string;
  selectedRouteItemCount: number;
}) {
  return (
    params.selectedRouteItemCount === 0 ||
    (params.freshness?.routeFingerprint === params.routeFingerprint &&
      params.freshness.itemCount === params.selectedRouteItemCount)
  );
}

function readTodayPlanItemSyncMetadata(metadata: unknown) {
  if (!isRecord(metadata)) {
    return {
      sourceLabel: null,
      lessonLabel: null,
      weeklyRouteItemId: null,
      skillNodeId: null,
    };
  }

  return {
    sourceLabel: typeof metadata.sourceLabel === "string" ? metadata.sourceLabel : null,
    lessonLabel: typeof metadata.lessonLabel === "string" ? metadata.lessonLabel : null,
    weeklyRouteItemId:
      typeof metadata.weeklyRouteItemId === "string" ? metadata.weeklyRouteItemId : null,
    skillNodeId: typeof metadata.skillNodeId === "string" ? metadata.skillNodeId : null,
  };
}

function buildTodayPlanItemUpdatePatch(
  existingPlanItem: typeof planItems.$inferSelect,
  nextValues: TodayPlanItemPayload,
) {
  // A route-backed plan item is dirty only when the persisted Today-facing fields diverge from
  // the desired canonical route projection. No-op rows intentionally skip updatedAt churn.
  const mergedMetadata = {
    ...(isRecord(existingPlanItem.metadata) ? existingPlanItem.metadata : {}),
    ...nextValues.metadata,
  };
  const currentMetadata = readTodayPlanItemSyncMetadata(existingPlanItem.metadata);
  const nextMetadata = readTodayPlanItemSyncMetadata(mergedMetadata);
  const isDirty =
    existingPlanItem.planId !== nextValues.planId ||
    existingPlanItem.planDayId !== nextValues.planDayId ||
    (existingPlanItem.planDaySlotId ?? null) !== nextValues.planDaySlotId ||
    existingPlanItem.curriculumItemId !== nextValues.curriculumItemId ||
    existingPlanItem.title !== nextValues.title ||
    (existingPlanItem.description ?? null) !== (nextValues.description ?? null) ||
    (existingPlanItem.subject ?? null) !== (nextValues.subject ?? null) ||
    existingPlanItem.status !== nextValues.status ||
    (existingPlanItem.scheduledDate ?? null) !== nextValues.scheduledDate ||
    (existingPlanItem.estimatedMinutes ?? null) !== nextValues.estimatedMinutes ||
    (existingPlanItem.ordering ?? null) !== nextValues.ordering ||
    currentMetadata.sourceLabel !== nextMetadata.sourceLabel ||
    currentMetadata.lessonLabel !== nextMetadata.lessonLabel ||
    currentMetadata.weeklyRouteItemId !== nextMetadata.weeklyRouteItemId ||
    currentMetadata.skillNodeId !== nextMetadata.skillNodeId;

  if (!isDirty) {
    return null;
  }

  return {
    ...nextValues,
    metadata: mergedMetadata,
    updatedAt: new Date(),
  };
}

async function syncTodayPlanItems(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  sourceTitle: string;
  /** Session budget from the canonical timing contract. Used for lesson session scheduledMinutes. */
  sessionBudgetMinutes: number;
  selectedRouteSlots: TodayRouteSlotSelection[];
  nodeById: Map<string, Awaited<ReturnType<typeof listCurriculumNodes>>[number]>;
}) {
  return withTodayTiming(
    "syncTodayPlanItems",
    {
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      selectedRouteItemCount: params.selectedRouteSlots.reduce(
        (total, slot) => total + slot.routeItems.length,
        0,
      ),
      selectedSlotCount: params.selectedRouteSlots.length,
    },
    async () => {
      const db = getDb();
      const workspacePlan = await getOrCreateTodayWorkspacePlan(
        params.organizationId,
        params.learnerId,
      );
      const workspaceDay = await getOrCreateTodayWorkspaceDay(params);
      const routeItemIds = params.selectedRouteSlots.flatMap((slot) =>
        slot.routeItems.map((item) => item.id),
      );

      if (routeItemIds.length === 0) {
        return new Map<string, TodayMaterializedWorkflowEntry>();
      }

      const slotRows = await Promise.all(
        params.selectedRouteSlots.map((slot) =>
          getOrCreateTodayWorkspaceDaySlot({
            organizationId: params.organizationId,
            learnerId: params.learnerId,
            date: params.date,
            slotIndex: slot.slotIndex,
            title: slot.title,
            origin: slot.slotIndex === 1 ? "system_generated" : "manual",
            sourceId: params.sourceId,
            routeFingerprint: slot.routeFingerprint,
          }),
        ),
      );
      const slotByIndex = new Map(slotRows.map((slot) => [slot.slotIndex, slot]));

      const existingLinks = await db.query.planItemCurriculumLinks.findMany({
        where: inArray(planItemCurriculumLinks.weeklyRouteItemId, routeItemIds),
      });
      const existingPlanItemIds = [...new Set(existingLinks.map((link) => link.planItemId))];
      const existingPlanItems =
        existingPlanItemIds.length > 0
          ? await db.query.planItems.findMany({
              where: inArray(planItems.id, existingPlanItemIds),
            })
          : [];
      const existingPlanItemById = new Map(existingPlanItems.map((item) => [item.id, item]));
      const existingPlanItemByRouteItemId = new Map<string, typeof planItems.$inferSelect>();

      for (const link of existingLinks) {
        if (typeof link.weeklyRouteItemId !== "string") {
          continue;
        }

        const planItem = existingPlanItemById.get(link.planItemId);
        if (planItem) {
          existingPlanItemByRouteItemId.set(link.weeklyRouteItemId, planItem);
        }
      }

      const routeItemPayloads = params.selectedRouteSlots.flatMap((slot) =>
        slot.routeItems.map((routeItem, index) => {
        const slotRecord = slotByIndex.get(slot.slotIndex);
        if (!slotRecord) {
          throw new Error(`Today workspace slot not found for slotIndex ${slot.slotIndex}.`);
        }
        const node = params.nodeById.get(routeItem.skillNodeId);
        const scheduledDate = routeItem.scheduledDate ?? params.date;
        const itemEffortMinutes = node?.estimatedMinutes ?? params.sessionBudgetMinutes;
        const subject = node?.normalizedPath.split("/")[0] ?? params.sourceTitle;
        const lessonLabel = getSkillPathLabel(routeItem.skillPath);
        const planItemStatus: typeof planItems.$inferInsert.status =
          mapRouteStateToPlanStatus(routeItem.state) === "blocked" ? "skipped" : "ready";

        return {
          routeItem,
          scheduledDate,
          values: {
            planId: workspacePlan.id,
            planDayId: workspaceDay.id,
            planDaySlotId: slotRecord.id,
            curriculumItemId: null,
            title: routeItem.skillTitle,
            description: node?.description ?? routeItem.skillTitle,
            subject,
            status: planItemStatus,
            scheduledDate,
            estimatedMinutes: itemEffortMinutes,
            ordering: slot.slotIndex * 100 + index,
            metadata: {
              sourceLabel: params.sourceTitle,
              lessonLabel,
              weeklyRouteItemId: routeItem.id,
              skillNodeId: routeItem.skillNodeId,
            },
          } satisfies TodayPlanItemPayload,
        };
      }));

      const itemsToCreate = routeItemPayloads.filter(
        ({ routeItem }) => !existingPlanItemByRouteItemId.has(routeItem.id),
      );
      const dirtyUpdates = routeItemPayloads.flatMap(({ routeItem, values }) => {
        const existingPlanItem = existingPlanItemByRouteItemId.get(routeItem.id);
        if (!existingPlanItem) {
          return [];
        }

        const patch = buildTodayPlanItemUpdatePatch(existingPlanItem, values);
        return patch
          ? [{ planItemId: existingPlanItem.id, routeItemId: routeItem.id, patch }]
          : [];
      });

      const createdPlanItems =
        itemsToCreate.length > 0
          ? await db.insert(planItems).values(itemsToCreate.map(({ values }) => values)).returning()
          : [];

      if (dirtyUpdates.length > 0) {
        await Promise.all(
          dirtyUpdates.map(({ planItemId, patch }) =>
            db.update(planItems).set(patch).where(eq(planItems.id, planItemId)),
          ),
        );
      }

      const provisionalPlanItemByRouteItemId = new Map(existingPlanItemByRouteItemId);
      for (const planItem of createdPlanItems) {
        const routeItemId = readWeeklyRouteItemIdFromMetadata(planItem.metadata);
        if (routeItemId) {
          provisionalPlanItemByRouteItemId.set(routeItemId, planItem);
        }
      }

      const existingLinkedRouteItemIds = new Set(
        existingLinks
          .map((link) => link.weeklyRouteItemId)
          .filter((value): value is string => typeof value === "string"),
      );
      const missingLinks = routeItemPayloads.flatMap(({ routeItem }) => {
        if (existingLinkedRouteItemIds.has(routeItem.id)) {
          return [];
        }

        const planItem = provisionalPlanItemByRouteItemId.get(routeItem.id);
        if (!planItem) {
          return [];
        }

        return [
          {
            planItemId: planItem.id,
            sourceId: routeItem.sourceId,
            skillNodeId: routeItem.skillNodeId,
            weeklyRouteItemId: routeItem.id,
            origin: "curriculum_route" as const,
            metadata: {},
          },
        ];
      });

      if (missingLinks.length > 0) {
        await db.insert(planItemCurriculumLinks).values(missingLinks).onConflictDoNothing({
          target: planItemCurriculumLinks.weeklyRouteItemId,
        });
      }

      let resolvedPlanItemByRouteItemId = provisionalPlanItemByRouteItemId;
      if (createdPlanItems.length > 0 || missingLinks.length > 0) {
        const canonicalLinks = await db.query.planItemCurriculumLinks.findMany({
          where: inArray(planItemCurriculumLinks.weeklyRouteItemId, routeItemIds),
        });
        const canonicalPlanItemIds = [...new Set(canonicalLinks.map((link) => link.planItemId))];
        const canonicalPlanItems =
          canonicalPlanItemIds.length > 0
            ? await db.query.planItems.findMany({
                where: inArray(planItems.id, canonicalPlanItemIds),
              })
            : [];
        const canonicalPlanItemById = new Map(canonicalPlanItems.map((item) => [item.id, item]));
        resolvedPlanItemByRouteItemId = new Map<string, typeof planItems.$inferSelect>();

        for (const link of canonicalLinks) {
          if (typeof link.weeklyRouteItemId !== "string") {
            continue;
          }

          const planItem = canonicalPlanItemById.get(link.planItemId);
          if (planItem) {
            resolvedPlanItemByRouteItemId.set(link.weeklyRouteItemId, planItem);
          }
        }
      }

      const resolvedPlanItemIds = [
        ...new Set(
          routeItemPayloads
            .map(({ routeItem }) => resolvedPlanItemByRouteItemId.get(routeItem.id)?.id ?? null)
            .filter((value): value is string => Boolean(value)),
        ),
      ];
      const existingSessionRows =
        resolvedPlanItemIds.length > 0
          ? await db
              .select()
              .from(lessonSessions)
              .where(
                and(
                  eq(lessonSessions.organizationId, params.organizationId),
                  eq(lessonSessions.learnerId, params.learnerId),
                  eq(lessonSessions.sessionDate, params.date),
                  inArray(lessonSessions.planItemId, resolvedPlanItemIds),
                ),
              )
              .orderBy(desc(lessonSessions.updatedAt), desc(lessonSessions.createdAt))
          : [];
      const latestSessionByPlanItemId = new Map<string, typeof lessonSessions.$inferSelect>();
      for (const session of existingSessionRows) {
        if (!latestSessionByPlanItemId.has(session.planItemId)) {
          latestSessionByPlanItemId.set(session.planItemId, session);
        }
      }

      const materializedByRouteItemId = new Map<string, TodayMaterializedWorkflowEntry>();
      const preloadedSessionById = new Map<string, typeof lessonSessions.$inferSelect>();
      const sessionEnsures = routeItemPayloads.flatMap(({ routeItem }) => {
        const planItemRecord = resolvedPlanItemByRouteItemId.get(routeItem.id);
        if (!planItemRecord) {
          return [];
        }

        const existingSession = latestSessionByPlanItemId.get(planItemRecord.id) ?? null;
        if (existingSession) {
          preloadedSessionById.set(existingSession.id, existingSession);
          materializedByRouteItemId.set(routeItem.id, {
            planParentId: workspacePlan.id,
            planDayRecordId: workspaceDay.id,
            planDaySlotId: planItemRecord.planDaySlotId ?? null,
            planDaySlotIndex: routeItem.scheduledSlotIndex ?? null,
            planItemId: planItemRecord.id,
            lessonSessionId: existingSession.id,
            completionStatus: existingSession.completionStatus,
            reviewState: existingSession.reviewState,
            evidenceCount: 0,
            activityCount: 0,
          });
          return [];
        }

        return [{ routeItem, planItemRecord }];
      });

      const ensuredSessions = await Promise.all(
        sessionEnsures.map(async ({ routeItem, planItemRecord }) => {
          const session = await ensureSessionWorkspace({
            organizationId: params.organizationId,
            learnerId: params.learnerId,
            planId: workspacePlan.id,
            planDayId: workspaceDay.id,
            planDaySlotId: planItemRecord.planDaySlotId ?? null,
            planItemId: planItemRecord.id,
            sessionDate: params.date,
            scheduledMinutes: params.sessionBudgetMinutes,
            metadata: {
              weeklyRouteItemId: routeItem.id,
              sourceId: routeItem.sourceId,
              skillNodeId: routeItem.skillNodeId,
            },
          });

          return {
            routeItemId: routeItem.id,
            session,
            planItemId: planItemRecord.id,
          };
        }),
      );

      for (const ensured of ensuredSessions) {
        preloadedSessionById.set(ensured.session.id, ensured.session);
        materializedByRouteItemId.set(ensured.routeItemId, {
          planParentId: workspacePlan.id,
          planDayRecordId: workspaceDay.id,
          planDaySlotId: resolvedPlanItemByRouteItemId.get(ensured.routeItemId)?.planDaySlotId ?? null,
          planDaySlotIndex: routeItemPayloads.find(({ routeItem }) => routeItem.id === ensured.routeItemId)?.routeItem.scheduledSlotIndex ?? null,
          planItemId: ensured.planItemId,
          lessonSessionId: ensured.session.id,
          completionStatus: ensured.session.completionStatus,
          reviewState: ensured.session.reviewState,
          evidenceCount: 0,
          activityCount: 0,
        });
      }

      console.info("[today-runtime] syncTodayPlanItems:summary", {
        date: params.date,
        selectedRouteItemCount: routeItemPayloads.length,
        createdItemCount: createdPlanItems.length,
        updatedItemCount: dirtyUpdates.length,
        ensuredSessionCount: ensuredSessions.length,
        canonicalReload: createdPlanItems.length > 0 || missingLinks.length > 0,
      });

      return hydrateTodayMaterializedWorkflow(materializedByRouteItemId, {
        preloadedSessionById,
      });
    },
  );
}

async function hydrateTodayMaterializedWorkflow(
  entries: Map<string, TodayMaterializedWorkflowEntry>,
  options?: {
    preloadedSessionById?: Map<string, typeof lessonSessions.$inferSelect>;
  },
) {
  const db = getDb();
  const hydratedEntries = new Map(entries);
  const planItemIds = [...hydratedEntries.values()].map((entry) => entry.planItemId);
  const lessonSessionIds = [...hydratedEntries.values()]
    .map((entry) => entry.lessonSessionId)
    .filter((value): value is string => Boolean(value));

  const missingSessionIds = lessonSessionIds.filter(
    (sessionId) => !options?.preloadedSessionById?.has(sessionId),
  );
  const sessions =
    missingSessionIds.length > 0
      ? await db.query.lessonSessions.findMany({
          where: inArray(lessonSessions.id, missingSessionIds),
        })
      : [];
  const sessionById = new Map(options?.preloadedSessionById ?? []);
  for (const session of sessions) {
    sessionById.set(session.id, session);
  }

  const activityRows = planItemIds.length > 0
    ? await db.query.interactiveActivities.findMany({
        where: and(
          inArray(interactiveActivities.planItemId, planItemIds),
          eq(interactiveActivities.status, "published"),
        ),
      })
    : [];
  const activityCountByPlanItemId = new Map<string, number>();
  for (const activity of activityRows) {
    if (!activity.planItemId) {
      continue;
    }

    activityCountByPlanItemId.set(
      activity.planItemId,
      (activityCountByPlanItemId.get(activity.planItemId) ?? 0) + 1,
    );
  }

  const evidenceRows = lessonSessionIds.length > 0
    ? await db.query.evidenceRecords.findMany({
        where: inArray(evidenceRecords.lessonSessionId, lessonSessionIds),
      })
    : [];
  const evidenceCountBySessionId = new Map<string, number>();
  for (const evidence of evidenceRows) {
    if (!evidence.lessonSessionId) {
      continue;
    }

    evidenceCountBySessionId.set(
      evidence.lessonSessionId,
      (evidenceCountBySessionId.get(evidence.lessonSessionId) ?? 0) + 1,
    );
  }

  for (const [routeItemId, entry] of hydratedEntries) {
    const session = entry.lessonSessionId ? sessionById.get(entry.lessonSessionId) : null;
    hydratedEntries.set(routeItemId, {
      ...entry,
      completionStatus: session?.completionStatus ?? entry.completionStatus,
      reviewState: session?.reviewState ?? entry.reviewState,
      evidenceCount: entry.lessonSessionId
        ? evidenceCountBySessionId.get(entry.lessonSessionId) ?? 0
        : 0,
      activityCount: activityCountByPlanItemId.get(entry.planItemId) ?? 0,
    });
  }

  return hydratedEntries;
}

async function loadTodayMaterializedWorkflow(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  selectedRouteItems: WeeklyRouteBoard["items"];
}) {
  const workspacePlan = await getTodayWorkspacePlan(params.organizationId, params.learnerId);
  const workspaceDay = workspacePlan
    ? await getTodayWorkspaceDay({
        organizationId: params.organizationId,
        learnerId: params.learnerId,
        date: params.date,
      })
    : null;

  if (!workspacePlan || !workspaceDay || params.selectedRouteItems.length === 0) {
    return new Map<string, TodayMaterializedWorkflowEntry>();
  }

  const routeItemIds = params.selectedRouteItems.map((item) => item.id);
  const db = getDb();
  const links = await db.query.planItemCurriculumLinks.findMany({
    where: inArray(planItemCurriculumLinks.weeklyRouteItemId, routeItemIds),
  });
  const linkedPlanItemIds = [...new Set(links.map((link) => link.planItemId))];
  const linkedPlanItems = linkedPlanItemIds.length > 0
    ? await db.query.planItems.findMany({
        where: inArray(planItems.id, linkedPlanItemIds),
      })
    : [];
  const linkedPlanDaySlotIds = [
    ...new Set(
      linkedPlanItems
        .map((item) => item.planDaySlotId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const linkedSlots = linkedPlanDaySlotIds.length > 0
    ? await db.query.planDaySlots.findMany({
        where: inArray(planDaySlots.id, linkedPlanDaySlotIds),
      })
    : [];
  const slotById = new Map(linkedSlots.map((slot) => [slot.id, slot]));
  const planItemById = new Map(linkedPlanItems.map((item) => [item.id, item]));

  const sessionRows = linkedPlanItemIds.length > 0
    ? await db
        .select()
        .from(lessonSessions)
        .where(
          and(
            eq(lessonSessions.organizationId, params.organizationId),
            eq(lessonSessions.learnerId, params.learnerId),
            eq(lessonSessions.sessionDate, params.date),
            inArray(lessonSessions.planItemId, linkedPlanItemIds),
          ),
        )
        .orderBy(desc(lessonSessions.updatedAt), desc(lessonSessions.createdAt))
    : [];
  const latestSessionByPlanItemId = new Map<string, typeof lessonSessions.$inferSelect>();
  for (const session of sessionRows) {
    if (!latestSessionByPlanItemId.has(session.planItemId)) {
      latestSessionByPlanItemId.set(session.planItemId, session);
    }
  }

  const workflowEntries = new Map<string, TodayMaterializedWorkflowEntry>();
  for (const link of links) {
    if (typeof link.weeklyRouteItemId !== "string") {
      continue;
    }

    const planItem = planItemById.get(link.planItemId);
    if (!planItem) {
      continue;
    }

    const session = latestSessionByPlanItemId.get(planItem.id) ?? null;
    workflowEntries.set(link.weeklyRouteItemId, {
      planParentId: planItem.planId,
      planDayRecordId: planItem.planDayId,
      planDaySlotId: planItem.planDaySlotId ?? null,
      planDaySlotIndex: planItem.planDaySlotId
        ? (slotById.get(planItem.planDaySlotId)?.slotIndex ?? null)
        : null,
      planItemId: planItem.id,
      lessonSessionId: session?.id ?? null,
      completionStatus: session?.completionStatus ?? null,
      reviewState: session?.reviewState ?? null,
      evidenceCount: 0,
      activityCount: 0,
    });
  }

  return hydrateTodayMaterializedWorkflow(workflowEntries);
}

export async function getSavedTodayLessonDraft(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  return (await readTodayWorkspaceStoredState(params)).metadataState.lessonDraft;
}

export async function getSavedTodayLessonBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  return (await readTodayWorkspaceStoredState(params)).metadataState.lessonBuild;
}

export async function getSavedTodayActivityBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  return (await readTodayWorkspaceStoredState(params)).metadataState.activityBuild;
}

export async function getSavedTodayLessonRegenerationNote(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  return (await readTodayWorkspaceStoredState(params)).metadataState.lessonRegenerationNote;
}

export async function getSavedTodayExpansionIntent(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  return (await readTodayWorkspaceStoredState(params)).metadataState.expansionIntent;
}

export async function getTodayBuildStatus(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  lessonSessionId?: string | null;
}) {
  return withTodayTiming(
    "getTodayBuildStatus",
    {
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: params.sourceId,
      routeFingerprint: params.routeFingerprint,
    },
    async () => {
      const metadataState = await readTodayWorkspaceMetadataState(params);
      const lessonSessionId =
        params.lessonSessionId ?? metadataState.activityBuild?.lessonSessionId ?? null;

      return {
        lessonBuild: metadataState.lessonBuild,
        lessonDraft: metadataState.lessonDraft,
        activityBuild: metadataState.activityBuild,
        activityState: await buildTodayActivityStateFromDraft({
          lessonDraft: metadataState.lessonDraft,
          lessonSessionId,
        }),
      };
    },
  );
}

export async function getTodayLessonBuildStatus(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}) {
  const state = await getTodayBuildStatus(params);

  return {
    build: state.lessonBuild,
    draft: state.lessonDraft,
    activityBuild: state.activityBuild,
  };
}

export async function getTodayActivityBuildStatus(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  lessonSessionId?: string | null;
}) {
  const state = await getTodayBuildStatus(params);

  return {
    build: state.activityBuild,
    activityState: state.activityState,
  };
}

async function writeTodayLessonBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  patch: (
    current: DailyWorkspaceLessonBuild | null,
    now: string,
  ) => DailyWorkspaceLessonBuild;
}) {
  const current = await getSavedTodayLessonBuild(params);
  const updatedSlot = await updateTodayWorkspaceSlotMetadata({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    slotId: params.slotId,
    sourceId: params.sourceId,
    routeFingerprint: params.routeFingerprint,
    slotIndex: params.slotIndex,
    title: params.title,
    patch: (metadata, now) => ({
      lessonBuild: params.patch(current, now),
    }),
  });

  return readTodaySlotMetadataState(updatedSlot.metadata, params.sourceId, params.routeFingerprint)
    .lessonBuild as DailyWorkspaceLessonBuild;
}

export async function queueTodayLessonBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  trigger: DailyWorkspaceLessonBuildTrigger;
}) {
  return writeTodayLessonBuild({
    ...params,
    patch: (current, now) => {
      if (current?.status === "ready") {
        return current;
      }

      return {
        status: "queued",
        trigger: params.trigger,
        sourceId: params.sourceId,
        routeFingerprint: params.routeFingerprint,
        queuedAt: current?.queuedAt ?? now,
        startedAt: current?.startedAt,
        completedAt: undefined,
        failedAt: undefined,
        updatedAt: now,
        error: null,
      };
    },
  });
}

export async function markTodayLessonBuildGenerating(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  trigger: DailyWorkspaceLessonBuildTrigger;
}) {
  return writeTodayLessonBuild({
    ...params,
    patch: (current, now) => ({
      status: "generating",
      trigger: params.trigger,
      sourceId: params.sourceId,
      routeFingerprint: params.routeFingerprint,
      queuedAt: current?.queuedAt ?? now,
      startedAt: now,
      completedAt: undefined,
      failedAt: undefined,
      updatedAt: now,
      error: null,
    }),
  });
}

export async function markTodayLessonBuildFailed(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  trigger: DailyWorkspaceLessonBuildTrigger;
  error: string;
}) {
  return writeTodayLessonBuild({
    ...params,
    patch: (current, now) => ({
      status: "failed",
      trigger: params.trigger,
      sourceId: params.sourceId,
      routeFingerprint: params.routeFingerprint,
      queuedAt: current?.queuedAt ?? now,
      startedAt: current?.startedAt,
      completedAt: undefined,
      failedAt: now,
      updatedAt: now,
      error: params.error,
    }),
  });
}

export async function markTodayLessonBuildReady(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  trigger: DailyWorkspaceLessonBuildTrigger;
}) {
  return writeTodayLessonBuild({
    ...params,
    patch: (current, now) => ({
      status: "ready",
      trigger: params.trigger,
      sourceId: params.sourceId,
      routeFingerprint: params.routeFingerprint,
      queuedAt: current?.queuedAt ?? now,
      startedAt: current?.startedAt,
      completedAt: now,
      failedAt: undefined,
      updatedAt: now,
      error: null,
    }),
  });
}

async function writeTodayActivityBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  patch: (
    current: DailyWorkspaceActivityBuild | null,
    now: string,
  ) => DailyWorkspaceActivityBuild;
}) {
  const current = await getSavedTodayActivityBuild(params);
  const updatedSlot = await updateTodayWorkspaceSlotMetadata({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    slotId: params.slotId,
    sourceId: params.sourceId,
    routeFingerprint: params.routeFingerprint,
    slotIndex: params.slotIndex,
    title: params.title,
    patch: (metadata, now) => ({
      activityBuild: params.patch(current, now),
    }),
  });

  return readTodaySlotMetadataState(updatedSlot.metadata, params.sourceId, params.routeFingerprint)
    .activityBuild as DailyWorkspaceActivityBuild;
}

export async function queueTodayActivityBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  lessonSessionId?: string | null;
  trigger: DailyWorkspaceActivityBuildTrigger;
}) {
  return writeTodayActivityBuild({
    ...params,
    patch: (current, now) => ({
      status: "queued",
      trigger: params.trigger,
      sourceId: params.sourceId,
      routeFingerprint: params.routeFingerprint,
      lessonSessionId: params.lessonSessionId ?? current?.lessonSessionId ?? null,
      activityId: null,
      queuedAt: current?.queuedAt ?? now,
      startedAt: undefined,
      completedAt: undefined,
      failedAt: undefined,
      updatedAt: now,
      error: null,
    }),
  });
}

export async function markTodayActivityBuildGenerating(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  lessonSessionId?: string | null;
  trigger: DailyWorkspaceActivityBuildTrigger;
}) {
  return writeTodayActivityBuild({
    ...params,
    patch: (current, now) => ({
      status: "generating",
      trigger: params.trigger,
      sourceId: params.sourceId,
      routeFingerprint: params.routeFingerprint,
      lessonSessionId: params.lessonSessionId ?? current?.lessonSessionId ?? null,
      activityId: current?.activityId ?? null,
      queuedAt: current?.queuedAt ?? now,
      startedAt: now,
      completedAt: undefined,
      failedAt: undefined,
      updatedAt: now,
      error: null,
    }),
  });
}

export async function markTodayActivityBuildFailed(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  lessonSessionId?: string | null;
  trigger: DailyWorkspaceActivityBuildTrigger;
  error: string;
}) {
  return writeTodayActivityBuild({
    ...params,
    patch: (current, now) => ({
      status: "failed",
      trigger: params.trigger,
      sourceId: params.sourceId,
      routeFingerprint: params.routeFingerprint,
      lessonSessionId: params.lessonSessionId ?? current?.lessonSessionId ?? null,
      activityId: null,
      queuedAt: current?.queuedAt ?? now,
      startedAt: current?.startedAt,
      completedAt: undefined,
      failedAt: now,
      updatedAt: now,
      error: params.error,
    }),
  });
}

export async function markTodayActivityBuildReady(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  lessonSessionId?: string | null;
  activityId?: string | null;
  trigger: DailyWorkspaceActivityBuildTrigger;
}) {
  return writeTodayActivityBuild({
    ...params,
    patch: (current, now) => ({
      status: "ready",
      trigger: params.trigger,
      sourceId: params.sourceId,
      routeFingerprint: params.routeFingerprint,
      lessonSessionId: params.lessonSessionId ?? current?.lessonSessionId ?? null,
      activityId: params.activityId ?? current?.activityId ?? null,
      queuedAt: current?.queuedAt ?? now,
      startedAt: current?.startedAt,
      completedAt: now,
      failedAt: undefined,
      updatedAt: now,
      error: null,
    }),
  });
}

export async function saveTodayLessonRegenerationNote(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  note: string | null;
}) {
  await updateTodayWorkspaceSlotMetadata({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    slotId: params.slotId,
    sourceId: params.sourceId,
    routeFingerprint: params.routeFingerprint,
    slotIndex: params.slotIndex,
    title: params.title,
    patch: () => ({
      lessonRegenerationNote: params.note,
    }),
  });

  return params.note;
}

export async function saveTodayExpansionIntent(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  intent: DailyWorkspaceExpansionIntent | null;
}) {
  await updateTodayWorkspaceSlotMetadata({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    slotId: params.slotId,
    sourceId: params.sourceId,
    routeFingerprint: params.routeFingerprint,
    slotIndex: params.slotIndex,
    title: params.title,
    patch: () => ({
      expansionIntent: params.intent,
    }),
  });

  return params.intent;
}

export async function saveTodayLessonDraft(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  sourceTitle: string;
  routeFingerprint: string;
  slotIndex?: number;
  title?: string;
  structured: StructuredLessonDraft;
  promptVersion?: string;
}) {
  const savedAt = new Date().toISOString();

  await updateTodayWorkspaceSlotMetadata({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    slotId: params.slotId,
    sourceId: params.sourceId,
    routeFingerprint: params.routeFingerprint,
    slotIndex: params.slotIndex,
    title: params.title,
    patch: () => ({
      lessonDraft: {
        structured: params.structured,
        sourceId: params.sourceId,
        sourceTitle: params.sourceTitle,
        routeFingerprint: params.routeFingerprint,
        promptVersion: params.promptVersion ?? null,
        savedAt,
      },
    }),
  });

  return {
    structured: params.structured,
    sourceId: params.sourceId,
    sourceTitle: params.sourceTitle,
    routeFingerprint: params.routeFingerprint,
    promptVersion: params.promptVersion,
    savedAt,
  } satisfies DailyWorkspaceLessonDraft;
}

function mapRouteStateToPlanStatus(state: WeeklyRouteItem["state"]): PlanItem["status"] {
  if (state === "done") {
    return "completed";
  }

  if (state === "in_progress") {
    return "in_progress";
  }

  if (state === "removed") {
    return "blocked";
  }

  return "ready";
}

function getSkillPathLabel(path?: string) {
  if (!path) {
    return "Curriculum route";
  }

  return path
    .split("/")
    .filter(Boolean)
    .slice(0, 4)
    .join(" \u00b7 ");
}

function buildPlanItem(
  routeItem: WeeklyRouteBoard["items"][number],
  sourceTitle: string,
  date: string,
  sessionBudgetMinutes: number,
  node?: Awaited<ReturnType<typeof listCurriculumNodes>>[number],
  workflow?: TodayMaterializedWorkflowEntry,
): PlanItem {
  const subject = node?.normalizedPath.split("/")[0] ?? sourceTitle;
  // Item-effort: node override if explicitly set, otherwise the session budget.
  const estimatedMinutes = node?.estimatedMinutes ?? sessionBudgetMinutes;

  return {
    id: routeItem.id,
    date,
    planDaySlotId: workflow?.planDaySlotId ?? undefined,
    planDaySlotIndex: workflow?.planDaySlotIndex ?? routeItem.scheduledSlotIndex ?? undefined,
    title: routeItem.skillTitle,
    subject,
    kind: "lesson",
    objective: node?.description ?? routeItem.skillTitle,
    estimatedMinutes,
    status: mapRouteStateToPlanStatus(routeItem.state),
    standards: [],
    goals: [],
    materials: [
      sourceTitle,
      routeItem.skillPath,
      node?.title,
    ].filter((value): value is string => Boolean(value)),
    artifactSlots: ["work sample", "teacher note"],
    copilotPrompts: [
      `Generate a simpler explanation for ${routeItem.skillTitle}.`,
      `Draft an extension prompt using ${getSkillPathLabel(routeItem.skillPath)}.`,
    ],
    sourceLabel: sourceTitle,
    lessonLabel: getSkillPathLabel(routeItem.skillPath),
    planOrigin: "curriculum_route",
    planParentId: workflow?.planParentId,
    planDayRecordId: workflow?.planDayRecordId,
    planRecordId: workflow?.planItemId,
    sessionRecordId: workflow?.lessonSessionId ?? undefined,
    reviewState: workflow?.reviewState ?? undefined,
    completionStatus: workflow?.completionStatus ?? undefined,
    curriculum: {
      sourceId: routeItem.sourceId,
      skillNodeId: routeItem.skillNodeId,
      weeklyRouteItemId: routeItem.id,
      origin: "curriculum_route",
    },
    workflow,
    note:
      routeItem.manualOverrideNote ??
      (routeItem.manualOverrideKind === "none"
        ? undefined
        : `Manual override: ${routeItem.manualOverrideKind}`),
  };
}

function buildWeeklyRouteItem(
  routeItem: WeeklyRouteBoard["items"][number],
  sourceTitle: string,
  sessionBudgetMinutes: number,
  node?: Awaited<ReturnType<typeof listCurriculumNodes>>[number],
): WeeklyRouteItem {
  const subject = node?.normalizedPath.split("/")[0] ?? sourceTitle;
  // Item-effort: node override if explicitly set, otherwise the session budget.
  const estimatedMinutes = node?.estimatedMinutes ?? sessionBudgetMinutes;

  return {
    id: routeItem.id,
    weeklyRouteId: routeItem.weeklyRouteId,
    sourceId: routeItem.sourceId,
    skillNodeId: routeItem.skillNodeId,
    skillTitle: routeItem.skillTitle,
    skillDescription: node?.description ?? routeItem.skillTitle,
    subject,
    estimatedMinutes,
    recommendedPosition: routeItem.recommendedPosition,
    currentPosition: routeItem.currentPosition,
    scheduledDate: routeItem.scheduledDate ?? undefined,
    scheduledSlotIndex: routeItem.scheduledSlotIndex ?? undefined,
    manualOverrideKind: routeItem.manualOverrideKind,
    state: routeItem.state,
  };
}

function getVisibleRouteSlots(board: WeeklyRouteBoard, date: string): TodayRouteSlotSelection[] {
  const scheduledForToday = board.items
    .filter((item) => item.state !== "removed" && item.scheduledDate === date)
    .sort((left, right) => left.currentPosition - right.currentPosition);

  if (scheduledForToday.length > 0) {
    const grouped = new Map<number, WeeklyRouteBoard["items"]>();
    for (const item of scheduledForToday) {
      const slotIndex = normalizeSlotIndex(item.scheduledSlotIndex);
      const existing = grouped.get(slotIndex) ?? [];
      existing.push(item);
      grouped.set(slotIndex, existing);
    }

    return [...grouped.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([slotIndex, routeItems]) => ({
        slotIndex,
        title: `Lesson ${slotIndex}`,
        routeFingerprint: buildTodayLessonDraftFingerprint(routeItems.map((item) => item.id)),
        routeItems,
      }));
  }

  const routeItems = board.items
    .filter((item) => item.state !== "removed" && item.scheduledDate == null)
    .sort((left, right) => left.currentPosition - right.currentPosition)
    .slice(0, DEFAULT_UNSCHEDULED_ITEM_COUNT);

  if (routeItems.length === 0) {
    return [];
  }

  return [
    {
      slotIndex: 1,
      title: "Lesson 1",
      routeFingerprint: buildTodayLessonDraftFingerprint(routeItems.map((item) => item.id)),
      routeItems,
    },
  ];
}

function getAlternateItems(board: WeeklyRouteBoard, selectedIds: string[]) {
  const selectedSet = new Set(selectedIds);
  const alternates = board.items.filter(
    (item) => item.state !== "removed" && item.state !== "done" && !selectedSet.has(item.id),
  );

  return alternates.sort((left, right) => left.currentPosition - right.currentPosition);
}

function buildPrepChecklist(
  learnerName: string,
  sourceTitle: string,
  selectedItems: PlanItem[],
) {
  const leadTitle = selectedItems[0]?.title ?? "the next route item";
  return [
    `Open ${sourceTitle} and pull the materials for ${leadTitle}.`,
    `Keep the route board in view so ${learnerName} stays aligned with the active sequence.`,
    "Leave space for one end-of-day note before the first block starts.",
  ];
}

function buildSessionTargets(selectedItems: PlanItem[]) {
  return selectedItems.slice(0, 3).map((item) => `${item.subject}: ${item.title}`);
}

function buildCopilotInsertions(
  learnerName: string,
  sourceTitle: string,
  selectedItems: PlanItem[],
) {
  const lead = selectedItems[0];
  return [
    `Simplify ${lead?.title ?? "the lead lesson"} for ${learnerName} if the first pass stalls.`,
    `Draft an extension for ${sourceTitle} that stays within the current route sequence.`,
    `Summarize today's execution so tomorrow's planning view reflects the real outcome.`,
  ];
}

function buildFamilyNotes(sourceTitle: string, selectedItems: PlanItem[]) {
  return [
    `Today's route comes from ${sourceTitle}.`,
    `${selectedItems.length} curriculum item${selectedItems.length === 1 ? "" : "s"} are visible in today's handoff.`,
  ];
}

function buildArtifactSlots(sourceTitle: string, selectedItems: PlanItem[]) {
  const leadTitle = selectedItems[0]?.title ?? "the lead lesson";
  return [
    {
      label: "Lesson artifacts",
      status: "open" as const,
      description: `Capture a work sample and notes for ${leadTitle} from ${sourceTitle}.`,
    },
    {
      label: "Copilot follow-ups",
      status: "waiting" as const,
      description: "Leave room for a reteach or extension prompt once the lesson settles.",
    },
    {
      label: "Tracking handoff",
      status: "suggested" as const,
      description: "Mark completion here so the learner record reflects the real day.",
    },
  ];
}

const resolveSourceContext = cache(async (organizationId: string) => ({
  selectedSource: await getLiveCurriculumSource(organizationId),
}));

const resolveTodayWorkspaceContext = cache(
  async (
    organizationId: string,
    learnerId: string,
    learnerName: string,
    date: string,
  ): Promise<TodayWorkspaceContext | null> =>
    withTodayTiming(
      "resolveTodayWorkspaceContext",
      {
        organizationId,
        learnerId,
        date,
      },
      async () => {
        const { selectedSource } = await resolveSourceContext(organizationId);

        if (!selectedSource) {
          return null;
        }

        const sessionTiming = resolveLessonSessionMinutes({
          sourceSessionMinutes: selectedSource.pacing?.sessionMinutes,
        });
        const sessionBudgetMinutes = sessionTiming.resolvedTotalMinutes;
        const weekStartDate = toWeekStartDate(date);
        const [{ board }, nodes] = await Promise.all([
          withTodayTiming(
            "resolveTodayWeeklyRouteBoard",
            {
              organizationId,
              learnerId,
              date,
              sourceId: selectedSource.id,
              weekStartDate,
            },
            async () => {
              const readResult = await getReadOptimizedWeeklyRouteBoardForToday({
                learnerId,
                sourceId: selectedSource.id,
                weekStartDate,
              });

              if (readResult.board) {
                console.info("[today-runtime] resolveTodayWeeklyRouteBoard:mode", {
                  organizationId,
                  learnerId,
                  date,
                  sourceId: selectedSource.id,
                  weekStartDate,
                  mode: readResult.mode,
                  maintenanceReason: readResult.maintenanceReason,
                });

                return {
                  weekStartDate: readResult.weekStartDate,
                  board: readResult.board,
                };
              }

              console.info("[today-runtime] resolveTodayWeeklyRouteBoard:mode", {
                organizationId,
                learnerId,
                date,
                sourceId: selectedSource.id,
                weekStartDate,
                mode: readResult.mode,
                maintenanceReason: readResult.maintenanceReason,
              });

              return getOrCreateWeeklyRouteBoardForLearner({
                learnerId,
                sourceId: selectedSource.id,
                weekStartDate,
              });
            },
          ),
          withTodayTiming(
            "resolveTodayCurriculumNodes",
            {
              organizationId,
              learnerId,
              date,
              sourceId: selectedSource.id,
            },
            () => listCurriculumNodes(selectedSource.id),
          ),
        ]);
        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        const selectedRouteSlots = getVisibleRouteSlots(board, date);
        const selectedRouteItems = selectedRouteSlots.flatMap((slot) => slot.routeItems);
        const planningContext = buildCopilotPlanningContext({
          board,
          learnerId,
          learnerName,
          sourceId: selectedSource.id,
          selectedDate: date,
        });

        return {
          selectedSource,
          sourceId: selectedSource.id,
          sourceTitle: selectedSource.title,
          sessionTiming,
          sessionBudgetMinutes,
          board,
          selectedRouteSlots,
          selectedRouteItems,
          nodeById,
          planningContext,
          routeFingerprint: selectedRouteSlots[0]?.routeFingerprint ?? "",
        };
      },
    ),
);

async function readTodayWorkspaceMetadataState(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  slotId?: string | null;
  sourceId: string;
  routeFingerprint: string;
}): Promise<TodayWorkspaceMetadataState> {
  return (await readTodayWorkspaceStoredState(params)).metadataState;
}

async function loadLatestEvaluationsForPlanItems(items: PlanItem[]) {
  const syncedSessionIds = items
    .map((item) => item.sessionRecordId)
    .filter((value): value is string => Boolean(value));
  const syncedPlanItemIds = items
    .map((item) => item.planRecordId)
    .filter((value): value is string => Boolean(value));

  if (syncedSessionIds.length === 0 || syncedPlanItemIds.length === 0) {
    return items;
  }

  const db = getDb();
  const latestFeedbackRows = await db.query.feedbackEntries.findMany({
    where: and(
      inArray(feedbackEntries.lessonSessionId, syncedSessionIds),
      inArray(feedbackEntries.planItemId, syncedPlanItemIds),
    ),
    orderBy: [desc(feedbackEntries.createdAt)],
  });

  const latestEvaluationByPlanItemId = new Map<
    string,
    {
      level: LessonEvaluationLevel;
      label: string;
      note?: string;
      createdAt: string;
    }
  >();

  for (const entry of latestFeedbackRows) {
    if (!entry.planItemId || latestEvaluationByPlanItemId.has(entry.planItemId)) {
      continue;
    }

    const metadata = isRecord(entry.metadata) ? entry.metadata : null;
    if (!metadata || metadata.source !== "lesson_evaluation") {
      continue;
    }

    const level = isLessonEvaluationLevel(metadata.evaluationLevel)
      ? metadata.evaluationLevel
      : getLessonEvaluationLevelFromRating(entry.rating) ?? "successful";

    latestEvaluationByPlanItemId.set(entry.planItemId, {
      level,
      label:
        typeof metadata.evaluationLabel === "string"
          ? metadata.evaluationLabel
          : getLessonEvaluationLabel(level),
      note:
        typeof metadata.note === "string" && metadata.note.trim().length > 0
          ? metadata.note
          : undefined,
      createdAt: entry.createdAt.toISOString(),
    });
  }

  return items.map((item) => {
    const latestEvaluation = item.planRecordId
      ? latestEvaluationByPlanItemId.get(item.planRecordId)
      : undefined;

    return latestEvaluation ? { ...item, latestEvaluation } : item;
  });
}

export async function materializeTodayWorkspace(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}) {
  const context = await resolveTodayWorkspaceContext(
    params.organizationId,
    params.learnerId,
    params.learnerName,
    params.date,
  );

  return materializeTodayWorkspaceFromContext({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    context,
  });
}

type TodayWorkspaceViewResult = {
  workspace: DailyWorkspace;
  sourceId: string;
  sourceTitle: string;
  sessionTiming: LessonTimingContract;
  planningContext: ReturnType<typeof buildCopilotPlanningContext> | null;
  routeFingerprint: string;
};

async function materializeTodayWorkspaceFromContext(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  context: TodayWorkspaceContext | null;
}) {
  if (!params.context || params.context.selectedRouteItems.length === 0) {
    return params.context;
  }

  const context = params.context;

  await withTodayTiming(
    "materializeTodayWorkspace",
    {
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: context.sourceId,
      routeFingerprint: context.routeFingerprint,
      selectedRouteItemCount: context.selectedRouteItems.length,
    },
    async () => {
      await syncTodayPlanItems({
        organizationId: params.organizationId,
        learnerId: params.learnerId,
        date: params.date,
        sourceId: context.sourceId,
        sourceTitle: context.sourceTitle,
        sessionBudgetMinutes: context.sessionBudgetMinutes,
        selectedRouteSlots: context.selectedRouteSlots,
        nodeById: context.nodeById,
      });
    },
  );

  return context;
}

export async function getTodayWorkspaceViewFromContext(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
  context: TodayWorkspaceContext;
  metadataState?: TodayWorkspaceMetadataState;
}): Promise<TodayWorkspaceViewResult> {
  return withTodayTiming(
    "getTodayWorkspaceView",
    {
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
      sourceId: params.context.sourceId,
      routeFingerprint: params.context.routeFingerprint,
      selectedRouteItemCount: params.context.selectedRouteItems.length,
    },
    async () => {
      const context = params.context;
      const metadataState =
        params.metadataState ??
        (await readTodayWorkspaceMetadataState({
          organizationId: params.organizationId,
          learnerId: params.learnerId,
          date: params.date,
          sourceId: context.sourceId,
          routeFingerprint: context.routeFingerprint,
        }));

      if (context.board.items.length === 0) {
        return {
          sourceId: context.sourceId,
          sourceTitle: context.sourceTitle,
          sessionTiming: context.sessionTiming,
          planningContext: null,
          routeFingerprint: context.routeFingerprint,
          workspace: {
            date: params.date,
            headline: `${context.sourceTitle} route for ${params.learnerName}`,
            learner: {
              id: params.learnerId,
              name: params.learnerName,
              gradeLabel: "",
              pacingPreference: "Current weekly route",
              currentSeason: formatPlannerDate(params.date),
            },
            leadItem: {
              id: "today-empty",
              date: params.date,
              title: "No route items yet",
              subject: "Curriculum",
              kind: "review",
              objective:
                "Import curriculum or generate a weekly route to populate today's workspace.",
              estimatedMinutes: 0,
              status: "blocked",
              standards: [],
              goals: [],
              materials: [],
              artifactSlots: [],
              copilotPrompts: [],
              sourceLabel: context.sourceTitle,
              lessonLabel: "Empty route",
              planOrigin: "manual",
            },
            slots: [],
            items: [],
            prepChecklist: [],
            sessionTargets: [],
            artifactSlots: buildArtifactSlots(context.sourceTitle, []),
            copilotInsertions: [],
            completionPrompts: [],
            familyNotes: [],
            recoveryOptions: [],
            alternatesByPlanItemId: {},
            lessonDraft: null,
            lessonBuild: null,
            activityBuild: null,
            activityState: { status: "no_draft" },
            lessonRegenerationNote: null,
            expansionIntent: null,
          },
        };
      }

      if (context.selectedRouteItems.length === 0) {
        return {
          sourceId: context.sourceId,
          sourceTitle: context.sourceTitle,
          sessionTiming: context.sessionTiming,
          planningContext: context.planningContext,
          routeFingerprint: context.routeFingerprint,
          workspace: {
            date: params.date,
            headline: `${context.sourceTitle} route for ${params.learnerName}`,
            learner: {
              id: params.learnerId,
              name: params.learnerName,
              gradeLabel: "",
              pacingPreference: "Active route queue",
              currentSeason: "Current week",
            },
            leadItem: buildPlanItem(
              {
                ...context.board.items[0]!,
                scheduledDate: params.date,
              },
              context.sourceTitle,
              params.date,
              context.sessionBudgetMinutes,
                context.nodeById.get(context.board.items[0]!.skillNodeId),
            ),
            slots: [],
            items: [],
            prepChecklist: [],
            sessionTargets: [],
            artifactSlots: buildArtifactSlots(context.sourceTitle, []),
            copilotInsertions: [],
            completionPrompts: [],
            familyNotes: [],
            recoveryOptions: [],
            alternatesByPlanItemId: {},
            lessonDraft: null,
            lessonBuild: null,
            activityBuild: null,
            activityState: { status: "no_draft" },
            lessonRegenerationNote: null,
            expansionIntent: null,
          },
        };
      }

      const materializedWorkflow = await loadTodayMaterializedWorkflow({
        organizationId: params.organizationId,
        learnerId: params.learnerId,
        date: params.date,
        selectedRouteItems: context.selectedRouteItems,
      });
      const persistedSlots = await getTodayWorkspaceDaySlots({
        organizationId: params.organizationId,
        learnerId: params.learnerId,
        date: params.date,
      });
      const persistedSlotByIndex = new Map(persistedSlots.map((slot) => [slot.slotIndex, slot]));
      let selectedPlansWithWorkflow = context.selectedRouteItems.map((item) =>
        buildPlanItem(
          item,
          context.sourceTitle,
          item.scheduledDate ?? params.date,
          context.sessionBudgetMinutes,
          context.nodeById.get(item.skillNodeId),
          materializedWorkflow.get(item.id),
        ),
      );
      selectedPlansWithWorkflow = await loadLatestEvaluationsForPlanItems(selectedPlansWithWorkflow);
      const selectedPlanByRouteItemId = new Map(
        selectedPlansWithWorkflow.map((planItem) => [planItem.id, planItem]),
      );

      const alternateItems = getAlternateItems(
        context.board,
        context.selectedRouteItems.map((item) => item.id),
      );
      const alternatesByPlanItemId = Object.fromEntries(
        selectedPlansWithWorkflow.map((planItem) => [
          planItem.id,
          alternateItems
            .slice(0, 2)
            .map((routeItem) =>
              buildWeeklyRouteItem(
                routeItem,
                context.sourceTitle,
                context.sessionBudgetMinutes,
                context.nodeById.get(routeItem.skillNodeId),
              ),
            ),
        ]),
      );

      const slotViews: DailyWorkspaceSlot[] = await Promise.all(
        context.selectedRouteSlots.map(async (routeSlot) => {
          const persistedSlot = persistedSlotByIndex.get(routeSlot.slotIndex) ?? null;
          const routeItemIds = new Set(routeSlot.routeItems.map((item) => item.id));
          const slotItems = selectedPlansWithWorkflow.filter((item) => routeItemIds.has(item.id));
          const slotMetadata =
            persistedSlot != null
              ? readTodaySlotMetadataState(
                  persistedSlot.metadata,
                  context.sourceId,
                  routeSlot.routeFingerprint,
                )
              : {
                  lessonDraft: null,
                  lessonBuild: null,
                  activityBuild: null,
                  lessonRegenerationNote: null,
                  expansionIntent: null,
                };
          const leadItem = slotItems[0] ?? selectedPlanByRouteItemId.get(routeSlot.routeItems[0]?.id ?? "");
          if (!leadItem) {
            throw new Error(`Today workspace slot ${routeSlot.slotIndex} has no lead item.`);
          }

          const activityState = await buildTodayActivityStateFromDraft({
            lessonDraft: slotMetadata.lessonDraft,
            lessonSessionId:
              leadItem.sessionRecordId ?? leadItem.workflow?.lessonSessionId ?? null,
          });

          return {
            id: persistedSlot?.id ?? `virtual-slot-${routeSlot.slotIndex}`,
            date: params.date,
            sourceId: context.sourceId,
            slotIndex: routeSlot.slotIndex,
            title: persistedSlot?.title ?? routeSlot.title,
            origin: persistedSlot?.origin ?? (routeSlot.slotIndex === 1 ? "system_generated" : "manual"),
            status: persistedSlot?.status ?? "planned",
            routeFingerprint: routeSlot.routeFingerprint,
            leadItem,
            items: slotItems,
            prepChecklist: buildPrepChecklist(params.learnerName, context.sourceTitle, slotItems),
            sessionTargets: buildSessionTargets(slotItems),
            artifactSlots: buildArtifactSlots(context.sourceTitle, slotItems),
            lessonDraft: slotMetadata.lessonDraft,
            lessonBuild: slotMetadata.lessonBuild,
            activityBuild: slotMetadata.activityBuild,
            activityState,
            lessonRegenerationNote: slotMetadata.lessonRegenerationNote,
            expansionIntent: slotMetadata.expansionIntent,
          };
        }),
      );

      const activeSlot = slotViews[0];
      const topLevelMetadata =
        params.metadataState ??
        (activeSlot
          ? {
              lessonDraft: activeSlot.lessonDraft,
              lessonBuild: activeSlot.lessonBuild,
              activityBuild: activeSlot.activityBuild,
              lessonRegenerationNote: activeSlot.lessonRegenerationNote,
              expansionIntent: activeSlot.expansionIntent,
            }
          : {
              lessonDraft: null,
              lessonBuild: null,
              activityBuild: null,
              lessonRegenerationNote: null,
              expansionIntent: null,
            });

      const workspace: DailyWorkspace = {
        date: params.date,
        headline: `${context.sourceTitle} route for ${params.learnerName}`,
        learner: {
          id: params.learnerId,
          name: params.learnerName,
          gradeLabel: `${selectedPlansWithWorkflow.length} active item${selectedPlansWithWorkflow.length === 1 ? "" : "s"}`,
          pacingPreference: "Current weekly route",
          currentSeason: formatPlannerDate(params.date),
        },
        slots: slotViews,
        leadItem: activeSlot?.leadItem ?? selectedPlansWithWorkflow[0],
        items: selectedPlansWithWorkflow,
        prepChecklist: buildPrepChecklist(
          params.learnerName,
          context.sourceTitle,
          activeSlot?.items ?? selectedPlansWithWorkflow,
        ),
        sessionTargets: buildSessionTargets(activeSlot?.items ?? selectedPlansWithWorkflow),
        artifactSlots: buildArtifactSlots(
          context.sourceTitle,
          activeSlot?.items ?? selectedPlansWithWorkflow,
        ),
        copilotInsertions: buildCopilotInsertions(
          params.learnerName,
          context.sourceTitle,
          activeSlot?.items ?? selectedPlansWithWorkflow,
        ),
        completionPrompts: [
          "What did the learner complete today?",
          "What changed in pacing or support?",
          "Which route item should stay in view tomorrow?",
        ],
        familyNotes: [
          ...buildFamilyNotes(context.sourceTitle, selectedPlansWithWorkflow),
          `${slotViews.length} lesson slot${slotViews.length === 1 ? "" : "s"} are available today.`,
        ],
        recoveryOptions: [],
        alternatesByPlanItemId,
        lessonDraft: topLevelMetadata.lessonDraft,
        lessonBuild: topLevelMetadata.lessonBuild,
        activityBuild: topLevelMetadata.activityBuild,
        activityState: activeSlot?.activityState ?? null,
        lessonRegenerationNote: topLevelMetadata.lessonRegenerationNote,
        expansionIntent: topLevelMetadata.expansionIntent,
      };

      return {
        workspace,
        sourceId: context.sourceId,
        sourceTitle: context.sourceTitle,
        sessionTiming: context.sessionTiming,
        planningContext: context.planningContext,
        routeFingerprint: context.routeFingerprint,
      };
    },
  );
}

export async function getTodayWorkspaceView(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}): Promise<TodayWorkspaceViewResult | null> {
  const context = await resolveTodayWorkspaceContext(
    params.organizationId,
    params.learnerId,
    params.learnerName,
    params.date,
  );
  if (!context) {
    return null;
  }

  return getTodayWorkspaceViewFromContext({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    date: params.date,
    context,
  });
}

export async function getTodayWorkspaceViewForRender(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}): Promise<TodayWorkspaceViewResult | null> {
  return withTodayTiming(
    "getTodayWorkspaceViewForRender",
    {
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      date: params.date,
    },
    async () => {
      const context = await resolveTodayWorkspaceContext(
        params.organizationId,
        params.learnerId,
        params.learnerName,
        params.date,
      );
      if (!context) {
        return null;
      }
      await materializeTodayWorkspaceFromContext({
        organizationId: params.organizationId,
        learnerId: params.learnerId,
        date: params.date,
        context,
      });

      return getTodayWorkspaceViewFromContext({
        organizationId: params.organizationId,
        learnerId: params.learnerId,
        learnerName: params.learnerName,
        date: params.date,
        context,
      });
    },
  );
}

export async function getTodayWorkspace(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}) {
  return getTodayWorkspaceViewForRender(params);
}

async function loadWeeklyRouteItem(learnerId: string, weeklyRouteItemId: string) {
  const db = getDb();
  const routeItem = await db.query.weeklyRouteItems.findFirst({
    where: eq(weeklyRouteItems.id, weeklyRouteItemId),
  });

  if (!routeItem) {
    throw new Error(`Weekly route item not found: ${weeklyRouteItemId}`);
  }

  const route = await db.query.weeklyRoutes.findFirst({
    where: and(eq(weeklyRoutes.id, routeItem.weeklyRouteId), eq(weeklyRoutes.learnerId, learnerId)),
  });

  if (!route) {
    throw new Error("Weekly route not found.");
  }

  return { routeItem, route };
}

async function updateWeeklyRouteItem(
  learnerId: string,
  weeklyRouteItemId: string,
  updater: (current: typeof weeklyRouteItems.$inferSelect, routeDate: string) => Partial<typeof weeklyRouteItems.$inferSelect> & {
    eventType: typeof routeOverrideEvents.$inferInsert["eventType"];
    payload: Record<string, unknown>;
  },
) {
  const db = getDb();
  const { routeItem, route } = await loadWeeklyRouteItem(learnerId, weeklyRouteItemId);
  const next = updater(routeItem, route.weekStartDate);
  const { eventType, payload, ...columns } = next;

  await db.transaction(async (tx) => {
    await tx
      .update(weeklyRouteItems)
      .set({
        ...columns,
        updatedAt: new Date(),
      })
      .where(eq(weeklyRouteItems.id, routeItem.id));

    await tx.insert(routeOverrideEvents).values({
      learnerId,
      weeklyRouteItemId: routeItem.id,
      eventType,
      payload,
      createdByAdultUserId: null,
    });
  });
}

async function findMaterializedPlanItemForRouteItem(weeklyRouteItemId: string) {
  const db = getDb();
  const link = await db.query.planItemCurriculumLinks.findFirst({
    where: eq(planItemCurriculumLinks.weeklyRouteItemId, weeklyRouteItemId),
    orderBy: [desc(planItemCurriculumLinks.createdAt)],
  });

  if (!link) {
    return null;
  }

  const planItem = await db.query.planItems.findFirst({
    where: eq(planItems.id, link.planItemId),
  });

  if (!planItem) {
    return null;
  }

  return { link, planItem };
}

async function resolveTodayPlanItemContext(params: {
  weeklyRouteItemId: string;
  planParentId?: string | null;
  planDayRecordId?: string | null;
  planDaySlotId?: string | null;
  planRecordId?: string | null;
  sessionRecordId?: string | null;
}) {
  const db = getDb();

  let planItem =
    params.planRecordId
      ? await db.query.planItems.findFirst({
          where: eq(planItems.id, params.planRecordId),
        })
      : null;

  if (!planItem) {
    const materializedPlanItem = await findMaterializedPlanItemForRouteItem(params.weeklyRouteItemId);
    planItem = materializedPlanItem?.planItem ?? null;
  }

  let session =
    params.sessionRecordId
      ? await db.query.lessonSessions.findFirst({
          where: eq(lessonSessions.id, params.sessionRecordId),
        })
      : null;

  if (!session && planItem) {
    session = await db.query.lessonSessions.findFirst({
      where: eq(lessonSessions.planItemId, planItem.id),
      orderBy: [desc(lessonSessions.updatedAt), desc(lessonSessions.createdAt)],
    });
  }

  return {
    planId: params.planParentId ?? planItem?.planId ?? null,
    planDayId: params.planDayRecordId ?? planItem?.planDayId ?? null,
    planDaySlotId: params.planDaySlotId ?? planItem?.planDaySlotId ?? null,
    planItemId: params.planRecordId ?? planItem?.id ?? null,
    session,
    planItem,
  };
}

export async function completeTodayPlanItem(params: {
  organizationId: string;
  learnerId: string;
  weeklyRouteItemId: string;
  date: string;
  planParentId?: string | null;
  planDayRecordId?: string | null;
  planDaySlotId?: string | null;
  planRecordId?: string | null;
  estimatedMinutes?: number | null;
  title?: string | null;
}) {
  const context = await resolveTodayPlanItemContext(params);

  if (context.planItemId) {
    await completeSessionWorkspace({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planId: context.planId,
      planDayId: context.planDayId,
      planDaySlotId: context.planDaySlotId,
      planItemId: context.planItemId,
      sessionDate: params.date,
      scheduledMinutes: params.estimatedMinutes ?? context.planItem?.estimatedMinutes ?? null,
      actualMinutes: params.estimatedMinutes ?? context.planItem?.estimatedMinutes ?? null,
      completionStatus: "completed_as_planned",
      summary: `Completed ${params.title ?? context.planItem?.title ?? "this lesson"}.`,
      notes: null,
      retrospective: null,
      nextAction: null,
      deviationReason: null,
      metadata: {
        weeklyRouteItemId: params.weeklyRouteItemId,
        source: "today_workspace_complete",
      },
    });
  }

  await updateWeeklyRouteItem(params.learnerId, params.weeklyRouteItemId, (current) => ({
    state: "done",
    scheduledDate: current.scheduledDate,
    manualOverrideKind: current.manualOverrideKind,
    manualOverrideNote: current.manualOverrideNote ?? "Completed from today workspace.",
    eventType: "repair_applied",
    payload: {
      action: "complete",
      fromState: current.state,
      fromScheduledDate: current.scheduledDate,
    },
  }));
}

export async function resetTodayPlanItem(params: {
  organizationId: string;
  learnerId: string;
  weeklyRouteItemId: string;
  date: string;
  sessionRecordId?: string | null;
  planRecordId?: string | null;
}) {
  const context = await resolveTodayPlanItemContext(params);

  if (context.planItemId) {
    const db = getDb();
    const session =
      context.session ??
      (await db.query.lessonSessions.findFirst({
        where: and(
          eq(lessonSessions.organizationId, params.organizationId),
          eq(lessonSessions.learnerId, params.learnerId),
          eq(lessonSessions.planItemId, context.planItemId),
          eq(lessonSessions.sessionDate, params.date),
        ),
        orderBy: [desc(lessonSessions.updatedAt), desc(lessonSessions.createdAt)],
      }));

    if (session) {
      const progress = await db.query.progressRecords.findMany({
        where: and(
          eq(progressRecords.lessonSessionId, session.id),
          eq(progressRecords.planItemId, context.planItemId),
        ),
        orderBy: [desc(progressRecords.createdAt)],
      });
      const progressIds = progress.map((row) => row.id);

      const autoEvidence = await db.query.evidenceRecords.findMany({
        where: and(
          eq(evidenceRecords.lessonSessionId, session.id),
          eq(evidenceRecords.evidenceType, "note"),
          isNull(evidenceRecords.artifactId),
        ),
        orderBy: [desc(evidenceRecords.createdAt)],
      });
      const autoEvidenceIds = autoEvidence.map((row) => row.id);

      await db.transaction(async (tx) => {
        if (progressIds.length > 0) {
          await tx
            .delete(progressRecordStandards)
            .where(inArray(progressRecordStandards.progressRecordId, progressIds));
        }

        if (autoEvidenceIds.length > 0) {
          await tx
            .delete(evidenceRecordObjectives)
            .where(inArray(evidenceRecordObjectives.evidenceRecordId, autoEvidenceIds));
        }

        if (progressIds.length > 0) {
          await tx
            .delete(feedbackEntries)
            .where(inArray(feedbackEntries.progressRecordId, progressIds));
        }

        if (autoEvidenceIds.length > 0) {
          await tx
            .delete(feedbackEntries)
            .where(inArray(feedbackEntries.evidenceRecordId, autoEvidenceIds));
          await tx
            .delete(evidenceRecords)
            .where(inArray(evidenceRecords.id, autoEvidenceIds));
        }

        await tx
          .delete(reviewQueueItems)
          .where(
            and(
              eq(reviewQueueItems.subjectType, "session"),
              eq(reviewQueueItems.subjectId, session.id),
            ),
          );

        if (progressIds.length > 0) {
          await tx.delete(progressRecords).where(inArray(progressRecords.id, progressIds));
        }

        await tx
          .update(lessonSessions)
          .set({
            status: "planned",
            completionStatus: "not_started",
            reviewState: "not_required",
            actualMinutes: null,
            completedAt: null,
            reviewedAt: null,
            reviewedByAdultUserId: null,
            summary: null,
            notes: null,
            retrospective: null,
            nextAction: null,
            deviationReason: null,
            updatedAt: new Date(),
          })
          .where(eq(lessonSessions.id, session.id));
      });
    }
  }

  await updateWeeklyRouteItem(params.learnerId, params.weeklyRouteItemId, (current) => ({
    state: "scheduled",
    scheduledDate: params.date,
    manualOverrideKind:
      current.manualOverrideKind === "skip_acknowledged" ? "none" : current.manualOverrideKind,
    manualOverrideNote:
      current.manualOverrideNote === "Completed from today workspace."
        ? null
        : current.manualOverrideNote,
    eventType: "repair_applied",
    payload: {
      action: "reset_today_status",
      toDate: params.date,
    },
  }));
}

export async function partiallyCompleteTodayPlanItem(params: {
  organizationId: string;
  learnerId: string;
  weeklyRouteItemId: string;
  date: string;
  planParentId?: string | null;
  planDayRecordId?: string | null;
  planDaySlotId?: string | null;
  planRecordId?: string | null;
  estimatedMinutes?: number | null;
  title?: string | null;
}) {
  const tomorrow = addDays(params.date, 1);
  const context = await resolveTodayPlanItemContext(params);

  if (context.planItemId) {
    const estimatedMinutes = params.estimatedMinutes ?? context.planItem?.estimatedMinutes ?? 30;
    await completeSessionWorkspace({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planId: context.planId,
      planDayId: context.planDayId,
      planDaySlotId: context.planDaySlotId,
      planItemId: context.planItemId,
      sessionDate: params.date,
      scheduledMinutes: estimatedMinutes,
      actualMinutes: Math.max(15, Math.round(estimatedMinutes / 2)),
      completionStatus: "partially_completed",
      summary: `Partially completed ${params.title ?? context.planItem?.title ?? "this lesson"}.`,
      notes: null,
      retrospective: "Stopped before finishing the full lesson.",
      nextAction: `Carry the remaining work into ${tomorrow}.`,
      deviationReason: "partial_completion",
      metadata: {
        weeklyRouteItemId: params.weeklyRouteItemId,
        source: "today_workspace_partial",
      },
    });
  }

  await updateWeeklyRouteItem(params.learnerId, params.weeklyRouteItemId, (current, weekStartDate) => {
    const weekDates = Array.from({ length: 5 }, (_, index) => addDays(weekStartDate, index));
    const withinWeek = weekDates.includes(tomorrow);

    return {
      state: withinWeek ? "scheduled" : "queued",
      scheduledDate: withinWeek ? tomorrow : null,
      scheduledSlotIndex: withinWeek ? normalizeSlotIndex(current.scheduledSlotIndex) : null,
      manualOverrideKind: current.manualOverrideKind === "none" ? "deferred" : current.manualOverrideKind,
      manualOverrideNote: withinWeek
        ? `Marked partial on ${params.date}; carried into ${tomorrow}.`
        : `Marked partial on ${params.date}; remaining work moved back to the backlog.`,
      eventType: "defer",
      payload: {
        action: "mark_partial",
        fromDate: params.date,
        toDate: withinWeek ? tomorrow : null,
      },
    };
  });
}

export async function pushTodayPlanItemToTomorrow(
  learnerId: string,
  weeklyRouteItemId: string,
  date: string,
) {
  await updateWeeklyRouteItem(learnerId, weeklyRouteItemId, (current, weekStartDate) => {
    const tomorrow = addDays(date, 1);
    const weekDates = Array.from({ length: 5 }, (_, index) => addDays(weekStartDate, index));
    const withinWeek = weekDates.includes(tomorrow);

    return {
      state: withinWeek ? "scheduled" : "queued",
      scheduledDate: withinWeek ? tomorrow : null,
      scheduledSlotIndex: withinWeek ? normalizeSlotIndex(current.scheduledSlotIndex) : null,
      manualOverrideKind: current.manualOverrideKind === "none" ? "deferred" : current.manualOverrideKind,
      manualOverrideNote: withinWeek
        ? `Deferred from ${date} to ${tomorrow}.`
        : `Deferred from ${date}; tomorrow falls outside the active week.`,
      eventType: "defer",
      payload: {
        action: "push_to_tomorrow",
        fromDate: date,
        toDate: withinWeek ? tomorrow : null,
      },
    };
  });
}

export async function repeatTodayPlanItemTomorrow(
  learnerId: string,
  weeklyRouteItemId: string,
  date: string,
) {
  const targetDate = addDays(date, 1);
  const { route } = await loadWeeklyRouteItem(learnerId, weeklyRouteItemId);

  await duplicateWeeklyRouteItem({
    learnerId,
    weeklyRouteId: route.id,
    weeklyRouteItemId,
    targetScheduledDate: targetDate,
    manualOverrideNote: `Repeated from ${date} to ${targetDate}.`,
  });
}

export async function removeTodayPlanItem(learnerId: string, weeklyRouteItemId: string, date: string) {
  await updateWeeklyRouteItem(learnerId, weeklyRouteItemId, (current) => ({
    state: "queued",
    scheduledDate: null,
    scheduledSlotIndex: null,
    manualOverrideKind: current.manualOverrideKind === "none" ? "deferred" : current.manualOverrideKind,
    manualOverrideNote: `Removed from the ${date} workspace.`,
    eventType: "remove_from_week",
    payload: {
      action: "remove_today",
      fromDate: date,
    },
  }));
}

export async function skipTodayPlanItem(params: {
  organizationId: string;
  learnerId: string;
  weeklyRouteItemId: string;
  date: string;
  planParentId?: string | null;
  planDayRecordId?: string | null;
  planDaySlotId?: string | null;
  planRecordId?: string | null;
  estimatedMinutes?: number | null;
  title?: string | null;
}) {
  const context = await resolveTodayPlanItemContext(params);

  if (context.planItemId) {
    await completeSessionWorkspace({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planId: context.planId,
      planDayId: context.planDayId,
      planDaySlotId: context.planDaySlotId,
      planItemId: context.planItemId,
      sessionDate: params.date,
      scheduledMinutes: params.estimatedMinutes ?? context.planItem?.estimatedMinutes ?? null,
      actualMinutes: 0,
      completionStatus: "skipped",
      summary: `Skipped ${params.title ?? context.planItem?.title ?? "this lesson"}.`,
      notes: null,
      retrospective: "Life happened; this lesson was not run today.",
      nextAction: null,
      deviationReason: "life_happened",
      metadata: {
        weeklyRouteItemId: params.weeklyRouteItemId,
        source: "today_workspace_skip",
      },
    });
  }

  await updateWeeklyRouteItem(params.learnerId, params.weeklyRouteItemId, (current) => ({
    state: "queued",
    scheduledDate: null,
    scheduledSlotIndex: null,
    manualOverrideKind:
      current.manualOverrideKind === "none" ? "skip_acknowledged" : current.manualOverrideKind,
    manualOverrideNote: `Skipped on ${params.date}.`,
    eventType: "skip_acknowledged",
    payload: {
      action: "skip_today",
      fromDate: params.date,
    },
  }));
}

export async function scheduleRouteItemForDate(
  learnerId: string,
  weeklyRouteItemId: string,
  date: string,
) {
  await updateWeeklyRouteItem(learnerId, weeklyRouteItemId, (current) => ({
    state: "scheduled",
    scheduledDate: date,
    scheduledSlotIndex: normalizeSlotIndex(current.scheduledSlotIndex),
    manualOverrideKind: current.manualOverrideKind === "none" ? "pinned" : current.manualOverrideKind,
    manualOverrideNote: `Scheduled directly for ${date}.`,
    eventType: "pin",
    payload: {
      action: "schedule_for_day",
      toDate: date,
    },
  }));
}

export async function startNextLessonToday(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
}) {
  const weekStartDate = toWeekStartDate(params.date);
  const readResult = await getReadOptimizedWeeklyRouteBoardForToday({
    learnerId: params.learnerId,
    sourceId: params.sourceId,
    weekStartDate,
  });
  const { board } = readResult.board
    ? { board: readResult.board }
    : await getOrCreateWeeklyRouteBoardForLearner({
        learnerId: params.learnerId,
        sourceId: params.sourceId,
        weekStartDate,
      });

  const todayItems = board.items
    .filter((item) => item.state !== "removed" && item.state !== "done" && item.scheduledDate === params.date)
    .sort((left, right) => {
      const leftSlot = normalizeSlotIndex(left.scheduledSlotIndex);
      const rightSlot = normalizeSlotIndex(right.scheduledSlotIndex);
      return leftSlot === rightSlot
        ? left.currentPosition - right.currentPosition
        : leftSlot - rightSlot;
    });
  const nextSlotIndex =
    todayItems.reduce((max, item) => Math.max(max, normalizeSlotIndex(item.scheduledSlotIndex)), 0) + 1;

  const futureScheduled = board.items
    .filter(
      (item) =>
        item.state !== "removed" &&
        item.state !== "done" &&
        item.scheduledDate != null &&
        item.scheduledDate > params.date,
    )
    .sort((left, right) => {
      if (left.scheduledDate !== right.scheduledDate) {
        return (left.scheduledDate ?? "").localeCompare(right.scheduledDate ?? "");
      }

      const leftSlot = normalizeSlotIndex(left.scheduledSlotIndex);
      const rightSlot = normalizeSlotIndex(right.scheduledSlotIndex);
      return leftSlot === rightSlot
        ? left.currentPosition - right.currentPosition
        : leftSlot - rightSlot;
    });

  const targetGroup = futureScheduled.length > 0
    ? futureScheduled.filter((item) => {
        const lead = futureScheduled[0]!;
        return (
          item.scheduledDate === lead.scheduledDate &&
          normalizeSlotIndex(item.scheduledSlotIndex) === normalizeSlotIndex(lead.scheduledSlotIndex)
        );
      })
    : board.items
        .filter(
          (item) =>
            item.state !== "removed" &&
            item.state !== "done" &&
            item.scheduledDate == null,
        )
        .sort((left, right) => left.currentPosition - right.currentPosition)
        .slice(0, DEFAULT_UNSCHEDULED_ITEM_COUNT);

  if (targetGroup.length === 0) {
    return {
      status: "blocked" as const,
      message: "No later lesson block is available to pull into today.",
      slotIndex: nextSlotIndex,
      movedRouteItemIds: [] as string[],
    };
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    for (const item of targetGroup) {
      await tx
        .update(weeklyRouteItems)
        .set({
          state: "scheduled",
          scheduledDate: params.date,
          scheduledSlotIndex: nextSlotIndex,
          manualOverrideKind: "reordered",
          manualOverrideNote: `Pulled forward into lesson ${nextSlotIndex} on ${params.date}.`,
          updatedAt: new Date(),
        })
        .where(eq(weeklyRouteItems.id, item.id));

      await tx.insert(routeOverrideEvents).values({
        learnerId: params.learnerId,
        weeklyRouteItemId: item.id,
        eventType: "reorder",
        payload: {
          action: "pull_forward_to_today",
          fromDate: item.scheduledDate,
          fromSlotIndex: normalizeSlotIndex(item.scheduledSlotIndex),
          toDate: params.date,
          toSlotIndex: nextSlotIndex,
        },
        createdByAdultUserId: null,
      });
    }
  });

  await getOrCreateTodayWorkspaceDaySlot({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    slotIndex: nextSlotIndex,
    title: `Lesson ${nextSlotIndex}`,
    origin: "manual",
    sourceId: params.sourceId,
    routeFingerprint: buildTodayLessonDraftFingerprint(targetGroup.map((item) => item.id)),
  });

  return {
    status: "scheduled" as const,
    message:
      targetGroup.length === 1
        ? `Pulled the next lesson into today as Lesson ${nextSlotIndex}.`
        : `Pulled ${targetGroup.length} planned skills into today as Lesson ${nextSlotIndex}.`,
    slotIndex: nextSlotIndex,
    movedRouteItemIds: targetGroup.map((item) => item.id),
  };
}

export async function swapTodayPlanItemWithAlternate(
  learnerId: string,
  weeklyRouteItemId: string,
  alternateWeeklyRouteItemId: string,
  date: string,
) {
  const db = getDb();
  const [current, alternate] = await Promise.all([
    loadWeeklyRouteItem(learnerId, weeklyRouteItemId),
    loadWeeklyRouteItem(learnerId, alternateWeeklyRouteItemId),
  ]);

  if (current.route.sourceId !== alternate.route.sourceId) {
    throw new Error("Cannot swap route items across different curriculum sources.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(weeklyRouteItems)
      .set({
        state: "queued",
        scheduledDate: null,
        scheduledSlotIndex: null,
        manualOverrideKind: current.routeItem.manualOverrideKind === "none" ? "deferred" : current.routeItem.manualOverrideKind,
        manualOverrideNote: `Swapped out on ${date}.`,
        updatedAt: new Date(),
      })
      .where(eq(weeklyRouteItems.id, current.routeItem.id));

    await tx
      .update(weeklyRouteItems)
      .set({
        state: "scheduled",
        scheduledDate: date,
        scheduledSlotIndex: normalizeSlotIndex(current.routeItem.scheduledSlotIndex),
        manualOverrideKind: "reordered",
        manualOverrideNote: `Swapped in for ${current.routeItem.id} on ${date}.`,
        updatedAt: new Date(),
      })
      .where(eq(weeklyRouteItems.id, alternate.routeItem.id));

    await tx.insert(routeOverrideEvents).values([
      {
        learnerId,
        weeklyRouteItemId: current.routeItem.id,
        eventType: "repair_applied",
        payload: {
          action: "swap_out",
          swappedWithWeeklyRouteItemId: alternate.routeItem.id,
          date,
        },
        createdByAdultUserId: null,
      },
      {
        learnerId,
        weeklyRouteItemId: alternate.routeItem.id,
        eventType: "repair_applied",
        payload: {
          action: "swap_in",
          swappedWithWeeklyRouteItemId: current.routeItem.id,
          date,
        },
        createdByAdultUserId: null,
      },
    ]);
  });
}

export async function listTodaySources(session: AppWorkspace) {
  return listCurriculumSources(session.organization.id);
}

export async function getTodaySourceTree(session: AppWorkspace, sourceId: string) {
  return getCurriculumTree(sourceId, session.organization.id);
}

export async function listTodayNodes(sourceId: string) {
  return listCurriculumNodes(sourceId);
}
