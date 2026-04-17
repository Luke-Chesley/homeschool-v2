import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

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
import { duplicateWeeklyRouteItem, getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";
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

type TodayMaterializedWorkflowEntry = {
  planParentId: string;
  planDayRecordId: string;
  planItemId: string;
  lessonSessionId: string | null;
  completionStatus: string | null;
  reviewState: string | null;
  evidenceCount: number;
  activityCount: number;
};

type TodayWorkspaceContext = {
  selectedSource: CurriculumSource;
  sourceId: string;
  sourceTitle: string;
  sessionTiming: LessonTimingContract;
  sessionBudgetMinutes: number;
  board: WeeklyRouteBoard;
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

async function buildTodayActivityState(
  workspace: Pick<DailyWorkspace, "leadItem" | "lessonDraft">,
): Promise<DailyWorkspaceActivityState> {
  const lessonDraft = workspace.lessonDraft?.structured;
  if (!lessonDraft) {
    return { status: "no_draft" };
  }

  const leadSessionId =
    workspace.leadItem.sessionRecordId ?? workspace.leadItem.workflow?.lessonSessionId ?? null;
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

async function syncTodayPlanItems(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  sourceTitle: string;
  /** Session budget from the canonical timing contract. Used for lesson session scheduledMinutes. */
  sessionBudgetMinutes: number;
  selectedRouteItems: WeeklyRouteBoard["items"];
  nodeById: Map<string, Awaited<ReturnType<typeof listCurriculumNodes>>[number]>;
}) {
  const db = getDb();
  const workspacePlan = await getOrCreateTodayWorkspacePlan(params.organizationId, params.learnerId);
  const workspaceDay = await getOrCreateTodayWorkspaceDay(params);
  const routeItemIds = params.selectedRouteItems.map((item) => item.id);

  if (routeItemIds.length === 0) {
    return new Map<string, TodayMaterializedWorkflowEntry>();
  }

  const existingLinks = await db.query.planItemCurriculumLinks.findMany({
    where: inArray(planItemCurriculumLinks.weeklyRouteItemId, routeItemIds),
  });
  const existingPlanItems = existingLinks.length > 0
    ? await db.query.planItems.findMany({
        where: inArray(
          planItems.id,
          [...new Set(existingLinks.map((link) => link.planItemId))],
        ),
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

  const routeItemPayloads = params.selectedRouteItems.map((routeItem, index) => {
    const node = params.nodeById.get(routeItem.skillNodeId);
    const scheduledDate = routeItem.scheduledDate ?? params.date;
    const itemEffortMinutes = node?.estimatedMinutes ?? params.sessionBudgetMinutes;
    const subject = node?.normalizedPath.split("/")[0] ?? params.sourceTitle;
    const lessonLabel = getSkillPathLabel(routeItem.skillPath);
    const planItemStatus: typeof planItems.$inferInsert.status =
      mapRouteStateToPlanStatus(routeItem.state) === "blocked" ? "skipped" : "ready";

    return {
      index,
      node,
      routeItem,
      scheduledDate,
      itemEffortMinutes,
      values: {
        planId: workspacePlan.id,
        planDayId: workspaceDay.id,
        curriculumItemId: null,
        title: routeItem.skillTitle,
        description: node?.description ?? routeItem.skillTitle,
        subject,
        status: planItemStatus,
        scheduledDate,
        estimatedMinutes: itemEffortMinutes,
        ordering: index,
        metadata: {
          sourceLabel: params.sourceTitle,
          lessonLabel,
          weeklyRouteItemId: routeItem.id,
          skillNodeId: routeItem.skillNodeId,
        },
      },
    };
  });

  const itemsToCreate = routeItemPayloads.filter(
    ({ routeItem }) => !existingPlanItemByRouteItemId.has(routeItem.id),
  );
  const itemsToUpdate = routeItemPayloads.filter(({ routeItem }) =>
    existingPlanItemByRouteItemId.has(routeItem.id),
  );

  const createdPlanItems =
    itemsToCreate.length > 0
      ? await db.insert(planItems).values(itemsToCreate.map(({ values }) => values)).returning()
      : [];

  if (itemsToUpdate.length > 0) {
    await Promise.all(
      itemsToUpdate.map(async ({ routeItem, values }) => {
        const existingPlanItem = existingPlanItemByRouteItemId.get(routeItem.id);
        if (!existingPlanItem) {
          return;
        }

        await db
          .update(planItems)
          .set({
            ...values,
            metadata: {
              ...(existingPlanItem.metadata ?? {}),
              ...(values.metadata ?? {}),
            },
            updatedAt: new Date(),
          })
          .where(eq(planItems.id, existingPlanItem.id));
      }),
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

  const canonicalLinks = await db.query.planItemCurriculumLinks.findMany({
    where: inArray(planItemCurriculumLinks.weeklyRouteItemId, routeItemIds),
  });
  const canonicalPlanItemIds = [...new Set(canonicalLinks.map((link) => link.planItemId))];
  const canonicalPlanItems = canonicalPlanItemIds.length > 0
    ? await db.query.planItems.findMany({
        where: inArray(planItems.id, canonicalPlanItemIds),
      })
    : [];
  const canonicalPlanItemById = new Map(canonicalPlanItems.map((item) => [item.id, item]));
  const canonicalPlanItemByRouteItemId = new Map<string, typeof planItems.$inferSelect>();

  for (const link of canonicalLinks) {
    if (typeof link.weeklyRouteItemId !== "string") {
      continue;
    }

    const planItem = canonicalPlanItemById.get(link.planItemId);
    if (planItem) {
      canonicalPlanItemByRouteItemId.set(link.weeklyRouteItemId, planItem);
    }
  }

  const materializedByRouteItemId = new Map<string, TodayMaterializedWorkflowEntry>();
  const ensuredSessions = await Promise.all(
    routeItemPayloads.map(async ({ routeItem, scheduledDate }) => {
      const planItemRecord =
        canonicalPlanItemByRouteItemId.get(routeItem.id) ??
        provisionalPlanItemByRouteItemId.get(routeItem.id);
      if (!planItemRecord) {
        return null;
      }

      const session = await ensureSessionWorkspace({
        organizationId: params.organizationId,
        learnerId: params.learnerId,
        planId: workspacePlan.id,
        planDayId: workspaceDay.id,
        planItemId: planItemRecord.id,
        sessionDate: scheduledDate,
        scheduledMinutes: params.sessionBudgetMinutes,
        metadata: {
          weeklyRouteItemId: routeItem.id,
          sourceId: routeItem.sourceId,
          skillNodeId: routeItem.skillNodeId,
        },
      });

      return {
        routeItemId: routeItem.id,
        entry: {
          planParentId: workspacePlan.id,
          planDayRecordId: workspaceDay.id,
          planItemId: planItemRecord.id,
          lessonSessionId: session.id,
          completionStatus: session.completionStatus,
          reviewState: session.reviewState,
          evidenceCount: 0,
          activityCount: 0,
        } satisfies TodayMaterializedWorkflowEntry,
      };
    }),
  );

  for (const ensured of ensuredSessions) {
    if (ensured) {
      materializedByRouteItemId.set(ensured.routeItemId, ensured.entry);
    }
  }

  return hydrateTodayMaterializedWorkflow(materializedByRouteItemId);
}

async function hydrateTodayMaterializedWorkflow(
  entries: Map<string, TodayMaterializedWorkflowEntry>,
) {
  const db = getDb();
  const hydratedEntries = new Map(entries);
  const planItemIds = [...hydratedEntries.values()].map((entry) => entry.planItemId);
  const lessonSessionIds = [...hydratedEntries.values()]
    .map((entry) => entry.lessonSessionId)
    .filter((value): value is string => Boolean(value));

  const sessions = lessonSessionIds.length > 0
    ? await db.query.lessonSessions.findMany({
        where: inArray(lessonSessions.id, lessonSessionIds),
      })
    : [];
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

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
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  const day = await getTodayWorkspaceDay(params);
  if (!day) {
    return null;
  }

  return readLessonDraftFromMetadata(day.metadata, params.sourceId, params.routeFingerprint);
}

export async function getSavedTodayLessonBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  const day = await getTodayWorkspaceDay(params);
  if (!day) {
    return null;
  }

  return readLessonBuildFromMetadata(day.metadata, params.sourceId, params.routeFingerprint);
}

export async function getSavedTodayActivityBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  const day = await getTodayWorkspaceDay(params);
  if (!day) {
    return null;
  }

  return readActivityBuildFromMetadata(day.metadata, params.sourceId, params.routeFingerprint);
}

export async function getSavedTodayLessonRegenerationNote(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  const day = await getTodayWorkspaceDay(params);
  if (!day) {
    return null;
  }

  return readLessonRegenerationNoteFromMetadata(day.metadata, params.sourceId, params.routeFingerprint);
}

export async function getSavedTodayExpansionIntent(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
}) {
  if (!params.routeFingerprint) {
    return null;
  }

  const day = await getTodayWorkspaceDay(params);
  if (!day) {
    return null;
  }

  return readExpansionIntentFromMetadata(day.metadata, params.sourceId, params.routeFingerprint);
}

export async function getTodayLessonBuildStatus(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
}) {
  const state = await readTodayWorkspaceMetadataState(params);

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
  sourceId: string;
  routeFingerprint: string;
  lessonSessionId?: string | null;
}) {
  const metadataState = await readTodayWorkspaceMetadataState(params);
  const lessonDraft = metadataState.lessonDraft?.structured;
  const leadSessionId = params.lessonSessionId ?? metadataState.activityBuild?.lessonSessionId ?? null;

  if (!lessonDraft) {
    return {
      build: metadataState.activityBuild,
      activityState: { status: "no_draft" } satisfies DailyWorkspaceActivityState,
    };
  }

  if (!leadSessionId) {
    return {
      build: metadataState.activityBuild,
      activityState: { status: "no_activity" } satisfies DailyWorkspaceActivityState,
    };
  }

  const repos = createRepositories(getDb());
  const currentFingerprint = computeLessonDraftFingerprint(lessonDraft);
  const existingActivity = await repos.activities.findPublishedActivityForSession(leadSessionId);

  if (!existingActivity) {
    return {
      build: metadataState.activityBuild,
      activityState: { status: "no_activity", sessionId: leadSessionId } satisfies DailyWorkspaceActivityState,
    };
  }

  return {
    build: metadataState.activityBuild,
    activityState: {
      status:
        existingActivity.lessonDraftFingerprint === currentFingerprint ? "ready" : "stale",
      sessionId: leadSessionId,
      activityId: existingActivity.id,
    } satisfies DailyWorkspaceActivityState,
  };
}

async function writeTodayLessonBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
  patch: (
    current: DailyWorkspaceLessonBuild | null,
    now: string,
  ) => DailyWorkspaceLessonBuild;
}) {
  const day = await getOrCreateTodayWorkspaceDay(params);
  const db = getDb();
  const metadata = isRecord(day.metadata) ? day.metadata : {};
  const buildSources = isRecord(metadata[TODAY_LESSON_BUILDS_KEY])
    ? (metadata[TODAY_LESSON_BUILDS_KEY] as Record<string, unknown>)
    : {};
  const sourceBuilds = isRecord(buildSources[params.sourceId])
    ? (buildSources[params.sourceId] as Record<string, unknown>)
    : {};
  const current = readLessonBuildFromMetadata(metadata, params.sourceId, params.routeFingerprint);
  const now = new Date().toISOString();
  const next = params.patch(current, now);

  await db
    .update(planDays)
    .set({
      metadata: {
        ...metadata,
        [TODAY_LESSON_BUILDS_KEY]: {
          ...buildSources,
          [params.sourceId]: {
            ...sourceBuilds,
            [params.routeFingerprint]: next,
          },
        },
      },
      updatedAt: new Date(now),
    })
    .where(eq(planDays.id, day.id));

  return next;
}

export async function queueTodayLessonBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
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
  sourceId: string;
  routeFingerprint: string;
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
  sourceId: string;
  routeFingerprint: string;
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
  sourceId: string;
  routeFingerprint: string;
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
  sourceId: string;
  routeFingerprint: string;
  patch: (
    current: DailyWorkspaceActivityBuild | null,
    now: string,
  ) => DailyWorkspaceActivityBuild;
}) {
  const day = await getOrCreateTodayWorkspaceDay(params);
  const db = getDb();
  const metadata = isRecord(day.metadata) ? day.metadata : {};
  const buildSources = isRecord(metadata[TODAY_ACTIVITY_BUILDS_KEY])
    ? (metadata[TODAY_ACTIVITY_BUILDS_KEY] as Record<string, unknown>)
    : {};
  const sourceBuilds = isRecord(buildSources[params.sourceId])
    ? (buildSources[params.sourceId] as Record<string, unknown>)
    : {};
  const current = readActivityBuildFromMetadata(metadata, params.sourceId, params.routeFingerprint);
  const now = new Date().toISOString();
  const next = params.patch(current, now);

  await db
    .update(planDays)
    .set({
      metadata: {
        ...metadata,
        [TODAY_ACTIVITY_BUILDS_KEY]: {
          ...buildSources,
          [params.sourceId]: {
            ...sourceBuilds,
            [params.routeFingerprint]: next,
          },
        },
      },
      updatedAt: new Date(now),
    })
    .where(eq(planDays.id, day.id));

  return next;
}

export async function queueTodayActivityBuild(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
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
  sourceId: string;
  routeFingerprint: string;
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
  sourceId: string;
  routeFingerprint: string;
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
  sourceId: string;
  routeFingerprint: string;
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
  sourceId: string;
  routeFingerprint: string;
  note: string | null;
}) {
  const day = await getOrCreateTodayWorkspaceDay(params);
  const db = getDb();
  const metadata = isRecord(day.metadata) ? day.metadata : {};
  const noteSources = isRecord(metadata[TODAY_LESSON_REGEN_NOTES_KEY])
    ? (metadata[TODAY_LESSON_REGEN_NOTES_KEY] as Record<string, unknown>)
    : {};
  const sourceNotes = isRecord(noteSources[params.sourceId])
    ? (noteSources[params.sourceId] as Record<string, unknown>)
    : {};
  const now = new Date().toISOString();

  await db
    .update(planDays)
    .set({
      metadata: {
        ...metadata,
        [TODAY_LESSON_REGEN_NOTES_KEY]: {
          ...noteSources,
          [params.sourceId]: {
            ...sourceNotes,
            [params.routeFingerprint]: params.note,
          },
        },
      },
      updatedAt: new Date(now),
    })
    .where(eq(planDays.id, day.id));

  return params.note;
}

export async function saveTodayExpansionIntent(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
  intent: DailyWorkspaceExpansionIntent | null;
}) {
  const day = await getOrCreateTodayWorkspaceDay(params);
  const db = getDb();
  const metadata = isRecord(day.metadata) ? day.metadata : {};
  const intentSources = isRecord(metadata[TODAY_EXPANSION_INTENTS_KEY])
    ? (metadata[TODAY_EXPANSION_INTENTS_KEY] as Record<string, unknown>)
    : {};
  const sourceIntents = isRecord(intentSources[params.sourceId])
    ? (intentSources[params.sourceId] as Record<string, unknown>)
    : {};
  const now = new Date().toISOString();

  await db
    .update(planDays)
    .set({
      metadata: {
        ...metadata,
        [TODAY_EXPANSION_INTENTS_KEY]: {
          ...intentSources,
          [params.sourceId]: {
            ...sourceIntents,
            [params.routeFingerprint]: params.intent,
          },
        },
      },
      updatedAt: new Date(now),
    })
    .where(eq(planDays.id, day.id));

  return params.intent;
}

export async function saveTodayLessonDraft(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  sourceTitle: string;
  routeFingerprint: string;
  structured: StructuredLessonDraft;
  promptVersion?: string;
}) {
  const day = await getOrCreateTodayWorkspaceDay(params);
  const db = getDb();
  const metadata = isRecord(day.metadata) ? day.metadata : {};
  const draftSources = isRecord(metadata[TODAY_LESSON_DRAFTS_KEY])
    ? (metadata[TODAY_LESSON_DRAFTS_KEY] as Record<string, unknown>)
    : {};
  const sourceDrafts = isRecord(draftSources[params.sourceId])
    ? (draftSources[params.sourceId] as Record<string, unknown>)
    : {};
  const savedAt = new Date().toISOString();

  await db
    .update(planDays)
    .set({
      metadata: {
        ...metadata,
        [TODAY_LESSON_DRAFTS_KEY]: {
          ...draftSources,
          [params.sourceId]: {
            ...sourceDrafts,
            [params.routeFingerprint]: {
              structured: params.structured,
              sourceId: params.sourceId,
              sourceTitle: params.sourceTitle,
              routeFingerprint: params.routeFingerprint,
              promptVersion: params.promptVersion ?? null,
              savedAt,
            },
          },
        },
      },
      updatedAt: new Date(savedAt),
    })
    .where(eq(planDays.id, day.id));

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
    manualOverrideKind: routeItem.manualOverrideKind,
    state: routeItem.state,
  };
}

function getVisibleRouteItems(board: WeeklyRouteBoard, date: string) {
  const scheduledForToday = board.items
    .filter((item) => item.state !== "removed" && item.scheduledDate === date)
    .sort((left, right) => left.currentPosition - right.currentPosition);

  if (scheduledForToday.length > 0) {
    return scheduledForToday;
  }

  return board.items
    .filter((item) => item.state !== "removed" && item.scheduledDate == null)
    .sort((left, right) => left.currentPosition - right.currentPosition)
    .slice(0, DEFAULT_UNSCHEDULED_ITEM_COUNT);
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

async function resolveSourceContext(params: {
  organizationId: string;
}) {
  const sources = await listCurriculumSources(params.organizationId);
  if (sources.length === 0) {
    return { sources, selectedSource: null };
  }

  return {
    sources,
    selectedSource: await getLiveCurriculumSource(params.organizationId),
  };
}

async function resolveTodayWorkspaceContext(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}): Promise<TodayWorkspaceContext | null> {
  const { selectedSource } = await resolveSourceContext({
    organizationId: params.organizationId,
  });

  if (!selectedSource) {
    return null;
  }

  const sessionTiming = resolveLessonSessionMinutes({
    sourceSessionMinutes: selectedSource.pacing?.sessionMinutes,
  });
  const sessionBudgetMinutes = sessionTiming.resolvedTotalMinutes;
  const weekStartDate = toWeekStartDate(params.date);
  const { board } = await getOrCreateWeeklyRouteBoardForLearner({
    learnerId: params.learnerId,
    sourceId: selectedSource.id,
    weekStartDate,
  });
  const nodes = await listCurriculumNodes(selectedSource.id);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selectedRouteItems = getVisibleRouteItems(board, params.date);
  const planningContext = buildCopilotPlanningContext({
    board,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    sourceId: selectedSource.id,
    selectedDate: params.date,
  });

  return {
    selectedSource,
    sourceId: selectedSource.id,
    sourceTitle: selectedSource.title,
    sessionTiming,
    sessionBudgetMinutes,
    board,
    selectedRouteItems,
    nodeById,
    planningContext,
    routeFingerprint: buildTodayLessonDraftFingerprint(selectedRouteItems.map((item) => item.id)),
  };
}

async function readTodayWorkspaceMetadataState(params: {
  organizationId: string;
  learnerId: string;
  date: string;
  sourceId: string;
  routeFingerprint: string;
}): Promise<TodayWorkspaceMetadataState> {
  if (!params.routeFingerprint) {
    return {
      lessonDraft: null,
      lessonBuild: null,
      activityBuild: null,
      lessonRegenerationNote: null,
      expansionIntent: null,
    };
  }

  const day = await getTodayWorkspaceDay(params);
  if (!day) {
    return {
      lessonDraft: null,
      lessonBuild: null,
      activityBuild: null,
      lessonRegenerationNote: null,
      expansionIntent: null,
    };
  }

  return {
    lessonDraft: readLessonDraftFromMetadata(day.metadata, params.sourceId, params.routeFingerprint),
    lessonBuild: readLessonBuildFromMetadata(day.metadata, params.sourceId, params.routeFingerprint),
    activityBuild: readActivityBuildFromMetadata(day.metadata, params.sourceId, params.routeFingerprint),
    lessonRegenerationNote: readLessonRegenerationNoteFromMetadata(
      day.metadata,
      params.sourceId,
      params.routeFingerprint,
    ),
    expansionIntent: readExpansionIntentFromMetadata(
      day.metadata,
      params.sourceId,
      params.routeFingerprint,
    ),
  };
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
  const context = await resolveTodayWorkspaceContext(params);
  if (!context || context.selectedRouteItems.length === 0) {
    return context;
  }

  await syncTodayPlanItems({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    sourceId: context.sourceId,
    sourceTitle: context.sourceTitle,
    sessionBudgetMinutes: context.sessionBudgetMinutes,
    selectedRouteItems: context.selectedRouteItems,
    nodeById: context.nodeById,
  });

  return context;
}

export async function getTodayWorkspaceView(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}): Promise<{
  workspace: DailyWorkspace;
  sourceId: string;
  sourceTitle: string;
  sessionTiming: LessonTimingContract;
  planningContext: ReturnType<typeof buildCopilotPlanningContext>;
  routeFingerprint: string;
} | null> {
  const context = await resolveTodayWorkspaceContext(params);
  if (!context) {
    return null;
  }

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
          objective: "Import curriculum or generate a weekly route to populate today's workspace.",
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

  const metadataState = await readTodayWorkspaceMetadataState({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    sourceId: context.sourceId,
    routeFingerprint: context.routeFingerprint,
  });
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
    leadItem: selectedPlansWithWorkflow[0],
    items: selectedPlansWithWorkflow,
    prepChecklist: buildPrepChecklist(
      params.learnerName,
      context.sourceTitle,
      selectedPlansWithWorkflow,
    ),
    sessionTargets: buildSessionTargets(selectedPlansWithWorkflow),
    artifactSlots: buildArtifactSlots(context.sourceTitle, selectedPlansWithWorkflow),
    copilotInsertions: buildCopilotInsertions(
      params.learnerName,
      context.sourceTitle,
      selectedPlansWithWorkflow,
    ),
    completionPrompts: [
      "What did the learner complete today?",
      "What changed in pacing or support?",
      "Which route item should stay in view tomorrow?",
    ],
    familyNotes: buildFamilyNotes(context.sourceTitle, selectedPlansWithWorkflow),
    recoveryOptions: [],
    alternatesByPlanItemId,
    lessonDraft: metadataState.lessonDraft,
    lessonBuild: metadataState.lessonBuild,
    activityBuild: metadataState.activityBuild,
    activityState: null,
    lessonRegenerationNote: metadataState.lessonRegenerationNote,
    expansionIntent: metadataState.expansionIntent,
  };

  workspace.activityState = await buildTodayActivityState(workspace);

  return {
    workspace,
    sourceId: context.sourceId,
    sourceTitle: context.sourceTitle,
    sessionTiming: context.sessionTiming,
    planningContext: context.planningContext,
    routeFingerprint: context.routeFingerprint,
  };
}

export async function getTodayWorkspace(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}) {
  await materializeTodayWorkspace(params);
  return getTodayWorkspaceView(params);
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
    manualOverrideKind: current.manualOverrideKind === "none" ? "pinned" : current.manualOverrideKind,
    manualOverrideNote: `Scheduled directly for ${date}.`,
    eventType: "pin",
    payload: {
      action: "schedule_for_day",
      toDate: date,
    },
  }));
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
