import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PlanningShell } from "@/components/planning/planning-shell";
import { TodayWorkspaceView } from "@/components/planning/today-workspace-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppSession } from "@/lib/app-session/server";
import { listCurriculumSources } from "@/lib/curriculum/service";
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
    const sourceQuery = selectedSourceId
      ? `${redirectQuery ? "&" : "?"}sourceId=${encodeURIComponent(selectedSourceId)}`
      : "";
    redirect(`/today${redirectQuery}${sourceQuery}`);
  }

  const todayDate = date ?? new Date().toISOString().slice(0, 10);
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

  const { workspace } = workspaceResult;
  const totalMinutes = workspace.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);

  return (
    <PlanningShell>
      <div className="mb-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>{formatLongDate(workspace.date)}</span>
        <span>{workspace.items.length} items</span>
        <span>{totalMinutes} min</span>
      </div>
      <TodayWorkspaceView workspace={workspace} sourceId={selectedSourceId} />
    </PlanningShell>
  );
}
