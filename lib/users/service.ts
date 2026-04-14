import "@/lib/server-only";

import { and, eq } from "drizzle-orm";

import { ensurePublishedActivitiesForLearner } from "@/lib/activities/assignment-service";
import { assertLearnerCreationAllowed } from "@/lib/billing/service";
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

function canUseLearnerInWorkspace(learner: AppLearner) {
  return learner.status !== "archived";
}

function resolveActiveLearner(learners: AppLearner[], preferredLearnerId?: string | null) {
  const selectableLearners = learners.filter(canUseLearnerInWorkspace);
  if (selectableLearners.length === 0) {
    return null;
  }

  return (
    selectableLearners.find((learner) => learner.id === preferredLearnerId) ??
    selectableLearners.find((learner) => learner.status === "active") ??
    selectableLearners[0]
  );
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
  await assertLearnerCreationAllowed(organizationId);
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

export async function getWorkspaceContextForOrganization(options: {
  organizationId: string;
  learnerId?: string | null;
}): Promise<AppWorkspace> {
  await ensureDatabaseReady();
  const organization = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, options.organizationId),
  });

  if (!organization) {
    throw new Error("Organization not found.");
  }

  const platformSettings = await ensureOrganizationPlatformSettings({
    id: organization.id,
    type: organization.type,
  });

  const learners = await listLearnersForOrganization(organization.id);
  const activeLearner = resolveActiveLearner(learners, options.learnerId);

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
