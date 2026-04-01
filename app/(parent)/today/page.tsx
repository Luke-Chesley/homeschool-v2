import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CalendarDays, LayoutDashboard, Sparkles } from "lucide-react";

import { PlanningShell } from "@/components/planning/planning-shell";
import {
  TodayLessonPlanSection,
  TodayRouteItemsSection,
} from "@/components/planning/today-workspace-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { listCurriculumSources } from "@/lib/curriculum/service";
import { toWeekStartDate } from "@/lib/curriculum-routing";
import {
  completeTodayPlanItem,
  getTodayWorkspace,
  pushTodayPlanItemToTomorrow,
  removeTodayPlanItem,
  swapTodayPlanItemWithAlternate,
} from "@/lib/planning/today-service";

interface TodayPageProps {
  searchParams: Promise<{
    date?: string | string[];
    sourceId?: string | string[];
    action?: string | string[];
    planItemId?: string | string[];
    alternateWeeklyRouteItemId?: string | string[];
  }>;
}

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const session = await requireAppSession();
  const resolvedSearchParams = await searchParams;
  const date =
    typeof resolvedSearchParams.date === "string" ? resolvedSearchParams.date : undefined;
  const sourceId =
    typeof resolvedSearchParams.sourceId === "string" ? resolvedSearchParams.sourceId : undefined;
  const action =
    typeof resolvedSearchParams.action === "string" ? resolvedSearchParams.action : undefined;
  const planItemId =
    typeof resolvedSearchParams.planItemId === "string"
      ? resolvedSearchParams.planItemId
      : undefined;
  const alternateWeeklyRouteItemId =
    typeof resolvedSearchParams.alternateWeeklyRouteItemId === "string"
      ? resolvedSearchParams.alternateWeeklyRouteItemId
      : undefined;
  const sources = await listCurriculumSources(session.organization.id);
  const selectedSourceId =
    sourceId && sources.some((source) => source.id === sourceId) ? sourceId : sources[0]?.id;

  if (sources.length === 0) {
    return (
      <PlanningShell
        currentView="today"
        title={`${session.activeLearner.displayName}'s daily workspace`}
        description="Import a curriculum source to turn today into a real route."
      >
        <Card>
          <CardHeader>
            <CardTitle>No curriculum source available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import a curriculum source first so today can load real route items for the active learner.
            </p>
            <Button asChild>
              <Link href="/curriculum">Open curriculum</Link>
            </Button>
          </CardContent>
        </Card>
      </PlanningShell>
    );
  }

  if (action && planItemId) {
    if (action === "complete") {
      await completeTodayPlanItem(session.activeLearner.id, planItemId);
    } else if (action === "push_to_tomorrow") {
      await pushTodayPlanItemToTomorrow(session.activeLearner.id, planItemId, date ?? new Date().toISOString().slice(0, 10));
    } else if (action === "remove_today") {
      await removeTodayPlanItem(session.activeLearner.id, planItemId, date ?? new Date().toISOString().slice(0, 10));
    } else if (action === "swap_with_alternate" && alternateWeeklyRouteItemId) {
      await swapTodayPlanItemWithAlternate(
        session.activeLearner.id,
        planItemId,
        alternateWeeklyRouteItemId,
        date ?? new Date().toISOString().slice(0, 10),
      );
    }

    const redirectQuery = date ? `?date=${encodeURIComponent(date)}` : "";
    const sourceQuery = selectedSourceId ? `${redirectQuery ? "&" : "?"}sourceId=${encodeURIComponent(selectedSourceId)}` : "";
    redirect(`/today${redirectQuery}${sourceQuery}`);
  }

  const todayDate = date ?? new Date().toISOString().slice(0, 10);
  const todayWeekStartDate = toWeekStartDate(todayDate);
  const navItems = selectedSourceId
    ? [
        {
          href: `/planning/month?sourceId=${selectedSourceId}&month=${encodeURIComponent(todayDate)}`,
          label: "Month planning",
          view: "month" as const,
          icon: CalendarDays,
        },
        {
          href: `/planning?sourceId=${selectedSourceId}&weekStartDate=${encodeURIComponent(todayWeekStartDate)}`,
          label: "Weekly planning",
          view: "week" as const,
          icon: CalendarClock,
        },
        {
          href: `/planning/day/${todayWeekStartDate}`,
          label: "Daily plan",
          view: "day" as const,
          icon: LayoutDashboard,
        },
        {
          href: `/today?date=${encodeURIComponent(todayDate)}${selectedSourceId ? `&sourceId=${encodeURIComponent(selectedSourceId)}` : ""}`,
          label: "Today workspace",
          view: "today" as const,
          icon: Sparkles,
        },
      ]
    : undefined;
  const workspaceResult = await getTodayWorkspace({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    date: todayDate,
    sourceId: selectedSourceId,
  });

  if (!workspaceResult) {
    notFound();
  }

  const { workspace, sourceTitle } = workspaceResult;
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  return (
    <PlanningShell
      currentView="today"
      title={`${workspace.learner.name}'s daily workspace`}
      description={`Active source: ${sourceTitle}. This surface keeps execution, prep, and tracking handoff on the same screen.`}
      navItems={navItems}
      headerSupplement={
        <div className="rounded-[1.5rem] border border-border/70 bg-background/72 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{workspace.leadItem.sourceLabel}</Badge>
            <Badge variant="secondary">{workspace.items.length} items</Badge>
            <Badge variant="secondary">{totalMinutes} min</Badge>
            <Badge variant="secondary">
              {workspace.sessionTargets.length} objective
              {workspace.sessionTargets.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Curriculum overview</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {workspace.items.length} curriculum item{workspace.items.length === 1 ? "" : "s"} are in scope for today from{" "}
                {workspace.leadItem.sourceLabel}.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/curriculum${selectedSourceId ? `?sourceId=${encodeURIComponent(selectedSourceId)}` : ""}`}>
                Review curriculum
              </Link>
            </Button>
          </div>
          <TodayRouteItemsSection workspace={workspace} sourceId={selectedSourceId} embedded />
        </div>
      }
    >
      <TodayLessonPlanSection workspace={workspace} sourceId={selectedSourceId} />
    </PlanningShell>
  );
}
