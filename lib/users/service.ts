import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { FIXTURE_SESSIONS } from "@/lib/activities/fixtures";
import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { interactiveActivities, organizations } from "@/lib/db/schema";

export type AppLearner = {
  id: string;
  organizationId: string;
  displayName: string;
  firstName: string;
  lastName: string | null;
  status: "active" | "paused" | "archived";
};

export type AppWorkspace = {
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  learners: AppLearner[];
  activeLearner: AppLearner | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "homeschool";
}

function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const [firstName = displayName.trim(), ...rest] = parts;

  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(" ") : null,
  };
}

function mapLearnerRecord(record: {
  id: string;
  organizationId: string;
  displayName: string;
  firstName: string;
  lastName: string | null;
  status: "active" | "paused" | "archived";
}): AppLearner {
  return {
    id: record.id,
    organizationId: record.organizationId,
    displayName: record.displayName,
    firstName: record.firstName,
    lastName: record.lastName,
    status: record.status,
  };
}

export async function ensureAppOrganization() {
  const db = getDb();
  const repos = createRepositories(db);
  const existing = await db.query.organizations.findFirst({
    orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
  });

  if (existing) {
    return existing;
  }

  const timestamp = Date.now();

  return repos.organizations.createOrganization({
    name: "Homeschool",
    slug: `homeschool-${timestamp}`,
    type: "household",
    timezone: "America/Los_Angeles",
    metadata: {},
  });
}

export async function listLearnersForOrganization(organizationId: string): Promise<AppLearner[]> {
  const repos = createRepositories(getDb());
  const learners = await repos.learners.listByOrganization(organizationId);

  return learners.map(mapLearnerRecord);
}

export async function ensureFixtureActivitiesForLearner(
  organizationId: string,
  learnerId: string,
) {
  const db = getDb();
  const existing = await db
    .select({ id: interactiveActivities.id })
    .from(interactiveActivities)
    .where(eq(interactiveActivities.learnerId, learnerId))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  for (const session of FIXTURE_SESSIONS) {
    await db.insert(interactiveActivities).values({
      organizationId,
      learnerId,
      activityType: session.definition.kind === "hybrid_layout" ? "reading_check" : session.definition.kind,
      status: "published",
      title: session.definition.title,
      definition: session.definition as Record<string, unknown>,
      metadata: {
        sessionKind: session.definition.kind,
        estimatedMinutes: session.estimatedMinutes ?? null,
        lessonId: session.lessonId ?? null,
        standardIds: session.standardIds,
      },
    });
  }
}

export async function createLearnerForOrganization(
  organizationId: string,
  input: { displayName: string },
) {
  const normalizedDisplayName = input.displayName.trim();
  if (!normalizedDisplayName) {
    throw new Error("Display name is required.");
  }

  const repos = createRepositories(getDb());
  const { firstName, lastName } = splitDisplayName(normalizedDisplayName);
  const learner = await repos.learners.createLearner({
    organizationId,
    firstName,
    lastName,
    displayName: normalizedDisplayName,
    timezone: "America/Los_Angeles",
    status: "active",
    metadata: {},
  });

  await ensureFixtureActivitiesForLearner(organizationId, learner.id);
  return mapLearnerRecord(learner);
}

export async function getWorkspaceContext(options?: {
  organizationId?: string | null;
  learnerId?: string | null;
}): Promise<AppWorkspace> {
  const organization =
    options?.organizationId != null
      ? await getDb().query.organizations.findFirst({
          where: eq(organizations.id, options.organizationId),
        })
      : await ensureAppOrganization();

  if (!organization) {
    throw new Error("Organization not found.");
  }

  const learners = await listLearnersForOrganization(organization.id);
  const activeLearner =
    learners.find((learner) => learner.id === options?.learnerId) ?? learners[0] ?? null;

  if (activeLearner) {
    await ensureFixtureActivitiesForLearner(organization.id, activeLearner.id);
  }

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
    },
    learners,
    activeLearner,
  };
}

export async function getLearnerById(learnerId: string) {
  const repos = createRepositories(getDb());
  const learner = await repos.learners.findLearnerById(learnerId);
  return learner ? mapLearnerRecord(learner) : null;
}

export async function createDefaultOrganizationIfNeeded(name: string) {
  const db = getDb();
  const existing = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slugify(name)),
  });

  if (existing) {
    return existing;
  }

  return createRepositories(db).organizations.createOrganization({
    name,
    slug: `${slugify(name)}-${Date.now()}`,
    type: "household",
    timezone: "America/Los_Angeles",
    metadata: {},
  });
}
