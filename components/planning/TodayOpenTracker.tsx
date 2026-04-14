"use client";

import { useEffect } from "react";

import { ACTIVATION_EVENT_NAMES } from "@/lib/homeschool/onboarding/activation-contracts";
import { trackProductEvent } from "@/lib/platform/observability";

function toUtcStartOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function TodayOpenTracker({
  organizationId,
  learnerId,
  date,
  onboardingStartedAt,
}: {
  organizationId: string;
  learnerId: string;
  date: string;
  onboardingStartedAt?: string | null;
}) {
  useEffect(() => {
    const metadata: Record<string, unknown> = {
      source: "today_page",
      date,
    };

    if (onboardingStartedAt) {
      const start = toUtcStartOfDay(onboardingStartedAt.slice(0, 10));
      const current = toUtcStartOfDay(date);
      const daysSinceStart = Math.round(
        (current.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (daysSinceStart === 1) {
        metadata.returnDayMarker = "day_2";
      } else if (daysSinceStart === 6) {
        metadata.returnDayMarker = "day_7";
      }
    }

    void trackProductEvent({
      name: ACTIVATION_EVENT_NAMES.todayOpened,
      organizationId,
      learnerId,
      metadata,
    });
  }, [date, learnerId, onboardingStartedAt, organizationId]);

  return null;
}
