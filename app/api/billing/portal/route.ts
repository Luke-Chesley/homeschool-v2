import { NextRequest, NextResponse } from "next/server";

import { requireAppApiSession } from "@/lib/app-session/server";
import { getBillingConfiguration } from "@/lib/billing/service";
import { createBillingPortalSession } from "@/lib/billing/stripe";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";

export async function POST(request: NextRequest) {
  const session = await requireAppApiSession({ requireLearner: false });
  const destination = new URL("/account", request.url);
  const config = getBillingConfiguration();

  if (!config.hasStripeConfiguration) {
    destination.searchParams.set("billing", "not-configured");
    return NextResponse.redirect(destination, 303);
  }

  try {
    const portalUrl = await createBillingPortalSession({
      organizationId: session.organization.id,
      returnOrigin: new URL(request.url).origin,
    });

    await trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.billingPortalOpened,
      organizationId: session.organization.id,
      learnerId: session.activeLearner?.id ?? null,
      metadata: {
        source: "account",
      },
    });

    return NextResponse.redirect(portalUrl, 303);
  } catch {
    destination.searchParams.set("billing", "portal-error");
    return NextResponse.redirect(destination, 303);
  }
}
