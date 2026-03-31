import { notFound, redirect } from "next/navigation";

import { PlanningShell } from "@/components/planning/planning-shell";
import { TodayWorkspaceView } from "@/components/planning/today-workspace-view";
import {
  completeTodayPlanItem,
  getTodayWorkspace,
  pushTodayPlanItemToTomorrow,
  removeTodayPlanItem,
  swapTodayPlanItemWithAlternate,
} from "@/lib/planning/service";

interface TodayPageProps {
  searchParams: Promise<{
    date?: string | string[];
    action?: string | string[];
    planItemId?: string | string[];
    alternateWeeklyRouteItemId?: string | string[];
  }>;
}

export default async function TodayPage({ searchParams }: TodayPageProps) {
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

  if (action && planItemId) {
    if (action === "complete") {
      completeTodayPlanItem(planItemId);
    } else if (action === "push_to_tomorrow") {
      pushTodayPlanItemToTomorrow(planItemId);
    } else if (action === "remove_today") {
      removeTodayPlanItem(planItemId);
    } else if (action === "swap_with_alternate" && alternateWeeklyRouteItemId) {
      swapTodayPlanItemWithAlternate(planItemId, alternateWeeklyRouteItemId);
    }

    const redirectQuery = date ? `?date=${encodeURIComponent(date)}` : "";
    redirect(`/today${redirectQuery}`);
  }

  const workspace = getTodayWorkspace(date);

  if (!workspace) {
    notFound();
  }

  return (
    <PlanningShell
      currentView="today"
      title="The daily workspace for running a lesson, not just planning one."
      description="This surface keeps execution, prep, generated-asset placeholders, and tracking handoff on the same screen so the operational day stays coherent."
    >
      <TodayWorkspaceView workspace={workspace} />
    </PlanningShell>
  );
}
