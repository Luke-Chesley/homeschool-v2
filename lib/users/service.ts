import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { ensurePublishedActivitiesForLearner } from "@/lib/activities/assignment-service";
import { createRepositories } from "@/lib/db";
import { ensureDatabaseReady, getDb } from "@/lib/db/server";
import { learners, organizations } from "@/lib/db/schema";
import { ensureOrganizationPlatformSettings } from "@/lib/platform/settings";

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
  platformSettings: {
    templateKey: string;
    workflowMode: string;
    reportingMode: string;
    primaryGuideLabel: string;
    learnerLabel: string;
    sessionLabel: string;
    moduleLabel: string;
    activityLabel: string;
    checkpointLabel: string;
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
  await ensureDatabaseReady();
  const db = getDb();
  const repos = createRepositories(db);
  const existing = await db.query.organizations.findFirst({
    orderBy: (table, { asc: orderAsc }) => [orderAsc(table.createdAt)],
  });

  if (existing) {
    await ensureOrganizationPlatformSettings({
      id: existing.id,
      type: existing.type,
    });
    return existing;
  }

  const timestamp = Date.now();

  const organization = await repos.organizations.createOrganization({
    name: "Homeschool",
    slug: `homeschool-${timestamp}`,
    type: "household",
    timezone: "America/Los_Angeles",
    metadata: {},
  });

  await ensureOrganizationPlatformSettings({
    id: organization.id,
    type: organization.type,
  });

  return organization;
}

export async function listLearnersForOrganization(organizationId: string): Promise<AppLearner[]> {
  await ensureDatabaseReady();
  const repos = createRepositories(getDb());
  const learners = await repos.learners.listByOrganization(organizationId);

  return learners.map(mapLearnerRecord);
}

export async function ensureActivitiesForLearner(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
}) {
  await ensurePublishedActivitiesForLearner({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
  });
}

export async function createLearnerForOrganization(
  organizationId: string,
  input: { displayName: string },
) {
  await ensureDatabaseReady();
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

  await ensureActivitiesForLearner({
    organizationId,
    learnerId: learner.id,
    learnerName: learner.displayName,
  });
  return mapLearnerRecord(learner);
}

export async function getWorkspaceContext(options?: {
  organizationId?: string | null;
  learnerId?: string | null;
}): Promise<AppWorkspace> {
  await ensureDatabaseReady();
  let organization =
    options?.organizationId != null
      ? await getDb().query.organizations.findFirst({
          where: eq(organizations.id, options.organizationId),
        })
      : null;

  // Cookies can point at deleted/demo organizations. Recover to a valid workspace instead of
  // throwing from every parent route.
  if (!organization) {
    organization = await ensureAppOrganization();
  }

  const platformSettings = await ensureOrganizationPlatformSettings({
    id: organization.id,
    type: organization.type,
  });

  const learners = await listLearnersForOrganization(organization.id);
  const activeLearner =
    learners.find((learner) => learner.id === options?.learnerId) ?? learners[0] ?? null;

  if (activeLearner) {
    await ensureActivitiesForLearner({
      organizationId: organization.id,
      learnerId: activeLearner.id,
      learnerName: activeLearner.displayName,
    });
  }

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
    },
    platformSettings: {
      templateKey: platformSettings.templateKey,
      workflowMode: platformSettings.workflowMode,
      reportingMode: platformSettings.reportingMode,
      primaryGuideLabel: platformSettings.primaryGuideLabel,
      learnerLabel: platformSettings.learnerLabel,
      sessionLabel: platformSettings.sessionLabel,
      moduleLabel: platformSettings.moduleLabel,
      activityLabel: platformSettings.activityLabel,
      checkpointLabel: platformSettings.checkpointLabel,
    },
    learners,
    activeLearner,
  };
}

export async function getLearnerById(
  learnerId: string,
  options?: { organizationId?: string | null },
) {
  await ensureDatabaseReady();
  const learner = await getDb().query.learners.findFirst({
    where: and(
      eq(learners.id, learnerId),
      options?.organizationId ? eq(learners.organizationId, options.organizationId) : undefined,
    ),
  });
  return learner ? mapLearnerRecord(learner) : null;
}

export async function createDefaultOrganizationIfNeeded(name: string) {
  await ensureDatabaseReady();
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
