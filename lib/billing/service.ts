import "@/lib/server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/server";
import { learners, organizations } from "@/lib/db/schema";

import {
  type BillingInterval,
  type BillingStatus,
  type HouseholdBillingRecord,
  type HouseholdBillingSummary,
  type LocalBillingSandboxAction,
  HouseholdBillingRecordSchema,
} from "@/lib/billing/types";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function optionalString(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export const FOUNDING_HOUSEHOLD_PLAN = {
  key: "founding_household",
  name: "Founding household",
  learnerCap: 5,
  defaultInterval: "annual" as const,
  trialDays: 7,
};

export class BillingEntitlementError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "learner_cap_reached", status = 409) {
    super(message);
    this.name = "BillingEntitlementError";
    this.code = code;
    this.status = status;
  }
}

export function isBillingEntitlementError(error: unknown): error is BillingEntitlementError {
  return error instanceof BillingEntitlementError;
}

export function getBillingConfiguration() {
  const stripeSecretKey = optionalString(process.env.STRIPE_SECRET_KEY);
  const stripeWebhookSecret = optionalString(process.env.STRIPE_WEBHOOK_SECRET);
  const annualPriceId = optionalString(process.env.STRIPE_FOUNDING_HOUSEHOLD_ANNUAL_PRICE_ID);
  const monthlyPriceId = optionalString(process.env.STRIPE_FOUNDING_HOUSEHOLD_MONTHLY_PRICE_ID);
  const appEnv = process.env.APP_ENV === "hosted" ? "hosted" : "local";
  const hasStripeConfiguration = Boolean(stripeSecretKey && annualPriceId);

  return {
    appEnv,
    stripeSecretKey,
    stripeWebhookSecret,
    annualPriceId,
    monthlyPriceId,
    hasStripeConfiguration,
    localSandboxEnabled: appEnv === "local" && !hasStripeConfiguration,
  };
}

function buildDefaultBillingRecord(): HouseholdBillingRecord {
  return {
    planKey: FOUNDING_HOUSEHOLD_PLAN.key,
    planName: FOUNDING_HOUSEHOLD_PLAN.name,
    billingInterval: FOUNDING_HOUSEHOLD_PLAN.defaultInterval,
    status: "none",
    learnerCap: FOUNDING_HOUSEHOLD_PLAN.learnerCap,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodEnd: null,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    updatedAt: null,
  };
}

function normalizeBillingRecord(value: unknown): HouseholdBillingRecord {
  const parsed = HouseholdBillingRecordSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  return buildDefaultBillingRecord();
}

function mergeBillingRecord(
  current: HouseholdBillingRecord,
  patch: Partial<HouseholdBillingRecord>,
): HouseholdBillingRecord {
  return {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

function getBillingStatusLabel(status: BillingStatus) {
  switch (status) {
    case "trialing":
      return "Trialing";
    case "active":
      return "Active";
    case "past_due":
      return "Payment issue";
    case "canceled":
      return "Canceled";
    case "incomplete":
      return "Incomplete";
    case "unpaid":
      return "Unpaid";
    case "none":
    default:
      return "Not started";
  }
}

async function findOrganizationRecord(organizationId: string) {
  const organization = await getDb().query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  return organization;
}

async function countActiveLearners(organizationId: string) {
  const rows = await getDb()
    .select({ id: learners.id })
    .from(learners)
    .where(and(eq(learners.organizationId, organizationId), ne(learners.status, "archived")));

  return rows.length;
}

export async function getOrganizationBillingRecord(organizationId: string) {
  const organization = await findOrganizationRecord(organizationId);
  return normalizeBillingRecord(asRecord(organization.metadata).billing);
}

export async function updateOrganizationBillingRecord(
  organizationId: string,
  patch: Partial<HouseholdBillingRecord>,
) {
  const organization = await findOrganizationRecord(organizationId);
  const metadata = asRecord(organization.metadata);
  const current = normalizeBillingRecord(metadata.billing);
  const nextRecord = mergeBillingRecord(current, patch);

  await getDb()
    .update(organizations)
    .set({
      metadata: {
        ...metadata,
        billing: nextRecord,
      },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  return nextRecord;
}

export async function replaceOrganizationBillingRecord(
  organizationId: string,
  record: HouseholdBillingRecord,
) {
  const organization = await findOrganizationRecord(organizationId);
  const metadata = asRecord(organization.metadata);
  const nextRecord = mergeBillingRecord(buildDefaultBillingRecord(), record);

  await getDb()
    .update(organizations)
    .set({
      metadata: {
        ...metadata,
        billing: nextRecord,
      },
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  return nextRecord;
}

export async function getHouseholdBillingSummary(
  organizationId: string,
): Promise<HouseholdBillingSummary> {
  const [record, activeLearnerCount] = await Promise.all([
    getOrganizationBillingRecord(organizationId),
    countActiveLearners(organizationId),
  ]);
  const config = getBillingConfiguration();
  const remainingLearnerSlots = Math.max(0, record.learnerCap - activeLearnerCount);

  return {
    record,
    activeLearnerCount,
    remainingLearnerSlots,
    statusLabel: getBillingStatusLabel(record.status),
    hasStripeConfiguration: config.hasStripeConfiguration,
    localSandboxEnabled: config.localSandboxEnabled,
    canStartCheckout: record.status === "none" || record.status === "canceled" || record.status === "incomplete",
    canManageBilling:
      Boolean(record.stripeCustomerId) &&
      (record.status === "trialing" ||
        record.status === "active" ||
        record.status === "past_due" ||
        record.status === "unpaid" ||
        record.status === "canceled"),
  };
}

export async function assertLearnerCreationAllowed(organizationId: string) {
  const summary = await getHouseholdBillingSummary(organizationId);
  if (summary.activeLearnerCount >= summary.record.learnerCap) {
    throw new BillingEntitlementError(
      `This household is capped at ${summary.record.learnerCap} active learners on the founding plan.`,
    );
  }

  return summary;
}

export async function applyLocalBillingSandboxAction(
  organizationId: string,
  action: LocalBillingSandboxAction,
) {
  const current = await getOrganizationBillingRecord(organizationId);
  const now = new Date();
  const annualEnd = addYears(now, 1).toISOString();
  const trialEnd = addDays(now, FOUNDING_HOUSEHOLD_PLAN.trialDays).toISOString();

  switch (action) {
    case "start_trial":
      return updateOrganizationBillingRecord(organizationId, {
        status: "trialing",
        trialEndsAt: trialEnd,
        currentPeriodEnd: trialEnd,
        cancelAtPeriodEnd: false,
      });
    case "activate":
      return updateOrganizationBillingRecord(organizationId, {
        status: "active",
        trialEndsAt: null,
        currentPeriodEnd: annualEnd,
        cancelAtPeriodEnd: false,
      });
    case "past_due":
      return updateOrganizationBillingRecord(organizationId, {
        status: "past_due",
        currentPeriodEnd: current.currentPeriodEnd ?? annualEnd,
      });
    case "cancel":
      return updateOrganizationBillingRecord(organizationId, {
        status: "canceled",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: current.currentPeriodEnd ?? annualEnd,
      });
    case "reactivate":
      return updateOrganizationBillingRecord(organizationId, {
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: current.currentPeriodEnd ?? annualEnd,
      });
    case "reset":
    default:
      return replaceOrganizationBillingRecord(organizationId, buildDefaultBillingRecord());
  }
}

export function getBillingIntervalDisplayName(interval: BillingInterval) {
  return interval === "monthly" ? "Monthly" : "Annual";
}

export async function findOrganizationByStripeCustomerId(customerId: string) {
  const [organization] = await getDb()
    .select()
    .from(organizations)
    .where(sql`${organizations.metadata} -> 'billing' ->> 'stripeCustomerId' = ${customerId}`)
    .limit(1);

  return organization ?? null;
}

export async function findOrganizationByStripeSubscriptionId(subscriptionId: string) {
  const [organization] = await getDb()
    .select()
    .from(organizations)
    .where(sql`${organizations.metadata} -> 'billing' ->> 'stripeSubscriptionId' = ${subscriptionId}`)
    .limit(1);

  return organization ?? null;
}
