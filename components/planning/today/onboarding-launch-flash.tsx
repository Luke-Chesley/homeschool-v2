"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { consumeOnboardingLaunchSummary, type OnboardingLaunchSummary } from "@/lib/homeschool/onboarding/launch-summary";

export function OnboardingLaunchFlash() {
  const [summary, setSummary] = React.useState<OnboardingLaunchSummary | null>(null);

  React.useEffect(() => {
    setSummary(consumeOnboardingLaunchSummary());
  }, []);

  if (!summary) {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">Onboarding setup ready</p>
          <p className="break-words">{summary.summaryText}</p>
          {summary.scopeSummary ? (
            <p className="text-emerald-900/80 break-words">{summary.scopeSummary}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSummary(null)}
          className="shrink-0 text-emerald-950 hover:bg-emerald-100"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
