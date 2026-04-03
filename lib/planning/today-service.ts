import { and, desc, eq } from "drizzle-orm";

import { getCurriculumTree, listCurriculumNodes, listCurriculumSources } from "@/lib/curriculum/service";
import { getDb } from "@/lib/db/server";
import { planDays, plans, routeOverrideEvents, weeklyRouteItems, weeklyRoutes } from "@/lib/db/schema";
import type {
  DailyWorkspace,
  DailyWorkspaceLessonDraft,
  PlanItem,
  WeeklyRouteItem,
} from "@/lib/planning/types";
import type { AppWorkspace } from "@/lib/users/service";
import { getOrCreateWeeklyRouteBoardForLearner } from "@/lib/planning/weekly-route-service";
import type { WeeklyRouteBoard } from "@/lib/curriculum-routing";
import { toWeekStartDate } from "@/lib/curriculum-routing";
import { buildCopilotPlanningContext } from "@/lib/planning/copilot-snapshot";

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
  if (!isRecord(candidate) || typeof candidate.markdown !== "string") {
    return null;
  }

  return {
    markdown: candidate.markdown,
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
  markdown: string;
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
              markdown: params.markdown,
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
    markdown: params.markdown,
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
  node?: Awaited<ReturnType<typeof listCurriculumNodes>>[number],
): PlanItem {
  const subject = node?.normalizedPath.split("/")[0] ?? sourceTitle;
  const estimatedMinutes = node?.estimatedMinutes ?? 45;

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
    note:
      routeItem.manualOverrideKind === "none"
        ? undefined
        : `Manual override: ${routeItem.manualOverrideKind}`,
  };
}

function buildWeeklyRouteItem(
  routeItem: WeeklyRouteBoard["items"][number],
  sourceTitle: string,
  node?: Awaited<ReturnType<typeof listCurriculumNodes>>[number],
): WeeklyRouteItem {
  const subject = node?.normalizedPath.split("/")[0] ?? sourceTitle;
  const estimatedMinutes = node?.estimatedMinutes ?? 45;

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
  sourceId?: string;
}) {
  const sources = await listCurriculumSources(params.organizationId);
  if (sources.length === 0) {
    return { sources, selectedSource: null };
  }

  const selectedSource =
    params.sourceId && sources.some((source) => source.id === params.sourceId)
      ? sources.find((source) => source.id === params.sourceId) ?? sources[0]
      : sources[0];

  return { sources, selectedSource };
}

export async function getTodayWorkspace(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  date: string;
  sourceId?: string;
}): Promise<{
  workspace: DailyWorkspace;
  sourceId: string;
  sourceTitle: string;
  planningContext: ReturnType<typeof buildCopilotPlanningContext>;
} | null> {
  const { selectedSource } = await resolveSourceContext({
    organizationId: params.organizationId,
    sourceId: params.sourceId,
  });

  if (!selectedSource) {
    return null;
  }

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

  const selectedPlans = selectedRouteItems.map((item) =>
    buildPlanItem(
      item,
      selectedSource.title,
      item.scheduledDate ?? params.date,
      nodeById.get(item.skillNodeId),
    ),
  );
  const routeFingerprint = buildTodayLessonDraftFingerprint(selectedPlans.map((item) => item.id));
  const savedLessonDraft = await getSavedTodayLessonDraft({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    date: params.date,
    sourceId: selectedSource.id,
    routeFingerprint,
  });
  const alternateItems = getAlternateItems(board, selectedRouteItems.map((item) => item.id));
  const alternatesByPlanItemId = Object.fromEntries(
    selectedPlans.map((planItem) => [
      planItem.id,
      alternateItems
        .slice(0, 2)
        .map((routeItem) => buildWeeklyRouteItem(routeItem, selectedSource.title, nodeById.get(routeItem.skillNodeId))),
    ]),
  );

  const workspace: DailyWorkspace = {
    date: params.date,
    headline: `${selectedSource.title} route for ${params.learnerName}`,
    learner: {
      id: params.learnerId,
      name: params.learnerName,
      gradeLabel: `${selectedPlans.length} active item${selectedPlans.length === 1 ? "" : "s"}`,
      pacingPreference: "Current weekly route",
      currentSeason: formatPlannerDate(params.date),
    },
    leadItem: selectedPlans[0],
    items: selectedPlans,
    prepChecklist: buildPrepChecklist(params.learnerName, selectedSource.title, selectedPlans),
    sessionTargets: buildSessionTargets(selectedPlans),
    artifactSlots: buildArtifactSlots(selectedSource.title, selectedPlans),
    copilotInsertions: buildCopilotInsertions(params.learnerName, selectedSource.title, selectedPlans),
    completionPrompts: [
      "What did the learner complete today?",
      "What changed in pacing or support?",
      "Which route item should stay in view tomorrow?",
    ],
    familyNotes: buildFamilyNotes(selectedSource.title, selectedPlans),
    recoveryOptions: [],
    alternatesByPlanItemId,
    lessonDraft: savedLessonDraft,
  };

  return {
    workspace,
    sourceId: selectedSource.id,
    sourceTitle: selectedSource.title,
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

export async function completeTodayPlanItem(learnerId: string, weeklyRouteItemId: string) {
  await updateWeeklyRouteItem(learnerId, weeklyRouteItemId, (current) => ({
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
