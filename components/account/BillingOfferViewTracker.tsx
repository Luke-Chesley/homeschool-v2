"use client";

import { useEffect } from "react";

import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";

export function BillingOfferViewTracker({
  organizationId,
  learnerId,
  billingStatus,
}: {
  organizationId: string;
  learnerId: string | null;
  billingStatus: string;
}) {
  useEffect(() => {
    trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.billingOfferViewed,
      organizationId,
      learnerId,
      metadata: {
        source: "account",
        billingStatus,
      },
    });
  }, [billingStatus, learnerId, organizationId]);

  return null;
}
