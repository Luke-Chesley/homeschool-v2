import "@/lib/server-only";

import { eq, inArray } from "drizzle-orm";

import { homeschoolTemplate } from "@/config/templates/homeschool";
import { getDb } from "@/lib/db/server";
import { learnerProfiles, learners, organizationPlatformSettings, organizations } from "@/lib/db/schema";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function optionalNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type HomeschoolHouseholdPreferences = {
  householdName: string;
  schoolYearLabel: string | null;
  termStartDate: string | null;
  termEndDate: string | null;
  preferredSchoolDays: number[];
  dailyTimeBudgetMinutes: number;
  subjects: string[];
  standardsPreference: string | null;
  teachingStyle: string | null;
};

export type HomeschoolLearnerPreference = {
  learnerId: string;
  gradeLevel: string | null;
  pacePreference: "gentle" | "balanced" | "accelerated";
  loadPreference: "light" | "balanced" | "ambitious";
};

export async function getHomeschoolHouseholdPreferences(organizationId: string): Promise<HomeschoolHouseholdPreferences> {
  const db = getDb();
  const [organization, settings] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    }),
    db.query.organizationPlatformSettings.findFirst({
      where: eq(organizationPlatformSettings.organizationId, organizationId),
    }),
  ]);

  const organizationMetadata = asRecord(organization?.metadata);
  const homeschool = asRecord(organizationMetadata.homeschool);
  const onboarding = asRecord(homeschool.onboarding);
  const scheduler = asRecord(homeschool.scheduler);
  const settingsMetadata = asRecord(settings?.metadata);
  const reportDefaults = asRecord(settings?.reportDefaults);

  return {
    householdName: organization?.name ?? "Homeschool",
    schoolYearLabel: optionalNonEmptyString(onboarding.schoolYearLabel),
    termStartDate: optionalNonEmptyString(onboarding.termStartDate),
    termEndDate: optionalNonEmptyString(onboarding.termEndDate),
    preferredSchoolDays: Array.isArray(scheduler.preferredSchoolDays)
      ? scheduler.preferredSchoolDays.filter((value): value is number => Number.isInteger(value))
      : [...homeschoolTemplate.defaults.schoolDays],
    dailyTimeBudgetMinutes:
      typeof scheduler.dailyTimeBudgetMinutes === "number"
        ? scheduler.dailyTimeBudgetMinutes
        : homeschoolTemplate.defaults.dailyTimeBudgetMinutes,
    subjects: Array.isArray(onboarding.subjects)
      ? onboarding.subjects.filter((value): value is string => typeof value === "string")
      : [],
    standardsPreference:
      optionalNonEmptyString(reportDefaults.standardsPreference) ??
      optionalNonEmptyString(settingsMetadata.standardsPreference),
    teachingStyle: optionalNonEmptyString(onboarding.teachingStyle),
  };
}

export async function listHomeschoolLearnerPreferences(organizationId: string): Promise<HomeschoolLearnerPreference[]> {
  const db = getDb();
  const learnerRows = await db.query.learners.findMany({
    where: eq(learners.organizationId, organizationId),
    columns: {
      id: true,
    },
  });
  const learnerIds = learnerRows.map((learner) => learner.id);
  if (learnerIds.length === 0) {
    return [];
  }
  const profiles = await db.query.learnerProfiles.findMany({
    where: inArray(learnerProfiles.learnerId, learnerIds),
  });

  return profiles.map((profile) => {
      const metadata = asRecord(profile.metadata);
      const homeschool = asRecord(metadata.homeschool);
      return {
        learnerId: profile.learnerId,
        gradeLevel: profile.gradeLevel,
        pacePreference:
          homeschool.pacePreference === "gentle" ||
          homeschool.pacePreference === "accelerated"
            ? homeschool.pacePreference
            : "balanced",
        loadPreference:
          homeschool.loadPreference === "light" ||
          homeschool.loadPreference === "ambitious"
            ? homeschool.loadPreference
            : "balanced",
      };
    });
}
