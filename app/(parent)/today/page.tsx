import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PlanningShell } from "@/components/planning/planning-shell";
import { TodayWorkspaceView } from "@/components/planning/today-workspace-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { getLiveCurriculumSource } from "@/lib/curriculum/service";
import {
  completeTodayPlanItem,
  getTodayWorkspace,
  repeatTodayPlanItemTomorrow,
  pushTodayPlanItemToTomorrow,
  removeTodayPlanItem,
  swapTodayPlanItemWithAlternate,
} from "@/lib/planning/today-service";

interface TodayPageProps {
  searchParams: Promise<{
    date?: string | string[];
    action?: string | string[];
    planItemId?: string | string[];
    alternateWeeklyRouteItemId?: string | string[];
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
  const liveSource = await getLiveCurriculumSource(session.organization.id);

  if (!liveSource) {
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

  if (action && planItemId) {
    if (action === "complete") {
      await completeTodayPlanItem({
        organizationId: session.organization.id,
        learnerId: session.activeLearner.id,
        weeklyRouteItemId: planItemId,
        date: date ?? new Date().toISOString().slice(0, 10),
      });
    } else if (action === "push_to_tomorrow") {
      await pushTodayPlanItemToTomorrow(
        session.activeLearner.id,
        planItemId,
        date ?? new Date().toISOString().slice(0, 10),
      );
    } else if (action === "repeat_tomorrow") {
      await repeatTodayPlanItemTomorrow(
        session.activeLearner.id,
        planItemId,
        date ?? new Date().toISOString().slice(0, 10),
      );
    } else if (action === "remove_today") {
      await removeTodayPlanItem(
        session.activeLearner.id,
        planItemId,
        date ?? new Date().toISOString().slice(0, 10),
      );
    } else if (action === "swap_with_alternate" && alternateWeeklyRouteItemId) {
      await swapTodayPlanItemWithAlternate(
        session.activeLearner.id,
        planItemId,
        alternateWeeklyRouteItemId,
        date ?? new Date().toISOString().slice(0, 10),
      );
    }

    const redirectQuery = date ? `?date=${encodeURIComponent(date)}` : "";
    redirect(`/today${redirectQuery}`);
  }

  const todayDate = date ?? new Date().toISOString().slice(0, 10);
  const workspaceResult = await getTodayWorkspace({
    organizationId: session.organization.id,
    learnerId: session.activeLearner.id,
    learnerName: session.activeLearner.displayName,
    date: todayDate,
  });

  if (!workspaceResult) {
    notFound();
  }

  const { workspace } = workspaceResult;
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  return (
    <PlanningShell>
      <div className="mb-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Live curriculum: {liveSource.title}</span>
        <span>{formatLongDate(workspace.date)}</span>
        <span>{workspace.items.length} items</span>
        <span>{totalMinutes} min</span>
      </div>
      <TodayWorkspaceView workspace={workspace} sourceId={liveSource.id} />
    </PlanningShell>
  );
}
