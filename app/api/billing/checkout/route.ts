import { NextRequest, NextResponse } from "next/server";

import { requireAppApiSession } from "@/lib/app-session/server";
import {
  FOUNDING_HOUSEHOLD_PLAN,
  applyLocalBillingSandboxAction,
  getBillingConfiguration,
} from "@/lib/billing/service";
import { createBillingCheckoutSession } from "@/lib/billing/stripe";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";

export async function POST(request: NextRequest) {
  const session = await requireAppApiSession({ requireLearner: false });
  const organizationId = session.organization.id;
  const destination = new URL("/account", request.url);
  const config = getBillingConfiguration();

  trackProductEvent({
    name: ACTIVATION_EVENT_NAMES.checkoutStarted,
    organizationId,
    learnerId: session.activeLearner?.id ?? null,
    metadata: {
      source: "account",
      planKey: FOUNDING_HOUSEHOLD_PLAN.key,
    },
  });

  if (config.hasStripeConfiguration) {
    try {
      const checkoutUrl = await createBillingCheckoutSession({
        organizationId,
        adultEmail: session.adultUser.email,
        returnOrigin: new URL(request.url).origin,
      });

      if (checkoutUrl) {
        return NextResponse.redirect(checkoutUrl, 303);
      }
    } catch {
      destination.searchParams.set("billing", "checkout-error");
      return NextResponse.redirect(destination, 303);
    }
  }

  if (config.localSandboxEnabled) {
    await applyLocalBillingSandboxAction(organizationId, "start_trial");

    trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.trialStarted,
      organizationId,
      learnerId: session.activeLearner?.id ?? null,
      metadata: {
        source: "local_sandbox",
        trialDays: FOUNDING_HOUSEHOLD_PLAN.trialDays,
      },
    });

    destination.searchParams.set("billing", "trial-started");
    return NextResponse.redirect(destination, 303);
  }

  destination.searchParams.set("billing", "not-configured");
  return NextResponse.redirect(destination, 303);
}
