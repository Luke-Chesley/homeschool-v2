import "server-only";

import { FIXTURE_SESSIONS } from "@/lib/activities/fixtures";
import { getRepositories } from "@/lib/db";
import { lessonSessions, planDays, planItems, plans } from "@/lib/db/schema";
import { ensureDatabaseReady, getDb } from "@/lib/db/server";

export const LOCAL_DEMO_ORGANIZATION_ID = "household-demo";
export const LOCAL_DEMO_LEARNER_ID = "learner-demo";
const LOCAL_DEMO_PLAN_ID = "plan-demo-sessions";
const LOCAL_DEMO_DAY_ID = "day-demo-sessions";

let ensurePromise: Promise<void> | null = null;

function mapActivityType(kind: string) {
  switch (kind) {
    case "quiz":
    case "matching":
    case "flashcards":
    case "sequencing":
    case "guided_practice":
    case "reflection":
      return kind;
    default:
      return "guided_practice";
  }
}

async function seedLocalDemoData() {
  await ensureDatabaseReady();
  const repos = getRepositories();
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  await repos.organizations.upsertOrganization({
    id: LOCAL_DEMO_ORGANIZATION_ID,
    name: "Demo Household",
    slug: "household-demo",
    type: "household",
    timezone: "America/Los_Angeles",
    metadata: {
      source: "local-demo-persistence",
    },
  });

  await repos.learners.upsertLearner({
    id: LOCAL_DEMO_LEARNER_ID,
    organizationId: LOCAL_DEMO_ORGANIZATION_ID,
    firstName: "Demo",
    displayName: "Demo Learner",
    timezone: "America/Los_Angeles",
    status: "active",
    metadata: {
      source: "local-demo-persistence",
    },
  });

  const existingPlan = await db.query.plans.findFirst({
    where: (table, { eq }) => eq(table.id, LOCAL_DEMO_PLAN_ID),
  });

  if (!existingPlan) {
    await db.insert(plans).values({
      id: LOCAL_DEMO_PLAN_ID,
      organizationId: LOCAL_DEMO_ORGANIZATION_ID,
      learnerId: LOCAL_DEMO_LEARNER_ID,
      title: "Demo learner activity queue",
      status: "active",
      startDate: today,
      metadata: {
        source: "local-demo-persistence",
        purpose: "demo_activity_queue",
      },
    });
  }

  const existingDay = await db.query.planDays.findFirst({
    where: (table, { eq }) => eq(table.id, LOCAL_DEMO_DAY_ID),
  });

  if (!existingDay) {
    await db.insert(planDays).values({
      id: LOCAL_DEMO_DAY_ID,
      planId: LOCAL_DEMO_PLAN_ID,
      date: today,
      status: "planned",
      metadata: {
        source: "local-demo-persistence",
      },
    });
  }

  for (const [index, session] of FIXTURE_SESSIONS.entries()) {
    const planItemId = `planitem-demo-${String(index + 1).padStart(3, "0")}`;
    const existingPlanItem = await db.query.planItems.findFirst({
      where: (table, { eq }) => eq(table.id, planItemId),
    });

    if (!existingPlanItem) {
      await db.insert(planItems).values({
        id: planItemId,
        planId: LOCAL_DEMO_PLAN_ID,
        planDayId: LOCAL_DEMO_DAY_ID,
        curriculumItemId: null,
        title: session.definition.title,
        description: session.definition.kind,
        subject: "Demo",
        status: "ready",
        scheduledDate: today,
        estimatedMinutes: session.estimatedMinutes ?? null,
        ordering: index,
        metadata: {
          source: "local-demo-persistence",
          fixtureSessionId: session.id,
          standardIds: session.standardIds,
        },
      });
    }

    const existingSession = await db.query.lessonSessions.findFirst({
      where: (table, { eq }) => eq(table.id, session.id),
    });

    if (!existingSession) {
      await db.insert(lessonSessions).values({
        id: session.id,
        organizationId: LOCAL_DEMO_ORGANIZATION_ID,
        learnerId: session.learnerId,
        planId: LOCAL_DEMO_PLAN_ID,
        planDayId: LOCAL_DEMO_DAY_ID,
        planItemId,
        sessionDate: today,
        workspaceType: "self_guided_queue",
        status: "planned",
        completionStatus: "not_started",
        reviewState: "not_required",
        reviewRequired: false,
        actualMinutes: null,
        scheduledMinutes: session.estimatedMinutes ?? null,
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
          source: "local-demo-persistence",
          standardIds: session.standardIds,
        },
      });
    }

    await repos.activities.upsertActivity({
      id: session.activityId,
      organizationId: LOCAL_DEMO_ORGANIZATION_ID,
      learnerId: session.learnerId,
      planItemId,
      lessonSessionId: session.id,
      activityType: mapActivityType(session.definition.kind),
      status: "published",
      title: session.definition.title,
      schemaVersion: "1",
      definition: session.definition as Record<string, unknown>,
      metadata: {
        source: "fixture-session",
        sessionId: session.id,
        standardIds: session.standardIds,
        estimatedMinutes: session.estimatedMinutes ?? null,
        lessonId: session.id,
      },
    });
  }
}

export async function ensureLocalDemoData() {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = seedLocalDemoData().catch((error) => {
    ensurePromise = null;
    throw error;
  });

  return ensurePromise;
}
