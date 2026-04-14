import "@/lib/server-only";

import Stripe from "stripe";

import {
  FOUNDING_HOUSEHOLD_PLAN,
  findOrganizationByStripeCustomerId,
  findOrganizationByStripeSubscriptionId,
  getBillingConfiguration,
  getOrganizationBillingRecord,
  updateOrganizationBillingRecord,
} from "@/lib/billing/service";
import type { BillingStatus } from "@/lib/billing/types";

let cachedStripe: Stripe | null = null;

function requireStripeConfiguration() {
  const config = getBillingConfiguration();
  if (!config.stripeSecretKey || !config.annualPriceId) {
    throw new Error("Stripe billing is not configured.");
  }

  return config;
}

export function getStripeServerClient() {
  if (cachedStripe) {
    return cachedStripe;
  }

  const config = requireStripeConfiguration();
  const secretKey = config.stripeSecretKey!;
  cachedStripe = new Stripe(secretKey, {
    apiVersion: "2026-03-25.dahlia",
  });
  return cachedStripe;
}

export async function createBillingCheckoutSession(params: {
  organizationId: string;
  adultEmail: string | null;
  returnOrigin: string;
}) {
  const stripe = getStripeServerClient();
  const config = requireStripeConfiguration();
  const existing = await getOrganizationBillingRecord(params.organizationId);

  let stripeCustomerId = existing.stripeCustomerId ?? null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: params.adultEmail ?? undefined,
      metadata: {
        organizationId: params.organizationId,
      },
      name: FOUNDING_HOUSEHOLD_PLAN.name,
    });
    stripeCustomerId = customer.id;
    await updateOrganizationBillingRecord(params.organizationId, {
      stripeCustomerId,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${params.returnOrigin}/account?billing=checkout-complete`,
    cancel_url: `${params.returnOrigin}/account?billing=checkout-canceled`,
    customer: stripeCustomerId,
    client_reference_id: params.organizationId,
    line_items: [
      {
        price: config.annualPriceId,
        quantity: 1,
      },
    ],
    metadata: {
      organizationId: params.organizationId,
      planKey: FOUNDING_HOUSEHOLD_PLAN.key,
    },
    subscription_data: {
      metadata: {
        organizationId: params.organizationId,
        planKey: FOUNDING_HOUSEHOLD_PLAN.key,
      },
      trial_period_days:
        existing.status === "none" || existing.status === "canceled"
          ? FOUNDING_HOUSEHOLD_PLAN.trialDays
          : undefined,
    },
  });

  return session.url;
}

export async function createBillingPortalSession(params: {
  organizationId: string;
  returnOrigin: string;
}) {
  const stripe = getStripeServerClient();
  const existing = await getOrganizationBillingRecord(params.organizationId);

  if (!existing.stripeCustomerId) {
    throw new Error("No Stripe customer is attached to this household.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: existing.stripeCustomerId,
    return_url: `${params.returnOrigin}/account?billing=portal-return`,
  });

  return session.url;
}

function toIsoString(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "unpaid":
      return "unpaid";
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "past_due";
    default:
      return "none";
  }
}

async function syncSubscriptionRecord(
  organizationId: string,
  subscription: Stripe.Subscription,
  customerId?: string | null,
) {
  const price = subscription.items.data[0]?.price?.id ?? null;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end ?? null;

  await updateOrganizationBillingRecord(organizationId, {
    planKey: FOUNDING_HOUSEHOLD_PLAN.key,
    planName: FOUNDING_HOUSEHOLD_PLAN.name,
    billingInterval:
      subscription.items.data[0]?.price?.recurring?.interval === "month" ? "monthly" : "annual",
    status: mapSubscriptionStatus(subscription.status),
    learnerCap: FOUNDING_HOUSEHOLD_PLAN.learnerCap,
    stripeCustomerId: customerId ?? (typeof subscription.customer === "string" ? subscription.customer : null),
    stripeSubscriptionId: subscription.id,
    stripePriceId: price,
    currentPeriodEnd: toIsoString(currentPeriodEnd),
    trialEndsAt: toIsoString(subscription.trial_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

async function resolveOrganizationIdForSubscription(
  subscription: Stripe.Subscription,
  customerId?: string | null,
) {
  const metadataOrganizationId =
    typeof subscription.metadata.organizationId === "string"
      ? subscription.metadata.organizationId
      : null;
  if (metadataOrganizationId) {
    return metadataOrganizationId;
  }

  const bySubscription = await findOrganizationByStripeSubscriptionId(subscription.id);
  if (bySubscription) {
    return bySubscription.id;
  }

  const effectiveCustomerId =
    customerId ?? (typeof subscription.customer === "string" ? subscription.customer : null);
  if (!effectiveCustomerId) {
    return null;
  }

  const byCustomer = await findOrganizationByStripeCustomerId(effectiveCustomerId);
  return byCustomer?.id ?? null;
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId =
        typeof session.metadata?.organizationId === "string" ? session.metadata.organizationId : null;
      if (!organizationId) {
        return;
      }

      await updateOrganizationBillingRecord(organizationId, {
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
        status: session.status === "complete" ? "trialing" : "incomplete",
      });
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = await resolveOrganizationIdForSubscription(subscription);
      if (!organizationId) {
        return;
      }

      await syncSubscriptionRecord(organizationId, subscription);
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) {
        return;
      }

      const organization = await findOrganizationByStripeCustomerId(customerId);
      if (!organization) {
        return;
      }

      await updateOrganizationBillingRecord(organization.id, {
        status: "past_due",
      });
      return;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) {
        return;
      }

      const organization = await findOrganizationByStripeCustomerId(customerId);
      if (!organization) {
        return;
      }

      await updateOrganizationBillingRecord(organization.id, {
        status: "active",
      });
      return;
    }

    default:
      return;
  }
}
