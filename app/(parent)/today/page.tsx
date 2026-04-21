import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { PlanningShell } from "@/components/planning/planning-shell";
import { TodayOpenTracker } from "@/components/planning/TodayOpenTracker";
import { OnboardingLaunchFlash } from "@/components/planning/today/onboarding-launch-flash";
import { TodayWorkspaceView } from "@/components/planning/today-workspace-view";
import { Button } from "@/components/ui/button";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { requireAppSession } from "@/lib/app-session/server";
import { getOrganizationTodayTrackerBaseline } from "@/lib/beta/service";
import { getTodayWorkspaceViewForRender } from "@/lib/planning/today-service";
import { buildTodayWorkspaceDaySummary } from "@/lib/planning/today-workspace-summary";

interface TodayPageProps {
  searchParams: Promise<{
    date?: string | string[];
  }>;
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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
        <EmptyStatePanel
          title="Build the first teachable day."
          body="Add a curriculum source first so Today can turn it into a workable lesson, a clear queue, and a calmer week."
          icon={BookOpen}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Link href="/curriculum" className="quiet-panel-muted p-4 text-left transition-colors hover:bg-card/80">
              <p className="text-sm font-semibold text-foreground">Add curriculum</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Import a source or start a curriculum conversation.
              </p>
            </Link>
            <Link href="/planning" className="quiet-panel-muted p-4 text-left transition-colors hover:bg-card/80">
              <p className="text-sm font-semibold text-foreground">Open planning</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Review the weekly board once a source is live.
              </p>
            </Link>
            <div className="quiet-panel-muted p-4 text-left">
              <p className="text-sm font-semibold text-foreground">Stay lightweight</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start with one learner, one source, and one good day.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Button asChild>
              <Link href="/curriculum">
                Open curriculum
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </EmptyStatePanel>
      </PlanningShell>
    );
  }

  const { workspace, sessionTiming, sourceId } = workspaceResult;
  const daySummary = buildTodayWorkspaceDaySummary(workspace);

  return (
    <PlanningShell>
      <TodayOpenTracker
        organizationId={session.organization.id}
        learnerId={session.activeLearner.id}
        date={workspace.date}
        onboardingStartedAt={trackerBaseline.onboardingStartedAt}
      />
      <header className="space-y-3 border-b border-border/70 pb-5">
        <p className="section-meta">{formatLongDate(workspace.date)}</p>
        <h1 className="page-title">Today</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{formatCount(daySummary.skillCount, "skill")}</span>
          <span>{formatCount(daySummary.lessonSlotCount, "lesson slot")}</span>
          <span>{`${daySummary.totalMinutes || sessionTiming.resolvedTotalMinutes} min`}</span>
        </div>
      </header>
      <OnboardingLaunchFlash />
      <TodayWorkspaceView workspace={workspace} sourceId={sourceId} />
    </PlanningShell>
  );
}
