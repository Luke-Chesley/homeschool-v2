import "server-only";

import { FIXTURE_SESSIONS } from "@/lib/activities/fixtures";
import { getRepositories } from "@/lib/db/server";

export const LOCAL_DEMO_ORGANIZATION_ID = "household-demo";
export const LOCAL_DEMO_LEARNER_ID = "learner-demo";

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
  const repos = await getRepositories();

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

  for (const session of FIXTURE_SESSIONS) {
    await repos.activities.upsertActivity({
      id: session.activityId,
      organizationId: LOCAL_DEMO_ORGANIZATION_ID,
      learnerId: session.learnerId,
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
        lessonId: session.lessonId ?? null,
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
