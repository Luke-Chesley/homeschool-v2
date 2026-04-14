import "@/lib/server-only";

import { eq } from "drizzle-orm";

import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { organizations } from "@/lib/db/schema";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";

type BetaMeasurementMode = "intent_only" | "live_billing";
type BetaEnrollmentStatus = "candidate" | "enrolled" | "paused" | "complete";

export type BetaCohortMetadata = {
  enrollmentStatus: BetaEnrollmentStatus;
  measurementMode: BetaMeasurementMode;
  cohortLabel: string | null;
  recruitmentSource: string | null;
  supportNotes: string | null;
  enrolledAt: string | null;
  updatedAt: string | null;
};

export type BetaHouseholdScorecard = {
  organizationId: string;
  beta: BetaCohortMetadata;
  activation: {
    onboardingStartedAt: string | null;
    firstTodayOpenedAt: string | null;
    reachedFirstToday: boolean;
    timeToFirstTodayMinutes: number | null;
    firstPlanItemStatusChanged: boolean;
  };
  retention: {
    returnedDay2: boolean;
    returnedDay7: boolean;
    week1TodayOpens: number;
    week1LearnerAdditions: number;
    week1CurriculumInputsAdded: number;
  };
  monetization: {
    billingOfferViewed: boolean;
    trialStarted: boolean;
    checkoutStarted: boolean;
    checkoutCompleted: boolean;
    subscriptionActivated: boolean;
    subscriptionPaymentFailed: boolean;
    founderIntentCaptured: boolean;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asIsoString(value: unknown) {
  const normalized = asNullableString(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeBetaMetadata(value: unknown): BetaCohortMetadata {
  const record = asRecord(value);
  const enrollmentStatus = record.enrollmentStatus;
  const measurementMode = record.measurementMode;

  return {
    enrollmentStatus:
      enrollmentStatus === "enrolled" ||
      enrollmentStatus === "paused" ||
      enrollmentStatus === "complete"
        ? enrollmentStatus
        : "candidate",
    measurementMode: measurementMode === "live_billing" ? "live_billing" : "intent_only",
    cohortLabel: asNullableString(record.cohortLabel),
    recruitmentSource: asNullableString(record.recruitmentSource),
    supportNotes: asNullableString(record.supportNotes),
    enrolledAt: asIsoString(record.enrolledAt),
    updatedAt: asIsoString(record.updatedAt),
  };
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function differenceInMinutes(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function getOrganizationBetaMetadata(organizationId: string) {
  const organization = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  return normalizeBetaMetadata(asRecord(asRecord(organization.metadata).beta));
}

export async function updateOrganizationBetaMetadata(
  organizationId: string,
  patch: Partial<BetaCohortMetadata>,
) {
  const organization = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  const metadata = asRecord(organization.metadata);
  const current = normalizeBetaMetadata(asRecord(metadata.beta));
  const next: BetaCohortMetadata = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await getDb()
    .update(organizations)
    .set({
      metadata: {
        ...metadata,
        beta: next,
      },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  return next;
}

function firstEventTime(
  events: Array<{ name: string; createdAt: Date }>,
  name: string,
) {
  return events.find((event) => event.name === name)?.createdAt ?? null;
}

function hasEvent(events: Array<{ name: string }>, name: string) {
  return events.some((event) => event.name === name);
}

function countEventsBetween(
  events: Array<{ name: string; createdAt: Date }>,
  name: string,
  start: Date | null,
  end: Date | null,
) {
  if (!start || !end) {
    return 0;
  }

  return events.filter(
    (event) => event.name === name && event.createdAt >= start && event.createdAt < end,
  ).length;
}

export async function buildBetaHouseholdScorecard(
  organizationId: string,
): Promise<BetaHouseholdScorecard> {
  const repos = createRepositories(getDb());
  const [beta, events] = await Promise.all([
    getOrganizationBetaMetadata(organizationId),
    repos.observability.listProductEventsForOrganization(organizationId),
  ]);

  const onboardingStartedAt = firstEventTime(events, ACTIVATION_EVENT_NAMES.onboardingStarted);
  const firstTodayOpenedAt =
    firstEventTime(events, ACTIVATION_EVENT_NAMES.firstTodayOpened) ??
    firstEventTime(events, ACTIVATION_EVENT_NAMES.todayOpened);
  const weekStart = onboardingStartedAt ? startOfUtcDay(onboardingStartedAt) : null;
  const weekEnd = weekStart ? addDays(weekStart, 7) : null;

  return {
    organizationId,
    beta,
    activation: {
      onboardingStartedAt: onboardingStartedAt?.toISOString() ?? null,
      firstTodayOpenedAt: firstTodayOpenedAt?.toISOString() ?? null,
      reachedFirstToday: Boolean(firstTodayOpenedAt),
      timeToFirstTodayMinutes:
        onboardingStartedAt && firstTodayOpenedAt
          ? differenceInMinutes(onboardingStartedAt, firstTodayOpenedAt)
          : null,
      firstPlanItemStatusChanged: hasEvent(
        events,
        ACTIVATION_EVENT_NAMES.firstPlanItemStatusChange,
      ),
    },
    retention: {
      returnedDay2: hasEvent(events, ACTIVATION_EVENT_NAMES.returnedDay2),
      returnedDay7: hasEvent(events, ACTIVATION_EVENT_NAMES.returnedDay7),
      week1TodayOpens: countEventsBetween(
        events,
        ACTIVATION_EVENT_NAMES.todayOpened,
        weekStart,
        weekEnd,
      ),
      week1LearnerAdditions: countEventsBetween(
        events,
        ACTIVATION_EVENT_NAMES.secondLearnerCreated,
        weekStart,
        weekEnd,
      ),
      week1CurriculumInputsAdded: countEventsBetween(
        events,
        ACTIVATION_EVENT_NAMES.curriculumSourceAdded,
        weekStart,
        weekEnd,
      ),
    },
    monetization: {
      billingOfferViewed: hasEvent(events, ACTIVATION_EVENT_NAMES.billingOfferViewed),
      trialStarted: hasEvent(events, ACTIVATION_EVENT_NAMES.trialStarted),
      checkoutStarted: hasEvent(events, ACTIVATION_EVENT_NAMES.checkoutStarted),
      checkoutCompleted: hasEvent(events, ACTIVATION_EVENT_NAMES.checkoutCompleted),
      subscriptionActivated: hasEvent(events, ACTIVATION_EVENT_NAMES.subscriptionActivated),
      subscriptionPaymentFailed: hasEvent(
        events,
        ACTIVATION_EVENT_NAMES.subscriptionPaymentFailed,
      ),
      founderIntentCaptured: hasEvent(events, ACTIVATION_EVENT_NAMES.founderIntentCaptured),
    },
  };
}

export async function getOrganizationTodayTrackerBaseline(organizationId: string) {
  const repos = createRepositories(getDb());
  const [beta, events] = await Promise.all([
    getOrganizationBetaMetadata(organizationId),
    repos.observability.listProductEventsForOrganization(organizationId),
  ]);

  const onboardingStartedAt = firstEventTime(events, ACTIVATION_EVENT_NAMES.onboardingStarted);

  return {
    beta,
    onboardingStartedAt: onboardingStartedAt?.toISOString() ?? null,
  };
}

export async function listBetaHouseholdScorecards(options?: {
  cohortLabel?: string;
  statuses?: BetaEnrollmentStatus[];
}) {
  const organizationsList = await getDb().query.organizations.findMany({
    where: eq(organizations.type, "household"),
  });

  const filtered = organizationsList.filter((organization) => {
    const beta = normalizeBetaMetadata(asRecord(asRecord(organization.metadata).beta));
    if (options?.cohortLabel && beta.cohortLabel !== options.cohortLabel) {
      return false;
    }
    if (options?.statuses && !options.statuses.includes(beta.enrollmentStatus)) {
      return false;
    }
    return beta.enrollmentStatus !== "candidate";
  });

  return Promise.all(filtered.map((organization) => buildBetaHouseholdScorecard(organization.id)));
}
