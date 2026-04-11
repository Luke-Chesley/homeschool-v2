"use client";

import { Bug } from "lucide-react";

import { StudioDrawer } from "@/components/studio/StudioDrawer";
import { StudioJsonInspector } from "@/components/studio/StudioJsonInspector";
import { StudioSection } from "@/components/studio/StudioSection";
import { useStudio } from "@/components/studio/studio-provider";
import { Button } from "@/components/ui/button";
import type { ActivityComponentFeedback } from "@/lib/activities/feedback";
import type { ActivityAttempt, ActivitySession } from "@/lib/activities/types";

type RuntimeEventSnapshot = {
  componentId: string;
  componentType: string;
  learnerResponse: unknown;
  result: ActivityComponentFeedback | null;
};

type TransitionEventSnapshot = {
  componentId: string;
  componentType: string;
  learnerAction: unknown;
  currentResponse: unknown;
  result: unknown;
};

export function ActivityStudioPanel({
  session,
  attempt,
  submitted,
  error,
  lastFeedback,
  lastTransition,
}: {
  session: ActivitySession | null;
  attempt: ActivityAttempt | null;
  submitted: boolean;
  error: string | null;
  lastFeedback: RuntimeEventSnapshot | null;
  lastTransition: TransitionEventSnapshot | null;
}) {
  const { access, isEnabled, openPanel } = useStudio();

  if (!isEnabled || !access.canViewRuntimeEvents) {
    return null;
  }

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => openPanel("learner-runtime-diagnostics")}>
          <Bug className="size-3.5" />
          Runtime diagnostics
        </Button>
      </div>

      <StudioDrawer
        panelId="learner-runtime-diagnostics"
        title="Learner runtime diagnostics"
        description="Studio mode keeps the learner flow clean while still exposing the current session, attempt state, and recent runtime exchanges."
      >
        <div className="space-y-6">
          <StudioSection title="Status">
            <dl className="grid gap-3 rounded-lg border border-border/70 bg-muted/25 p-4 text-sm text-foreground sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Session</dt>
                <dd>{session?.id ?? "Unavailable"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attempt</dt>
                <dd>{attempt?.id ?? "Unavailable"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Attempt status</dt>
                <dd>{attempt?.status ?? "Unknown"}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Submitted</dt>
                <dd>{submitted ? "Yes" : "No"}</dd>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Error</dt>
                <dd>{error ?? "None"}</dd>
              </div>
            </dl>
          </StudioSection>

          <StudioJsonInspector title="Session payload" value={session} />
          <StudioJsonInspector title="Attempt payload" value={attempt} />
          <StudioJsonInspector
            title="Most recent feedback exchange"
            value={lastFeedback ?? { status: "No feedback request captured yet." }}
          />
          <StudioJsonInspector
            title="Most recent transition exchange"
            value={lastTransition ?? { status: "No transition request captured yet." }}
          />
        </div>
      </StudioDrawer>
    </>
  );
}
