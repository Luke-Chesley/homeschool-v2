import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";
import { isStructuredLessonDraft } from "@/lib/lesson-draft/types";

import {
  getCurriculumTree,
  getLiveCurriculumSource,
  listCurriculumNodes,
  listCurriculumSources,
} from "@/lib/curriculum/service";
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
  DailyWorkspace,
  DailyWorkspaceLessonDraft,
  PlanItem,
  WeeklyRouteItem,
} from "@/lib/planning/types";
import { completeSessionWorkspace, ensureSessionWorkspace } from "@/lib/session-workspace/service";
import type { AppWorkspace } from "@/lib/users/service";
import { duplicateWeeklyRouteItem, getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";
import type { WeeklyRouteBoard } from "@/lib/curriculum-routing";
import { toWeekStartDate } from "@/lib/curriculum-routing";
import { buildCopilotPlanningContext } from "@/lib/planning/copilot-snapshot";
import { syncDailyWorkspaceSessionRecords } from "@/lib/planning/session-workspace-service";
import {
  resolveLessonSessionMinutes,
  type LessonTimingContract,
} from "@/lib/planning/session-timing";
import type { CurriculumSource } from "@/lib/curriculum/types";

const DEFAULT_UNSCHEDULED_ITEM_COUNT = 4;
const TODAY_WORKSPACE_PLAN_PURPOSE = "today_workspace";
const TODAY_LESSON_DRAFTS_KEY = "todayLessonDrafts";

function addDays(baseDate: string, days: number) {
  const date = new Date(`${baseDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPlannerDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function buildTodayLessonDraftFingerprint(itemIds: string[]) {
  return itemIds.join("::");
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

async function getTodayWorkspacePlan(organizationId: string, learnerId: string) {
  const db = getDb();
  const learnerPlans = await db
    .select()
    .from(plans)
    .where(and(eq(plans.organizationId, organizationId), eq(plans.learnerId, learnerId)))
    .orderBy(desc(plans.updatedAt), desc(plans.createdAt));

  return (
    learnerPlans.find(
      (plan) =>
        isRecord(plan.metadata) &&
        plan.metadata.purpose === TODAY_WORKSPACE_PLAN_PURPOSE,
    ) ?? null
  );
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
    return new Map<
      string,
      {
        planItemId: string;
        lessonSessionId: string | null;
        completionStatus: string | null;
        reviewState: string | null;
        evidenceCount: number;
        activityCount: number;
      }
    >();
  }

  const existingLinks = await db.query.planItemCurriculumLinks.findMany({
    where: inArray(planItemCurriculumLinks.weeklyRouteItemId, routeItemIds),
  });
  const existingPlanItems = existingLinks.length
    ? await db.query.planItems.findMany({
        where: inArray(
          planItems.id,
          existingLinks.map((link) => link.planItemId),
        ),
      })
    : [];

  const linkByWeeklyRouteItemId = new Map(
    existingLinks
      .filter((link) => typeof link.weeklyRouteItemId === "string")
      .map((link) => [link.weeklyRouteItemId as string, link]),
  );
  const planItemById = new Map(existingPlanItems.map((item) => [item.id, item]));

  const materializedByRouteItemId = new Map<
    string,
    {
      planItemId: string;
      lessonSessionId: string | null;
      completionStatus: string | null;
      reviewState: string | null;
      evidenceCount: number;
      activityCount: number;
    }
  >();

  for (const [index, routeItem] of params.selectedRouteItems.entries()) {
    const node = params.nodeById.get(routeItem.skillNodeId);
    let linkRecord = linkByWeeklyRouteItemId.get(routeItem.id) ?? null;
    const existingPlanItem = linkRecord ? planItemById.get(linkRecord.planItemId) ?? null : null;
    const scheduledDate = routeItem.scheduledDate ?? params.date;
    // Item-effort: node-level override if explicitly set, otherwise session budget.
    // This is NOT the session's total budget — it is one item's effort share.
    const itemEffortMinutes = node?.estimatedMinutes ?? params.sessionBudgetMinutes;
    const subject = node?.normalizedPath.split("/")[0] ?? params.sourceTitle;

    let planItemRecord =
      existingPlanItem ??
      (await db
        .insert(planItems)
        .values({
          planId: workspacePlan.id,
          planDayId: workspaceDay.id,
          curriculumItemId: null,
          title: routeItem.skillTitle,
          description: node?.description ?? routeItem.skillTitle,
          subject,
          status: mapRouteStateToPlanStatus(routeItem.state) === "blocked" ? "skipped" : "ready",
          scheduledDate,
          estimatedMinutes: itemEffortMinutes,
          ordering: index,
          metadata: {
            sourceLabel: params.sourceTitle,
            lessonLabel: getSkillPathLabel(routeItem.skillPath),
            weeklyRouteItemId: routeItem.id,
            skillNodeId: routeItem.skillNodeId,
          },
        })
        .returning()
        .then((rows) => rows[0]!));

    if (existingPlanItem) {
      await db
        .update(planItems)
        .set({
          planId: workspacePlan.id,
          planDayId: workspaceDay.id,
          title: routeItem.skillTitle,
          description: node?.description ?? routeItem.skillTitle,
          subject,
          status: mapRouteStateToPlanStatus(routeItem.state) === "blocked" ? "skipped" : "ready",
          scheduledDate,
          estimatedMinutes: itemEffortMinutes,
          ordering: index,
          metadata: {
            ...(existingPlanItem.metadata ?? {}),
            sourceLabel: params.sourceTitle,
            lessonLabel: getSkillPathLabel(routeItem.skillPath),
            weeklyRouteItemId: routeItem.id,
            skillNodeId: routeItem.skillNodeId,
          },
          updatedAt: new Date(),
        })
        .where(eq(planItems.id, existingPlanItem.id));
    }

    if (!planItemRecord) {
      continue;
    }

    if (!linkRecord) {
      await db
        .insert(planItemCurriculumLinks)
        .values({
          planItemId: planItemRecord.id,
          sourceId: routeItem.sourceId,
          skillNodeId: routeItem.skillNodeId,
          weeklyRouteItemId: routeItem.id,
          origin: "curriculum_route",
          metadata: {},
        })
        .onConflictDoNothing({
          target: planItemCurriculumLinks.weeklyRouteItemId,
        });

      linkRecord =
        (await db.query.planItemCurriculumLinks.findFirst({
          where: eq(planItemCurriculumLinks.weeklyRouteItemId, routeItem.id),
        })) ?? null;

      if (linkRecord && linkRecord.planItemId !== planItemRecord.id) {
        planItemRecord =
          (await db.query.planItems.findFirst({
            where: eq(planItems.id, linkRecord.planItemId),
          })) ?? planItemRecord;
      }
    }

    const session = await ensureSessionWorkspace({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planId: workspacePlan.id,
      planDayId: workspaceDay.id,
      planItemId: planItemRecord.id,
      sessionDate: scheduledDate,
      // Use the canonical session budget (from curriculum pacing), not item effort.
      scheduledMinutes: params.sessionBudgetMinutes,
      metadata: {
        weeklyRouteItemId: routeItem.id,
        sourceId: routeItem.sourceId,
        skillNodeId: routeItem.skillNodeId,
      },
    });

    materializedByRouteItemId.set(routeItem.id, {
      planItemId: planItemRecord.id,
      lessonSessionId: session.id,
      completionStatus: session.completionStatus,
      reviewState: session.reviewState,
      evidenceCount: 0,
      activityCount: 0,
    });
  }

  const planItemIds = [...materializedByRouteItemId.values()].map((entry) => entry.planItemId);
  const sessions = await db.query.lessonSessions.findMany({
    where: inArray(
      lessonSessions.id,
      [...materializedByRouteItemId.values()]
        .map((entry) => entry.lessonSessionId)
        .filter((value): value is string => Boolean(value)),
    ),
  });
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  const activityRows = planItemIds.length
    ? await db.query.interactiveActivities.findMany({
        where: inArray(interactiveActivities.planItemId, planItemIds),
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

  const evidenceRows =
    sessions.length > 0
      ? await db.query.evidenceRecords.findMany({
          where: inArray(
            evidenceRecords.lessonSessionId,
            sessions.map((session) => session.id),
          ),
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

  for (const [routeItemId, entry] of materializedByRouteItemId) {
    const session = entry.lessonSessionId ? sessionById.get(entry.lessonSessionId) : null;
    materializedByRouteItemId.set(routeItemId, {
      ...entry,
      completionStatus: session?.completionStatus ?? entry.completionStatus,
      reviewState: session?.reviewState ?? entry.reviewState,
      evidenceCount: entry.lessonSessionId
        ? evidenceCountBySessionId.get(entry.lessonSessionId) ?? 0
        : 0,
      activityCount: activityCountByPlanItemId.get(entry.planItemId) ?? 0,
    });
  }

  return materializedByRouteItemId;
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
  workflow?: {
    planItemId: string;
    lessonSessionId: string | null;
    completionStatus: string | null;
    reviewState: string | null;
    evidenceCount: number;
    activityCount: number;
  },
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

export async function getTodayWorkspace(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
}): Promise<{
  workspace: DailyWorkspace;
  sourceId: string;
  sourceTitle: string;
  /** Resolved session budget from the canonical timing contract. */
  sessionTiming: LessonTimingContract;
  planningContext: ReturnType<typeof buildCopilotPlanningContext>;
} | null> {
  const { selectedSource } = await resolveSourceContext({
    organizationId: params.organizationId,
  });

  if (!selectedSource) {
    return null;
  }

  // Resolve the canonical session budget for this source once.
  // All planning and lesson-draft code downstream must use this value.
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

  if (board.items.length === 0) {
    return {
      sourceId: selectedSource.id,
      sourceTitle: selectedSource.title,
      sessionTiming,
      planningContext: null,
      workspace: {
        date: params.date,
        headline: `${selectedSource.title} route for ${params.learnerName}`,
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
          sourceLabel: selectedSource.title,
          lessonLabel: "Empty route",
          planOrigin: "manual",
        },
        items: [],
        prepChecklist: [],
        sessionTargets: [],
        artifactSlots: buildArtifactSlots(selectedSource.title, []),
        copilotInsertions: [],
        completionPrompts: [],
        familyNotes: [],
        recoveryOptions: [],
        alternatesByPlanItemId: {},
        lessonDraft: null,
      },
    };
  }

  const selectedRouteItems = getVisibleRouteItems(board, params.date);
  if (selectedRouteItems.length === 0) {
    return {
      sourceId: selectedSource.id,
      sourceTitle: selectedSource.title,
      sessionTiming,
      planningContext: buildCopilotPlanningContext({
        board,
        learnerId: params.learnerId,
        learnerName: params.learnerName,
        sourceId: selectedSource.id,
        selectedDate: params.date,
      }),
      workspace: {
        date: params.date,
        headline: `${selectedSource.title} route for ${params.learnerName}`,
        learner: {
          id: params.learnerId,
          name: params.learnerName,
          gradeLabel: "",
          pacingPreference: "Active route queue",
          currentSeason: "Current week",
        },
        leadItem: buildPlanItem(
          {
            ...board.items[0]!,
            scheduledDate: params.date,
          },
          selectedSource.title,
          params.date,
          sessionBudgetMinutes,
          nodeById.get(board.items[0]!.skillNodeId),
        ),
        items: [],
        prepChecklist: [],
        sessionTargets: [],
        artifactSlots: buildArtifactSlots(selectedSource.title, []),
        copilotInsertions: [],
        completionPrompts: [],
        familyNotes: [],
        recoveryOptions: [],
        alternatesByPlanItemId: {},
        lessonDraft: null,
      },
    };
  }

  const materializedWorkflow = await syncTodayPlanItems({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    sourceId: selectedSource.id,
    sourceTitle: selectedSource.title,
    sessionBudgetMinutes,
    selectedRouteItems,
    nodeById,
  });
  const selectedPlansWithWorkflow = selectedRouteItems.map((item) =>
    buildPlanItem(
      item,
      selectedSource.title,
      item.scheduledDate ?? params.date,
      sessionBudgetMinutes,
      nodeById.get(item.skillNodeId),
      materializedWorkflow.get(item.id),
    ),
  );
  const routeFingerprint = buildTodayLessonDraftFingerprint(selectedPlansWithWorkflow.map((item) => item.id));
  const savedLessonDraft = await getSavedTodayLessonDraft({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    sourceId: selectedSource.id,
    routeFingerprint,
  });
  const alternateItems = getAlternateItems(board, selectedRouteItems.map((item) => item.id));
  const alternatesByPlanItemId = Object.fromEntries(
    selectedPlansWithWorkflow.map((planItem) => [
      planItem.id,
      alternateItems
        .slice(0, 2)
        .map((routeItem) =>
          buildWeeklyRouteItem(routeItem, selectedSource.title, sessionBudgetMinutes, nodeById.get(routeItem.skillNodeId)),
        ),
    ]),
  );

  const workspace: DailyWorkspace = {
    date: params.date,
    headline: `${selectedSource.title} route for ${params.learnerName}`,
    learner: {
      id: params.learnerId,
      name: params.learnerName,
      gradeLabel: `${selectedPlansWithWorkflow.length} active item${selectedPlansWithWorkflow.length === 1 ? "" : "s"}`,
      pacingPreference: "Current weekly route",
      currentSeason: formatPlannerDate(params.date),
    },
    leadItem: selectedPlansWithWorkflow[0],
    items: selectedPlansWithWorkflow,
    prepChecklist: buildPrepChecklist(params.learnerName, selectedSource.title, selectedPlansWithWorkflow),
    sessionTargets: buildSessionTargets(selectedPlansWithWorkflow),
    artifactSlots: buildArtifactSlots(selectedSource.title, selectedPlansWithWorkflow),
    copilotInsertions: buildCopilotInsertions(params.learnerName, selectedSource.title, selectedPlansWithWorkflow),
    completionPrompts: [
      "What did the learner complete today?",
      "What changed in pacing or support?",
      "Which route item should stay in view tomorrow?",
    ],
    familyNotes: buildFamilyNotes(selectedSource.title, selectedPlansWithWorkflow),
    recoveryOptions: [],
    alternatesByPlanItemId,
    lessonDraft: savedLessonDraft,
  };
  const syncedRecords = await syncDailyWorkspaceSessionRecords({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    items: workspace.items,
  });

  const syncedItems = workspace.items.map((item, index) => {
    const synced = syncedRecords.itemsByWeeklyRouteItemId[item.id];

    return {
      ...item,
      ordering: index,
      planRecordId: synced?.planItemId,
      sessionRecordId: synced?.lessonSessionId,
      reviewState: synced?.reviewState,
      completionStatus: synced?.completionStatus,
    };
  });

  workspace.items = syncedItems;
  workspace.leadItem = syncedItems[0] ?? workspace.leadItem;

  return {
    workspace,
    sourceId: selectedSource.id,
    sourceTitle: selectedSource.title,
    sessionTiming,
    planningContext: buildCopilotPlanningContext({
      board,
      learnerId: params.learnerId,
      learnerName: params.learnerName,
      sourceId: selectedSource.id,
      selectedDate: params.date,
    }),
  };
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

export async function completeTodayPlanItem(params: {
  organizationId: string;
  learnerId: string;
  weeklyRouteItemId: string;
  date: string;
}) {
  const materializedPlanItem = await findMaterializedPlanItemForRouteItem(params.weeklyRouteItemId);

  if (materializedPlanItem) {
    await completeSessionWorkspace({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planId: materializedPlanItem.planItem.planId,
      planDayId: materializedPlanItem.planItem.planDayId,
      planItemId: materializedPlanItem.planItem.id,
      sessionDate: params.date,
      scheduledMinutes: materializedPlanItem.planItem.estimatedMinutes ?? null,
      actualMinutes: materializedPlanItem.planItem.estimatedMinutes ?? null,
      completionStatus: "completed_as_planned",
      summary: `Completed ${materializedPlanItem.planItem.title}.`,
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
}) {
  const materializedPlanItem = await findMaterializedPlanItemForRouteItem(params.weeklyRouteItemId);

  if (materializedPlanItem) {
    const db = getDb();
    const session = await db.query.lessonSessions.findFirst({
      where: and(
        eq(lessonSessions.organizationId, params.organizationId),
        eq(lessonSessions.learnerId, params.learnerId),
        eq(lessonSessions.planItemId, materializedPlanItem.planItem.id),
        eq(lessonSessions.sessionDate, params.date),
      ),
      orderBy: [desc(lessonSessions.updatedAt)],
    });

    if (session) {
      const progress = await db.query.progressRecords.findMany({
        where: and(
          eq(progressRecords.lessonSessionId, session.id),
          eq(progressRecords.planItemId, materializedPlanItem.planItem.id),
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
}) {
  const materializedPlanItem = await findMaterializedPlanItemForRouteItem(params.weeklyRouteItemId);
  const tomorrow = addDays(params.date, 1);

  if (materializedPlanItem) {
    await completeSessionWorkspace({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planId: materializedPlanItem.planItem.planId,
      planDayId: materializedPlanItem.planItem.planDayId,
      planItemId: materializedPlanItem.planItem.id,
      sessionDate: params.date,
      scheduledMinutes: materializedPlanItem.planItem.estimatedMinutes ?? null,
      actualMinutes: Math.max(15, Math.round((materializedPlanItem.planItem.estimatedMinutes ?? 30) / 2)),
      completionStatus: "partially_completed",
      summary: `Partially completed ${materializedPlanItem.planItem.title}.`,
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
}) {
  const materializedPlanItem = await findMaterializedPlanItemForRouteItem(params.weeklyRouteItemId);

  if (materializedPlanItem) {
    await completeSessionWorkspace({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planId: materializedPlanItem.planItem.planId,
      planDayId: materializedPlanItem.planItem.planDayId,
      planItemId: materializedPlanItem.planItem.id,
      sessionDate: params.date,
      scheduledMinutes: materializedPlanItem.planItem.estimatedMinutes ?? null,
      actualMinutes: 0,
      completionStatus: "skipped",
      summary: `Skipped ${materializedPlanItem.planItem.title}.`,
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
