import Link from "next/link";

import { PlanningShell } from "@/components/planning/planning-shell";
import { TodayOpenTracker } from "@/components/planning/TodayOpenTracker";
import { OnboardingLaunchFlash } from "@/components/planning/today/onboarding-launch-flash";
import { TodayWorkspaceView } from "@/components/planning/today-workspace-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { getOrganizationTodayTrackerBaseline } from "@/lib/beta/service";
import { getTodayWorkspaceViewForRender } from "@/lib/planning/today-service";

interface TodayPageProps {
  searchParams: Promise<{
    date?: string | string[];
  }>;
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const session = await requireAppSession();
  const resolvedSearchParams = await searchParams;
  const date =
    typeof resolvedSearchParams.date === "string" ? resolvedSearchParams.date : undefined;
  const todayDate = date ?? new Date().toISOString().slice(0, 10);

  const [trackerBaseline, workspaceResult] = await Promise.all([
    getOrganizationTodayTrackerBaseline(session.organization.id),
    getTodayWorkspaceViewForRender({
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
      learnerName: session.activeLearner.displayName,
      date: todayDate,
    }),
  ]);

  if (!workspaceResult) {
    return (
      <PlanningShell>
        <Card>
          <CardHeader>
            <CardTitle>No curriculum source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import a source before building the day.
            </p>
            <Button asChild>
              <Link href="/curriculum">Open curriculum</Link>
            </Button>
          </CardContent>
        </Card>
      </PlanningShell>
    );
  }

  const { workspace, sessionTiming, sourceId } = workspaceResult;

  return (
    <PlanningShell>
      <TodayOpenTracker
        organizationId={session.organization.id}
        learnerId={session.activeLearner.id}
        date={workspace.date}
        onboardingStartedAt={trackerBaseline.onboardingStartedAt}
      />
      <header className="page-header gap-1 pb-3">
        <p className="section-meta">{formatLongDate(workspace.date)}</p>
        <h1 className="page-title">Today</h1>
        <div className="toolbar-row text-sm text-muted-foreground">
          <span>{workspace.items.length} lesson slots</span>
          <span>{sessionTiming.resolvedTotalMinutes} min</span>
        </div>
      </header>
      <OnboardingLaunchFlash />
      <TodayWorkspaceView workspace={workspace} sourceId={sourceId} />
    </PlanningShell>
  );
}
