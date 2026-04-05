import "@/lib/server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import {
  lessonSessions,
  planDays,
  planItemCurriculumLinks,
  planItems,
  plans,
} from "@/lib/db/schema";
import type { PlanItem } from "@/lib/planning/types";

const SESSION_WORKSPACE_PLAN_PURPOSE = "session_workspace";

function mapPlanItemStatus(status: PlanItem["status"]): typeof planItems.$inferInsert["status"] {
  switch (status) {
    case "completed":
      return "completed";
    case "carried_over":
      return "carried_over";
    case "blocked":
      return "skipped";
    case "in_progress":
      return "planned";
    default:
      return "ready";
  }
}

function mapLessonSessionStatus(
  status: PlanItem["status"],
): typeof lessonSessions.$inferInsert["status"] {
  switch (status) {
    case "completed":
      return "completed";
    case "in_progress":
      return "in_progress";
    default:
      return "planned";
  }
}

function mapCompletionStatus(
  status: PlanItem["status"],
): typeof lessonSessions.$inferInsert["completionStatus"] {
  switch (status) {
    case "completed":
      return "completed_as_planned";
    case "blocked":
      return "needs_review";
    case "carried_over":
      return "needs_follow_up";
    default:
      return "not_started";
  }
}

async function getOrCreateSessionWorkspacePlan(args: {
  organizationId: string;
  learnerId: string;
}) {
  const db = getDb();
  const existing = await db.query.plans.findFirst({
    where: and(eq(plans.organizationId, args.organizationId), eq(plans.learnerId, args.learnerId)),
    orderBy: [sql`${plans.updatedAt} desc`],
  });

  if (
    existing &&
    typeof existing.metadata === "object" &&
    existing.metadata !== null &&
    !Array.isArray(existing.metadata) &&
    existing.metadata.purpose === SESSION_WORKSPACE_PLAN_PURPOSE
  ) {
    return existing;
  }

  const [created] = await db
    .insert(plans)
    .values({
      organizationId: args.organizationId,
      learnerId: args.learnerId,
      title: "Session workspace",
      status: "active",
      metadata: {
        purpose: SESSION_WORKSPACE_PLAN_PURPOSE,
      },
    })
    .returning();

  return created;
}

async function getOrCreateSessionWorkspaceDay(args: {
  planId: string;
  date: string;
}) {
  const db = getDb();
  const existing = await db.query.planDays.findFirst({
    where: and(eq(planDays.planId, args.planId), eq(planDays.date, args.date)),
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(planDays)
    .values({
      planId: args.planId,
      date: args.date,
      status: "planned",
      metadata: {},
    })
    .returning();

  return created;
}

async function upsertPlanItemForWorkspace(args: {
  planId: string;
  planDayId: string;
  date: string;
  item: PlanItem;
}) {
  const db = getDb();
  const existingLink = args.item.curriculum?.weeklyRouteItemId
    ? await db.query.planItemCurriculumLinks.findFirst({
        where: eq(planItemCurriculumLinks.weeklyRouteItemId, args.item.curriculum.weeklyRouteItemId),
      })
    : null;

  if (existingLink) {
    const [updated] = await db
      .update(planItems)
      .set({
        planId: args.planId,
        planDayId: args.planDayId,
        title: args.item.title,
        description: args.item.objective,
        subject: args.item.subject,
        status: mapPlanItemStatus(args.item.status),
        scheduledDate: args.date,
        estimatedMinutes: args.item.estimatedMinutes,
        ordering: args.item.ordering ?? 0,
        metadata: {
          sourceLabel: args.item.sourceLabel,
          lessonLabel: args.item.lessonLabel,
          materials: args.item.materials,
          goals: args.item.goals,
          standards: args.item.standards,
          copilotPrompts: args.item.copilotPrompts,
          note: args.item.note ?? null,
          artifactSlots: args.item.artifactSlots,
        },
        updatedAt: new Date(),
      })
      .where(eq(planItems.id, existingLink.planItemId))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(planItems)
    .values({
      planId: args.planId,
      planDayId: args.planDayId,
      curriculumItemId: null,
      title: args.item.title,
      description: args.item.objective,
      subject: args.item.subject,
      status: mapPlanItemStatus(args.item.status),
      scheduledDate: args.date,
      estimatedMinutes: args.item.estimatedMinutes,
      ordering: args.item.ordering ?? 0,
      metadata: {
        sourceLabel: args.item.sourceLabel,
        lessonLabel: args.item.lessonLabel,
        materials: args.item.materials,
        goals: args.item.goals,
        standards: args.item.standards,
        copilotPrompts: args.item.copilotPrompts,
        note: args.item.note ?? null,
        artifactSlots: args.item.artifactSlots,
      },
    })
    .returning();

  if (args.item.curriculum) {
    await db
      .insert(planItemCurriculumLinks)
      .values({
        planItemId: created.id,
        sourceId: args.item.curriculum.sourceId,
        skillNodeId: args.item.curriculum.skillNodeId,
        weeklyRouteItemId: args.item.curriculum.weeklyRouteItemId,
        origin: args.item.curriculum.origin,
        metadata: {},
      })
      .onConflictDoNothing({
        target: planItemCurriculumLinks.weeklyRouteItemId,
      });

    const canonicalLink = await db.query.planItemCurriculumLinks.findFirst({
      where: eq(planItemCurriculumLinks.weeklyRouteItemId, args.item.curriculum.weeklyRouteItemId),
    });

    if (canonicalLink && canonicalLink.planItemId !== created.id) {
      return (
        (await db.query.planItems.findFirst({
          where: eq(planItems.id, canonicalLink.planItemId),
        })) ?? created
      );
    }
  }

  return created;
}

async function upsertSessionForPlanItem(args: {
  organizationId: string;
  learnerId: string;
  planId: string;
  planDayId: string;
  planItemId: string;
  date: string;
  item: PlanItem;
}) {
  const db = getDb();
  const existing = await db.query.lessonSessions.findFirst({
    where: and(
      eq(lessonSessions.organizationId, args.organizationId),
      eq(lessonSessions.learnerId, args.learnerId),
      eq(lessonSessions.planItemId, args.planItemId),
      eq(lessonSessions.sessionDate, args.date),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(lessonSessions)
      .set({
        planId: args.planId,
        planDayId: args.planDayId,
        workspaceType: "homeschool_day",
        status: mapLessonSessionStatus(args.item.status),
        completionStatus: mapCompletionStatus(args.item.status),
        reviewState: existing.reviewState,
        reviewRequired: existing.reviewRequired,
        scheduledMinutes: args.item.estimatedMinutes,
        metadata: {
          weeklyRouteItemId: args.item.curriculum?.weeklyRouteItemId ?? null,
          sourceLabel: args.item.sourceLabel,
          lessonLabel: args.item.lessonLabel,
        },
        updatedAt: new Date(),
      })
      .where(eq(lessonSessions.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(lessonSessions)
    .values({
      organizationId: args.organizationId,
      learnerId: args.learnerId,
      planId: args.planId,
      planDayId: args.planDayId,
      planItemId: args.planItemId,
      sessionDate: args.date,
      workspaceType: "homeschool_day",
      status: mapLessonSessionStatus(args.item.status),
      completionStatus: mapCompletionStatus(args.item.status),
      reviewState: "not_required",
      reviewRequired: false,
      actualMinutes: null,
      scheduledMinutes: args.item.estimatedMinutes,
      startedAt: null,
      completedAt: null,
      reviewedAt: null,
      reviewedByAdultUserId: null,
      summary: null,
      notes: null,
      retrospective: null,
      nextAction: null,
      deviationReason: null,
      metadata: {
        weeklyRouteItemId: args.item.curriculum?.weeklyRouteItemId ?? null,
        sourceLabel: args.item.sourceLabel,
        lessonLabel: args.item.lessonLabel,
      },
    })
    .returning();

  return created;
}

export async function syncDailyWorkspaceSessionRecords(args: {
  organizationId: string;
  learnerId: string;
  date: string;
  items: PlanItem[];
}) {
  const plan = await getOrCreateSessionWorkspacePlan({
    organizationId: args.organizationId,
    learnerId: args.learnerId,
  });
  const day = await getOrCreateSessionWorkspaceDay({
    planId: plan.id,
    date: args.date,
  });

  const synced = await Promise.all(
    args.items.map(async (item, index) => {
      const planItem = await upsertPlanItemForWorkspace({
        planId: plan.id,
        planDayId: day.id,
        date: args.date,
        item: {
          ...item,
          ordering: item.ordering ?? index,
        },
      });
      const session = await upsertSessionForPlanItem({
        organizationId: args.organizationId,
        learnerId: args.learnerId,
        planId: plan.id,
        planDayId: day.id,
        planItemId: planItem.id,
        date: args.date,
        item,
      });

      return {
        weeklyRouteItemId: item.id,
        planItemId: planItem.id,
        lessonSessionId: session.id,
        reviewState: session.reviewState,
        completionStatus: session.completionStatus,
      };
    }),
  );

  return {
    planId: plan.id,
    planDayId: day.id,
    itemsByWeeklyRouteItemId: Object.fromEntries(
      synced.map((entry) => [entry.weeklyRouteItemId, entry]),
    ),
  };
}
