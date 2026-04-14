import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppApiSession } from "@/lib/app-session/server";
import {
  applyLocalBillingSandboxAction,
  getBillingConfiguration,
} from "@/lib/billing/service";
import { LocalBillingSandboxActionSchema } from "@/lib/billing/types";
import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";

const BillingDevSchema = z.object({
  action: LocalBillingSandboxActionSchema,
});

export async function POST(request: NextRequest) {
  const session = await requireAppApiSession({ requireLearner: false });
  const config = getBillingConfiguration();
  const destination = new URL("/account", request.url);

  if (!config.localSandboxEnabled) {
    destination.searchParams.set("billing", "sandbox-disabled");
    return NextResponse.redirect(destination, 303);
  }

  const formData = await request.formData();
  const parsed = BillingDevSchema.safeParse({
    action: formData.get("action"),
  });

  if (!parsed.success) {
    destination.searchParams.set("billing", "sandbox-invalid");
    return NextResponse.redirect(destination, 303);
  }

  await applyLocalBillingSandboxAction(session.organization.id, parsed.data.action);

  const eventName =
    parsed.data.action === "start_trial"
      ? ACTIVATION_EVENT_NAMES.trialStarted
      : parsed.data.action === "activate" || parsed.data.action === "reactivate"
        ? ACTIVATION_EVENT_NAMES.subscriptionActivated
        : parsed.data.action === "past_due"
          ? ACTIVATION_EVENT_NAMES.subscriptionPaymentFailed
          : parsed.data.action === "cancel"
            ? ACTIVATION_EVENT_NAMES.subscriptionCanceled
            : null;

  if (eventName) {
    trackProductEvent({
      name: eventName,
      organizationId: session.organization.id,
      learnerId: session.activeLearner?.id ?? null,
      metadata: {
        source: "local_sandbox",
        action: parsed.data.action,
      },
    });
  }

  destination.searchParams.set("billing", "sandbox-updated");
  return NextResponse.redirect(destination, 303);
}
